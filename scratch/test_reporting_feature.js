const path = require('path');
const sqlite3 = require('better-sqlite3');

const DB_FILE = path.join(__dirname, '../db/banking.db');
const db = sqlite3(DB_FILE);

console.log('--- Testing sys_report_definition Table & Queries ---');

// 1. Ensure Table Exists
db.exec(`
  CREATE TABLE IF NOT EXISTS sys_report_definition (
      sys_report_definition_id INTEGER PRIMARY KEY,
      report_name VARCHAR(250) NOT NULL UNIQUE,
      chart_type VARCHAR(50) NOT NULL DEFAULT 'line',
      definition_json TEXT NOT NULL,
      created_date DATE DEFAULT CURRENT_TIMESTAMP,
      updated_date DATE DEFAULT CURRENT_TIMESTAMP
  );
`);

console.log('✅ sys_report_definition table exists/created successfully.');

// 2. Insert Test Report Definition
const testReportName = 'Test Automated Report ' + Date.now();
const testDef = {
  series: [
    {
      id: 's1',
      name: 'All Credits',
      filters: [{ drcr: 'CR' }]
    },
    {
      id: 's2',
      name: 'All Debits',
      filters: [{ drcr: 'DR' }]
    }
  ],
  interval: 'monthly',
  amountMode: 'net'
};

const insertStmt = db.prepare(`
  INSERT INTO sys_report_definition (report_name, chart_type, definition_json, updated_date)
  VALUES (?, ?, ?, CURRENT_TIMESTAMP)
`);
const res = insertStmt.run(testReportName, 'bar', JSON.stringify(testDef));
console.log('✅ Inserted test report definition, ID:', res.lastInsertRowid);

// 3. Select Report Definition
const row = db.prepare('SELECT * FROM sys_report_definition WHERE sys_report_definition_id = ?').get(res.lastInsertRowid);
console.log('✅ Retrieved inserted report:', row.report_name, 'Chart:', row.chart_type);

// 4. Delete Test Report Definition
db.prepare('DELETE FROM sys_report_definition WHERE sys_report_definition_id = ?').run(res.lastInsertRowid);
console.log('✅ Deleted test report definition cleanly.');

console.log('--- All DB Verification Tests Passed! ---');
