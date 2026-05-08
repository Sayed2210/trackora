# Trackora Architecture Fix Plan

Generated: 2026-05-09

---

## P0 — Ship Blockers (Must Fix Before Any Deployment)

### 1. Register Auth Guards Globally
**Files:** `src/app.module.ts`
- `RolesGuard` and `PermissionsGuard` are defined but never registered
- All `@Roles()` decorators are currently no-ops
- **Fix:** Add `APP_GUARD` providers globally:
  ```ts
  { provide: APP_GUARD, useClass: JwtAuthGuard },
  { provide: APP_GUARD, useClass: RolesGuard },
  // optionally: { provide: APP_GUARD, useClass: PermissionsGuard },
  ```
- Ensure endpoints that need public access use `@Public()` decorator

### 2. Restrict Role Assignment on Registration
**Files:** `src/modules/auth/dtos/index.ts`, `src/modules/auth/controllers/auth.controller.ts`
- `POST /auth/register` accepts any `role` from DTO including `SUPER_ADMIN`
- **Fix:** Restrict registration DTO to `MERCHANT` | `COURIER` only; admin roles require separate admin-only endpoint
- Add `@IsEnum` validation or whitelist check

### 3. Remove OTP from API Response
**Files:** `src/modules/auth/controllers/auth.controller.ts`
- `sendOtp()` returns `{ message, code }` — the OTP is in the HTTP response
- **Fix:** Remove `code` from response; return only `{ message: 'OTP sent' }`

### 4. Make Wallet Transactions Atomic
**Files:** `src/modules/wallets/listeners/shipment-delivered.listener.ts`
- COD credit, commission debit, and fee debit are 3 separate `$transaction` calls
- Partial failure causes wallet balance inconsistency
- **Fix:** Wrap all 3 operations in a single `$transaction` with one wallet version check
- Calculate fees inside the transaction, not before

### 5. Replace Hardcoded `'temp-user-id'` Placeholders
**Files:**
- `src/modules/merchants/controllers/merchants.controller.ts`
- `src/modules/couriers/controllers/couriers.controller.ts`
- `src/modules/couriers/controllers/courier-app.controller.ts`
- `src/modules/assignments/controllers/assignments.controller.ts`
- `src/modules/shipments/controllers/shipments.controller.ts`
- **Fix:** Extract `req.user.userId` from JWT in all endpoints; update controller method signatures to inject `@Req() req`

---

## P1 — Important (Must Fix Before Production)

### 6. Implement Missing Business Modules
- **PayoutService** — schema exists, no service/controller. Implement: request, approve, process, minimum EGP 500 check
- **BlacklistedPhone service** — model exists, no service. Auto-blacklist after 3 consecutive failures, check during shipment creation and login
- **Auto-dispatch service** — `autoDispatchEligible` field exists, no logic. Implement courier matching algorithm
- **WhatsApp notification delivery** — `NotificationService` only writes to DB. Integrate Twilio/FCM for delivery

### 7. Fix Fraud Detection Non-Deterministic Scoring
**File:** `src/modules/shipments/services/fraud-detection.service.ts`
- `Math.random()` noise makes scores non-reproducible
- **Fix:** Remove random noise or move to a separate `signals` field that doesn't affect the main score

### 8. Hash Shipment OTP Before Storage
**File:** `src/modules/shipments/services/shipments.service.ts`
- OTP stored in plaintext in `customerOtp` column
- **Fix:** Hash the OTP with bcrypt/bcrypto before storing; compare hashed values during verification
- Consider storing OTP in Redis with TTL instead of DB

### 9. Fix Dashboard & Reports Performance
**Files:**
- `src/modules/merchants/services/merchant-dashboard.service.ts`
- `src/modules/admin/services/reports.service.ts`
- `src/modules/admin/services/admin-dashboard.service.ts`
- **Fix:** Replace in-memory aggregation with Prisma `groupBy` and SQL aggregates (`SUM`, `AVG`, `COUNT`)
- Add cursor-based pagination for report generation
- Consider streaming for large exports

