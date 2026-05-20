# Tasks: System Owner Backend Layer

**Input**: `specs/system-owner-backend/spec.md`, `specs/system-owner-backend/plan.md`
**Prerequisites**: Existing NestJS backend, Prisma schema, auth guards, permissions constants, Swagger setup

## Phase 0: Backend Spec/API Alignment

| ID | Title | Files likely to change | Dependencies | Acceptance Criteria | Parallelizable |
|----|-------|------------------------|--------------|---------------------|----------------|
| T001 | Confirm API contracts and DTO naming | `docs/API_SPEC.md`, `specs/system-owner-backend/*` | None | Endpoint list, payload assumptions, and response shapes are approved | No |
| T002 | Decide platform user strategy | `prisma/schema.prisma`, `src/modules/auth/*` | T001 | Decision recorded: extend `UserRole` or create `PlatformUser` | No |
| T003 | Decide existing data tenant migration approach | `prisma/migrations/*`, migration notes | T001 | Default tenant or empty DB migration strategy is approved | No |

## Phase 1: Database Schema/Migrations

| ID | Title | Files likely to change | Dependencies | Acceptance Criteria | Parallelizable |
|----|-------|------------------------|--------------|---------------------|----------------|
| T004 | Add platform enums | `prisma/schema.prisma` | T002 | Tenant, subscription, payment, feature flag, impersonation enums exist | Yes |
| T005 | Add Tenant model | `prisma/schema.prisma` | T004 | Tenant has status, trial dates, plan/subscription relations, indexes | Yes |
| T006 | Add Plan and PlanFeatureFlag models | `prisma/schema.prisma` | T004 | Plan limits and feature entitlements are persisted and indexed | Yes |
| T007 | Add Subscription model | `prisma/schema.prisma` | T005, T006 | Subscription tracks tenant, plan, status, trial, renewal, payment | No |
| T008 | Add FeatureFlag and TenantFeatureFlag models | `prisma/schema.prisma` | T004, T005 | Global and tenant flag overrides are persisted and indexed | Yes |
| T009 | Expand AuditLog model | `prisma/schema.prisma` | T004 | Required audit fields exist with actor/resource/action indexes | Yes |
| T010 | Add ImpersonationSession model | `prisma/schema.prisma` | T005, T009 | Session has actor, tenant, target user, reason, expiry, status | Yes |
| T011 | Add ManualInvoice model | `prisma/schema.prisma` | T005, T007 | Manual invoice placeholder supports billing overview and export | Yes |
| T012 | Add tenantId to tenant-owned models | `prisma/schema.prisma` | T005 | User, Merchant, Courier, Shipment, Wallet, Payout, BulkJob, Notification are tenant-scoped | No |
| T013 | Create and validate migration | `prisma/migrations/*` | T004-T012 | Prisma migration applies cleanly and preserves existing data strategy | No |
| T014 | Generate Prisma client | generated Prisma client | T013 | TypeScript recognizes new models/enums | No |

## Phase 2: Platform Auth/Roles/Permissions

| ID | Title | Files likely to change | Dependencies | Acceptance Criteria | Parallelizable |
|----|-------|------------------------|--------------|---------------------|----------------|
| T015 | Extend permissions constants | `src/common/constants/permissions.constant.ts` | T014 | All required platform permissions exist | Yes |
| T016 | Extend JWT payload/auth me response | `src/modules/auth/services/auth.service.ts`, `src/modules/auth/controllers/auth.controller.ts`, `src/modules/auth/dtos/*` | T015 | `GET /auth/me` returns role, permissions, tenant/platform context | No |
| T017 | Add platform-only guard | `src/common/guards/platform-only.guard.ts` | T015 | Non-platform roles cannot access platform routes | Yes |
| T018 | Verify global guard registration | `src/app.module.ts`, existing guard files | T015 | JWT, roles, and permissions enforcement is active | No |
| T019 | Add impersonation context extraction | `src/common/guards/*`, `src/modules/platform/support/*` | T010, T016 | Requests can identify active impersonation session | No |
| T020 | Add dangerous-action guard/decorator | `src/common/guards/*`, `src/common/decorators/*` | T019 | Configured dangerous actions are blocked during impersonation | Yes |

