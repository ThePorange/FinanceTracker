import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Database from 'better-sqlite3';
import * as path from 'path';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private db!: Database.Database;

  onModuleInit() {
    const dbPath = path.resolve(process.cwd(), 'db', 'banking.db');
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.runMigrations();
  }

  private runMigrations() {
    const tableCheck = (table: string, col: string) => {
      try {
        const cols = this.db.prepare(`PRAGMA table_info(${table})`).all() as any[];
        return cols.some(c => c.name === col);
      } catch (e) {
        return false;
      }
    };

    if (this.db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='sys_account_mapping'`).get()) {
      if (!tableCheck('sys_account_mapping', 'account_source_type')) {
        this.db.exec(`ALTER TABLE sys_account_mapping ADD COLUMN account_source_type VARCHAR(20) DEFAULT 'csv'`);
      }
      this.db.exec(`UPDATE sys_account_mapping SET account_source_type = 'csv' WHERE account_source_type IS NULL OR account_source_type = ''`);
    }

    if (this.db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='sys_import_log'`).get()) {
      if (!tableCheck('sys_import_log', 'account_source_type')) {
        this.db.exec(`ALTER TABLE sys_import_log ADD COLUMN account_source_type VARCHAR(20) DEFAULT 'csv'`);
      }
      this.db.exec(`UPDATE sys_import_log SET account_source_type = 'csv' WHERE account_source_type IS NULL OR account_source_type = ''`);
    }

    if (this.db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='sys_transaction'`).get()) {
      if (!tableCheck('sys_transaction', 'account_source_type')) {
        this.db.exec(`ALTER TABLE sys_transaction ADD COLUMN account_source_type VARCHAR(20) DEFAULT 'csv'`);
      }
      this.db.exec(`UPDATE sys_transaction SET account_source_type = 'csv' WHERE account_source_type IS NULL OR account_source_type = ''`);
    }

    if (this.db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='sys_account_mapping'`).get()) {
      const legacyMappings = this.db.prepare(`
        SELECT DISTINCT staging_tablename FROM sys_account_mapping 
        WHERE (account_source_type = 'csv' OR account_source_type IS NULL)
        AND staging_tablename NOT LIKE '%_csv'
        AND staging_tablename NOT LIKE '%_ofx'
      `).all() as any[];

      for (const m of legacyMappings) {
        const oldName = m.staging_tablename;
        const newName = `${oldName}_csv`;
        
        try {
          const exists = this.db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(oldName);
          if (exists) {
            this.db.exec(`ALTER TABLE ${oldName} RENAME TO ${newName}`);
          }
        } catch (e) {
          console.warn(`Could not rename table ${oldName} to ${newName}:`, e);
        }

        this.db.prepare(`UPDATE sys_account_mapping SET staging_tablename = ? WHERE staging_tablename = ?`).run(newName, oldName);
      }
    }

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sys_merge_map (
        sys_merge_map_id INTEGER PRIMARY KEY,
        sys_account_source_id INTEGER,
        source VARCHAR(250) NOT NULL,
        fieldname VARCHAR(250) NOT NULL,
        in_output VARCHAR(250) NOT NULL,
        output_fieldname VARCHAR(250) NOT NULL,
        output_field_order VARCHAR(250),
        list_index VARCHAR(250),
        datatype VARCHAR(250) NOT NULL,
        format VARCHAR(250),
        calculation_json VARCHAR(250),
        created_date DATE DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(sys_account_source_id) REFERENCES sys_account_source(sys_account_source_id)
      )
    `);
  }

  onModuleDestroy() {
    if (this.db) {
      this.db.close();
    }
  }

  getDb(): Database.Database {
    return this.db;
  }
}
