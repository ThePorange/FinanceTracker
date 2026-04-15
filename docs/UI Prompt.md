## Application Context
This application is a personal finance tracking system.

It focuses on:
- Normalizing financial transactions from multiple sources
- Mapping raw transaction descriptions to structured categories
- Supporting both automatic and user-defined categorization
- Providing visibility into spending patterns

The UI should reflect these domain concepts clearly and consistently.

You are a senior frontend engineer building a production-ready internal web application UI.

## Objective
Build a clean, modular, and reusable frontend for a FinanceTracker application that interacts with an API layer in this project.

The application allows users to:
- Upload and view financial transactions (bank + credit card)
- Categorize transactions (manual + auto-mapped categories)
- Filter, search, and analyze spending
- Maintain mappings between raw transaction descriptions and normalized categories

## Tech Requirements
- Framework: React (with TypeScript)
- Build Tooling: Vite
- Styling: TailwindCSS
- State Management: React Query (for server state) + minimal local state (useState)
- Routing: React Router
- Forms: React Hook Form
- Charts: Recharts (or similar lightweight lib)

## Architecture Principles
- Use a feature-based folder structure:
  - /features/transactions
  - /features/categories
  - /features/mappings
  - /components/shared
  - /services/api
- All API calls must be abstracted into a service layer
- No business logic in components — keep components presentational where possible
- Reusable components must live in /components/shared
- Use strict typing for all models

## Core Screens

### 1. Transactions Screen
- Table view of transactions
- Columns:
  - Date
  - Description
  - Amount
  - Account
  - Auto Category
  - User Category
- Features:
  - Search (fuzzy match on description)
  - Filters (date range, category, account)
  - Inline category editing (dropdown)
  - Pagination or virtualization

### 2. Transaction Detail Panel
- Opens on row click (side drawer or modal)
- Shows:
  - Full transaction details
  - Raw description
  - Suggested category
  - Editable assigned category
  - Mapping history (if exists)

### 3. Category Management Screen
- List of categories
- Ability to:
  - Create
  - Edit
  - Delete
- Categories support:
  - Name
  - Parent category (optional)
  - Type (e.g. fixed, variable, income)

### 4. Mapping Rules Screen
- Displays mapping rules:
  - Match pattern (string or regex)
  - Assigned category
  - Priority
- Ability to:
  - Create rule
  - Edit rule
  - Delete rule
- Show preview of matched transactions

### 5. Dashboard Screen
- High-level analytics:
  - Spend by category (bar chart)
  - Monthly trend (line chart)
  - Top merchants
- Allow date range selection

## UX Guidelines
- Clean, minimal UI (internal tool, not marketing site)
- Fast interactions (optimistic updates where possible)
- Use modals/drawers instead of page reloads
- Consistent spacing and typography via Tailwind
- Use loading skeletons for async data
- Show clear empty states

## API Integration
- Assume REST endpoints:
  - GET /transactions
  - PATCH /transactions/:id
  - GET /categories
  - POST /categories
  - GET /mappings
  - POST /mappings
- Use React Query hooks:
  - useTransactions()
  - useCategories()
  - useMappings()

## Data Models (TypeScript)

Transaction:
- id: string
- date: string
- description: string
- amount: number
- account: string
- autoCategory: string
- userCategory: string | null

Category:
- id: string
- name: string
- parentId: string | null
- type: string

MappingRule:
- id: string
- pattern: string
- categoryId: string
- priority: number

## Deliverables
- Full React project structure
- Typed components and hooks
- Example API service implementation
- At least one fully implemented screen (Transactions)
- Reusable table component
- Reusable form components

## Constraints
- Do NOT hardcode data
- Do NOT mix API calls inside UI components
- Do NOT use heavy state management libraries (no Redux)
- Keep bundle size minimal

## Output Format
- Provide full file structure
- Provide key files with code
- Keep code production-quality and readable

## Backend Assumptions
- All business logic (category assignment, mapping rules, validation) is handled by the API layer
- The frontend must treat the API as the single source of truth
- Do not attempt to replicate or infer backend logic in the UI

