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

3. **Run the API Backend**
   ```bash
   npm run build
   npm run start
   # Or for hot-reloading:
   npm run start:dev
   ```
   The backend runs successfully on `http://localhost:3000`.

## Backend API Overview

The project currently provides a strictly typed NestJS REST API with modular architecture supporting custom SQLite data ingestion.

### Modules:
1. **Config Module**
   - Endpoints: `GET/POST/PUT/DELETE /config/:table_name`
   - Dynamically reads and validates data applying constraints dynamically via `class-validator` schema DTOs based directly on the provided `table_name`. 

2. **Staging Module**
   - Upload CSV preview: `POST /staging/preview` (returns headers and sample rows to present visually into UI)
   - Dynamic table creation: `POST /staging/confirm` (creates the unique `staging_<account_name>` tables and stores parameter mappings, including identifying which columns represent amounts and explicit debit/credit flags).

3. **ETL Module**
   - Ingest CSV: `POST /import/:account_source_id`
   - Migrates data into `sys_transaction`. Validates checksum duplicates constraints and data length requirements. Ensures unique constraints and auto-assigns Source-Derived categorizations seamlessly into `sys_transaction_category_map`.
   - **Financial Debit/Credit Logic:** Dynamically standardizes transactions during ingestion:
     - **Explicit DR/CR:** If a `drcr` mapping exists ('DR', 'CR', 'DEBIT', 'CREDIT'), it determines the direction explicitly. 
     - **Implicit Calculation:** If no explicit flag is mapped, it calculates the direction based on the amount's sign and the Account Source's `debit_negative` configuration.
     - **Standardized Output:** Debits are uniformly converted and stored as native negative mathematical values, and Credits are stored as positive values.

4. **Rule Engine Module**
   - Evaluate Rules: `POST /rules/apply/:account_source_id`
   - Dynamically translates abstract JSON system rules (`contains`, `equals`, `amount_range`, `date_range`, `AND`) directly down to optimized raw SQLite conditional parameters natively. Resolves categorization idempotently, respecting all existing manual override restrictions.

5. **Reporting Module**
   - Retrieve Finalized Transactions: `GET /transactions?page=1&limit=50`
   - Connects datasets safely to `vw_transaction_final_category`, successfully tracking/resolving automatic rules versus manual overrides effortlessly.

## Database Schema
The schema represents core banking concepts including accounts, transactions, file imports, transaction categorization, and currency mapping.

Core tables include:
- `sys_account_source`: Source accounts
- `sys_transaction`, `sys_transaction_type`: Banking transactions
- `sys_import_log`: Tracked ingestion points
- `sys_transaction_category`, `sys_transaction_category_map`, `sys_rules`: Rules and engine for categorization
- `sys_currency`, `sys_currency_pair`, `sys_fx_rate`: Foreign exchange functionality

---
*This README will be kept up to date as frontend dashboards and further requirements are integrated.*
