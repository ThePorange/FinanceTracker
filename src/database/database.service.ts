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
