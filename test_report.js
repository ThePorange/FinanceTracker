const Database = require('better-sqlite3');
const db = new Database('./db/banking.db');

const ruleGroupId = 1;

let sql = `
  SELECT COUNT(DISTINCT t.sys_transaction_id) as count
  FROM sys_transaction t 
  WHERE t.sys_transaction_id IN (
      SELECT map.sys_transaction_id
      FROM sys_transaction_category_map map
      JOIN sys_rule_group_map rgm ON map.sys_rule_id = rgm.sys_rule_id
      WHERE rgm.sys_rule_group_id = ? AND rgm.exclude_rules = 0
  )
  AND t.sys_transaction_id NOT IN (
      SELECT map.sys_transaction_id
      FROM sys_transaction_category_map map
      JOIN sys_rule_group_map rgm ON map.sys_rule_id = rgm.sys_rule_id
      WHERE rgm.sys_rule_group_id = ? AND rgm.exclude_rules = 1
  )
`;

const res = db.prepare(sql).get(ruleGroupId, ruleGroupId);
console.log(`Transactions matched by Rule Group ${ruleGroupId}: ${res.count}`);
