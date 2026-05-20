# Readiness Checklist: System Owner Backend Layer

**Purpose**: Validate planning and implementation readiness for the Trackora Platform Owner backend layer.
**Created**: 2026-05-20
**Feature**: `specs/system-owner-backend/spec.md`

## Planning

- [ ] CHK001 `spec.md` exists and covers tenants, plans, subscriptions, feature flags, analytics, billing, audit logs, and support impersonation.
- [ ] CHK002 `plan.md` exists and documents NestJS/Prisma backend-only approach.
- [ ] CHK003 `tasks.md` exists with atomic backend tasks.
- [ ] CHK004 `tasks.md` includes ID, title, files likely to change, dependencies, acceptance criteria, and parallelizable flag.
- [ ] CHK005 Implementation phases 0 through 12 are represented.
- [ ] CHK006 No frontend work is included.

## Migrations Planned

- [ ] CHK007 Tenant model migration is planned.
- [ ] CHK008 Plan and plan feature flag migrations are planned.
- [ ] CHK009 Subscription migration is planned.
- [ ] CHK010 FeatureFlag and TenantFeatureFlag migrations are planned.
- [ ] CHK011 AuditLog expansion migration is planned.
- [ ] CHK012 ImpersonationSession migration is planned.
- [ ] CHK013 ManualInvoice placeholder migration is planned.
- [ ] CHK014 Platform role enum changes are planned.
- [ ] CHK015 Tenant status enum is planned.
- [ ] CHK016 Tenant scoping fields and indexes are planned for tenant-owned models.
- [ ] CHK017 Existing data migration/default tenant approach is planned.

## Guards Planned

- [ ] CHK018 JWT auth guard is required for platform routes.
- [ ] CHK019 Role guard is required for platform routes.
- [ ] CHK020 Permission guard is required for platform routes.
- [ ] CHK021 Platform-only guard or equivalent enforcement is planned.
- [ ] CHK022 Tenant admins, merchants, and couriers are explicitly blocked from `/platform/*`.
- [ ] CHK023 Impersonation dangerous-action guard/decorator is planned.
- [ ] CHK024 Guard registration is planned and will be verified.

## Permissions Planned

- [ ] CHK025 `manage_tenants` is planned.
- [ ] CHK026 `manage_plans` is planned.
- [ ] CHK027 `manage_subscriptions` is planned.
- [ ] CHK028 `view_platform_analytics` is planned.
- [ ] CHK029 `manage_feature_flags` is planned.
- [ ] CHK030 `view_audit_logs` is planned.
- [ ] CHK031 `impersonate_tenant_admin` is planned.
- [ ] CHK032 `view_billing` is planned.
- [ ] CHK033 `suspend_tenants` is planned.
- [ ] CHK034 Role-to-permission mapping is planned for `PLATFORM_OWNER`, `PLATFORM_ADMIN`, `PLATFORM_SUPPORT`, and `PLATFORM_FINANCE`.

## Swagger Endpoints Planned

- [ ] CHK035 `GET /auth/me` is planned.
- [ ] CHK036 Tenant endpoints are planned.
- [ ] CHK037 Plan endpoints are planned.
- [ ] CHK038 Subscription endpoints are planned.
- [ ] CHK039 Feature flag endpoints are planned.
- [ ] CHK040 Analytics endpoints are planned.
- [ ] CHK041 Audit log endpoint is planned.
- [ ] CHK042 Support and impersonation endpoints are planned.
- [ ] CHK043 Swagger DTO schemas and bearer auth annotations are planned.

## Audit Logging Planned

