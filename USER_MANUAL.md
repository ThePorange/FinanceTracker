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
The Data Source Wizard is the core ingestion engine for importing external financial transaction files (supporting both `.CSV` and `.OFX` formats) into the Finance Tracker ledger. The ETL (Extract, Transform, Load) pipeline handles format detection, schema mapping, file and row-level duplicate detection, date/currency/financial normalization, core ledger synchronization, automated multi-tier categorization, and transactional rollback.

#### 2.4.1 Setting Up an Account Source & Schema Mapping
Before importing data from a financial institution, an **Account Source** (`sys_account_source`) must be defined:
* **Source Configuration:** Defines account source metadata including source name, base currency (`base_currency_id`), and debit polarity (`debit_negative` flag indicating if negative values represent debits or credits).
* **Multi-Format Mapping (`account_source_type`):** Supports configuring distinct `.CSV` (`staging_<name>_csv`) and `.OFX` (`staging_<name>_ofx`) mappings under the same Account Source ID (`sys_account_source_id`).
* **Dynamic Staging Tables:** Creates dedicated staging tables with typed columns (`TEXT`, `DATE`, `REAL`, `INTEGER`) and default value constraints.
* **Column & Tag Mapping (`sys_account_mapping`):** Visually maps incoming CSV header names or OFX transaction tags (`TRNTYPE`, `DTPOSTED`, `TRNAMT`, `FITID`, `NAME`, `MEMO`, `CHECKNUM`) to staging fields (`staging_table_fieldname`) and target transaction ledger fields (`transaction_table_fieldname`).
* **System Staging Fields:** Automatically appends system metadata columns (e.g. `sys_account_source_id`, `account_source_type`, `account_source_row`, `record`, `records`, `row_checksum`, `created_date`) defined in `sys_staging_fields`.
* **Unique Record Constraints:** Flags specific fields (`unique_records = 1`) used to build composite unique keys for row checksum calculation.
* **Mapping Change Safeguard:** Editing `unique_records` on existing mappings triggers a validation warning explaining that changing unique fields will alter checksum calculations for future imports.

#### 2.4.2 Uploading, Validation & Data Staging
When a `.CSV` or `.OFX` file is uploaded for ingestion against an Account Source:
1. **Format & Schema Validation:**
   * Validates file extension (`.csv` vs `.ofx`) against configured `account_source_type` mappings for the selected account source.
   * Raises an explicit error if no mapping exists for the selected file format on that account source.
2. **Dual Checksum Validation:**
   * **File SHA-256 Hash:** Computes the cryptographic checksum of the uploaded file buffer.
   * **Unique Dataset SHA-256 Checksum:** Extracts all mapped unique fields across all rows, concatenates and sorts them, and generates a unique dataset hash.
   * **Duplicate File Prevention:** Checks `sys_import_log` against previous non-deleted imports. If a matching checksum exists, the entire file is blocked.
3. **Atomic Staging Sandbox:**
   * The format-specific staging table (`staging_<name>_csv` or `staging_<name>_ofx`) is cleared (`DELETE FROM staging_...`) inside an isolated transaction.
   * CSV records or parsed OFX `<STMTTRN>` nodes are staged with SQL `COALESCE` default value fallbacks.
4. **Sequence & Occurrence Tracking (`record` / `records`):**
   * Groups rows sharing identical unique non-derived values to compute total occurrence counts (`records`) and sequence positions (`record`) for multi-line transactions.

#### 2.4.3 Transformation, Row-Level Deduplication & Core Ledger Synchronization
Once data is staged, the pipeline transforms and validates records before writing to `sys_transaction`:
* **Date Normalization:** Converts varied date formats (e.g. `YYYYMMDD`, `YYYYMMDDHHMMSS`, `DD/MM/YYYY`, `DD-MM-YYYY`) into standard ISO `YYYY-MM-DD` format.
* **Financial Amount & DR/CR Resolution:**
  * Evaluates debit/credit indicators (`DR`/`DEBIT` vs `CR`/`CREDIT`).
  * Applies `debit_negative` logic to determine financial polarity.
  * Standardizes outputs into normalized signed `base_amount` (negative for Debits/expenses, positive for Credits/income) and `drcr` flags (`DR` or `CR`).
* **Row-Level Deduplication (Partial Ingestion):**
  * Computes deterministic `row_checksum` for each transaction line based on unique field combinations.
  * Compares each staged row's `row_checksum` against existing `sys_transaction.row_checksum` values for the same `(sys_account_source_id, account_source_type)`.
  * **Skips previously loaded duplicate rows** and inserts **only new records** into `sys_transaction`.
* **Metadata & Foreign Key Auto-Discovery:** Dynamic foreign keys (such as `sys_transaction_type_id`) are auto-created in `sys_transaction_type` if missing.
* **Atomic Ledger Ingestion:** Inserts clean, normalized records into `sys_transaction` tagged with `sys_account_source_id`, `account_source_type`, and `sys_import_log_id`.

#### 2.4.4 Automated Multi-tier Categorization & Priority Resolution
After transactions are committed to the ledger, a multi-tier categorization engine evaluates and assigns categories:
1. **Tier 1 - Source-Derived Categorization:** If a CSV/OFX field is mapped to `category_name`, categories are created automatically in `sys_transaction_category` and assigned in `sys_transaction_category_map` (`is_auto = 1`, `confidence = 1.0`).
2. **Tier 2 - Rules Engine Execution (`RulesService`):**
   * Evaluates custom JSON rules (`sys_rules`) against transactions.
   * Supports rule types: `contains` (substring text search), `equals` (exact string match), `date_range` (`BETWEEN` dates), `amount_range` (min/max amount filters), `select_transactions`/`exclude_transactions` (by checksums), `source` (by source ID), and composite nested `and`/`or` expressions.
   * Execution is idempotent: prior auto-mappings for the executed rule are cleared before inserting new mappings with rule-specific confidence scores (0.80 – 1.0).
3. **Tier 3 - Manual Overrides & View Priority Resolution (`vw_transaction_final_category`):**
   * User-defined manual category assignments (`is_auto = 0`) take absolute precedence over automated assignments.
   * Final transaction categories are resolved via database view `vw_transaction_final_category`, which prioritizes manual overrides first, followed by the highest confidence automatic rule mapping.

#### 2.4.5 Import Telemetry & Rollback Support
* **Import Logging (`sys_import_log`):** Detailed status logs (`Processing`, `Success`, `Error`, `Deleted`), file format (`account_source_type`), and counts for newly inserted records (`newRecords`) vs skipped duplicate records (`ignoredRecords`) are logged for auditability.
* **Atomic Import Rollback:** Users can delete/rollback an import job (`deleteEtlJob`), which atomically removes all associated transaction records and category mappings for that specific `sys_import_log_id` while preserving log integrity.

### 2.5 Budgets
*(Placeholder: To be completed. Will cover setting up budgeting goals, assigning categories, and tracking actual spending vs. planned budgets.)*

### 2.6 Reports & Analytics
*(Placeholder: To be completed. Will cover generating customized visualizations, cash flow analysis, and category breakdown reports.)*

### 2.7 Settings
*(Placeholder: To be completed. Will cover managing user preferences, configuring custom transaction categories, and database schema mappings.)*
