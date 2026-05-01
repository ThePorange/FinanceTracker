const Database = require('better-sqlite3');
const db = new Database('./db/banking.db');

const rules = db.prepare('SELECT sys_rules_id, rule_name, rule_json FROM sys_rules').all();
console.log(`Found ${rules.length} rules.`);

for (const rule of rules) {
    console.log(`\nRule: ${rule.rule_name} (ID: ${rule.sys_rules_id})`);
    const mappings = db.prepare('SELECT COUNT(*) as count FROM sys_transaction_category_map WHERE sys_rule_id = ?').get(rule.sys_rules_id);
    console.log(`- Mapped Transactions: ${mappings.count}`);
}

const ruleGroups = db.prepare('SELECT sys_rule_group_id, rule_group_name FROM sys_rule_group').all();
console.log(`\nFound ${ruleGroups.length} rule groups.`);
for (const group of ruleGroups) {
    console.log(`\nGroup: ${group.rule_group_name} (ID: ${group.sys_rule_group_id})`);
    const maps = db.prepare('SELECT * FROM sys_rule_group_map WHERE sys_rule_group_id = ?').all(group.sys_rule_group_id);
    console.log(`- Mappings:`, maps);
}