- [ ] CHK044 Tenant create/update/status changes are audited.
- [ ] CHK045 Plan create/update/archive/delete attempts are audited.
- [ ] CHK046 Subscription create/change/cancel/renew/pause changes are audited.
- [ ] CHK047 Feature flag changes are audited.
- [ ] CHK048 Impersonation start/end are audited.
- [ ] CHK049 Billing and manual invoice changes are audited.
- [ ] CHK050 Audit log includes actorUserId, actorRole, tenantId, action, resourceType, resourceId, oldValue, newValue, reason, ipAddress, userAgent, and createdAt.
- [ ] CHK051 Sensitive values are masked or excluded from audit logs.
- [ ] CHK052 Audit writes are planned inside the same transaction as sensitive mutations where feasible.

## Tenant Isolation

- [ ] CHK053 Tenant-owned queries require explicit tenant scoping.
- [ ] CHK054 Tenant summaries do not leak cross-tenant counts or records.
- [ ] CHK055 Billing summaries are scoped to requested tenant or platform permission.
- [ ] CHK056 Feature flag effective resolution is tenant-specific.
- [ ] CHK057 Impersonation never grants platform permissions inside tenant context.
- [ ] CHK058 Cross-tenant e2e tests are planned.

## Validation DTOs

- [ ] CHK059 Create tenant DTO is planned.
- [ ] CHK060 Update tenant DTO is planned.
- [ ] CHK061 Tenant status change DTO requires reason.
- [ ] CHK062 Create/update plan DTO validates limits and features.
- [ ] CHK063 Subscription mutation DTOs require valid reason where sensitive.
- [ ] CHK064 Feature flag mutation DTO requires reason.
- [ ] CHK065 Billing/manual invoice DTOs validate Decimal-compatible money inputs.
- [ ] CHK066 Impersonation start DTO requires reason.
- [ ] CHK067 Query DTOs validate pagination, filters, sort, and date ranges.

## Tests Planned

- [ ] CHK068 Unit tests are planned for tenant status transitions.
- [ ] CHK069 Unit tests are planned for plan archive/delete safety.
- [ ] CHK070 Unit tests are planned for subscription transitions and usage limits.
- [ ] CHK071 Unit tests are planned for feature flag precedence.
- [ ] CHK072 Unit tests are planned for audit writer masking and required fields.
- [ ] CHK073 Unit tests are planned for impersonation expiry and dangerous-action blocking.
- [ ] CHK074 E2E tests are planned for platform RBAC.
- [ ] CHK075 E2E tests are planned for tenant isolation.
- [ ] CHK076 E2E tests are planned for audit log creation.

## Error Handling Planned

- [ ] CHK077 Invalid tenant status transitions return `409`.
- [ ] CHK078 Missing reason for destructive/sensitive action returns `400`.
- [ ] CHK079 Unauthorized requests return `401`.
- [ ] CHK080 Insufficient permissions return `403`.
- [ ] CHK081 Missing tenant/plan/subscription resources return `404`.
- [ ] CHK082 Unsafe plan deletion returns `409`.
- [ ] CHK083 Expired impersonation session returns `403`.
- [ ] CHK084 Invalid date ranges and pagination return `400`.

## Pagination And Filtering Planned

- [ ] CHK085 Tenant list supports pagination/filtering.
- [ ] CHK086 Plan list supports pagination/filtering.
- [ ] CHK087 Subscription list supports pagination/filtering.
- [ ] CHK088 Audit log list supports pagination/filtering.
- [ ] CHK089 Support tenant search supports pagination.
- [ ] CHK090 Billing unpaid/past due lists support pagination/filtering.
- [ ] CHK091 Analytics endpoints support date range filters where relevant.

## Build And QA

- [ ] CHK092 Prisma schema validation is planned.
- [ ] CHK093 Prisma client generation is planned.
- [ ] CHK094 Lint is planned.
- [ ] CHK095 Typecheck/build is planned.
- [ ] CHK096 Unit tests are planned.
- [ ] CHK097 E2E tests are planned.
- [ ] CHK098 Final security review is planned.
- [ ] CHK099 Build passes before release.
- [ ] CHK100 No code implementation starts before planning artifacts are approved.
