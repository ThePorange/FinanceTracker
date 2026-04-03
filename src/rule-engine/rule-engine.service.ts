import { Injectable, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class RuleEngineService {
  constructor(private readonly dbService: DatabaseService) {}

  applyRules(accountId: number) {
    const db = this.dbService.getDb();
    const rules = db.prepare('SELECT * FROM sys_rules WHERE sys_account_source_id = ?').all(accountId) as any[];
    if (!rules.length) return { message: 'No rules found for this account origin', appliedCount: 0 };

    let appliedCount = 0;

    const runRules = db.transaction(() => {
      for (const rule of rules) {
        let conditionObj: any;
        try {
          conditionObj = JSON.parse(rule.rule_json);
        } catch (e) {
          continue; // skip malformed JSON rules
        }

        // Idempotency: Delete previous mappings for this specific rule
        db.prepare('DELETE FROM sys_transaction_category_map WHERE sys_rule_id = ? AND is_auto = 1').run(rule.sys_rules_id);

        // Map abstract JSON tree to SQL
        const buildCondition = (cond: any): string => {
           if (cond.type === 'contains') return `${cond.field} LIKE '%${cond.value}%'`;
           if (cond.type === 'equals') return `${cond.field} = '${cond.value}'`;
           if (cond.type === 'amount_range') return `base_amount >= ${cond.min} AND base_amount <= ${cond.max}`;
           if (cond.type === 'date_range') return `transaction_date >= '${cond.start}' AND transaction_date <= '${cond.end}'`;
           if (cond.type === 'AND' && Array.isArray(cond.conditions)) {
              return '(' + cond.conditions.map((c: any) => buildCondition(c)).join(' AND ') + ')';
           }
           return '1=0'; // Safe fallback
        };

        const sqlCond = buildCondition(conditionObj);

        // Find matches excluding Manual overrides
        const matchingSql = `
          SELECT sys_transaction_id FROM sys_transaction 
          WHERE sys_account_source_id = ? 
          AND ${sqlCond}
          AND sys_transaction_id NOT IN (
            SELECT sys_transaction_id FROM sys_transaction_category_map WHERE is_auto = 0
          )
        `;

        let matches: any[];
        try {
           matches = db.prepare(matchingSql).all(accountId);
        } catch(e: any) {
           throw new BadRequestException(`Rule SQL evaluation failed for rule ID ${rule.sys_rules_id}: ${e.message}`);
        }

        const insertMap = db.prepare('INSERT INTO sys_transaction_category_map (sys_transaction_id, sys_transaction_category_id, is_auto, confidence, sys_rule_id) VALUES (?, ?, 1, 0.8, ?)');

        for (const match of matches) {
           insertMap.run(match.sys_transaction_id, rule.sys_transaction_category_id, rule.sys_rules_id);
           appliedCount++;
        }
      }
    });

    runRules();
    return { message: 'Rules applied successfully', appliedCount };
  }

  testRuleEvaluation(description: string, amount: number = 0) {
    const db = this.dbService.getDb();
    const rules = db.prepare('SELECT * FROM sys_rules').all() as any[];

    for (const rule of rules) {
      let conditionObj: any;
      try {
        conditionObj = JSON.parse(rule.rule_json);
      } catch (e) {
        continue;
      }

      const evaluateCondition = (cond: any): boolean => {
        if (!cond) return false;
        if (cond.type === 'contains') return description.toLowerCase().includes(String(cond.value).toLowerCase());
        if (cond.type === 'equals') return description.toLowerCase() === String(cond.value).toLowerCase();
        if (cond.type === 'amount_range') return amount >= Number(cond.min) && amount <= Number(cond.max);
        if (cond.type === 'AND' && Array.isArray(cond.conditions)) {
          return cond.conditions.every((c: any) => evaluateCondition(c));
        }
        return false;
      };

      if (evaluateCondition(conditionObj)) {
        const cat = db.prepare('SELECT category_name FROM sys_transaction_category WHERE sys_transaction_category_id = ?').get(rule.sys_transaction_category_id) as any;
        return {
          matchedRuleId: rule.sys_rules_id,
          matchedPattern: conditionObj.value || 'Complex Rule',
          assignedCategory: cat ? cat.category_name : 'Unknown',
          confidence: 0.95
        };
      }
    }

    return {
      matchedRuleId: null,
      matchedPattern: null,
      assignedCategory: null,
      confidence: 0
    };
  }
}
