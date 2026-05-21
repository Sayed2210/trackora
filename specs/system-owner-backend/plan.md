# Implementation Plan: System Owner Backend Layer

**Branch**: `system-owner-backend` | **Date**: 2026-05-20 | **Spec**: `specs/system-owner-backend/spec.md`
**Input**: Feature specification from `/specs/system-owner-backend/spec.md`

## Summary

Add a platform-only backend layer for Trackora SaaS operations. The implementation extends the NestJS modular monolith with platform modules for tenants, plans, subscriptions, feature flags, analytics, billing overview, audit logs, and support impersonation. The core design adds tenant-aware data modeling, platform RBAC/permissions, strict audit logging, and safe impersonation while preserving financial integrity and preventing cross-tenant leakage.

## Technical Context

**Language/Version**: TypeScript with NestJS
**Primary Dependencies**: NestJS, Prisma Client, class-validator, Swagger, JWT auth guards
**Storage**: PostgreSQL via Prisma
**Testing**: Jest unit tests and NestJS e2e tests
**Target Platform**: Backend API service on Linux/AWS ECS
**Project Type**: Backend web service, modular monolith
**Performance Goals**: API response <200ms target, DB query <50ms target, platform analytics avoids in-memory full-table scans
**Constraints**: Strict tenant isolation, JWT auth, platform-only RBAC, audit logging for sensitive actions, Decimal for money, no frontend work
**Scale/Scope**: SaaS platform layer supporting 300K daily shipments and many tenants

## Constitution Check

The constitution file is currently a placeholder, so project-specific gates come from `AGENTS.md`, `MODULE_CONVENTIONS.md`, `docs/API_SPEC.md`, and current backend standards.

- **Modular monolith fit**: PASS. Platform modules live under `src/modules/platform/...` or one grouped `src/modules/platform` feature.
- **Database transaction safety**: PASS WITH REQUIREMENT. Tenant/subscription/billing/flag/impersonation mutations must write audit logs in the same Prisma transaction.
- **Financial integrity**: PASS WITH REQUIREMENT. Billing amounts and COD/payout analytics use Decimal and never float.
- **Security/RBAC**: PASS WITH REQUIREMENT. Platform JWT, roles, and permissions must be enforced on every platform endpoint.
- **Cross-tenant isolation**: PASS WITH REQUIREMENT. `tenantId` must be added/indexed and applied to tenant-owned queries.
- **Operational reality**: PASS. Support impersonation includes reason, expiry, audit, and dangerous action restrictions.
- **MENA optimization**: PASS. EGP billing, COD volume, payout volume, WhatsApp feature flag included.
- **Prisma compatibility**: PASS. Use Prisma models/migrations, not TypeORM patterns.

## Architecture Decisions

### Module Layout

Use a grouped platform domain module to keep SaaS-owner concerns isolated:

```text
src/modules/platform/
├── platform.module.ts
├── tenants/
│   ├── controllers/platform-tenants.controller.ts
│   ├── services/platform-tenants.service.ts
│   ├── repositories/platform-tenants.repository.ts
│   ├── dtos/
│   ├── entities/
│   └── tests/
├── plans/
├── subscriptions/
├── feature-flags/
├── analytics/
├── billing/
├── audit-logs/
└── support/
```

### Database Strategy
Phase 0 decisions applied for the initial backend foundation:

- Platform users use the existing `User` model. `UserRole` is extended with `PLATFORM_OWNER`, `PLATFORM_ADMIN`, `PLATFORM_SUPPORT`, and `PLATFORM_FINANCE`; no separate `PlatformUser` model is introduced for MVP.
- Existing development data uses a default tenant migration strategy. The first migration keeps new `tenantId` fields nullable to avoid deleting or blocking existing rows, creates a default development tenant record when migrations run, and leaves later backfill/enforcement to a dedicated migration once tenant ownership is verified.
- Platform API DTO names should follow module-specific action names in later phases, for example `CreatePlatformTenantDto`, `UpdatePlatformTenantDto`, `ChangePlatformTenantStatusDto`, `CreatePlanDto`, `UpdatePlanDto`, `UpdateFeatureFlagDto`, `StartImpersonationDto`, and `CreateManualInvoiceDto`.

Add new Prisma enums:

- `TenantStatus`: `TRIAL`, `ACTIVE`, `PAST_DUE`, `SUSPENDED`, `CANCELLED`
- `SubscriptionStatus`: `TRIALING`, `ACTIVE`, `PAST_DUE`, `PAUSED`, `CANCELLED`, `EXPIRED`
- `PaymentStatus`: `NOT_REQUIRED`, `PENDING`, `PAID`, `FAILED`, `PAST_DUE`
- `FeatureFlagKey`: `smart_dispatch`, `fraud_detection`, `cod_wallet`, `bulk_upload`, `whatsapp_notifications`, `api_access`, `public_tracking`, `advanced_reports`
- `AuditAction`: optional enum or string constants for sensitive actions
- `ImpersonationStatus`: `ACTIVE`, `ENDED`, `EXPIRED`
- Extend `UserRole`: `PLATFORM_OWNER`, `PLATFORM_ADMIN`, `PLATFORM_SUPPORT`, `PLATFORM_FINANCE`

