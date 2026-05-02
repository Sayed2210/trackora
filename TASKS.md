# Phase 1 Implementation Tasks (Backend Only)

## Sprint 1: Foundation (Week 1)

### Infrastructure Setup
- [x] **TASK-001:** Install Prisma dependencies (`@prisma/client`, `prisma`)
- [x] **TASK-002:** Create `docker-compose.yml` with PostgreSQL 15 + Redis 7
- [x] **TASK-003:** Create `.env.example` with required environment variables
- [x] **TASK-004:** Run `npx prisma migrate dev --name init` to create database
- [x] **TASK-005:** Run `npx prisma generate` to generate Prisma Client
- [x] **TASK-006:** Verify `docker-compose up` starts all services successfully

### Project Structure
- [x] **TASK-007:** Create directory structure under `src/`
  - `src/core/` (config, database, events, exceptions)
  - `src/modules/` (business modules)
  - `src/shared/` (enums, DTOs, interfaces, utils)
- [x] **TASK-008:** Create `src/core/prisma/prisma.service.ts` (PrismaClient wrapper)
- [x] **TASK-009:** Create `src/core/config/config.module.ts` (environment configuration)
- [x] **TASK-010:** Create `src/core/events/events.module.ts` (EventEmitter2 setup)
- [x] **TASK-011:** Update `src/app.module.ts` to import core modules

### Database Seeding
- [x] **TASK-012:** Create `prisma/seed.ts` with Egypt zones data
  - Country: Egypt
  - Governorates: Cairo, Giza, Alexandria
  - Cities: Maadi, Nasr City, Heliopolis, Dokki, Mohandessin
  - Districts: Sarayat, Degla, Mustafa, Rabaa, Korba
- [x] **TASK-013:** Add `prisma.seed` config to `package.json`
- [x] **TASK-014:** Run `npx prisma db seed` and verify zones created

### API Documentation
- [x] **TASK-015:** Install `@nestjs/swagger` and `swagger-ui-express`
- [x] **TASK-016:** Configure Swagger in `src/main.ts` at `/api/docs`
- [ ] **TASK-017:** Verify Swagger UI accessible at `http://localhost:3000/api/docs`

### Validation
- [x] **TASK-018:** Run `npm run lint` and fix any issues
- [x] **TASK-019:** Run `npm run test` and ensure starter tests pass
- [x] **TASK-020:** Run `npm run build` and verify no compilation errors

**Definition of Done:**
- [x] `docker-compose up` starts PostgreSQL + Redis
- [x] `npm run test` passes
- [x] `npm run build` succeeds
- [x] Swagger UI at `/api/docs`
- [x] Database seeded with Egypt zones

---

## Sprint 2: Authentication & Users (Week 2)

### Dependencies
- [x] **TASK-021:** Install required packages
  - `bcrypt` / `bcryptjs` (password hashing)
  - `@nestjs/jwt` (JWT support)
  - `@nestjs/passport` (Passport integration)
  - `passport`, `passport-jwt` (JWT strategy)
  - `class-validator`, `class-transformer` (DTO validation)
  - `twilio` (SMS/OTP)

### Auth Module
- [x] **TASK-022:** Generate `AuthModule` (`nest g module auth`)
- [x] **TASK-023:** Create `AuthService` with methods:
  - `register(phone, password, role)`
  - `login(phone, password)`
  - `refreshTokens(refreshToken)`
  - `logout(userId)`
- [x] **TASK-024:** Create `AuthController` with endpoints:
  - `POST /auth/register`
  - `POST /auth/login`
  - `POST /auth/refresh`
  - `POST /auth/logout`
- [x] **TASK-025:** Implement `JwtAuthGuard` (protect routes)
- [x] **TASK-026:** Implement `JwtStrategy` (validate JWT payload)
- [ ] **TASK-027:** Store refresh tokens in Redis with expiry

### OTP Service
- [ ] **TASK-028:** Create `OtpService` with methods:
  - `generateOtp(phone)` (4-digit code)
  - `verifyOtp(phone, code)` (3 attempts max)
  - `resendOtp(phone)`
- [ ] **TASK-029:** Integrate Twilio for SMS delivery
- [ ] **TASK-030:** Store OTPs in Redis with 5-minute TTL

