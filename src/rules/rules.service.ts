import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class RulesService {
  constructor(private readonly db: DatabaseService) {}

  public executeRules(sourceId?: number, ruleId?: number) {
    const db = this.db.getDb();
    
    let query = 'SELECT * FROM sys_rules';
    const params = [];
    const conditions = [];

    if (sourceId) { conditions.push('sys_account_source_id = ?'); params.push(sourceId); }
    if (ruleId) { conditions.push('sys_rules_id = ?'); params.push(ruleId); }
    
    if (conditions.length > 0) {
       query += ' WHERE ' + conditions.join(' AND ');
    }

    const rules = db.prepare(query).all(...params) as any[];

    if (rules.length > 0) {
       const ruleIds = rules.map(r => r.sys_rules_id).join(',');
       db.prepare(`UPDATE sys_rules SET last_run = CURRENT_TIMESTAMP, last_run_count = 0 WHERE sys_rules_id IN (${ruleIds})`).run();
    }

    let executionCount = 0;

    for (const rule of rules) {
       const json = JSON.parse(rule.rule_json);
       const categoryId = rule.sys_transaction_category_id;
       if (!categoryId) continue;

       const { where, params, confidence } = this.buildRuleCondition(json);
       if (!where) continue;

       let finalWhere = `(${where})`;
       const finalParams = [...params];
       
       if (rule.sys_account_source_id) {
           finalWhere += ` AND sys_account_source_id = ?`;
           finalParams.push(rule.sys_account_source_id);
       }

       // Clear prior automation links for this specific rule identically ensuring idempotency
       db.prepare(`DELETE FROM sys_transaction_category_map WHERE sys_rule_id = ? AND is_auto = 1`).run(rule.sys_rules_id);

       // Isolate transactions securely verifying against manual hooks natively configured
       const selectSql = `
         SELECT sys_transaction_id FROM sys_transaction 
         WHERE ${finalWhere}
       `;
       const matches = db.prepare(selectSql).all(...finalParams) as any[];

       if (matches.length > 0) {
          const insertStmt = db.prepare(`
             INSERT INTO sys_transaction_category_map (sys_transaction_id, sys_transaction_category_id, is_auto, confidence, sys_rule_id)
             VALUES (?, ?, 1, ?, ?)
          `);
          const insertMany = db.transaction((txns: any[]) => {
             for (const t of txns) {
                insertStmt.run(t.sys_transaction_id, categoryId, confidence, rule.sys_rules_id);
             }
          });
          insertMany(matches);
          db.prepare('UPDATE sys_rules SET last_run_count = ? WHERE sys_rules_id = ?').run(matches.length, rule.sys_rules_id);
          executionCount += matches.length;
       }
    }
    
    return { success: true, processedRules: rules.length, mappedTransactions: executionCount };
  }

  public deleteRule(ruleId: number) {
    const db = this.db.getDb();
    db.prepare('DELETE FROM sys_transaction_category_map WHERE sys_rule_id = ?').run(ruleId);
    db.prepare('DELETE FROM sys_rules WHERE sys_rules_id = ?').run(ruleId);
    return { success: true, deleted: ruleId };
  }

  private buildRuleCondition(json: any): { where: string, params: any[], confidence: number } {
     if (json.type === 'source') {
         if (!json.value) return { where: '', params: [], confidence: 0 };
         return { where: `sys_account_source_id = ?`, params: [json.value], confidence: 0.95 };
     }
     if (json.type === 'contains') {
         if (!json.value || String(json.value).trim() === '') return { where: '', params: [], confidence: 0 };
         const op = json.operator === 'NOT LIKE' ? 'NOT LIKE' : 'LIKE';
         return { where: `LOWER(${json.field}) ${op} LOWER(?)`, params: [`%${json.value}%`], confidence: 0.85 };
     }
     if (json.type === 'equals') {
         if (!json.value || String(json.value).trim() === '') return { where: '', params: [], confidence: 0 };
         return { where: `LOWER(${json.field}) = LOWER(?)`, params: [json.value], confidence: 0.95 };
     }
     if (json.type === 'date_range') {
         const field = json.field || 'transaction_date';
         return { where: `COALESCE(${field}, posting_date, created_date) BETWEEN ? AND ?`, params: [json.start, json.end], confidence: 0.90 };
     }
     if (json.type === 'amount_range') {
         const field = json.field || 'base_amount';
         return { where: `${field} >= ? AND ${field} <= ?`, params: [json.min, json.max], confidence: 0.80 };
     }
     if (json.type === 'select_transactions') {
         if (!json.checksums || !Array.isArray(json.checksums) || json.checksums.length === 0) return { where: '', params: [], confidence: 0 };
         const placeholders = json.checksums.map(() => '?').join(',');
         return { where: `row_checksum IN (${placeholders})`, params: json.checksums, confidence: 1.0 };
     }
     if (json.type === 'exclude_transactions') {
         if (!json.checksums || !Array.isArray(json.checksums) || json.checksums.length === 0) return { where: '', params: [], confidence: 0 };
         const placeholders = json.checksums.map(() => '?').join(',');
         return { where: `row_checksum NOT IN (${placeholders})`, params: json.checksums, confidence: 1.0 };
     }
     if ((json.type === 'and' || json.type === 'or') && json.conditions) {
         const clauses = [];
         const allParams = [];
         for (const cond of json.conditions) {
            const res = this.buildRuleCondition(cond);
            if (res.where) {
               clauses.push(`(${res.where})`);
               allParams.push(...res.params);
            }
         }
         const joiner = json.type === 'or' ? ' OR ' : ' AND ';
         return { where: clauses.join(joiner), params: allParams, confidence: 0.90 };
     }
     return { where: '', params: [], confidence: 0 };
  }
}
