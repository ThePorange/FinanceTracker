import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class SourcesService {
  constructor(private readonly db: DatabaseService) {}

  getSources() {
    const rows = this.db.getDb().prepare('SELECT * FROM sys_account_source').all() as any[];
    return rows.map(r => {
      const types = this.db.getDb().prepare('SELECT DISTINCT account_source_type FROM sys_account_mapping WHERE sys_account_source_id = ?').all(r.sys_account_source_id) as any[];
      const supportedTypes = types.map(t => t.account_source_type || 'csv');
      return {
        id: r.sys_account_source_id,
        name: r.account_source_name,
        type: supportedTypes.length > 0 ? supportedTypes.join(', ') : 'csv',
        supported_types: supportedTypes.length > 0 ? supportedTypes : ['csv'],
        status: 'active',
        config: {
          base_currency_id: r.base_currency_id,
          debit_negative: r.debit_negative === 1
        }
      };
    });
  }

  createSource(data: any) {
    const run = this.db.getDb().prepare('INSERT INTO sys_account_source (account_source_name, base_currency_id, debit_negative) VALUES (?, ?, ?)').run(
      data.name, data.config?.base_currency_id || null, data.config?.debit_negative ? 1 : 0
    );
    return this.getSource(run.lastInsertRowid as number);
  }

  setupSource(data: { name: string, config: any, mappings: any[], account_source_type?: string }) {
    const baseCurr = data.config?.base_currency_id || null;
    const debitNeg = data.config?.debit_negative ? 1 : 0;
    const sourceType = (data.account_source_type || data.mappings?.[0]?.account_source_type || 'csv').toLowerCase();

    const runSource = this.db.getDb().prepare('INSERT INTO sys_account_source (account_source_name, base_currency_id, debit_negative) VALUES (?, ?, ?)').run(
      data.name, baseCurr, debitNeg
    );
    const sourceId = runSource.lastInsertRowid as number;

    if (!data.mappings || data.mappings.length === 0) {
      throw new Error('No mappings provided for source induction');
    }

    let stagingTableName = data.mappings[0].staging_tablename;
    if (!stagingTableName.endsWith(`_${sourceType}`)) {
      stagingTableName = `${stagingTableName}_${sourceType}`;
    }

    const insertMapping = this.db.getDb().prepare(`
      INSERT INTO sys_account_mapping (
        sys_account_source_id, account_source_type, staging_tablename, sourcefile_fieldname, 
        staging_table_fieldname, datatype, transaction_table_fieldname, 
        default_value, derived_field, unique_records
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const columns: string[] = [];

    const transaction = this.db.getDb().transaction(() => {
      for (const m of data.mappings) {
        insertMapping.run(
          sourceId,
          sourceType,
          stagingTableName, 
          m.sourcefile_fieldname, 
          m.staging_table_fieldname, 
          m.datatype, 
          m.transaction_table_fieldname, 
          m.default_value || '', 
          m.derived_field === 'y' || m.derived_field === 1 ? 1 : 0, 
          m.unique_records === 'y' || m.unique_records === 1 ? 1 : 0
        );

        const typeMapping: Record<string, string> = {
          text: 'TEXT', date: 'DATE', real: 'REAL', float: 'REAL', integer: 'INTEGER'
        };
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
        columns.push(`${m.staging_table_fieldname} ${stype}${defStr.replace('DEFAULT (CURRENT_TIMESTAMP)', 'DEFAULT CURRENT_TIMESTAMP')}`);
      }

      this.db.getDb().exec(`CREATE TABLE IF NOT EXISTS ${stagingTableName} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ${columns.join(', ')}
      )`);
    });

    transaction();
    return this.getSource(sourceId);
  }

  getSourceMappings(id: number, type?: string) {
    if (type) {
      return this.db.getDb().prepare('SELECT * FROM sys_account_mapping WHERE sys_account_source_id = ? AND account_source_type = ?').all(id, type.toLowerCase());
    }
    return this.db.getDb().prepare('SELECT * FROM sys_account_mapping WHERE sys_account_source_id = ?').all(id);
  }

  updateSourceMappings(id: number, data: { name: string, config?: any, mappings: any[], account_source_type?: string }) {
    this.updateSource(id, { name: data.name, config: data.config });

    const sourceType = (data.account_source_type || data.mappings?.[0]?.account_source_type || 'csv').toLowerCase();

    const oldMappings = this.getSourceMappings(id, sourceType) as any[];
    if (oldMappings.length > 0) {
      const oldStagingName = oldMappings[0].staging_tablename;
      this.db.getDb().prepare(`DROP TABLE IF EXISTS ${oldStagingName}`).run();
    }

    this.db.getDb().prepare('DELETE FROM sys_account_mapping WHERE sys_account_source_id = ? AND account_source_type = ?').run(id, sourceType);

    if (!data.mappings || data.mappings.length === 0) return this.getSource(id);

    let stagingTableName = data.mappings[0].staging_tablename;
    if (!stagingTableName.endsWith(`_${sourceType}`)) {
      stagingTableName = `${stagingTableName}_${sourceType}`;
    }

    const insertMapping = this.db.getDb().prepare(`
      INSERT INTO sys_account_mapping (
        sys_account_source_id, account_source_type, staging_tablename, sourcefile_fieldname, 
        staging_table_fieldname, datatype, transaction_table_fieldname, 
        default_value, derived_field, unique_records
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const columns: string[] = [];

    const transaction = this.db.getDb().transaction(() => {
      for (const m of data.mappings) {
        insertMapping.run(
          id, 
          sourceType,
          stagingTableName, 
          m.sourcefile_fieldname, 
          m.staging_table_fieldname, 
          m.datatype, 
          m.transaction_table_fieldname, 
          m.default_value || '', 
          m.derived_field === 1 || m.derived_field === 'y' ? 1 : 0, 
          m.unique_records === 1 || m.unique_records === 'y' ? 1 : 0
        );

        const typeMapping: Record<string, string> = {
          text: 'TEXT', date: 'DATE', real: 'REAL', float: 'REAL', integer: 'INTEGER'
        };
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
        columns.push(`${m.staging_table_fieldname} ${stype}${defStr.replace('DEFAULT (CURRENT_TIMESTAMP)', 'DEFAULT CURRENT_TIMESTAMP')}`);
      }

      this.db.getDb().exec(`CREATE TABLE IF NOT EXISTS ${stagingTableName} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ${columns.join(', ')}
      )`);
    });

    transaction();
    return this.getSource(id);
  }

  updateSource(id: number, data: any) {
    const existing = this.getSource(id);
    const newName = data.name !== undefined ? data.name : existing.name;
    const baseCurr = data.config?.base_currency_id !== undefined ? data.config.base_currency_id : existing.config?.base_currency_id;
    const debitNeg = data.config?.debit_negative !== undefined ? (data.config.debit_negative ? 1 : 0) : (existing.config?.debit_negative ? 1 : 0);

    this.db.getDb().prepare('UPDATE sys_account_source SET account_source_name = ?, base_currency_id = ?, debit_negative = ? WHERE sys_account_source_id = ?').run(
      newName, baseCurr || null, debitNeg, id
    );

    return this.getSource(id);
  }

  getSource(id: number) {
    const row = this.db.getDb().prepare('SELECT * FROM sys_account_source WHERE sys_account_source_id = ?').get(id) as any;
    if (!row) throw new NotFoundException('Source not found');
    const types = this.db.getDb().prepare('SELECT DISTINCT account_source_type FROM sys_account_mapping WHERE sys_account_source_id = ?').all(id) as any[];
    const supportedTypes = types.map(t => t.account_source_type || 'csv');
    return {
      id: row.sys_account_source_id,
      name: row.account_source_name,
      type: supportedTypes.length > 0 ? supportedTypes.join(', ') : 'csv',
      supported_types: supportedTypes.length > 0 ? supportedTypes : ['csv'],
      status: 'active',
      config: {
        base_currency_id: row.base_currency_id,
        debit_negative: row.debit_negative === 1
      }
    };
  }

  deleteSource(id: number) {
    const db = this.db.getDb();
    
    // Validate source exists
    this.getSource(id);

    // Check foreign keys
    const tables = [
      'sys_transaction',
      'sys_transaction_type',
      'sys_import_log',
      'sys_account_group_map',
      'sys_rules'
    ];

    let inUse = false;
    for (const t of tables) {
      const count = db.prepare(`SELECT COUNT(*) as c FROM ${t} WHERE sys_account_source_id = ?`).get(id) as any;
      if (count.c > 0) {
        inUse = true;
        break;
      }
    }

    if (inUse) {
      throw new BadRequestException('This data source cannot be deleted because it is currently linked to existing transactions, rules, or system configurations.');
    }

    // Drop staging table if it exists
    const mappings = db.prepare('SELECT staging_tablename FROM sys_account_mapping WHERE sys_account_source_id = ? LIMIT 1').get(id) as any;
    if (mappings) {
      db.prepare(`DROP TABLE IF EXISTS ${mappings.staging_tablename}`).run();
    }

    db.prepare('DELETE FROM sys_account_mapping WHERE sys_account_source_id = ?').run(id);
    db.prepare('DELETE FROM sys_account_source WHERE sys_account_source_id = ?').run(id);

    return { success: true };
  }
}