### RBAC System
- [x] **TASK-031:** Create `@Roles()` decorator
- [x] **TASK-032:** Create `RolesGuard` (check user role)
- [x] **TASK-033:** Create `@Permissions()` decorator
- [x] **TASK-034:** Create `PermissionsGuard` (check user permissions)
- [x] **TASK-035:** Define permission constants:
  ```typescript
  export const Permissions = {
    SHIPMENTS_CREATE: 'shipments:create',
    SHIPMENTS_READ_ALL: 'shipments:read:all',
    SHIPMENTS_READ_OWN: 'shipments:read:own',
    SHIPMENTS_UPDATE_STATUS: 'shipments:update:status',
    SHIPMENTS_UPDATE_STATUS_OVERRIDE: 'shipments:update:status:override',
    COURIERS_READ: 'couriers:read',
    COURIERS_CREATE: 'couriers:create',
    MERCHANTS_READ: 'merchants:read',
    MERCHANTS_APPROVE: 'merchants:approve',
    WALLETS_READ_ALL: 'wallets:read:all',
    WALLETS_READ_OWN: 'wallets:read:own',
    PAYOUTS_REQUEST: 'payouts:request',
    PAYOUTS_APPROVE: 'payouts:approve',
  } as const;
  ```

### User Module
- [x] **TASK-036:** Generate `UsersModule`
- [x] **TASK-037:** Create `UserService` with CRUD operations
- [x] **TASK-038:** Create `UserController` with endpoints:
  - `GET /users` (admin only)
  - `GET /users/:id`
  - `PATCH /users/:id` (profile update)
  - `DELETE /users/:id` (soft delete)
- [x] **TASK-039:** Create `UserResponseDto` (exclude passwordHash)

### Merchant Module
- [x] **TASK-040:** Generate `MerchantsModule`
- [x] **TASK-041:** Create `MerchantService` with:
  - `create(data, userId)`
  - `findById(id)`
  - `updateKycStatus(id, status)`
  - `updateFeeStructure(id, fees)`
- [x] **TASK-042:** Create `MerchantController` with endpoints:
  - `POST /merchants` (onboarding)
  - `GET /merchants/:id`
  - `PATCH /merchants/:id/kyc` (admin)
  - `PATCH /merchants/:id/fees` (admin)
- [x] **TASK-043:** Create `CreateMerchantDto` with validation
- [x] **TASK-044:** Create `UpdateKycDto` (PENDING, APPROVED, REJECTED)
- [x] **TASK-045:** Auto-create Wallet when merchant KYC approved

### Courier Module
- [x] **TASK-046:** Generate `CouriersModule`
- [x] **TASK-047:** Create `CourierService` with:
  - `create(data, userId)`
  - `findById(id)`
  - `updateZones(id, zoneCodes)`
  - `updateAvailability(id, isAvailable)`
- [x] **TASK-048:** Create `CourierController` with endpoints:
  - `POST /couriers`
  - `GET /couriers/:id`
  - `PATCH /couriers/:id/zones`
  - `PATCH /couriers/:id/availability`
- [x] **TASK-049:** Create `CreateCourierDto` with validation
- [ ] **TASK-050:** Add document upload endpoint (S3 presigned URLs)

### Tests
- [ ] **TASK-051:** Write unit tests for `AuthService`
- [ ] **TASK-052:** Write unit tests for `OtpService`
- [ ] **TASK-053:** Write integration tests for auth endpoints
- [ ] **TASK-054:** Write unit tests for `MerchantService`
- [ ] **TASK-055:** Write unit tests for `CourierService`

**Definition of Done:**
- [x] All user types can register and login
- [x] JWT tokens issued and validated
- [ ] OTP verification works (3 attempts max)
- [x] Role-based access control enforced
- [x] Merchant onboarding complete
- [x] Courier profile creation with zones

---

## Sprint 3: Shipment Core (Week 3)

### Shipment Module
- [ ] **TASK-056:** Generate `ShipmentsModule`
- [ ] **TASK-057:** Create `ShipmentService` with:
  - `create(data, merchantId)`
  - `findAll(filters, pagination)`
  - `findById(id)`
  - `findByTrackingNumber(trackingNumber)`
  - `updateStatus(id, status, metadata)`
- [ ] **TASK-058:** Create `ShipmentController` with endpoints:
  - `POST /shipments`
  - `GET /shipments`
  - `GET /shipments/:id`
  - `GET /shipments/:id/timeline`
  - `PATCH /shipments/:id/status`

### State Machine
- [ ] **TASK-059:** Create `StateMachineService` with:
  - `validateTransition(currentStatus, newStatus)`
  - `isTerminalStatus(status)`
  - `getAllowedTransitions(status)`
