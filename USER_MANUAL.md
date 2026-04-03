# Finance Tracker - User Manual

## 1. Application Summary
The Finance Tracker is a comprehensive finance management platform designed to track accounts, categorize transactions, and provide robust reporting capabilities. A core feature of the system is its powerful ETL (Extract, Transform, Load) Data Ingestion pipeline, which allows users to dynamically map, stage, and synchronize financial data from external sources (such as bank CSV exports) directly into the system. The application aims to provide users with a clear view of their financial health through streamlined data entry, automated processing, and insightful visualizations.

## 2. Screen Reference
*This section contains detailed descriptions and usage instructions for each screen within the Finance Tracker application.*

### 2.1 Dashboard
*(Placeholder: To be completed. Will cover high-level financial metrics, recent transactions, and summary charts.)*

### 2.2 Accounts
*(Placeholder: To be completed. Will cover managing connected financial accounts, current balances, and account status.)*

### 2.3 Transactions Log
*(Placeholder: To be completed. Will cover viewing, searching, filtering, and manually managing individual financial transactions.)*

### 2.4 Data Source Wizard (ETL Ingestion)
The Data Source Wizard is the primary interface for importing transaction data from external sources (such as bank CSV exports) into the Finance Tracker. The process handles extraction, transformation, data validation, and automated categorization.

#### 2.4.1 Setting Up an Account Source Mapping
Before importing data from a new financial institution, an **Account Source** must be mapped. The wizard allows users to:
* Define a new account source name and create its dedicated staging table.
* Visually map the external CSV columns (e.g., "Posting Date", "Details") directly to the core transaction database schema (e.g., `posting_date`, `description`).
* Select constraints such as flag fields that define a *unique record* to prevent accidental duplicate rows in future imports.

#### 2.4.2 Uploading and Staging Data
When importing an active CSV file against an existing Account Source:
* **Checksum Validation:** The system calculates the file's checksum and checks the `System Import Logs`. If the exact file has already been imported, it blocks the process to avoid duplication.
* **Staging Area:** The unique staging table is cleared, and the CSV contents are loaded. This acts as a sandbox to evaluate schema and data typing alignment before touching core financial records.
* Any required metadata (like missing specific transaction types) is automatically discovered and generated.

#### 2.4.3 Synchronizing the Core Ledger
* The ETL pipeline extracts data from the clean staging table and commits it accurately into the primary `sys_transaction` master table.
* Rows that hit predefined unique constraint thresholds are flagged and merged correctly, gracefully rejecting record overlaps spanning date periods.

#### 2.4.4 Automated Multi-tier Categorization
After financial transactions drop into the ledger, a robust categorization rule engine parses them:
1. **Source-Derived Logic:** System automatically links categories extracted straight from raw CSV logic where matched directly.
2. **Rules-Based Engine:** Custom user rules (e.g. conditional statements containing `equals`, `amount_range`, `date_range`) dynamically categorize generic purchases into expense or income buckets.
3. **Manual Overrides:** Most importantly, user-defined manual categorization logic cleanly supersedes the automatic system rules without fear of subsequent ETL cycles re-writing over them.

### 2.5 Budgets
*(Placeholder: To be completed. Will cover setting up budgeting goals, assigning categories, and tracking actual spending vs. planned budgets.)*

### 2.6 Reports & Analytics
*(Placeholder: To be completed. Will cover generating customized visualizations, cash flow analysis, and category breakdown reports.)*

### 2.7 Settings
*(Placeholder: To be completed. Will cover managing user preferences, configuring custom transaction categories, and database schema mappings.)*
