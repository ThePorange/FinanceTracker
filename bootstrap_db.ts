import fs from 'fs';
import path from 'path';
import sqlite3 from 'sqlite3';

const DB_DIR = path.join(process.cwd(), 'db');
const DB_FILE = path.join(DB_DIR, 'banking.db');
const SCHEMA_FILE = path.join(process.cwd(), 'schema.sql');

async function bootstrapDb() {
  console.log('Starting DB bootstrap process...');

  // Check if DB file already exists
  if (fs.existsSync(DB_FILE)) {
    console.log(`Database file already exists at ${DB_FILE}. Skipping bootstrap.`);
    return;
  }

  // Ensure DB_DIR exists
  if (!fs.existsSync(DB_DIR)) {
    console.log(`Creating database directory at ${DB_DIR}...`);
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  console.log(`Connecting to new SQLite database at ${DB_FILE}...`);
  const db = new sqlite3.Database(DB_FILE, (err) => {
    if (err) {
      console.error('Error opening database:', err.message);
      process.exit(1);
    }
  });

  console.log(`Reading schema from ${SCHEMA_FILE}...`);
  let schemaSql: string;
  try {
    schemaSql = fs.readFileSync(SCHEMA_FILE, 'utf8');
  } catch (err) {
    console.error('Error reading schema.sql file:', err);
    process.exit(1);
  }

  console.log('Executing schema statements...');
  db.exec(schemaSql, (err) => {
    if (err) {
      console.error('Error executing schema statements:', err.message);
      process.exit(1);
    } else {
      console.log('Database schema created successfully.');
    }
    
    // Close the database connection
    db.close((closeErr) => {
      if (closeErr) {
        console.error('Error closing database connection:', closeErr.message);
      } else {
        console.log('Database connection closed.');
      }
    });
  });
}

bootstrapDb().catch((err) => {
  console.error('Unexpected error during bootstrap:', err);
  process.exit(1);
});