- [ ] **TASK-060:** Define transition matrix as constant
- [ ] **TASK-061:** Block invalid transitions with `409 Conflict`
- [ ] **TASK-062:** Allow admin override with `SHIPMENT_STATUS_OVERRIDE` permission

### Tracking Number Generation
- [ ] **TASK-063:** Create `TrackingNumberService` with:
  - `generate()` → `TRK-{YYMMDD}-{random(4)}`
  - `validateFormat(trackingNumber)`
- [ ] **TASK-064:** Ensure uniqueness (database unique constraint + retry)

### Status Logging
- [ ] **TASK-065:** Auto-create `ShipmentStatusLog` on every status change
- [ ] **TASK-066:** Include `previousStatus`, `newStatus`, `changedBy`, `reason`, `metadata`
- [ ] **TASK-067:** Store GPS location, photos, signatures in metadata JSON

### Filtering & Pagination
- [ ] **TASK-068:** Implement query filters:
  - `status` (multi-select)
  - `merchantId` (admin filter)
  - `courierId` (admin filter)
  - `zoneId`
  - `from`, `to` (date range)
  - `trackingNumber`
  - `search` (fuzzy on name/phone/address)
- [ ] **TASK-069:** Implement cursor pagination for high-volume lists
- [ ] **TASK-070:** Implement offset pagination for low-volume lists

### DTOs
- [ ] **TASK-071:** Create `CreateShipmentDto` with:
  - Customer name, phone, phone2
  - Address (structured JSON)
  - Address text (full raw address)
  - COD amount (required if type=COD)
  - Product description
  - Preferred delivery date
- [ ] **TASK-072:** Create `UpdateShipmentStatusDto` with:
  - New status
  - OTP (if delivered)
  - Collected cash (if delivered)
  - Notes
  - GPS location
- [ ] **TASK-073:** Create `ShipmentResponseDto` with all fields

### Fraud Detection (Basic)
- [ ] **TASK-074:** Create `FraudDetectionService` with:
  - `calculateRiskScore(shipment)`
  - Basic signals: phone format, address quality
- [ ] **TASK-075:** Store risk score on shipment creation
- [ ] **TASK-076:** Flag high-risk shipments (score > 50)

### Tests
- [ ] **TASK-077:** Write unit tests for `StateMachineService`
- [ ] **TASK-078:** Write unit tests for `TrackingNumberService`
- [ ] **TASK-079:** Write integration tests for shipment CRUD
- [ ] **TASK-080:** Write integration tests for status transitions

**Definition of Done:**
- [ ] Shipment created with proper tracking number
- [ ] State transitions validated
- [ ] Every status change logged with metadata
- [ ] Public tracking endpoint works
- [ ] Filtering and pagination functional

---

## Sprint 4: Assignment System (Week 4)

### Assignment Module
- [ ] **TASK-081:** Generate `AssignmentsModule`
- [ ] **TASK-082:** Create `AssignmentService` with:
  - `create(data)` (manual assignment)
  - `findByCourier(courierId)`
  - `findByShipment(shipmentId)`
  - `reassign(assignmentId, newCourierId, reason)`
  - `cancel(assignmentId, reason)`
- [ ] **TASK-083:** Create `AssignmentController` with endpoints:
  - `POST /assignments`
  - `GET /assignments`
  - `PATCH /assignments/:id/reassign`
  - `PATCH /assignments/:id/cancel`

### Validation
- [ ] **TASK-084:** Validate shipment is PENDING before assignment
- [ ] **TASK-085:** Validate courier has capacity (active < maxDailyCapacity)
- [ ] **TASK-086:** Validate courier is active and available
- [ ] **TASK-087:** Enforce one ACTIVE assignment per shipment

### Notifications
- [ ] **TASK-088:** Create `NotificationsModule`
- [ ] **TASK-089:** Create `NotificationService` with:
  - `sendToCourier(courierId, title, body, data)`
  - `sendToMerchant(merchantId, title, body, data)`
- [ ] **TASK-090:** Create `Notification` entity for in-app notifications
- [ ] **TASK-091:** Send push notification on assignment creation
- [ ] **TASK-092:** Implement Firebase Cloud Messaging integration

### Courier Task Endpoints
- [ ] **TASK-093:** Create `GET /courier/tasks` endpoint
- [ ] **TASK-094:** Return tasks sorted by route order
- [ ] **TASK-095:** Include customer phone masked (01xxxxx123)

### Tests
- [ ] **TASK-096:** Write unit tests for `AssignmentService`
- [ ] **TASK-097:** Write integration tests for assignment endpoints
- [ ] **TASK-098:** Write integration tests for reassignment flow

