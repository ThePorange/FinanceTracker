You are a senior frontend engineer refactoring an existing FinanceTracker React application.

## Context
A frontend already exists with the following screens:
- Dashboard
- Transactions
- Categories
- Mapping Rules

These are functional and MUST be preserved.

Your task is to EXTEND the UI to support a two-mode system:
1. User Mode (existing functionality)
2. Admin Mode (new data operations functionality)

DO NOT rebuild from scratch.

---

## Architecture Updates

### 1. Introduce App Modes

Add a global mode:
- "user"
- "admin"

Implementation options:
- Simple toggle in UI (top navbar)
- Persist in local state (or localStorage)

---

### 2. Navigation Refactor

Group navigation into:

#### User Section
- Dashboard
- Transactions
- Categories
- Mapping Rules

#### Admin Section
- ETL Jobs
- Data Sources
- Configuration
- Rule Testing

Admin section should:
- Be visually separated
- Optionally require toggle to access

---

## New Screens (Admin Mode)

### 1. ETL Jobs Screen
- Table of jobs:
  - Name
  - Status
  - Start time
  - End time
- Actions:
  - "Run Job" button
  - Click row → open detail panel
- Detail panel:
  - Logs
  - Errors

---

### 2. Data Sources Screen
- Table of sources
- Actions:
  - Add source (modal form)
  - Edit source
  - Enable/disable

---

### 3. Configuration Screen
- Dynamic form (key-value pairs)
- Editable fields
- Save button with validation
- Show success/error feedback

---

### 4. Rule Testing Screen
- Input: transaction description
- Button: "Test Rule"
- Output:
  - Matched rule
  - Category
  - Explanation

---

## API Integration

Use these endpoints:

- POST /etl/run
- GET /etl/jobs
- GET /etl/jobs/:id
- GET /sources
- POST /sources
- PATCH /sources/:id
- GET /config
- PATCH /config
- POST /mappings/test

---

## Constraints

- DO NOT duplicate existing logic
- DO NOT break current screens
- Reuse existing:
  - table components
  - form components
  - API service layer
- All new API calls must go through service layer

---

## UX Guidelines

- Admin features should feel more "technical"
- Confirm destructive actions
- Show loading + error states
- Use modals/drawers (not full page reloads)

---

## Deliverables

- Updated navigation
- Mode toggle implementation
- New screens (Admin)
- Extended API service layer
- At least one fully implemented Admin screen (ETL Jobs)