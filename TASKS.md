# Phase 1 Implementation Tasks

## Sprint 1: Foundation (Week 1)

### Infrastructure Setup
- [ ] **TASK-001:** Install Prisma dependencies (`@prisma/client`, `prisma`)
- [ ] **TASK-002:** Create `docker-compose.yml` with PostgreSQL 15 + Redis 7
- [ ] **TASK-003:** Create `.env.example` with required environment variables
- [ ] **TASK-004:** Run `npx prisma migrate dev --name init` to create database
- [ ] **TASK-005:** Run `npx prisma generate` to generate Prisma Client
- [ ] **TASK-006:** Verify `docker-compose up` starts all services successfully

### Project Structure
- [ ] **TASK-007:** Create directory structure under `src/`
  - `src/core/` (config, database, events, exceptions)
  - `src/modules/` (business modules)
  - `src/shared/` (enums, DTOs, interfaces, utils)
- [ ] **TASK-008:** Create `src/core/prisma/prisma.service.ts` (PrismaClient wrapper)
- [ ] **TASK-009:** Create `src/core/config/config.module.ts` (environment configuration)
- [ ] **TASK-010:** Create `src/core/events/events.module.ts` (EventEmitter2 setup)
- [ ] **TASK-011:** Update `src/app.module.ts` to import core modules

### Database Seeding
- [ ] **TASK-012:** Create `prisma/seed.ts` with Egypt zones data
  - Country: Egypt
  - Governorates: Cairo, Giza, Alexandria
  - Cities: Maadi, Nasr City, Heliopolis, Dokki, Mohandessin
  - Districts: Sarayat, Degla, Mustafa, Rabaa, Korba
- [ ] **TASK-013:** Add `prisma.seed` config to `package.json`
- [ ] **TASK-014:** Run `npx prisma db seed` and verify zones created

### API Documentation
- [ ] **TASK-015:** Install `@nestjs/swagger` and `swagger-ui-express`
- [ ] **TASK-016:** Configure Swagger in `src/main.ts` at `/api/docs`
- [ ] **TASK-017:** Verify Swagger UI accessible at `http://localhost:3000/api/docs`

### Validation
- [ ] **TASK-018:** Run `npm run lint` and fix any issues
- [ ] **TASK-019:** Run `npm run test` and ensure starter tests pass
- [ ] **TASK-020:** Run `npm run build` and verify no compilation errors

**Definition of Done:**
- [ ] `docker-compose up` starts PostgreSQL + Redis
- [ ] `npm run test` passes
- [ ] `npm run build` succeeds
- [ ] Swagger UI at `/api/docs`
- [ ] Database seeded with Egypt zones

---

## Sprint 2: Authentication & Users (Week 2)

### Dependencies
- [ ] **TASK-021:** Install required packages
  - `bcrypt` / `bcryptjs` (password hashing)
  - `@nestjs/jwt` (JWT support)
  - `@nestjs/passport` (Passport integration)
  - `passport`, `passport-jwt` (JWT strategy)
  - `class-validator`, `class-transformer` (DTO validation)
  - `twilio` (SMS/OTP)

### Auth Module
- [ ] **TASK-022:** Generate `AuthModule` (`nest g module auth`)
- [ ] **TASK-023:** Create `AuthService` with methods:
  - `register(phone, password, role)`
  - `login(phone, password)`
  - `refreshTokens(refreshToken)`
  - `logout(userId)`
- [ ] **TASK-024:** Create `AuthController` with endpoints:
  - `POST /auth/register`
  - `POST /auth/login`
  - `POST /auth/refresh`
  - `POST /auth/logout`
- [ ] **TASK-025:** Implement `JwtAuthGuard` (protect routes)
- [ ] **TASK-026:** Implement `JwtStrategy` (validate JWT payload)
- [ ] **TASK-027:** Store refresh tokens in Redis with expiry

### OTP Service
- [ ] **TASK-028:** Create `OtpService` with methods:
  - `generateOtp(phone)` (4-digit code)
  - `verifyOtp(phone, code)` (3 attempts max)
  - `resendOtp(phone)`
- [ ] **TASK-029:** Integrate Twilio for SMS delivery
- [ ] **TASK-030:** Store OTPs in Redis with 5-minute TTL