## Phase 3: Tenants Module

| ID | Title | Files likely to change | Dependencies | Acceptance Criteria | Parallelizable |
|----|-------|------------------------|--------------|---------------------|----------------|
| T021 | Create platform tenants module structure | `src/modules/platform/tenants/**` | T014-T018 | Module, controller, service, repository, DTO folders exist | Yes |
| T022 | Implement tenant create/list/details/update | `src/modules/platform/tenants/**` | T021 | CRUD APIs work with pagination/filtering and validation | No |
| T023 | Implement tenant status transitions | `src/modules/platform/tenants/**` | T022, T009 | Activate/suspend/cancel require reason and audit logs | No |
| T024 | Implement trial and plan assignment | `src/modules/platform/tenants/**` | T007, T023 | Trial dates and plan assignment update tenant/subscription safely | No |
| T025 | Implement tenant summaries | `src/modules/platform/tenants/**` | T012, T022 | Usage, users, merchants/couriers, shipments summaries are tenant-scoped | Yes |
| T026 | Add tenant module tests | `src/modules/platform/tenants/tests/*` | T022-T025 | Tests cover RBAC, status transitions, summaries, audit | Yes |

## Phase 4: Plans Module

| ID | Title | Files likely to change | Dependencies | Acceptance Criteria | Parallelizable |
|----|-------|------------------------|--------------|---------------------|----------------|
| T027 | Create plans module structure | `src/modules/platform/plans/**` | T014-T018 | Module structure exists | Yes |
| T028 | Implement plan CRUD | `src/modules/platform/plans/**` | T027 | Create/edit/list/detail endpoints validate limits and flags | No |
| T029 | Implement safe archive/delete | `src/modules/platform/plans/**` | T028 | Referenced plans are archived or deletion is rejected | No |
| T030 | Add suggested plan seeding path | `prisma/seed.ts` or module seed service | T028 | Starter, Growth, Pro, Enterprise can be seeded idempotently | Yes |
| T031 | Add plans tests | `src/modules/platform/plans/tests/*` | T028-T030 | Tests cover validation, archive/delete safety, audit | Yes |

## Phase 5: Subscriptions Module

| ID | Title | Files likely to change | Dependencies | Acceptance Criteria | Parallelizable |
|----|-------|------------------------|--------------|---------------------|----------------|
| T032 | Create subscriptions module structure | `src/modules/platform/subscriptions/**` | T007, T018 | Module structure exists | Yes |
| T033 | Implement subscription list/view/update | `src/modules/platform/subscriptions/**` | T032 | APIs return subscription, plan, tenant, usage metadata | No |
| T034 | Implement change plan | `src/modules/platform/subscriptions/**` | T033, T028 | Plan changes update subscription with audit and reason | No |
| T035 | Implement renew/cancel/pause | `src/modules/platform/subscriptions/**` | T033 | Renewal/cancel/pause enforce state rules and audit logs | No |
| T036 | Implement usage against limits | `src/modules/platform/subscriptions/**` | T025, T033 | Usage response shows limits, current, remaining, exceeded | Yes |
| T037 | Add subscription tests | `src/modules/platform/subscriptions/tests/*` | T033-T036 | Tests cover state transitions, limits, audit, RBAC | Yes |

## Phase 6: Feature Flags Module

