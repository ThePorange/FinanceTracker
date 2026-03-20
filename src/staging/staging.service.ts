import { Injectable, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { parse } from 'csv-parse/sync';

@Injectable()
export class StagingService {
  constructor(private readonly dbService: DatabaseService) {}

  previewCsv(fileBuffer: Buffer) {
    try {
      const records = parse(fileBuffer, {
        columns: true,
        skip_empty_lines: true,
        to_line: 5,
      });
      if (!records || records.length === 0) {
        throw new BadRequestException('Empty CSV or missing headers');
      }
      const headers = Object.keys(records[0] as Record<string, unknown>);
      return { headers, sample: records };
    } catch (err) {
      throw new BadRequestException('Failed to parse CSV');
    }
  }

  createStagingTable(accountId: number, mappings: any[]) {
    const db = this.dbService.getDb();
    
    const source = db.prepare('SELECT account_source_name FROM sys_account_source WHERE sys_account_source_id = ?').get(accountId) as any;
    if (!source) throw new BadRequestException('Account source not found');

    const cleanName = source.account_source_name.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const stagingTableName = `staging_${cleanName}`;
    
    db.exec(`DROP TABLE IF EXISTS ${stagingTableName}`);

    const columns = mappings.map(m => {
      // Must not be prone to SQL injection since internal mapping drives it, but typically staging_table_fieldname is safe
      return `${m.staging_table_fieldname} ${m.datatype || 'TEXT'}`;
    });
    
    // Ensure we have a primary key or rowid is enough for staging. Adding an auto-incrementing ID.
    const createSql = `CREATE TABLE ${stagingTableName} (
      staging_id INTEGER PRIMARY KEY AUTOINCREMENT,
      ${columns.join(', ')}
    )`;
    db.exec(createSql);

    const insertMapping = db.prepare(`
      INSERT INTO sys_account_mapping 
      (sys_account_source_id, staging_tablename, sourcefile_fieldname, staging_table_fieldname, datatype, transaction_table_fieldname, default_value, derived_field, unique_records)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const updateTx = db.transaction(() => {
      db.prepare('DELETE FROM sys_account_mapping WHERE sys_account_source_id = ?').run(accountId);
      
      for (const m of mappings) {
        insertMapping.run(
          accountId,
          stagingTableName,
          m.sourcefile_fieldname,
          m.staging_table_fieldname,
          m.datatype || 'TEXT',
          m.transaction_table_fieldname,
          m.default_value || null,
          m.derived_field ? 1 : 0,
          m.unique_records ? 1 : 0
        );
      }
    });
    
    updateTx();

    return { message: 'Staging table created successfully', stagingTableName };
  }
}
