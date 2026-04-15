# Rule Engine & Categorization System – Implementation Prompt

## Objective

Design and implement a rule-based transaction categorization engine that integrates with an existing SQLite schema. The system must support:

1. Rule-based categorization (deterministic logic)
2. Future ML-based categorization (probabilistic)
3. Manual overrides (highest priority)

The system must be modular, extensible, and production-ready.

---

## Core Principles

* Categories are stored in `sys_transaction_category`
* Rules DO NOT store category names as text
* Rules reference `sys_transaction_category_id`
* All categorization results are written to `sys_transaction_category_map`
* Manual overrides always take precedence over automated results

---

## Data Flow

1. Transactions are loaded into `sys_transaction`
2. Rules are defined in `sys_rules` with `rule_json`
3. Rule engine evaluates rules and assigns categories
4. Results are written to `sys_transaction_category_map`
5. Manual overrides are inserted separately and override automated results

---

## Rule Engine Requirements

### Rule Structure (`sys_rules.rule_json`)

Rules must be JSON-based and support multiple types.

Supported rule types:

#### 1. Text Match

```json
{
  "type": "contains",
  "field": "description",
  "value": "STARBUCKS"
}
```

#### 2. Exact Match

```json
{
  "type": "equals",
  "field": "description",
  "value": "AMAZON MKTPLACE"
}
```

#### 3. Date Range (Required)

```json
{
  "type": "date_range",
  "field": "transaction_date",
  "start": "YYYY-MM-DD",
  "end": "YYYY-MM-DD"
}
```

#### 4. Amount Range

```json
{
  "type": "amount_range",
  "field": "base_amount",
  "min": -100,
  "max": -1
}
```

#### 5. Composite Rule (AND conditions)

```json
{
  "type": "and",
  "conditions": [
    { "type": "contains", "field": "description", "value": "AIRBNB" },
    { "type": "date_range", "field": "transaction_date", "start": "2026-03-01", "end": "2026-03-10" }
  ]
}
```

---

## Rule Execution Logic

* Rules are processed per `sys_account_source_id`
* For each rule:

  * Identify matching transactions
  * Skip transactions that already have a manual category (`is_auto = 0`)
  * Insert results into `sys_transaction_category_map` with:

    * `is_auto = 1`
    * `confidence` based on rule type (default values acceptable)
    * `sys_rule_id` populated

---

## Confidence Scoring

Assign default confidence values by rule type:

| Rule Type    | Confidence |
| ------------ | ---------- |
| equals       | 0.95       |
| contains     | 0.85       |
| date_range   | 0.90       |
| amount_range | 0.80       |
| composite    | 0.90       |

Confidence must always be between 0.0 and 1.0.

---

## Manual Override Handling

* Manual inserts use:

  * `is_auto = 0`
  * `confidence = 1.0`
  * `sys_rule_id = NULL`
* Rule engine MUST NOT overwrite manual assignments
* Queries must prioritize manual over auto

---

## Idempotency & Reprocessing

* Rule execution must be repeatable without duplicating data
* Before inserting:

  * Either delete existing auto rows for that rule
  * OR upsert intelligently

---

## ML Integration (Future-Ready)

Design the system so ML can be added without schema changes:

* ML outputs insert into `sys_transaction_category_map`
* Use:

  * `is_auto = 1`
  * `confidence = model probability`
  * `sys_rule_id` referencing a special ML rule (optional)

---

## Query Layer

Create a view to return the final category per transaction:

* Manual overrides take priority
* If no manual category exists, return highest-confidence auto category

---

## Performance Requirements

* Use indexes on:

  * `sys_transaction.sys_account_source_id`
  * `sys_transaction_category_map.sys_transaction_id`
* Avoid full table scans where possible
* Batch inserts for performance

---

## Implementation Notes

* Language: Python preferred
* Use a modular design:

  * Rule parser
  * Rule evaluator
  * DB writer
* Avoid hardcoding rule logic outside JSON interpretation
* Ensure clean separation between:

  * data access
  * rule logic
  * orchestration

---

## Deliverables

1. Rule engine module
2. JSON rule parser
3. Execution pipeline
4. Final category SQL view
5. Example rules and test data

---

## Success Criteria

* Rules correctly categorize transactions
* Manual overrides always take precedence
* System supports multiple rule types
* System can be extended to ML without schema changes
* No duplicate or conflicting category assignments

---
