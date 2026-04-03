You are a senior backend engineer extending an existing API for a FinanceTracker application.

## Context
An API already exists supporting:
- Transactions
- Categories
- Mapping Rules

This API implements business logic defined in a process layer (ETL, mapping, normalization).

Your task is to EXTEND (not replace) the API to support admin/data-operations functionality required by the frontend.

## Requirements

### 1. ETL Job Endpoints

POST /etl/run
- Triggers a manual ETL process
- Body:
  - sourceId (optional)
- Response:
  - jobId
  - status ("started")

GET /etl/jobs
- Returns list of ETL jobs
- Fields:
  - id
  - name
  - status (pending, running, success, failed)
  - startedAt
  - completedAt

GET /etl/jobs/:id
- Returns detailed job info
- Include:
  - logs (array of strings)
  - error messages (if any)

---

### 2. Data Sources Endpoints

GET /sources
POST /sources
PATCH /sources/:id

Fields:
- id
- name
- type (csv, api, manual)
- status (active, disabled)
- config (JSON)

---

### 3. Configuration Endpoints

GET /config
- Returns key-value configuration object

PATCH /config
- Updates configuration
- Must validate inputs

Example config:
- defaultCategory
- mappingThreshold
- parsingRules

---

### 4. Mapping Rule Testing

POST /mappings/test

Body:
- description (string)

Response:
- matchedRuleId
- matchedPattern
- assignedCategory
- confidence (optional)

---

## Constraints
- Do NOT break existing endpoints
- Keep response formats consistent
- Reuse existing service patterns
- Ensure all endpoints are stateless
- Include basic validation

## Deliverables
- Endpoint definitions
- Example request/response payloads
- Service-layer implementation outline