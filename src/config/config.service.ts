import { Injectable, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class ConfigService {
  private readonly allowedTables = [
    'sys_account_source',
    'sys_account_mapping',
    'sys_transaction_category',
    'sys_rules',
    'sys_currency',
    'sys_currency_pair',
    'sys_fx_rate',
    'sys_config',
    'sys_staging_fields',
    'sys_transaction',
    'sys_import_log',
    'sys_account_group',
    'sys_account_group_map'
  ];

  constructor(private readonly dbService: DatabaseService) {}

  private validateTable(table: string) {
    if (!this.allowedTables.includes(table) && !table.startsWith('staging_')) {
      throw new BadRequestException(`Invalid table namespace interpolation: ${table}`);
    }
  }

  getStagingTables() {
    return this.dbService.getDb().prepare("SELECT name, sql FROM sqlite_master WHERE type='table' AND name LIKE 'staging_%'").all();
  }

  getTableSchema(table: string) {
    this.validateTable(table);
    return this.dbService.getDb().prepare(`PRAGMA table_info(${table})`).all();
  }

  findAll(table: string, page = 1, limit = 50, filters: Record<string, any> = {}) {
    this.validateTable(table);
    const db = this.dbService.getDb();
    
    let query = `SELECT * FROM ${table}`;
    if (table === 'sys_import_log') {
      query = `SELECT t.*, s.account_source_name FROM sys_import_log t LEFT JOIN sys_account_source s ON t.sys_account_source_id = s.sys_account_source_id`;
    }
    let countQuery = `SELECT COUNT(*) as total FROM ${table}`;
    const params: any[] = [];
    const filterKeys = Object.keys(filters);
    
    if (filterKeys.length > 0) {
      const conditions = filterKeys.map(k => `${k} = ?`).join(' AND ');
      query += ` WHERE ${conditions}`;
      countQuery += ` WHERE ${conditions}`;
      params.push(...Object.values(filters));
    }
    
    const offset = (page - 1) * limit;
    query += ` LIMIT ? OFFSET ?`;
    
    const data = db.prepare(query).all(...params, limit, offset);
    const totalRow = db.prepare(countQuery).get(...(filterKeys.length ? Object.values(filters) : [])) as any;
    
    return { data, total: totalRow.total, page, limit };
  }

  findOne(table: string, idField: string, idValue: number) {
    this.validateTable(table);
    const db = this.dbService.getDb();
    const row = db.prepare(`SELECT * FROM ${table} WHERE ${idField} = ?`).get(idValue);
    return row;
  }

  create(table: string, data: Record<string, any>) {
    this.validateTable(table);
    const db = this.dbService.getDb();
    
    // Strip undefined values
    const cleanData = Object.entries(data).reduce((acc, [k, v]) => {
      if (v !== undefined) acc[k] = v;
      return acc;
    }, {} as Record<string, any>);

    const keys = Object.keys(cleanData);
    const values = Object.values(cleanData);
    
    const placeholders = keys.map(() => '?').join(', ');
    const sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`;
    
    const info = db.prepare(sql).run(...values);
    return { id: info.lastInsertRowid };
  }

  update(table: string, idField: string, idValue: number, data: Record<string, any>) {
    this.validateTable(table);
    const db = this.dbService.getDb();
    const keys = Object.keys(data);
    const values = Object.values(data);
    
    const setClause = keys.map(k => `${k} = ?`).join(', ');
    const sql = `UPDATE ${table} SET ${setClause} WHERE ${idField} = ?`;
    
    const info = db.prepare(sql).run(...values, idValue);
    return { changes: info.changes };
  }

  remove(table: string, idField: string, idValue: number) {
    this.validateTable(table);
    const db = this.dbService.getDb();
    const sql = `DELETE FROM ${table} WHERE ${idField} = ?`;
    const info = db.prepare(sql).run(idValue);
    return { changes: info.changes };
  }
}