| ID | Title | Files likely to change | Dependencies | Acceptance Criteria | Parallelizable |
|----|-------|------------------------|--------------|---------------------|----------------|
| T038 | Create feature flags module structure | `src/modules/platform/feature-flags/**` | T008, T018 | Module structure exists | Yes |
| T039 | Implement global flags endpoints | `src/modules/platform/feature-flags/**` | T038 | Global flag list/update works and audits changes | No |
| T040 | Implement tenant flag endpoints | `src/modules/platform/feature-flags/**` | T038 | Tenant flag list/update works with reason and audit | No |
| T041 | Implement effective flag resolver | `src/modules/platform/feature-flags/**` | T039, T040, T006 | Precedence is tenant override, plan, global, false | No |
| T042 | Add feature flag tests | `src/modules/platform/feature-flags/tests/*` | T039-T041 | Tests cover precedence, validation, audit, RBAC | Yes |

## Phase 7: Platform Analytics Module

| ID | Title | Files likely to change | Dependencies | Acceptance Criteria | Parallelizable |
|----|-------|------------------------|--------------|---------------------|----------------|
| T043 | Create analytics module structure | `src/modules/platform/analytics/**` | T012, T018 | Module structure exists | Yes |
| T044 | Implement overview metrics | `src/modules/platform/analytics/**` | T043 | Overview returns required tenant/shipment/COD/payout/fraud metrics | No |
| T045 | Implement usage trends | `src/modules/platform/analytics/**` | T043 | Usage endpoint supports date range and grouping | Yes |
| T046 | Implement revenue analytics | `src/modules/platform/analytics/**` | T011, T043 | Revenue endpoint uses subscription/invoice data and Decimal-safe output | Yes |
| T047 | Implement shipment analytics | `src/modules/platform/analytics/**` | T043 | Shipment endpoint returns totals and top tenants by volume | Yes |
| T048 | Add analytics tests | `src/modules/platform/analytics/tests/*` | T044-T047 | Tests cover aggregation correctness and tenant isolation | Yes |

## Phase 8: Billing Overview Module

| ID | Title | Files likely to change | Dependencies | Acceptance Criteria | Parallelizable |
|----|-------|------------------------|--------------|---------------------|----------------|
| T049 | Create billing module structure | `src/modules/platform/billing/**` | T011, T018 | Module structure exists | Yes |
| T050 | Implement tenant billing summary | `src/modules/platform/billing/**`, `src/modules/platform/tenants/**` | T049 | Tenant billing endpoint returns plan, subscription, invoices, status | No |
| T051 | Implement unpaid and past due lists | `src/modules/platform/billing/**` | T049 | Finance users can list unpaid/past due tenants with pagination | Yes |
| T052 | Implement manual invoice records | `src/modules/platform/billing/**` | T049 | Create/update invoice placeholders with audit and Decimal values | No |
| T053 | Implement billing export | `src/modules/platform/billing/**` | T050-T052 | Export includes tenant, plan, period, amount, status, renewal | No |
| T054 | Add billing tests | `src/modules/platform/billing/tests/*` | T050-T053 | Tests cover permissions, Decimal output, audit, filtering | Yes |

## Phase 9: Audit Logs Module

| ID | Title | Files likely to change | Dependencies | Acceptance Criteria | Parallelizable |
|----|-------|------------------------|--------------|---------------------|----------------|
| T055 | Create audit logs module structure | `src/modules/platform/audit-logs/**` | T009, T018 | Module structure exists | Yes |
| T056 | Implement audit log writer service | `src/modules/platform/audit-logs/**` | T055 | Shared service writes required fields and masks sensitive data | No |
| T057 | Implement audit log query endpoint | `src/modules/platform/audit-logs/**` | T055 | `GET /platform/audit-logs` supports filters and pagination | No |
| T058 | Integrate audit writer into prior modules | `src/modules/platform/**` | T056, T023, T029, T035, T040, T052 | Sensitive actions produce audit records | No |
| T059 | Add audit tests | `src/modules/platform/audit-logs/tests/*` | T056-T058 | Tests cover required fields, filters, masking, permissions | Yes |

## Phase 10: Support/Impersonation Module

