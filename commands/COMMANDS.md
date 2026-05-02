# Slash Commands

## Overview

These commands are designed to accelerate development by providing structured prompts for common tasks. Invoke them by typing the command name.

---

## `/design-feature`

**Purpose:** Design a complete feature specification with architecture, API, database, and business logic.

**Usage:**
```
/design-feature [feature name]
```

**Example:**
```
/design-feature Smart Dispatch Auto-Assignment
```

**Output:**
- Feature overview and goals
- Database schema changes
- API endpoints
- Business logic flow
- Edge cases
- Implementation tasks

---

## `/generate-module`

**Purpose:** Generate a complete NestJS module structure with controller, service, DTOs, and tests.

**Usage:**
```
/generate-module [module-name] [entities...]
```

**Example:**
```
/generate-module zone-management Zone District City
```

**Output:**
- Module folder structure
- Controller with CRUD endpoints
- Service with business logic
- DTOs with validation
- Unit test template
- Module registration

---

## `/create-api`

**Purpose:** Generate a complete REST API endpoint with request/response DTOs and validation.

**Usage:**
```
/create-api [method] [path] [description]
```

**Example:**
```
/create-api POST /shipments/:id/cancel Cancel a shipment with reason
```

**Output:**
- Controller method
- Request DTO with validation
- Response DTO
- Service method signature
- Error handling

---

## `/review-code`

**Purpose:** Review code against project standards and best practices.

**Usage:**
```
/review-code [file-path]
```

**Example:**
```
/review-code src/modules/shipments/shipments.service.ts
```

**Output:**
- Code quality assessment
- Security concerns
- Performance issues
- Style violations
- Suggested improvements

---

## `/db-migration`

**Purpose:** Plan and generate a safe database migration.

**Usage:**
```
/db-migration [description of change]
```

**Example:**
```
/db-migration Add courier performance score field with index
```

**Output:**
- Prisma schema changes
- Migration SQL
- Rollback plan
- Data migration script (if needed)
- Index recommendations

---

## `/business-flow`

**Purpose:** Document a business process with actors, steps, data changes, and edge cases.

**Usage:**
```
/business-flow [process-name]
```

**Example:**
```
/business-flow Courier Cash Deposit and Reconciliation
```

**Output:**
- Actor definitions
- Step-by-step flow
- State transitions
- Data changes per step
- Edge cases and handling
- Mermaid sequence diagram

---

## `/test-scenario`

**Purpose:** Generate comprehensive test cases for a feature or service.

**Usage:**
```
/test-scenario [feature-name]
```

**Example:**
```
/test-scenario Wallet transaction processing
```

**Output:**
- Unit test cases
- Integration test cases
- E2E test scenarios
- Edge cases to test
- Mock data requirements

---

## `/security-review`

**Purpose:** Perform a security review of a feature, endpoint, or code section.

**Usage:**
```
/security-review [feature or file]
```

**Example:**
```
/security-review Payout approval workflow
```

**Output:**
- Authentication check
- Authorization matrix
- Input validation review
- Data exposure risks
- Audit logging requirements
- Compliance considerations

---

## `/performance-check`

**Purpose:** Analyze and optimize performance of a query, endpoint, or process.

**Usage:**
```
/performance-check [query or endpoint]
```

**Example:**
```
/performance-check GET /shipments with merchant filter
```

**Output:**
- Query execution plan
- Index recommendations
- Caching strategy
- Pagination suggestions
- Scaling considerations

---

## `/docs-generate`

**Purpose:** Generate documentation for a module, API, or feature.

**Usage:**
```
/docs-generate [type] [name]
```

**Example:**
```
/docs-generate api shipments
```

**Output:**
- Markdown documentation
- API examples
- Request/response samples
- Error codes
- Usage instructions

---

## How to Use Commands

Simply type the command followed by your request. I will:
1. Load the relevant skill(s)
2. Apply project-specific context
3. Generate the requested output
4. Follow coding standards and best practices

**Tip:** You can combine commands with role switching:
```
As a Backend Developer, /generate-module fraud-detection ShipmentRisk BlacklistedPhone
```
