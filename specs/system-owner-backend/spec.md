# Feature Specification: System Owner Backend Layer

**Feature Branch**: `system-owner-backend`
**Created**: 2026-05-20
**Status**: Draft
**Input**: Add a Platform Owner backend layer for Trackora SaaS tenant, plan, subscription, feature flag, usage, billing, audit, and support impersonation management.

## User Scenarios & Testing

### User Story 1 - Manage Tenants (Priority: P1)

Platform owners/admins can create, list, inspect, update, activate, suspend, cancel, assign plans, manage trials, and view summaries for SaaS tenants.

**Why this priority**: Tenant lifecycle is the root Platform Owner capability and blocks subscriptions, billing, analytics, and support.

**Independent Test**: Create a tenant, assign a plan, change status with reason, and retrieve usage/users/merchants/couriers/shipments summaries through platform-only APIs.

**Acceptance Scenarios**:

1. **Given** an authenticated `PLATFORM_OWNER` with `manage_tenants`, **When** they create a tenant, **Then** a `Tenant` is persisted with status `TRIAL` or `ACTIVE` and an audit log is written.
2. **Given** a tenant is `ACTIVE`, **When** a platform user suspends it with a reason, **Then** status becomes `SUSPENDED`, access is blocked for tenant users where applicable, and an audit log records old/new values.
3. **Given** a tenant admin JWT, **When** they call `/platform/tenants`, **Then** the API returns `403`.

---

### User Story 2 - Manage Plans And Subscriptions (Priority: P1)

Platform users can define SaaS plans, limits, feature entitlements, subscriptions, trial windows, renewal dates, payment status, and usage against limits.

**Why this priority**: Plans and subscriptions drive monetization and enforce SaaS boundaries.

**Independent Test**: Create plans, create subscription, change plan, renew/cancel/pause, and validate usage against plan limits.

**Acceptance Scenarios**:

1. **Given** a plan has active subscriptions, **When** a platform user deletes it, **Then** the system rejects unsafe deletion and allows archive instead.
2. **Given** a tenant exceeds monthly shipment limit, **When** usage is checked, **Then** response shows current usage, limit, remaining quota, and exceeded flag.
3. **Given** a subscription is changed, **When** the update succeeds, **Then** audit log records subscription old/new state and reason.

---

### User Story 3 - Manage Feature Flags (Priority: P1)

Platform users can define global flags, inherit plan-level flags, override tenant-level flags, and audit every flag mutation.

**Why this priority**: Feature flags control monetized capabilities like Smart Dispatch, Fraud Detection, COD Wallet, Bulk Upload, WhatsApp, API access, Public Tracking, and Advanced Reports.

**Independent Test**: Set a plan flag, override it for one tenant, resolve effective tenant flags, and verify audit log entries.

**Acceptance Scenarios**:

1. **Given** plan `Growth` enables `bulk_upload`, **When** a tenant on Growth requests effective flags, **Then** `bulk_upload` is enabled unless overridden.
2. **Given** a tenant-level override disables `whatsapp_notifications`, **When** effective flags are queried, **Then** the tenant override wins over plan inheritance.
3. **Given** a flag change request lacks reason, **When** endpoint is called, **Then** validation rejects the request.

---

### User Story 4 - Platform Analytics And Billing Overview (Priority: P2)

Platform users can view high-level SaaS metrics, usage trends, revenue/billing summaries, unpaid tenants, past due tenants, manual invoice records, and export billing summaries.

**Why this priority**: Operational and finance visibility are required after core tenant/subscription management.

**Independent Test**: Seed tenants, shipments, wallets, payouts, subscriptions, invoices, and verify overview metrics and billing exports.

**Acceptance Scenarios**:

1. **Given** multiple tenants with shipments, **When** `/platform/analytics/overview` is requested, **Then** totals for tenants, statuses, shipments, merchants, couriers, COD, payouts, and fraud are returned.
2. **Given** unpaid invoice placeholders exist, **When** billing overview is requested, **Then** unpaid and past due tenants are listed with subscription status.
3. **Given** a platform finance user, **When** export billing summary is requested, **Then** export contains tenant, plan, billing period, amount, payment status, and renewal date.

---

### User Story 5 - Audit Logs And Support Impersonation (Priority: P1)

Platform support can search tenants, view tenant health, start/end impersonation with mandatory reason, expiry, and strict audit logging. Dangerous actions can be blocked while impersonating.

**Why this priority**: Support access is sensitive and must be traceable before production operations.

