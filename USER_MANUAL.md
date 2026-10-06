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
The Data Source Wizard is the core ingestion engine for importing external financial transaction files (such as bank CSV exports) into the Finance Tracker ledger. The ETL (Extract, Transform, Load) pipeline handles schema mapping, file and row-level duplicate detection, date/currency/financial normalization, core ledger synchronization, automated multi-tier categorization, and transactional rollback.

#### 2.4.1 Setting Up an Account Source & Schema Mapping
Before importing data from a financial institution, an **Account Source** (`sys_account_source`) must be defined:
* **Source Configuration:** Defines account source metadata including source name, base currency (`base_currency_id`), and debit polarity (`debit_negative` flag indicating if negative values represent debits or credits).
* **Dynamic Staging Table:** Creates a dedicated staging table (`staging_<source_name>`) with typed columns (`TEXT`, `DATE`, `REAL`, `INTEGER`) and default value constraints.
* **Column Mapping (`sys_account_mapping`):** Visually maps incoming CSV header names (`sourcefile_fieldname`) to staging fields (`staging_table_fieldname`) and target transaction ledger fields (`transaction_table_fieldname`).
* **System Staging Fields:** Automatically appends system metadata columns (e.g. `sys_account_source_id`, `account_source_row`, `record`, `records`, `row_checksum`, `created_date`) defined in `sys_staging_fields`.
* **Unique Record Constraints:** Flags specific fields (`unique_records = 1`) used to build composite unique keys for duplicate detection.

#### 2.4.2 Uploading, Validation & Data Staging
When a CSV file is uploaded for ingestion against an Account Source:
1. **Dual Checksum Validation:**
   * **File SHA-256 Hash:** Computes the cryptographic checksum of the uploaded file buffer.
   * **Unique Dataset SHA-256 Checksum:** Extracts all mapped unique fields across all rows, concatenates and sorts them, and generates a unique dataset hash.
   * **Duplicate File Prevention:** Checks `sys_import_log` against previous successful imports. If a matching unique dataset checksum exists, the import is immediately blocked.
2. **Atomic Staging Sandbox:**
   * The dedicated staging table is cleared (`DELETE FROM staging_...`) inside an isolated transaction.
   * CSV records are parsed (with UTF-8 BOM handling and empty row stripping) and inserted into the staging table with SQL `COALESCE` default value fallbacks.
3. **Sequence & Occurrence Tracking (`record` / `records`):**
   * Groups rows sharing identical unique non-derived values to compute total occurrence counts (`records`) and sequence positions (`record`) for multi-line transactions.

#### 2.4.3 Transformation, Validation & Core Ledger Synchronization
Once data is staged, the pipeline transforms and validates records before writing to `sys_transaction`:
* **Date Normalization:** Converts varied date formats (e.g. `YYYYMMDD`, `DD/MM/YYYY`, `DD-MM-YYYY`, `YY-MM-DD`) into standard ISO `YYYY-MM-DD` format.
* **Financial Amount & DR/CR Resolution:**
  * Evaluates debit/credit indicators (`DR`/`DEBIT` vs `CR`/`CREDIT`).
  * Applies `debit_negative` logic to determine financial polarity.
  * Standardizes outputs into normalized signed `base_amount` (negative for Debits/expenses, positive for Credits/income) and `drcr` flags (`DR` or `CR`).
* **Composite Unique Overlap Guard:** Before inserting into the main ledger, the engine queries `sys_transaction` for matches against composite unique constraints (`unique_records`). If overlapping records exist for the account source, the entire import transaction is safely aborted and rolled back.
* **Metadata & Foreign Key Auto-Discovery:** Dynamic foreign keys (such as `sys_transaction_type_id`) are auto-created in `sys_transaction_type` if missing. Deterministic row checksums (`row_checksum`) are calculated per transaction line.
* **Atomic Ledger Ingestion:** Inserts clean, normalized records into `sys_transaction` linked to `sys_account_source_id` and `sys_import_log_id`.

#### 2.4.4 Automated Multi-tier Categorization & Priority Resolution
After transactions are committed to the ledger, a multi-tier categorization engine evaluates and assigns categories:
1. **Tier 1 - Source-Derived Categorization:** If a CSV field is mapped to `category_name`, categories are created automatically in `sys_transaction_category` and assigned in `sys_transaction_category_map` (`is_auto = 1`, `confidence = 1.0`).
2. **Tier 2 - Rules Engine Execution (`RulesService`):**
   * Evaluates custom JSON rules (`sys_rules`) against transactions.
   * Supports rule types: `contains` (substring text search), `equals` (exact string match), `date_range` (`BETWEEN` dates), `amount_range` (min/max amount filters), `select_transactions`/`exclude_transactions` (by checksums), `source` (by source ID), and composite nested `and`/`or` expressions.
   * Execution is idempotent: prior auto-mappings for the executed rule are cleared before inserting new mappings with rule-specific confidence scores (0.80 – 1.0).
3. **Tier 3 - Manual Overrides & View Priority Resolution (`vw_transaction_final_category`):**
   * User-defined manual category assignments (`is_auto = 0`) take absolute precedence over automated assignments.
   * Final transaction categories are resolved via database view `vw_transaction_final_category`, which prioritizes manual overrides first, followed by the highest confidence automatic rule mapping.

#### 2.4.5 Import Management & Rollback Support
* **Import Logging (`sys_import_log`):** Detailed status logs (`Processing`, `Success`, `Error`, `Deleted`) and execution trace details are recorded for auditability.
* **Atomic Import Rollback:** Users can delete/rollback an import job (`deleteEtlJob`), which atomically removes all associated transaction records and category mappings while preserving log integrity.

### 2.5 Budgets
*(Placeholder: To be completed. Will cover setting up budgeting goals, assigning categories, and tracking actual spending vs. planned budgets.)*

### 2.6 Reports & Analytics
*(Placeholder: To be completed. Will cover generating customized visualizations, cash flow analysis, and category breakdown reports.)*

### 2.7 Settings
*(Placeholder: To be completed. Will cover managing user preferences, configuring custom transaction categories, and database schema mappings.)*
