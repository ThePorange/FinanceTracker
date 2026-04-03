## External Specification

The system must strictly follow the business logic and process definitions documented in:

- process.md (located in the project root folder)

This document defines:
- End-to-end ingestion flow
- Mapping logic
- ETL behavior
- Categorization rules (including source-derived categories)
- Rule execution sequence (Section 3.5)

If there is any conflict between this prompt and process.md:
- process.md takes precedence for business logic
- this prompt takes precedence for architecture and implementation

The implementation must not invent or assume behavior that contradicts process.md.

# Backend API – Transaction Ingestion & Categorization Platform (Node.js / TypeScript)

## Objective

Build a backend API for a financial transaction ingestion and categorization system using:

* Language: TypeScript
* Framework: NestJS (preferred)
* Database: SQLite

The system must support:

* CSV ingestion from multiple account sources
* Configurable field mapping via database tables
* ETL into normalized transaction schema
* Categorization:

  * Source-derived (from CSV)
  * Rule-based
  * Future ML-based
* Manual overrides with highest priority

---

## Architecture Requirements

* Use NestJS modular architecture:

  * Controllers (API layer)
  * Services (business logic)
  * Repositories (database access)
* Use dependency injection
* Strict TypeScript typing (interfaces / DTOs)
* No business logic in controllers

---

## Core Modules

### 1. Config Module

CRUD APIs for:

* sys_account_source
* sys_account_mapping
* sys_transaction_category
* sys_rules
* sys_currency
* sys_currency_pair
* sys_fx_rate
* sys_config
* sys_staging_fields

Requirements:

* DTO validation (class-validator)
* Pagination and filtering

---

### 2. Staging Module

Responsibilities:

* Create staging tables dynamically:

  * naming: `staging_<account_source_name>`
* Parse CSV headers and sample data
* Store mappings

Libraries:

* CSV parsing: `csv-parse` or `papaparse`

Endpoints:

* Upload CSV (preview)
* Confirm mapping and create staging table

---

### 3. ETL Module

Endpoint:
`POST /import/:account_source_id`

Responsibilities:

1. Load CSV into staging table

2. Validate import:

   * checksum
   * uniqueness rules

3. Transform into `sys_transaction`:

   * apply mappings
   * resolve foreign keys
   * auto-create transaction types

4. Source-derived categorization:

   * If mapping includes `category_name`:

     * lookup/create category
     * insert into `sys_transaction_category_map`:

       * is_auto = 1
       * confidence = 1.0
       * sys_rule_id = NULL

5. Log import results

---

### 4. Rule Engine Module

Endpoint:
`POST /rules/apply/:account_source_id`

Responsibilities:

* Parse `rule_json`
* Support rule types:

  * contains
  * equals
  * date_range
  * amount_range
  * composite (AND)

Execution:

* Find matching transactions
* Exclude manual overrides
* Insert into mapping table

Idempotency:

* Prevent duplicates via delete + insert or upsert

---

### 5. Categorization Logic

Support:

| Type   | is_auto | sys_rule_id | confidence  |
| ------ | ------- | ----------- | ----------- |
| Manual | 0       | NULL        | 1.0         |
| Source | 1       | NULL        | 1.0         |
| Rule   | 1       | NOT NULL    | 0.6–0.95    |
| ML     | 1       | optional    | probability |

---

### 6. Reporting Module

Endpoint:
`GET /transactions`

Must return:

* transaction data
* resolved final category

Resolution:

* manual overrides first
* else highest-confidence auto

---

### 7. Database Layer

Library:

* `better-sqlite3`

Requirements:

* Prepared statements
* Transaction support for ETL
* Batch inserts

---

### 8. Background Jobs

* Run ETL and rule engine asynchronously
* Provide status endpoints

---

## Deliverables

* Fully working NestJS project
* Modular services
* SQLite integration
* Rule engine implementation
* Example seed data
* API documentation

---

## Success Criteria

* CSV ingestion works end-to-end
* Mapping drives ETL dynamically
* Categories correctly assigned
* Rules execute without duplication
* Manual overrides always respected
* System is ML-ready

---

## Important Notes

* Do NOT build UI yet
* Focus on backend correctness and modularity
* Avoid hardcoding logic
* Ensure clean separation of concerns

---