### RBAC System
- [ ] **TASK-031:** Create `@Roles()` decorator
- [ ] **TASK-032:** Create `RolesGuard` (check user role)
- [ ] **TASK-033:** Create `@Permissions()` decorator
- [ ] **TASK-034:** Create `PermissionsGuard` (check user permissions)
- [ ] **TASK-035:** Define permission constants:
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
- [ ] **TASK-036:** Generate `UsersModule`
- [ ] **TASK-037:** Create `UserService` with CRUD operations
- [ ] **TASK-038:** Create `UserController` with endpoints:
  - `GET /users` (admin only)
  - `GET /users/:id`
  - `PATCH /users/:id` (profile update)
  - `DELETE /users/:id` (soft delete)
- [ ] **TASK-039:** Create `UserResponseDto` (exclude passwordHash)

### Merchant Module
- [ ] **TASK-040:** Generate `MerchantsModule`
- [ ] **TASK-041:** Create `MerchantService` with:
  - `create(data, userId)`
  - `findById(id)`
  - `updateKycStatus(id, status)`
  - `updateFeeStructure(id, fees)`
- [ ] **TASK-042:** Create `MerchantController` with endpoints:
  - `POST /merchants` (onboarding)
  - `GET /merchants/:id`
  - `PATCH /merchants/:id/kyc` (admin)
  - `PATCH /merchants/:id/fees` (admin)
- [ ] **TASK-043:** Create `CreateMerchantDto` with validation
- [ ] **TASK-044:** Create `UpdateKycDto` (PENDING, APPROVED, REJECTED)
- [ ] **TASK-045:** Auto-create Wallet when merchant KYC approved

### Courier Module
- [ ] **TASK-046:** Generate `CouriersModule`
- [ ] **TASK-047:** Create `CourierService` with:
  - `create(data, userId)`
  - `findById(id)`
  - `updateZones(id, zoneCodes)`
  - `updateAvailability(id, isAvailable)`
- [ ] **TASK-048:** Create `CourierController` with endpoints:
  - `POST /couriers`
  - `GET /couriers/:id`
  - `PATCH /couriers/:id/zones`
  - `PATCH /couriers/:id/availability`
- [ ] **TASK-049:** Create `CreateCourierDto` with validation
- [ ] **TASK-050:** Add document upload endpoint (S3 presigned URLs)

### Tests
- [ ] **TASK-051:** Write unit tests for `AuthService`
- [ ] **TASK-052:** Write unit tests for `OtpService`
- [ ] **TASK-053:** Write integration tests for auth endpoints
- [ ] **TASK-054:** Write unit tests for `MerchantService`
- [ ] **TASK-055:** Write unit tests for `CourierService`

**Definition of Done:**
- [ ] All user types can register and login
- [ ] JWT tokens issued and validated
- [ ] OTP verification works (3 attempts max)
- [ ] Role-based access control enforced
- [ ] Merchant onboarding complete
- [ ] Courier profile creation with zones

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

## Sprint 5: Courier PWA (Week 5)

### PWA Setup
- [ ] **TASK-099:** Create `courier-app/` directory (separate from backend)
- [ ] **TASK-100:** Initialize React + Vite project
- [ ] **TASK-101:** Configure PWA (service worker, manifest.json)
- [ ] **TASK-102:** Setup offline support (workbox or custom SW)
- [ ] **TASK-103:** Configure Arabic RTL support

### Task List Screen
- [ ] **TASK-104:** Create task list component
- [ ] **TASK-105:** Display customer name, address, COD amount
- [ ] **TASK-106:** Show task status and order in route
- [ ] **TASK-107:** Pull-to-refresh functionality

### Status Update Flow
- [ ] **TASK-108:** Create status update buttons (Delivered, Failed, Postponed)
- [ ] **TASK-109:** OTP input modal for COD deliveries
- [ ] **TASK-110:** Camera integration for delivery photo
- [ ] **TASK-111:** Signature capture component
- [ ] **TASK-112:** GPS location capture

### Offline Sync
- [ ] **TASK-113:** Setup IndexedDB schema:
  - `pending_updates` store
  - `cached_tasks` store
- [ ] **TASK-114:** Queue updates when offline
- [ ] **TASK-115:** Background sync when online
- [ ] **TASK-116:** Conflict resolution UI

### Tests
- [ ] **TASK-117:** Write component tests for task list
- [ ] **TASK-118:** Write integration tests for status update flow

**Definition of Done:**
- [ ] PWA installable on Android
- [ ] Task list displays correctly
- [ ] Status updates sync to server
- [ ] Photos capture and upload
- [ ] Offline mode functional

---

## Sprint 6: Wallet & COD (Week 6)

