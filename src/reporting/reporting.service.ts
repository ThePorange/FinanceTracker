import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class ReportingService {
  constructor(private readonly dbService: DatabaseService) {}

  getTransactions(page = 1, limit = 50) {
    const offset = (page - 1) * limit;

    const sql = `
      SELECT t.*, 
             v.category_name, 
             v.is_auto as category_is_auto, 
             v.confidence as category_confidence 
      FROM sys_transaction t 
      LEFT JOIN vw_transaction_final_category v ON t.sys_transaction_id = v.sys_transaction_id
      ORDER BY t.created_date DESC
      LIMIT ? OFFSET ?
    `;

    const countSql = `SELECT COUNT(*) as total FROM sys_transaction`;
    
    const data = this.dbService.getDb().prepare(sql).all(limit, offset);
    const count = this.dbService.getDb().prepare(countSql).get() as any;

    return {
      data,
      total: count.total,
      page,
      limit
    };
  }
}