### 10. Remove Unused Dependencies
**File:** `package.json`
- Remove `@nestjs/typeorm`, `typeorm`, `pg` — project uses Prisma exclusively
- Enable `noImplicitAny: true` in `tsconfig.json`

### 11. Fix JWT Fallback Secret
**File:** `src/modules/auth/auth.module.ts`
- Remove `|| 'fallback-secret'` fallback
- **Fix:** Throw if `JWT_SECRET` is not configured (consistent with `jwt.strategy.ts`)

### 12. Validate `collectedCash` Against `codAmount`
**File:** `src/modules/shipments/services/shipments.service.ts`
- No check that `collectedCash` matches `codAmount` for COD deliveries
- **Fix:** Add validation with tolerance; flag discrepancies as audit events
- Handle over-collection and under-collection scenarios

### 13. Credit Merchant Wallet on Courier Cash Deposit
**File:** `src/modules/couriers/services/courier-app.service.ts`
- Cash deposit decrements `courier.cashHeld` but doesn't credit merchant wallet
- **Fix:** Create wallet transaction when deposit is verified

---

## P2 — Nice to Have (Post-Launch)

### 14. Implement Caching Strategy
**Files:** Hot path services
- Cache zones, available couriers, admin dashboard
- Use Redis with appropriate TTLs
- Implement cache invalidation on writes

### 15. Add Audit Logging Integration
**Files:** All mutation endpoints
- `AuditLogService.create()` exists but is never called
- **Fix:** Add audit logging to: KYC changes, fee changes, wallet operations, assignment changes, admin actions
- Consider using NestJS interceptors for automatic audit logging

### 16. Add E2E Tests
- Key flows: registration → login → create shipment → assign → deliver → wallet credit
- Concurrency tests for wallet transactions
- Tests for shipment-delivered listener

### 17. Fix BaseEntity Interface
**File:** `src/common/entities/base.entity.ts`
- `deletedAt` field doesn't match actual soft-delete pattern (uses `isActive` flag)
- **Fix:** Remove `deletedAt` from `BaseEntity` or add it to Prisma schema as optional field

### 18. Avoid `Number()` Cast on Decimal Fields
**Files:** wallets.service.ts, courier-app.service.ts, merchant-dashboard.service.ts
- **Fix:** Use `Prisma.Decimal` methods or `.toString()` for JSON serialization; avoid `Number()` for financial values

### 19. Add Response Interceptors
- Strip sensitive fields (passwordHash) from all responses
- Consistent pagination metadata
- Decimal → string serialization for JSON

### 20. Configure Database Connection Pooling
**File:** `src/core/prisma/prisma.service.ts`
- Add `connection_limit` and `pool_timeout` to Prisma connection URL
- Required for 300K daily shipment target

---

## Progress Tracking

- [ ] 1. Register auth guards globally
- [ ] 2. Restrict role on registration
- [ ] 3. Remove OTP from API response
- [ ] 4. Make wallet transactions atomic
- [ ] 5. Replace temp-user-id placeholders
- [ ] 6. Implement PayoutService
- [ ] 7. Implement BlacklistPhone service
- [ ] 8. Implement Auto-dispatch service
- [ ] 9. Implement WhatsApp notification delivery
- [ ] 10. Fix fraud detection random noise
- [ ] 11. Hash shipment OTP
- [ ] 12. Fix dashboard/report performance
- [ ] 13. Remove unused TypeORM dependencies
- [ ] 14. Enable noImplicitAny
- [ ] 15. Fix JWT fallback secret
- [ ] 16. Validate collectedCash vs codAmount
- [ ] 17. Credit merchant wallet on courier deposit
- [ ] 18. Add caching strategy
- [ ] 19. Integrate audit logging
- [ ] 20. Add E2E tests
- [ ] 21. Fix BaseEntity interface
- [ ] 22. Avoid Number() on Decimal
- [ ] 23. Add response interceptors
- [ ] 24. Configure connection pooling