### Wallet Module
- [ ] **TASK-119:** Generate `WalletsModule`
- [ ] **TASK-120:** Create `WalletService` with:
  - `create(merchantId)` (auto-create on KYC approval)
  - `findByMerchant(merchantId)`
  - `getBalance(merchantId)`
  - `getTransactions(merchantId, pagination)`
- [ ] **TASK-121:** Create `WalletController` with endpoints:
  - `GET /wallets/:id`
  - `GET /wallets/:id/transactions`

### Transaction Service
- [ ] **TASK-122:** Create `TransactionService` with:
  - `createCredit(walletId, amount, type, description)`
  - `createDebit(walletId, amount, type, description)`
  - `getRunningBalance(walletId)`
- [ ] **TASK-123:** Implement optimistic locking with `version` field
- [ ] **TASK-124:** Retry up to 3x on conflict with exponential backoff

### COD Credit Flow
- [ ] **TASK-125:** On `ShipmentDeliveredEvent`:
  - Calculate gross COD
  - Calculate commission (percentage)
  - Calculate fee (flat per shipment)
  - Create 3 transactions atomically
  - Update wallet balance
- [ ] **TASK-126:** Update `courier.cashHeld` on delivery

### Fee Calculation
- [ ] **TASK-127:** Create `FeeCalculatorService` with:
  - `calculateNetCredit(codAmount, feeStructure)`
  - Support for tiered commission rates
- [ ] **TASK-128:** Read fee structure from merchant config

### Merchant Wallet View
- [ ] **TASK-129:** Create merchant wallet page
- [ ] **TASK-130:** Display balance, pending, available
- [ ] **TASK-131:** Show transaction history with pagination

### Tests
- [ ] **TASK-132:** Write unit tests for `TransactionService`
- [ ] **TASK-133:** Write unit tests for `FeeCalculatorService`
- [ ] **TASK-134:** Write integration tests for COD credit flow
- [ ] **TASK-135:** Test concurrent wallet updates

**Definition of Done:**
- [ ] Wallet auto-created on merchant approval
- [ ] COD credits create matching debits
- [ ] Balance updates atomically
- [ ] Transaction history visible
- [ ] Courier cashHeld tracked

---

## Sprint 7: Polish & Pilot (Week 7-8)

### Merchant Portal
- [ ] **TASK-136:** Create merchant dashboard page
- [ ] **TASK-137:** Display shipment stats (total, pending, delivered, returned)
- [ ] **TASK-138:** Show delivery success rate
- [ ] **TASK-139:** Display wallet balance widget

### Admin Dashboard
- [ ] **TASK-140:** Create admin operations dashboard
- [ ] **TASK-141:** Show daily COD collected
- [ ] **TASK-142:** Display courier cash held
- [ ] **TASK-143:** Show pending assignments count

### Bug Fixes
- [ ] **TASK-144:** Fix any critical bugs from testing
- [ ] **TASK-145:** Performance optimization (add missing indexes)
- [ ] **TASK-146:** Security review (check all endpoints have auth)

### Documentation
- [ ] **TASK-147:** Update API documentation (Swagger)
- [ ] **TASK-148:** Create merchant onboarding guide
- [ ] **TASK-149:** Create courier app usage guide

### Pilot Preparation
- [ ] **TASK-150:** Setup staging environment
- [ ] **TASK-151:** Create pilot merchant accounts
- [ ] **TASK-152:** Onboard 2-3 test merchants
- [ ] **TASK-153:** Train pilot couriers on PWA

**Definition of Done:**
- [ ] 2-3 merchants creating shipments
- [ ] 5+ couriers using PWA
- [ ] 100+ shipments/week
- [ ] < 5 critical bugs
- [ ] Documentation complete

---

## Task Summary

| Sprint | Tasks | Focus |
|--------|-------|-------|
| Week 1 | TASK-001 to TASK-020 | Foundation, Docker, Prisma, Seeds |
| Week 2 | TASK-021 to TASK-055 | Auth, OTP, RBAC, Users, Merchants, Couriers |
| Week 3 | TASK-056 to TASK-080 | Shipments, State Machine, Tracking, Fraud |
| Week 4 | TASK-081 to TASK-098 | Assignments, Notifications, Courier Tasks |
| Week 5 | TASK-099 to TASK-118 | Courier PWA, Offline Sync |
| Week 6 | TASK-119 to TASK-135 | Wallet, Transactions, COD Credit, Fees |
| Week 7-8 | TASK-136 to TASK-153 | Polish, Dashboards, Pilot |

**Total Tasks:** 153
