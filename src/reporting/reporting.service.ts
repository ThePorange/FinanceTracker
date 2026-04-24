import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class ReportingService {
  constructor(private readonly dbService: DatabaseService) {}

  getTransactions(page: number = 1, limit: number = 50, queryFilters: Record<string, any> = {}) {
    const offset = limit > 0 ? (page - 1) * limit : 0;

    let sql = `
      SELECT t.sys_transaction_id AS id,
             t.posting_date,      
             t.transaction_date,  
             COALESCE(t.transaction_date, t.posting_date, t.created_date) AS date,
             t.description,
             t.base_amount AS amount,
             t.drcr,              
             tt.transaction_type, 
             s.account_source_name AS account,
             CASE WHEN v.is_auto = 1 THEN v.category_name ELSE NULL END AS autoCategory,
             CASE WHEN v.is_auto = 0 THEN v.category_name ELSE NULL END AS userCategory,
             v.confidence AS category_confidence,
             v.sys_rule_id,
             t.row_checksum
      FROM sys_transaction t 
      LEFT JOIN sys_account_source s ON t.sys_account_source_id = s.sys_account_source_id
      LEFT JOIN vw_transaction_final_category v ON t.sys_transaction_id = v.sys_transaction_id
      LEFT JOIN sys_transaction_type tt ON t.sys_transaction_type_id = tt.sys_transaction_type_id
    `;

    if (queryFilters.groupId) {
      sql += ` INNER JOIN sys_account_group_map gm ON t.sys_account_source_id = gm.sys_account_source_id AND gm.sys_account_group_id = ?`;
    }

    const where = [];
    const params = [];

    if (queryFilters.groupId) params.push(queryFilters.groupId);

    if (queryFilters.startDate) { where.push(`COALESCE(t.transaction_date, t.posting_date, t.created_date) >= ?`); params.push(queryFilters.startDate); }
    if (queryFilters.endDate) { where.push(`COALESCE(t.transaction_date, t.posting_date, t.created_date) <= ?`); params.push(`${queryFilters.endDate} 23:59:59`); }

    if (queryFilters.checksums) {
      const checksumArray = queryFilters.checksums.split(',').filter(Boolean);
      if (checksumArray.length > 0) {
        where.push(`t.row_checksum IN (${checksumArray.map(() => '?').join(',')})`);
        params.push(...checksumArray);
      }
    }
    
    if (queryFilters.amountOp && queryFilters.amountVal !== undefined && queryFilters.amountVal !== '') {
      const op = queryFilters.amountOp === '>' ? '>' : queryFilters.amountOp === '<' ? '<' : '=';
      where.push(`t.base_amount ${op} ?`);
      params.push(queryFilters.amountVal);
    } else if (queryFilters.amountVal !== undefined && queryFilters.amountVal !== '') {
      where.push(`t.base_amount = ?`);
      params.push(queryFilters.amountVal);
    }

    if (queryFilters.sourceId) { where.push(`t.sys_account_source_id = ?`); params.push(queryFilters.sourceId); }
    if (queryFilters.typeId) { where.push(`t.sys_transaction_type_id = ?`); params.push(queryFilters.typeId); }
    if (queryFilters.drcr) { where.push(`t.drcr = ?`); params.push(queryFilters.drcr); }
    if (queryFilters.ruleId) { 
        where.push(`EXISTS (SELECT 1 FROM sys_transaction_category_map mf WHERE mf.sys_transaction_id = t.sys_transaction_id AND mf.sys_rule_id = ?)`); 
        params.push(queryFilters.ruleId); 
    }
    if (queryFilters.category) { 
      where.push(`v.category_name LIKE ?`); 
      params.push(`%${queryFilters.category}%`); 
    }

    if (where.length > 0) sql += ` WHERE ` + where.join(' AND ');

    sql += ` ORDER BY COALESCE(t.transaction_date, t.posting_date, t.created_date) DESC`;

    if (limit > 0) {
       sql += ` LIMIT ? OFFSET ?`;
       params.push(limit, offset);
    }

    const data = this.dbService.getDb().prepare(sql).all(...params);

    let countSql = `SELECT COUNT(*) as total FROM sys_transaction t LEFT JOIN vw_transaction_final_category v ON t.sys_transaction_id = v.sys_transaction_id`;
    if (queryFilters.groupId) countSql += ` INNER JOIN sys_account_group_map gm ON t.sys_account_source_id = gm.sys_account_source_id AND gm.sys_account_group_id = ?`;
    if (where.length > 0) countSql += ` WHERE ` + where.join(' AND ');
    
    const countParams = limit > 0 ? params.slice(0, params.length - 2) : params;
    const count = this.dbService.getDb().prepare(countSql).get(...countParams) as any;

    return {
      data,
      total: count.total,
      page,
      limit
    };
  }

  updateTransaction(id: number, updates: { userCategory?: string }) {
    const db = this.dbService.getDb();
    
    if (updates.userCategory !== undefined) {
      const categoryName = updates.userCategory;
      const txn = db.prepare('SELECT sys_account_source_id FROM sys_transaction WHERE sys_transaction_id = ?').get(id) as any;
      if (!txn) throw new Error('Transaction not found');

      let cat = db.prepare('SELECT sys_transaction_category_id FROM sys_transaction_category WHERE category_name = ?').get(categoryName) as any;
      
      if (!cat && categoryName) {
        const res = db.prepare('INSERT INTO sys_transaction_category (category_name) VALUES (?)').run(categoryName);
        cat = { sys_transaction_category_id: res.lastInsertRowid };
      }

      // Remove existing manual categorization if any
      db.prepare('DELETE FROM sys_transaction_category_map WHERE sys_transaction_id = ? AND is_auto = 0').run(id);

      if (cat) {
        db.prepare('INSERT INTO sys_transaction_category_map (sys_transaction_id, sys_transaction_category_id, is_auto, confidence) VALUES (?, ?, 0, 1.0)').run(id, cat.sys_transaction_category_id);
      }
    }

    return { success: true };
  }
}
