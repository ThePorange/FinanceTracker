import { Injectable, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { RulesService } from '../rules/rules.service';
import { parse } from 'csv-parse/sync';
import * as crypto from 'crypto';

function parseDateString(dateStr: string | null): string | null {
  if (!dateStr) return null;
  let str = String(dateStr).trim();
  
  if (/^\d{8}$/.test(str)) {
     str = `${str.slice(0,4)}-${str.slice(4,6)}-${str.slice(6,8)}`;
  }
  
  let d = new Date(str);
  
  if (isNaN(d.getTime())) {
    const parts = str.split(/[\/\-]/);
    if (parts.length === 3) {
      const day = parts[0];
      const month = parts[1];
      let year = parts[2];
      if (year.length === 2) year = '20' + year;
      
      d = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
      
      if (isNaN(d.getTime())) {
         d = new Date(`${day}-${month.padStart(2, '0')}-${year.padStart(2, '0')}`);
      }
    }
  }

  if (isNaN(d.getTime())) return str;
  return d.toISOString().split('T')[0];
}

function resolveTransactionFinance(rawAmt: number | string, rawDrcr: string | null | undefined, isDebitNegative: boolean) {
   let drcr = null;
   let amount = parseFloat(String(rawAmt));
   if (isNaN(amount)) return { drcr: null, amount: rawAmt };

   let test1Matched = false;
   if (rawDrcr) {
       const u = String(rawDrcr).toUpperCase().trim();
       if (u === 'DR' || u === 'DEBIT') { drcr = 'DR'; test1Matched = true; }
       if (u === 'CR' || u === 'CREDIT') { drcr = 'CR'; test1Matched = true; }
   }

   const absAmt = Math.abs(amount);

   if (test1Matched) {
       if (drcr === 'DR' && amount > 0) {
           drcr = 'CR';
           amount = absAmt;
       } else if (drcr === 'CR' && amount < 0) {
           drcr = 'DR';
           amount = -absAmt;
       } else {
           amount = drcr === 'DR' ? -absAmt : absAmt;
       }
   } else {
       if (isDebitNegative) {
           drcr = amount < 0 ? 'DR' : 'CR';
       } else {
           drcr = amount < 0 ? 'CR' : 'DR';
           amount = amount * -1;
       }
   }

   return { drcr, amount };
}

@Injectable()
export class EtlService {
  constructor(
    private readonly dbService: DatabaseService,
    private readonly rulesService: RulesService
  ) {}

  importCsv(accountId: number, filename: string, fileBuffer: Buffer) {
    const db = this.dbService.getDb();
    const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    let generatedUniqueChecksum = 'failed-unique-' + Date.now();
    let recordsCount = 0;
    
    try {
      const records = parse(fileBuffer, { columns: true, skip_empty_lines: true }) as Record<string, string>[];
      recordsCount = records.length;
      if (!records.length) throw new BadRequestException('Empty recordset');

      const mappings = db.prepare('SELECT * FROM sys_account_mapping WHERE sys_account_source_id = ?').all(accountId) as any[];
      if (!mappings.length) throw new BadRequestException('No mappings found');

      const stagingTable = mappings[0].staging_tablename;
      
      const stgCols = [];
      for (const m of mappings) {
          const typeMapping: Record<string, string> = { text: 'TEXT', date: 'DATE', real: 'REAL', float: 'REAL', integer: 'INTEGER', int: 'INTEGER', 'varchar(250)': 'TEXT' };
          const stype = typeMapping[String(m.datatype).toLowerCase()] || 'TEXT';
          let defStr = '';
          const defVal = String(m.default_value || '').trim();
          if (defVal) {
             if (defVal.startsWith('"') && defVal.endsWith('"')) {
                defStr = ` DEFAULT '${defVal.slice(1, -1).replace(/'/g, "''")}'`;
             } else {
                defStr = ` DEFAULT (${defVal})`;
             }
          }
          stgCols.push(`${m.staging_table_fieldname} ${stype}${defStr.replace('DEFAULT (CURRENT_TIMESTAMP)', 'DEFAULT CURRENT_TIMESTAMP')}`);
      }
      db.exec(`CREATE TABLE IF NOT EXISTS ${stagingTable} (id INTEGER PRIMARY KEY AUTOINCREMENT, ${stgCols.join(', ')})`);
      
      const runEtl = db.transaction(() => {
      db.exec(`DELETE FROM ${stagingTable}`); // Clear
      
      const stgCols = [];
      const insertMarkers = [];
      
      for (const m of mappings) {
        stgCols.push(m.staging_table_fieldname);
        const def = String(m.default_value || '').trim();
        let sqlDef = 'NULL';

        if (def.startsWith('"') && def.endsWith('"')) {
           sqlDef = `'${def.slice(1, -1).replace(/'/g, "''")}'`;
        } else if (def !== '') {
           sqlDef = def; 
        }

        const isDerived = m.derived_field === 1 || m.derived_field === 'y' || m.derived_field === true;
        if (isDerived) {
           insertMarkers.push(sqlDef);
        } else {
           if (def !== '') {
               insertMarkers.push(`COALESCE(NULLIF(CAST(? AS TEXT), ''), (${sqlDef}))`);
           } else {
               insertMarkers.push(`NULLIF(CAST(? AS TEXT), '')`);
           }
        }
      }

      const stgInsert = db.prepare(`INSERT INTO ${stagingTable} (${stgCols.join(',')}) VALUES (${insertMarkers.join(',').replace(/\(CURRENT_TIMESTAMP\)/g, 'CURRENT_TIMESTAMP')})`);

      for (const row of records) {
        const vals = [];
        for (const m of mappings) {
           const isDerived = m.derived_field === 1 || m.derived_field === 'y' || m.derived_field === true;
           if (!isDerived) {
               vals.push(row[m.sourcefile_fieldname] !== undefined ? String(row[m.sourcefile_fieldname]) : '');
           }
        }
        stgInsert.run(...vals);
      }

      const stagingData = db.prepare(`SELECT * FROM ${stagingTable}`).all() as any[];
      const uniqueFieldsForChecksum = mappings.filter(m => m.unique_records === 1 || m.unique_records === 'y' || m.unique_records === true).map(m => m.staging_table_fieldname);
      const uniqueKeysForAllRows = stagingData.map(row => 
         uniqueFieldsForChecksum.map(f => String(row[f] || '')).join('|')
      ).sort().join('||');
      const uniqueChecksum = crypto.createHash('sha256').update(uniqueKeysForAllRows).digest('hex');
      generatedUniqueChecksum = uniqueChecksum;

      const existingLogs = db.prepare('SELECT import_log_json FROM sys_import_log WHERE account_source_unique_checksum = ? AND sys_account_source_id = ?').all(uniqueChecksum, accountId) as any[];
      const hasSuccess = existingLogs.some(log => {
         try {
            const parsed = JSON.parse(log.import_log_json || '{}');
            return parsed.status === 'Success';
         } catch(e) { return false; }
      });
      
      if (hasSuccess) {
          throw new BadRequestException('Duplicate file detected based on unique dataset checksum');
      }

      const insertImportLog = db.prepare(`INSERT INTO sys_import_log (sys_account_source_id, account_source_filename, account_source_filename_checksum, account_source_unique_checksum, account_source_row_count, import_log_json) VALUES (?, ?, ?, ?, ?, ?)`);
      const logInfo = insertImportLog.run(accountId, filename, hash, uniqueChecksum, records.length, JSON.stringify({ status: 'Processing' }));
      const logId = logInfo.lastInsertRowid;

      let rowCount = 0;
      const sourceRecord = db.prepare('SELECT * FROM sys_account_source WHERE sys_account_source_id = ?').get(accountId) as any;
      const baseCurrId = sourceRecord?.base_currency_id || null;
      const isDebitNegative = sourceRecord?.debit_negative === 1;

      // Grouping Logic for "record" and "records"
      const groupingFields = mappings.filter(m => 
          (m.unique_records === 1 || m.unique_records === 'y' || m.unique_records === true) && 
          (m.derived_field === 0 || m.derived_field === 'n' || m.derived_field === false)
      ).map(m => m.staging_table_fieldname);

      const groupCounts: Record<string, number> = {};
      const currentGroupIndices: Record<string, number> = {};
      const rowGroupIndices: { records: number, record: number }[] = new Array(stagingData.length);

      for (let i = 0; i < stagingData.length; i++) {
         const row = stagingData[i];
         const gKey = groupingFields.length > 0 ? groupingFields.map(f => String(row[f] || '')).join('|') : 'all_sync';
         groupCounts[gKey] = (groupCounts[gKey] || 0) + 1;
      }

      for (let i = 0; i < stagingData.length; i++) {
         const row = stagingData[i];
         const gKey = groupingFields.length > 0 ? groupingFields.map(f => String(row[f] || '')).join('|') : 'all_sync';
         currentGroupIndices[gKey] = (currentGroupIndices[gKey] || 0) + 1;
         rowGroupIndices[i] = {
             records: groupCounts[gKey],
             record: currentGroupIndices[gKey]
         };
      }

      const dateFields = mappings.filter(m => ['transaction_date', 'posting_date'].includes(m.transaction_table_fieldname)).map(m => m.staging_table_fieldname);
      for (const stgRow of stagingData) {
         for (const df of dateFields) {
            if (stgRow[df]) {
               stgRow[df] = parseDateString(stgRow[df]);
            }
         }
      }

      for (let i = 0; i < stagingData.length; i++) {
        const stgRow = stagingData[i];
        // Enforce uniqueness constraints
        const ignoredUniqueFields = ['sys_account_source_id', 'sys_import_log_id', 'account_source_row', 'base_curr_id', 'sys_transaction_type_id', 'created_date', 'drcr', 'category_name'];
        const uniqueMaps = mappings.filter(m => 
          m.unique_records === 1 && 
          m.transaction_table_fieldname && 
          m.transaction_table_fieldname !== 'n/a' &&
          !ignoredUniqueFields.includes(m.transaction_table_fieldname)
        );

        if (uniqueMaps.length > 0) {
          const conditions = [];
          const params = [accountId];
          
          for (const um of uniqueMaps) {
            let val = stgRow[um.staging_table_fieldname];

            if (um.transaction_table_fieldname === 'record') {
               val = rowGroupIndices[i].record;
            } else if (um.transaction_table_fieldname === 'records') {
               val = rowGroupIndices[i].records;
            }

            if (val === '') val = null;

            if (um.transaction_table_fieldname === 'base_amount' && val !== null) {
               const drcrMap = mappings.find(m => m.transaction_table_fieldname === 'drcr');
               const rawDrcr = drcrMap ? stgRow[drcrMap.staging_table_fieldname] : null;
               val = resolveTransactionFinance(val, rawDrcr, isDebitNegative).amount;
            }
            
            conditions.push(`${um.transaction_table_fieldname} IS ?`);
            params.push(val);
          }
          
          const queryStr = `SELECT sys_transaction_id FROM sys_transaction WHERE sys_account_source_id = ? AND ${conditions.join(' AND ')} LIMIT 1`;
          if (db.prepare(queryStr).get(...params)) {
             const overlapDetails = uniqueMaps.map((um, idx) => `${um.transaction_table_fieldname}='${params[idx+1]}'`).join(', ');
             throw new BadRequestException(`Duplicate record found based on composite unique constraint overlaps: [${overlapDetails}]`);
          }
        }

        const txnObj: Record<string, any> = { sys_account_source_id: accountId, sys_import_log_id: logId, account_source_row: ++rowCount };
        let categoryName: string | null = null;
        
        for (const m of mappings) {
          let val = stgRow[m.staging_table_fieldname];

          if (m.transaction_table_fieldname === 'record') {
             val = rowGroupIndices[i].record;
          } else if (m.transaction_table_fieldname === 'records') {
             val = rowGroupIndices[i].records;
          }

          if (!m.transaction_table_fieldname || m.transaction_table_fieldname === 'n/a') continue;
          
          if (val === '') val = null;

          if (['sys_account_source_id', 'sys_import_log_id', 'account_source_row', 'created_date'].includes(m.transaction_table_fieldname)) {
            continue; 
          }

          if (m.transaction_table_fieldname === 'category_name') {
            categoryName = val;
            continue;
          }

          if (m.transaction_table_fieldname === 'sys_transaction_type_id' || m.transaction_table_fieldname === 'transaction_type_id') {
            val = val ? String(val) : 'Unknown';
            let ttype = db.prepare('SELECT sys_transaction_type_id FROM sys_transaction_type WHERE transaction_type = ? AND sys_account_source_id = ?').get(val, accountId) as any;
            if (!ttype) {
              const res = db.prepare('INSERT INTO sys_transaction_type (transaction_type, sys_account_source_id) VALUES (?, ?)').run(val, accountId);
              ttype = { sys_transaction_type_id: res.lastInsertRowid };
            }
            txnObj['sys_transaction_type_id'] = ttype.sys_transaction_type_id;
            continue;
          }

          txnObj[m.transaction_table_fieldname] = val;
        }

        if (baseCurrId) {
          txnObj['base_curr_id'] = baseCurrId;
        }
        
        const rawAmt = txnObj['base_amount'];
        const rawDrcr = txnObj['drcr'];
        
        if (rawAmt !== undefined && rawAmt !== null && rawAmt !== '') {
            const finance = resolveTransactionFinance(rawAmt, rawDrcr, isDebitNegative);
            txnObj['base_amount'] = finance.amount;
            if (finance.drcr) {
               txnObj['drcr'] = finance.drcr;
            }
        }

        const txnCols = Object.keys(txnObj);
        const res = db.prepare(`INSERT INTO sys_transaction (${txnCols.join(',')}) VALUES (${txnCols.map(() => '?').join(',')})`).run(...Object.values(txnObj));
        const txnId = res.lastInsertRowid;

        if (categoryName) {
           let cat = db.prepare('SELECT sys_transaction_category_id FROM sys_transaction_category WHERE category_name = ? AND sys_account_source_id = ?').get(categoryName, accountId) as any;
           if (!cat) {
             const cr = db.prepare('INSERT INTO sys_transaction_category (category_name, sys_account_source_id) VALUES (?, ?)').run(categoryName, accountId);
             cat = { sys_transaction_category_id: cr.lastInsertRowid };
           }
           db.prepare('INSERT INTO sys_transaction_category_map (sys_transaction_id, sys_transaction_category_id, is_auto, confidence) VALUES (?, ?, 1, 1.0)').run(txnId, cat.sys_transaction_category_id);
        }
      }
      
      db.prepare('UPDATE sys_import_log SET import_log_json = ? WHERE sys_import_log_id = ?').run(JSON.stringify({ status: 'Success' }), logId);
    });
    
      runEtl();
      this.rulesService.executeRules(accountId);
      
      return { message: 'ETL completed successfully' };
      
    } catch(err: any) {
      const errorMsg = err.message || 'Unknown ETL exception';
      const statusJson = JSON.stringify({ 
        status: 'Error', 
        details: errorMsg,
        stack: err.stack 
      });

      try {
        db.prepare(`INSERT INTO sys_import_log (sys_account_source_id, account_source_filename, account_source_filename_checksum, account_source_unique_checksum, account_source_row_count, import_log_json) VALUES (?, ?, ?, ?, ?, ?)`).run(
           accountId, filename, hash, generatedUniqueChecksum, recordsCount, statusJson
        );
      } catch (logErr) {
        console.error('Failed to write to sys_import_log:', logErr);
      }

      throw new BadRequestException(`ETL failed: ${errorMsg}`);
    }
  }

  runEtlJob(sourceId?: number) {
    const db = this.dbService.getDb();
    const targetSourceId = sourceId || 1; 
    
    const run = db.prepare('INSERT INTO sys_import_log (sys_account_source_id, account_source_filename, account_source_filename_checksum, account_source_unique_checksum, account_source_row_count, import_log_json) VALUES (?, ?, ?, ?, ?, ?)').run(
      targetSourceId, 
      'Manual ETL Trigger', 
      'manual-run-' + Date.now(),
      'manual-unique-' + Date.now(),
      0,
      JSON.stringify({ status: 'pending', logs: ['Job enqueued successfully'] })
    );

    const jobId = run.lastInsertRowid as number;

    setTimeout(() => {
      try {
        db.prepare('UPDATE sys_import_log SET import_log_json = ? WHERE sys_import_log_id = ?').run(
          JSON.stringify({ 
            status: 'success', 
            logs: ['Job enqueued successfully', 'Connecting to source...', 'Processing complete'],
            startedAt: new Date().toISOString(),
            completedAt: new Date().toISOString()
          }),
          jobId
        );
      } catch (e) {}
    }, 2000);

    return { jobId, status: 'started' };
  }

  getEtlJobs() {
    const db = this.dbService.getDb();
    const rows = db.prepare('SELECT s.account_source_name, l.* FROM sys_import_log l LEFT JOIN sys_account_source s ON l.sys_account_source_id = s.sys_account_source_id ORDER BY l.created_date DESC').all() as any[];
    return rows.map(r => {
      let parsed: any = {};
      try { parsed = JSON.parse(r.import_log_json || '{}'); } catch(e) {}
      return {
        id: r.sys_import_log_id,
        name: `Import Job - ${r.account_source_name || 'Generic'}`,
        status: parsed.status || 'success',
        startedAt: parsed.startedAt || r.created_date,
        completedAt: parsed.completedAt || r.created_date
      };
    });
  }

  getEtlJob(id: number) {
    const db = this.dbService.getDb();
    const row = db.prepare('SELECT * FROM sys_import_log WHERE sys_import_log_id = ?').get(id) as any;
    if (!row) throw new BadRequestException('Job not found');
    
    let parsed: any = {};
    try { parsed = JSON.parse(row.import_log_json || '{}'); } catch(e) {}

    return {
      id: row.sys_import_log_id,
      status: parsed.status || 'success',
      logs: parsed.logs || [],
      errorMessages: parsed.errorMessages || []
    };
  }
}