**Independent Test**: Start impersonation with reason, verify session expiry and audit log, attempt blocked action while impersonating, end impersonation, and verify audit entry.

**Acceptance Scenarios**:

1. **Given** a `PLATFORM_SUPPORT` user with `impersonate_tenant_admin`, **When** they start impersonation with reason, **Then** an expiring `ImpersonationSession` is created and audit log is written.
2. **Given** an impersonation session is active, **When** a dangerous endpoint is called, **Then** the system rejects it if configured as blocked during impersonation.
3. **Given** impersonation ends, **When** session is closed, **Then** `endedAt` is set and audit log records the end action.

## Edge Cases

- Tenant status transitions must prevent accidental reactivation from `CANCELLED` unless explicitly allowed by platform owner.
- Suspending a tenant must not delete tenant data or financial records.
- Cancelling a tenant must preserve historical shipments, wallets, payouts, subscriptions, invoices, audit logs, and support sessions.
- Trial end date in the past must mark tenant/subscription as expired or past due through an explicit job or status update flow.
- Changing plan mid-cycle must define whether limits reset immediately or at next renewal.
- Plan deletion must be blocked when referenced by subscriptions; archive is preferred.
- Feature flag key must be restricted to known keys.
- Tenant overrides must support enabled, disabled, and inherited/null semantics.
- Analytics must avoid cross-tenant leakage and must aggregate by tenant safely.
- Billing overview must use Decimal for money and EGP currency by default.
- Audit logs must not store passwords, tokens, OTPs, full card/bank details, or unmasked sensitive data.
- Impersonation must expire automatically and must not grant platform permissions inside tenant context.
- Tenant admins, merchants, and couriers must never access `/platform/*`.
- Platform support should not access finance-only endpoints without `view_billing`.
- Pagination is required for tenants, plans, subscriptions, audit logs, tenant search, and invoices.
- Large analytics/export endpoints must avoid in-memory full-table scans.

## Requirements

### Functional Requirements

- **FR-001**: System MUST expose platform-only backend APIs under `/platform/*`.
- **FR-002**: System MUST support platform roles `PLATFORM_OWNER`, `PLATFORM_ADMIN`, `PLATFORM_SUPPORT`, and `PLATFORM_FINANCE`.
- **FR-003**: System MUST support platform permissions `manage_tenants`, `manage_plans`, `manage_subscriptions`, `view_platform_analytics`, `manage_feature_flags`, `view_audit_logs`, `impersonate_tenant_admin`, `view_billing`, and `suspend_tenants`.
- **FR-004**: System MUST prevent tenant admins, merchants, couriers, and non-platform roles from accessing platform APIs.
- **FR-005**: System MUST implement tenant statuses `TRIAL`, `ACTIVE`, `PAST_DUE`, `SUSPENDED`, and `CANCELLED`.
- **FR-006**: System MUST support tenant create, list, detail, update, status changes, trial management, plan assignment, and summary endpoints.
- **FR-007**: System MUST support tenant usage, users, merchants, couriers, shipments, billing, and feature flag summaries.
- **FR-008**: System MUST implement plan CRUD with safe archive/delete rules.
- **FR-009**: System MUST support plan limits for monthly shipments, admins, merchants, couriers, API access, Smart Dispatch, Fraud Detection, COD Wallet, Bulk Upload, WhatsApp Notifications, Advanced Reports, and Public Tracking.
- **FR-010**: System MUST seed or support suggested plans Starter, Growth, Pro, and Enterprise.
- **FR-011**: System MUST implement subscription create, view, change plan, renew, cancel, pause, trial end tracking, renewal tracking, payment status tracking, and usage against limits.
- **FR-012**: System MUST implement global, plan-level, tenant-level, and manual override feature flags.
- **FR-013**: System MUST resolve effective tenant feature flags using tenant override first, then plan flag, then global default.
- **FR-014**: System MUST audit every sensitive action listed in this spec.
- **FR-015**: Audit logs MUST include actorUserId, actorRole, tenantId nullable, action, resourceType, resourceId, oldValue, newValue, reason, ipAddress, userAgent, and createdAt.
- **FR-016**: System MUST provide platform analytics overview, usage, revenue, and shipments endpoints.
- **FR-017**: System MUST provide billing summary, unpaid tenants, past due tenants, invoice placeholders/manual invoices, and export billing summary.
- **FR-018**: System MUST support support tenant search and tenant health view.
- **FR-019**: System MUST support start/end impersonation with mandatory reason, audit logging, and expiry.
- **FR-020**: System MUST prevent dangerous actions while impersonating where configured.
- **FR-021**: System MUST add `GET /auth/me` returning current authenticated user role, permissions, tenant/platform context, and impersonation context if active.
- **FR-022**: System MUST use DTO validation for every platform request body and query.
- **FR-023**: System MUST use pagination/filtering for list endpoints.
- **FR-024**: System MUST use Prisma transactions for multi-write tenant, subscription, billing, flag, audit, and impersonation changes.
- **FR-025**: System MUST prevent cross-tenant data leakage by requiring explicit tenant scoping on tenant-owned records.