Add new Prisma models:

- `Tenant`
- `Plan`
- `Subscription`
- `FeatureFlag`
- `PlanFeatureFlag`
- `TenantFeatureFlag`
- Expanded `AuditLog`
- `ImpersonationSession`
- `ManualInvoice`

Add tenant scoping fields:

- `User.tenantId?`
- `Merchant.tenantId`
- `Courier.tenantId`
- `Shipment.tenantId`
- `Wallet.tenantId`
- `Payout.tenantId`
- `BulkJob.tenantId`
- `Notification.tenantId?`

Existing data migration must either create a default tenant for current records or require empty/non-production migration confirmation.

### Security Strategy

- Add platform roles to JWT payload.
- Add platform permissions to `PERMISSIONS`.
- Use `JwtAuthGuard`, `RolesGuard`, and `PermissionsGuard`.
- Ensure guards are globally registered or applied consistently.
- Add `PlatformOnlyGuard` or equivalent logic to reject non-platform roles.
- Add decorators for platform permissions.
- Require `reason` in DTOs for destructive/sensitive actions.
- Prevent tenant-scoped users from accessing `/platform/*`.
- Prevent platform impersonation from granting platform permissions inside tenant context.
- Add dangerous action guard for impersonation-sensitive mutations.

### Audit Strategy

All sensitive mutations call `PlatformAuditLogService` inside the same transaction where possible.

Audited actions:

- `tenant.created`
- `tenant.updated`
- `tenant.suspended`
- `tenant.activated`
- `tenant.cancelled`
- `plan.created`
- `plan.updated`
- `plan.archived`
- `subscription.created`
- `subscription.changed`
- `subscription.cancelled`
- `subscription.renewed`
- `feature_flag.changed`
- `impersonation.started`
- `impersonation.ended`
- `billing.changed`

Audit fields:

- `actorUserId`
- `actorRole`
- `tenantId`
- `action`
- `resourceType`
- `resourceId`
- `oldValue`
- `newValue`
- `reason`
- `ipAddress`
- `userAgent`
- `createdAt`

### Feature Flag Resolution

Effective tenant flag precedence:

1. Tenant override in `TenantFeatureFlag`
2. Plan-level flag in `PlanFeatureFlag`
3. Global default in `FeatureFlag`
4. Safe default `false` if missing

### Billing Strategy

Billing overview is not a payment provider integration. It includes subscription/payment status, manual invoice records, unpaid tenants, past due tenants, billing summaries, and exports.

Money fields use Prisma Decimal with EGP default.

### Analytics Strategy

Use Prisma aggregate/groupBy queries and indexed filters.

Metrics:

- total tenants
- active tenants
- trial tenants
- suspended tenants
- total shipments
- active merchants
- active couriers
- COD volume
- payout volume
- fraud flagged shipments
- top tenants by shipment volume
- usage trends

## Project Structure

### Documentation

```text
specs/system-owner-backend/
├── spec.md
├── plan.md
├── tasks.md
└── checklist.md
```

### Source Code

```text
prisma/
├── schema.prisma
└── migrations/

src/
├── common/
│   ├── constants/permissions.constant.ts
│   ├── decorators/
│   └── guards/
├── modules/
│   ├── auth/
│   └── platform/
│       ├── platform.module.ts
│       ├── tenants/
│       ├── plans/
│       ├── subscriptions/
│       ├── feature-flags/
│       ├── analytics/
│       ├── billing/
│       ├── audit-logs/
│       └── support/
└── app.module.ts

test/
└── platform/
```

**Structure Decision**: Use `src/modules/platform/` with subdomains to keep Platform Owner concerns isolated while sharing common guards, Prisma, auth, and Swagger infrastructure.

## API Contract Summary

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

## Implementation Phases

- **Phase 0**: Backend spec/API alignment
- **Phase 1**: Database schema/migrations
- **Phase 2**: Platform auth/roles/permissions
- **Phase 3**: Tenants module
- **Phase 4**: Plans module
- **Phase 5**: Subscriptions module
- **Phase 6**: Feature flags module
- **Phase 7**: Platform analytics module
- **Phase 8**: Billing overview module
- **Phase 9**: Audit logs module
- **Phase 10**: Support/impersonation module
- **Phase 11**: Swagger docs
- **Phase 12**: Tests and final QA

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| Tenant scoping migration across many existing models | Required to prevent cross-tenant leakage in SaaS mode | Keeping tenant only on Subscription would not safely scope shipments, users, merchants, couriers, wallets, and payouts |
| Expanded audit log model | Existing `AuditLog` lacks required actorRole, nullable tenantId, reason, and resource naming | Adding JSON metadata only would make audit queries and compliance filtering weaker |
| Impersonation session model | Support access must be time-bound, auditable, and revocable | Stateless JWT-only impersonation would be harder to revoke and audit |