| ID | Title | Files likely to change | Dependencies | Acceptance Criteria | Parallelizable |
|----|-------|------------------------|--------------|---------------------|----------------|
| T060 | Create support module structure | `src/modules/platform/support/**` | T010, T018 | Module structure exists | Yes |
| T061 | Implement tenant search | `src/modules/platform/support/**` | T060 | Search supports query/pagination and returns safe tenant fields | Yes |
| T062 | Implement tenant health view | `src/modules/platform/support/**` | T060, T025, T050 | Health includes status, subscription, usage, recent failures, flags | No |
| T063 | Implement start impersonation | `src/modules/platform/support/**` | T019, T060 | Requires reason, creates expiring session, audits start | No |
| T064 | Implement end impersonation | `src/modules/platform/support/**` | T063 | Ends active session and audits end | No |
| T065 | Add impersonation expiry handling | `src/modules/platform/support/**` | T063 | Expired sessions are rejected and marked expired | No |
| T066 | Add support tests | `src/modules/platform/support/tests/*` | T061-T065 | Tests cover reason, expiry, dangerous action block, audit | Yes |

## Phase 11: Swagger Docs

| ID | Title | Files likely to change | Dependencies | Acceptance Criteria | Parallelizable |
|----|-------|------------------------|--------------|---------------------|----------------|
| T067 | Add Swagger tags and DTO annotations | `src/modules/platform/**/*.controller.ts`, `src/modules/platform/**/dtos/*.ts` | T021-T066 | All platform endpoints appear in Swagger with schemas | Yes |
| T068 | Document auth and permission requirements | controller decorators and API docs | T067 | Swagger shows bearer auth and operation summaries | Yes |

## Phase 12: Tests And Final QA

| ID | Title | Files likely to change | Dependencies | Acceptance Criteria | Parallelizable |
|----|-------|------------------------|--------------|---------------------|----------------|
| T069 | Add platform e2e test setup | `test/platform/*` | T018, T021-T066 | E2E helpers can create platform and tenant users | No |
| T070 | Add RBAC e2e tests | `test/platform/rbac.e2e-spec.ts` | T069 | Tenant admins cannot access platform routes, platform permissions enforced | Yes |
| T071 | Add tenant isolation e2e tests | `test/platform/tenant-isolation.e2e-spec.ts` | T069 | Cross-tenant data leakage is prevented | Yes |
| T072 | Add audit e2e tests | `test/platform/audit.e2e-spec.ts` | T069 | Sensitive mutations create audit logs | Yes |
| T073 | Run Prisma validate/generate | `prisma/schema.prisma` | T013 | Prisma schema validates and client generates | No |
| T074 | Run lint/typecheck/tests | whole repo | T073, T070-T072 | Lint, typecheck, unit tests, and e2e tests pass | No |
| T075 | Final security review | `src/modules/platform/**`, `src/common/guards/**` | T074 | Checklist passes: guards, permissions, audit, tenant isolation, validation | No |

## Dependencies & Execution Order

- Phase 0 blocks all implementation decisions.
- Phase 1 blocks all modules because Prisma models and tenant scoping are foundational.
- Phase 2 blocks all platform controllers.
- Tenants, Plans, Audit writer, and Feature Flags can begin after Phase 2.
- Subscriptions depend on Tenants and Plans.
- Analytics and Billing depend on tenant scoping and subscription/billing models.
- Support/Impersonation depends on auth context, tenants, audit, and impersonation model.
- Swagger and final QA depend on implemented modules.

## Parallel Opportunities

- Prisma model additions can be drafted in parallel but migration validation is sequential.
- Plans, Feature Flags, Audit Logs, and Tenant summary tests can run in parallel after foundation.
- Analytics usage/revenue/shipments endpoints can be implemented in parallel.
- Billing unpaid/past-due and export can be developed in parallel after billing summary contracts.
- E2E RBAC, tenant isolation, and audit tests can be written in parallel once test setup exists.
