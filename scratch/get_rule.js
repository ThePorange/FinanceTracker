const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.resolve(process.cwd(), 'db', 'banking.db');
const db = new Database(dbPath);
const rule = db.prepare('SELECT rule_name, rule_json FROM sys_rules WHERE rule_name = ?').get('aa_test');
console.log(JSON.stringify(rule, null, 2));
db.close();
