const fs = require('fs');
const path = require('path');
const { parseOfx, extractOfxSchemaHeaders } = require('../dist/src/etl/ofx-parser');

const ofxContent = fs.readFileSync(path.join(__dirname, '../sample.ofx'), 'utf8');

console.log('--- Testing OFX Schema Extraction ---');
const headers = extractOfxSchemaHeaders(ofxContent);
console.log('Extracted Headers:', headers);

console.log('\n--- Testing OFX Transaction Parsing ---');
const records = parseOfx(ofxContent);
console.log(`Parsed ${records.length} transactions.`);
if (records.length > 0) {
  console.log('Sample Transaction 1:', records[0]);
  console.log('Sample Transaction 2:', records[1]);
}

if (records.length > 0 && records[0].TRNTYPE && records[0].TRNAMT && records[0].FITID) {
  console.log('\n✅ OFX Parsing Test PASSED!');
} else {
  console.log('\n❌ OFX Parsing Test FAILED!');
  process.exit(1);
}