### Required API Endpoints

Auth:

- `GET /auth/me`

Tenants:

- `GET /platform/tenants`
- `POST /platform/tenants`
- `GET /platform/tenants/:id`
- `PATCH /platform/tenants/:id`
- `PATCH /platform/tenants/:id/status`
- `GET /platform/tenants/:id/usage`
- `GET /platform/tenants/:id/users`
- `GET /platform/tenants/:id/billing`
- `GET /platform/tenants/:id/feature-flags`

Plans:

- `GET /platform/plans`
- `POST /platform/plans`
- `GET /platform/plans/:id`
- `PATCH /platform/plans/:id`
- `DELETE /platform/plans/:id`

Subscriptions:

- `GET /platform/subscriptions`
- `GET /platform/subscriptions/:id`
- `PATCH /platform/subscriptions/:id`
- `POST /platform/subscriptions/:id/change-plan`
- `POST /platform/subscriptions/:id/cancel`
- `POST /platform/subscriptions/:id/renew`

Feature Flags:

- `GET /platform/feature-flags`
- `PATCH /platform/feature-flags/:key`
- `GET /platform/tenants/:id/feature-flags`
- `PATCH /platform/tenants/:id/feature-flags/:key`

Analytics:

- `GET /platform/analytics/overview`
- `GET /platform/analytics/usage`
- `GET /platform/analytics/revenue`
- `GET /platform/analytics/shipments`

Audit:

- `GET /platform/audit-logs`

Support:

- `GET /platform/support/tenants/search`
- `GET /platform/support/tenants/:id/health`
- `POST /platform/tenants/:id/impersonate`
- `POST /platform/impersonation/end`

## Key Entities

- **Tenant**: SaaS customer account. Owns users, merchants, couriers, shipments, wallets, subscriptions, feature overrides, billing records, and audit context.
- **Plan**: Commercial package with limits and default feature entitlements.
- **Subscription**: Tenant's current or historical plan relationship with status, trial, renewal, payment status, and billing metadata.
- **FeatureFlag**: Known platform feature key with global default and metadata.
- **PlanFeatureFlag**: Plan-level entitlement for a feature key.
- **TenantFeatureFlag**: Tenant-level manual override with reason and actor.
- **AuditLog**: Insert-only sensitive action record.
- **ImpersonationSession**: Expiring support session linking platform actor to target tenant/admin context.
- **PlatformUser/User**: Existing `User` extended with platform roles, or separate `PlatformUser` if isolation is required.
- **ManualInvoice**: Placeholder/manual invoice record for billing overview until payment provider integration.

## Success Criteria

### Measurable Outcomes

- **SC-001**: 100% of `/platform/*` endpoints reject non-platform roles with `403`.
- **SC-002**: 100% of sensitive mutations create audit logs with actor, reason, oldValue, newValue, IP, and user agent.
- **SC-003**: Tenant list, detail, and usage summary respond under 200ms p95 for normal indexed queries.
- **SC-004**: Analytics overview avoids full in-memory aggregation and uses indexed Prisma aggregate/groupBy queries.
- **SC-005**: Feature flag effective resolution is deterministic and covered by unit tests for global, plan, and tenant override precedence.
- **SC-006**: Impersonation sessions expire automatically and cannot perform configured dangerous actions.
- **SC-007**: Build, lint, unit tests, and selected e2e tests pass before implementation is considered complete.

## Assumptions

- Existing NestJS, Prisma, PostgreSQL, JWT auth, guards, Swagger, and module conventions are reused.
- Existing `AuditLog` model exists but will be migrated/expanded to meet platform audit requirements.
- Existing `UserRole` enum will be extended unless a separate `PlatformUser` is chosen during implementation.
- Tenant scoping will require adding `tenantId` to tenant-owned models such as User, Merchant, Courier, Shipment, Wallet, Payout, BulkJob, and Notification.
- Billing provider integration is out of scope; manual invoice records and overview placeholders are in scope.
- Exports can start as CSV/JSON response or queued job depending on existing project conventions.
