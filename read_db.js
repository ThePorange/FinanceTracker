const Database = require('better-sqlite3');
const db = new Database('database.sqlite');
const rules = db.prepare('SELECT * FROM sys_rules').all();
console.log(JSON.stringify(rules, null, 2));