**Definition of Done:**
- [ ] Admin can manually assign shipments
- [ ] Courier receives notification
- [ ] Reassignment cancels old assignment
- [ ] Courier sees task list

---

## Sprint 5: Courier API Endpoints (Week 5)

This sprint provides the **backend APIs** consumed by the separate Courier PWA (React app in another repo).

### Courier Task API
- [ ] **TASK-099:** Create `GET /courier/tasks` endpoint (detailed)
  - Today's assigned shipments
  - Customer name, masked phone, address, COD amount
  - Route order, map URL
  - Product description, delivery notes
- [ ] **TASK-100:** Create `GET /courier/tasks/:id` endpoint (single task detail)
- [ ] **TASK-101:** Create `PATCH /courier/tasks/:id/status` endpoint
  - Accept status: DELIVERED, FAILED, POSTPONED
  - Validate OTP for COD deliveries
  - Accept photoBase64, signatureBase64, gpsLocation
  - Update courier.cashHeld on COD delivery

### Courier Sync API
- [ ] **TASK-102:** Create `POST /courier/sync` endpoint (batch offline updates)
  - Accept array of pending updates
  - Process with idempotency keys
  - Return conflicts for admin review
  - Handle duplicate updates gracefully
- [ ] **TASK-103:** Create `GET /courier/sync/status` endpoint
  - Return last sync timestamp
  - Return pending updates count

### Cash Management API
- [ ] **TASK-104:** Create `POST /courier/deposits` endpoint
  - Log cash deposit to admin
  - Amount, depositedTo (admin user), notes, receipt photo
  - Update courier.cashHeld
- [ ] **TASK-105:** Create `GET /courier/cash-summary` endpoint
  - Current cashHeld
  - Today's collections
  - Deposit history

### Performance API
- [ ] **TASK-106:** Create `GET /courier/performance` endpoint
  - Score, total delivered, total failed, success rate
  - Average delivery time, rank
  - Weekly trend data

### Tests
- [ ] **TASK-107:** Write integration tests for courier task endpoints
- [ ] **TASK-108:** Write integration tests for sync endpoint
- [ ] **TASK-109:** Write integration tests for cash deposit endpoint
- [ ] **TASK-110:** Test idempotency (duplicate updates)
- [ ] **TASK-111:** Test OTP validation (3 attempts, then lock)

**Definition of Done:**
- [ ] Courier can fetch today's tasks
- [ ] Status updates with OTP/photo work
- [ ] Offline sync processes batch updates
- [ ] Cash deposits update courier balance
- [ ] All endpoints have proper auth

---

## Sprint 6: Wallet & COD (Week 6)

### Wallet Module
- [ ] **TASK-112:** Generate `WalletsModule`
- [ ] **TASK-113:** Create `WalletService` with:
  - `create(merchantId)` (auto-create on KYC approval)
  - `findByMerchant(merchantId)`
  - `getBalance(merchantId)`
  - `getTransactions(merchantId, pagination)`
- [ ] **TASK-114:** Create `WalletController` with endpoints:
  - `GET /wallets/:id`
  - `GET /wallets/:id/transactions`

### Transaction Service
- [ ] **TASK-115:** Create `TransactionService` with:
  - `createCredit(walletId, amount, type, description)`
  - `createDebit(walletId, amount, type, description)`
  - `getRunningBalance(walletId)`
- [ ] **TASK-116:** Implement optimistic locking with `version` field
- [ ] **TASK-117:** Retry up to 3x on conflict with exponential backoff

### COD Credit Flow
- [ ] **TASK-118:** On `ShipmentDeliveredEvent`:
  - Calculate gross COD
  - Calculate commission (percentage)
  - Calculate fee (flat per shipment)
  - Create 3 transactions atomically
  - Update wallet balance
- [ ] **TASK-119:** Update `courier.cashHeld` on delivery

### Fee Calculation
- [ ] **TASK-120:** Create `FeeCalculatorService` with:
  - `calculateNetCredit(codAmount, feeStructure)`
  - Support for tiered commission rates
- [ ] **TASK-121:** Read fee structure from merchant config

### Merchant Wallet API
- [ ] **TASK-122:** Create `GET /merchant/wallet` endpoint
  - Balance, pending balance, available balance
  - Total credited, total debited
- [ ] **TASK-123:** Create `GET /merchant/wallet/transactions` endpoint
  - Transaction history with pagination
  - Filter by type, date range

