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

4. **Run the Frontend UI**
   The frontend is a React application powered by Vite. In a separate terminal, run:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   The frontend will be available at the local URL provided by Vite (typically `http://localhost:5173`).

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

## Portable Production Build

Follow these steps to create a standalone, production-ready version of Finance Tracker that can be moved to a new machine.

### ⚡ Automated Packaging (Recommended)

To quickly create the portable build folder with all necessary files and scripts, run the following command in the root directory:

**Mac/Linux:**
```bash
chmod +x package_portable.sh
./package_portable.sh
```

**Windows:**
```powershell
.\package_portable.ps1
```

This will create a `FinanceTracker_App` folder containing everything you need.

---

### Manual Steps (Alternative)

If you prefer to do it manually, follow these steps:

#### 1. Preparation & Build (On Development PC)

Generate the production assets for both the backend and frontend:

```bash
# Build Backend (Root directory)
npm run build

# Build Frontend (Frontend directory)
cd frontend
npm run build
cd ..
```

### 2. Packaging (On Development PC)

Create a new folder named `FinanceTracker_App` and copy the following files/folders into it:

- **Backend**:
  - `dist/` -> Copy to `FinanceTracker_App/backend/dist/`
  - `package.json` -> Copy to `FinanceTracker_App/backend/package.json`
  - `package-lock.json` -> Copy to `FinanceTracker_App/backend/package-lock.json`
- **Frontend**:
  - `frontend/dist/` -> Copy to `FinanceTracker_App/frontend/dist/`
- **Database (Schema)**:
  - `schema.sql` -> Copy to `FinanceTracker_App/schema.sql`
  - (Note: The database file `banking.db` will be created automatically on the first run)

**Tip:** If you want the app to be truly "offline" portable, run `npm install --production` inside `FinanceTracker_App/backend/` while still on your dev machine to include the `node_modules` folder.

### 3. Deployment (On New PC)

1.  Copy the `FinanceTracker_App` folder to any location on the new machine (e.g., `C:\Apps\FinanceTracker` or `/Applications/FinanceTracker`).
2.  Ensure **Node.js (v18+)** is installed on the new machine.
3.  If you didn't copy `node_modules`, run `npm install --production` inside the `backend` folder.

### 4. Execution (On New PC)

To start the application, you need to run both the backend API and a static server for the frontend.

**Start Backend:**
```bash
# Bootstrap Database (First time or if schema changes)
node backend/dist/bootstrap_db.js

# Start Backend
node backend/dist/src/main.js
```

**Start Frontend:**
Using `serve` (recommended):
```bash
# Run from the root of FinanceTracker_App
npx serve -s frontend/dist -p 5173
```

The application will be available at `http://localhost:5173`.

### 5. Production Helper Scripts

You can create these scripts in the root of your `FinanceTracker_App` folder for one-click startup.

#### Windows (`start_app.ps1`)
```powershell
Write-Host "Starting Finance Tracker Production..." -ForegroundColor Cyan

# Bootstrap Database
node backend/dist/bootstrap_db.js

# Start Backend
Start-Process -FilePath "node" -ArgumentList "backend/dist/src/main.js" -WindowStyle Normal

# Start Frontend
Start-Process -FilePath "npx.cmd" -ArgumentList "serve", "-s", "frontend/dist", "-p", "5173" -WindowStyle Normal

Write-Host "App is starting! Access it at http://localhost:5173" -ForegroundColor Green
```

#### Mac/Linux (`start_app.sh`)
```bash
#!/bin/bash
echo "Starting Finance Tracker Production..."

# Bootstrap Database
node backend/dist/bootstrap_db.js

# Start Backend in background
node backend/dist/src/main.js &

# Start Frontend
npx serve -s frontend/dist -p 5173
```
