import { Injectable, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { parse } from 'csv-parse/sync';
import * as crypto from 'crypto';

@Injectable()
export class EtlService {
  constructor(private readonly dbService: DatabaseService) {}

  importCsv(accountId: number, filename: string, fileBuffer: Buffer) {
    const db = this.dbService.getDb();
    const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    
    const existing = db.prepare('SELECT 1 FROM sys_import_log WHERE account_source_filename_checksum = ? AND sys_account_source_id = ?').get(hash, accountId);
    if (existing) {
      db.prepare('INSERT INTO sys_import_log (sys_account_source_id, account_source_filename, account_source_filename_checksum, account_source_row_count, import_log_json) VALUES (?, ?, ?, ?, ?)').run(accountId, filename, hash, 0, JSON.stringify({ error: 'Duplicate file' }));
      throw new BadRequestException('File already imported');
    }

    const records = parse(fileBuffer, { columns: true, skip_empty_lines: true }) as Record<string, string>[];
    if (!records.length) throw new BadRequestException('Empty recordset');

    const mappings = db.prepare('SELECT * FROM sys_account_mapping WHERE sys_account_source_id = ?').all(accountId) as any[];
    if (!mappings.length) throw new BadRequestException('No mappings found');

    const stagingTable = mappings[0].staging_tablename;
    
    const runEtl = db.transaction(() => {
      db.exec(`DELETE FROM ${stagingTable}`); // Clear
      
      const stgCols = mappings.map(m => m.staging_table_fieldname);
      const stgInsert = db.prepare(`INSERT INTO ${stagingTable} (${stgCols.join(',')}) VALUES (${stgCols.map(() => '?').join(',')})`);

      for (const row of records) {
        const vals = mappings.map(m => {
          if (m.derived_field) return m.default_value;
          return row[m.sourcefile_fieldname] || m.default_value || null;
        });
        stgInsert.run(...vals);
      }

      const stagingData = db.prepare(`SELECT * FROM ${stagingTable}`).all() as any[];
      const insertImportLog = db.prepare(`INSERT INTO sys_import_log (sys_account_source_id, account_source_filename, account_source_filename_checksum, account_source_row_count, import_log_json) VALUES (?, ?, ?, ?, ?)`);
      const logInfo = insertImportLog.run(accountId, filename, hash, records.length, JSON.stringify({ status: 'Processing' }));
      const logId = logInfo.lastInsertRowid;

      let rowCount = 0;
      for (const stgRow of stagingData) {
        // Enforce uniqueness constraints
        const uniqueMaps = mappings.filter(m => m.unique_records === 1 && m.transaction_table_fieldname && m.transaction_table_fieldname !== 'n/a');
        for (const um of uniqueMaps) {
          const val = stgRow[um.staging_table_fieldname];
          const query = db.prepare(`SELECT sys_transaction_id FROM sys_transaction WHERE sys_account_source_id = ? AND ${um.transaction_table_fieldname} = ? LIMIT 1`);
          if (query.get(accountId, val)) {
            throw new BadRequestException(`Duplicate record found based on unique constraint: ${um.transaction_table_fieldname} = ${val}`);
          }
        }

        const txnObj: Record<string, any> = { sys_account_source_id: accountId, sys_import_log_id: logId, account_source_row: ++rowCount };
        let categoryName: string | null = null;
        
        for (const m of mappings) {
          let val = stgRow[m.staging_table_fieldname];
          if (!m.transaction_table_fieldname || m.transaction_table_fieldname === 'n/a') continue;
          
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
    
    try {
      runEtl();
      return { message: 'ETL completed successfully' };
    } catch(err: any) {
      throw new BadRequestException(`ETL failed: ${err.message}`);
    }
  }
}