### Tests
- [ ] **TASK-124:** Write unit tests for `TransactionService`
- [ ] **TASK-125:** Write unit tests for `FeeCalculatorService`
- [ ] **TASK-126:** Write integration tests for COD credit flow
- [ ] **TASK-127:** Test concurrent wallet updates

**Definition of Done:**
- [ ] Wallet auto-created on merchant approval
- [ ] COD credits create matching debits
- [ ] Balance updates atomically
- [ ] Transaction history visible
- [ ] Courier cashHeld tracked

---

## Sprint 7: Admin & Merchant APIs + Polish (Week 7-8)

### Merchant Dashboard API
- [ ] **TASK-128:** Create `GET /merchant/dashboard` endpoint
  - Shipment counts (total, pending, in transit, delivered, returned)
  - Delivery success rate
  - Average COD amount
  - Recent activity (last 5 shipments)
- [ ] **TASK-129:** Create `GET /merchant/analytics` endpoint
  - Success rate trend (7d, 30d, 90d)
  - Return reasons breakdown
  - Zone performance metrics
  - COD collection trend

### Admin Dashboard API
- [ ] **TASK-130:** Create `GET /admin/dashboard` endpoint
  - Today's stats: shipments created, delivered, failed
  - Total COD collected today
  - Pending assignments count
  - Courier online/offline status
- [ ] **TASK-131:** Create `GET /admin/financial-summary` endpoint
  - Daily COD collected
  - Pending settlements
  - Courier cash holdings
  - Expected vs actual cash

### Reports API
- [ ] **TASK-132:** Create `POST /admin/reports/daily` endpoint
  - Generate daily operations report
  - Accept date parameter
  - Return shipment counts by status, zone, courier
- [ ] **TASK-133:** Create `POST /admin/reports/courier-performance` endpoint
  - Per-courier delivery stats
  - Success rate, average delivery time
- [ ] **TASK-134:** Create `POST /admin/reports/merchant-delivery` endpoint
  - Per-merchant delivery rates
  - Return reason analysis

### Audit Logs API
- [ ] **TASK-135:** Create `GET /admin/audit-logs` endpoint
  - Filter by user, action, entity type, date range
  - Pagination
  - Export to CSV

### Bug Fixes & Polish
- [ ] **TASK-136:** Fix any critical bugs from testing
- [ ] **TASK-137:** Performance optimization (add missing database indexes)
- [ ] **TASK-138:** Security review (verify all endpoints have auth guards)
- [ ] **TASK-139:** Rate limiting on auth and public endpoints

### Documentation
- [ ] **TASK-140:** Update API documentation (Swagger annotations)
- [ ] **TASK-141:** Create API usage guide for frontend teams
- [ ] **TASK-142:** Document courier sync protocol for PWA team

### Pilot Preparation
- [ ] **TASK-143:** Setup staging environment
- [ ] **TASK-144:** Create pilot merchant accounts
- [ ] **TASK-145:** Onboard 2-3 test merchants
- [ ] **TASK-146:** Verify end-to-end flow (create → assign → deliver → credit)

**Definition of Done:**
- [ ] 2-3 merchants creating shipments via API
- [ ] 5+ couriers updating status via API
- [ ] 100+ shipments/week processed
- [ ] Dashboard APIs return accurate data
- [ ] < 5 critical bugs
- [ ] Documentation complete for frontend teams

---

## Task Summary

| Sprint | Tasks | Backend Focus |
|--------|-------|---------------|
| Week 1 | TASK-001 to TASK-020 | Foundation, Docker, Prisma, Seeds |
| Week 2 | TASK-021 to TASK-055 | Auth, OTP, RBAC, Users, Merchants, Couriers |
| Week 3 | TASK-056 to TASK-080 | Shipments, State Machine, Tracking, Fraud |
| Week 4 | TASK-081 to TASK-098 | Assignments, Notifications, Courier Task APIs |
| Week 5 | TASK-099 to TASK-111 | Courier API Endpoints (for separate PWA) |
| Week 6 | TASK-112 to TASK-127 | Wallet, Transactions, COD Credit, Fees |
| Week 7-8 | TASK-128 to TASK-146 | Admin/Merchant APIs, Reports, Polish, Pilot |

**Total Tasks:** 146 (backend only)

**Frontend Apps (Separate Repos):**
- `trackora-courier/` — React PWA (consumes Sprint 5 APIs)
- `trackora-merchant/` — React Admin/Merchant Portal (consumes Sprint 7 APIs)
