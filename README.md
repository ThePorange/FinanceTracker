# Finance Tracker

A banking analytics web app that ingests account and transaction data, powering dashboards and tables for a browser UI. The backend is written in TypeScript on Node.js and uses a local SQLite database.

## System Requirements
- **Node.js** (v18+)
- **npm** (or pnpm/yarn)

## Setup & Bootstrap

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Bootstrap the Database**
   The project uses a local SQLite database which is stored at `db/banking.db`.
   To initialize the directory and run the database schema from scratch, execute:
   ```bash
   npm run bootstrap-db
   ```
   *Note: This script is idempotent. It will safely skip schema creation if the database file already exists.*

## Database Schema
The schema represents core banking concepts including accounts, transactions, file imports, transaction categorization, and currency mapping.

Core tables include:
- `sys_account_source`: Source accounts
- `sys_transaction`, `sys_transaction_type`: Banking transactions
- `sys_import_log`: Tracked ingestion points
- `sys_transaction_category`, `sys_transaction_category_map`, `sys_rules`: Rules and engine for categorization
- `sys_currency`, `sys_currency_pair`, `sys_fx_rate`: Foreign exchange functionality

---
*This README will be kept up to date as API endpoints, automated ingestion, and UI features are added to the project.*
