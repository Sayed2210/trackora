# Complete Prisma Schema

## Overview

This document contains the complete Prisma schema for the Logistics & COD Shipment Management SaaS. It is designed for PostgreSQL with specific extensions and optimizations for the MENA market.

## Required PostgreSQL Extensions

```sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For fuzzy text search
CREATE EXTENSION IF NOT EXISTS "postgis"; -- For geospatial queries (optional, Phase 2)
```

## Enums

```prisma
enum UserRole {
  SUPER_ADMIN
  OPERATIONS_MANAGER
  FINANCE_ADMIN
  MERCHANT
  COURIER
}

enum ShipmentStatus {
  PENDING
  PICKED_UP
  IN_WAREHOUSE
  OUT_FOR_DELIVERY
  DELIVERED
  FAILED
  POSTPONED
  RETURNED
  CANCELLED
}

enum ShipmentType {
  COD
  PREPAID
  RETURN
}

enum AssignmentType {
  MANUAL
  AUTO_DISPATCH
}

enum AssignmentStatus {
  ACTIVE
  COMPLETED
  CANCELLED
  REJECTED
}

enum TransactionType {
  COD_CREDIT
  FEE_DEBIT
  COMMISSION_DEBIT
  RETURN_FEE_DEBIT
  CANCELLATION_FEE_DEBIT
  PAYOUT_DEBIT
  ADJUSTMENT_CREDIT
  ADJUSTMENT_DEBIT
  BONUS_CREDIT
}

enum PayoutStatus {
  PENDING
  APPROVED
  PROCESSING
  COMPLETED
  REJECTED
}

enum PayoutMethod {
  BANK_TRANSFER
  INSTAPAY
  VODAFONE_CASH
  ETISALAT_CASH
}

enum NotificationType {
  SHIPMENT_CREATED
  SHIPMENT_ASSIGNED
  SHIPMENT_STATUS_UPDATE
  CASH_COLLECTED
  PAYOUT_PROCESSED
  SYSTEM_ALERT
}

enum KycStatus {
  PENDING
  APPROVED
  REJECTED
}

enum VehicleType {
  MOTORCYCLE
  CAR
  VAN
  BICYCLE
}

enum ReturnReason {
  CUSTOMER_NOT_AVAILABLE
  CUSTOMER_REFUSED
  WRONG_ADDRESS
  PHONE_UNREACHABLE
  PRODUCT_DAMAGED
  PRODUCT_MISMATCH
  COURIER_ACCESS_ISSUE
  CUSTOMER_CANCELLED
}

enum ZoneLevel {
  COUNTRY
  GOVERNORATE
  CITY
  DISTRICT
}

enum JobStatus {
  PROCESSING
  COMPLETED
  FAILED
}
```

## Core Models

### User

Central authentication and identity entity. All platform users (admins, merchants, couriers) have a User record.

```prisma
model User {
  id            String    @id @default(uuid())
  email         String?   @unique
  phone         String    @unique // Primary identifier in MENA
  passwordHash  String?
  role          UserRole
  name          String
  avatarUrl     String?
  isActive      Boolean   @default(true)
  emailVerified DateTime?
  phoneVerified DateTime?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  // Relations
  merchant      Merchant?
  courier       Courier?
  statusLogs    ShipmentStatusLog[]
  assignmentsCreated Assignment[] @relation("AssignmentCreator")
  payoutsApproved    Payout[] @relation("PayoutApprover")
  auditLogs     AuditLog[]
  notifications Notification[] @relation("NotificationRecipient")

  @@index([role, isActive])
  @@index([phone])
}
```

**Key Design Decisions:**
- `email` is nullable because many MENA users (especially couriers) only have phone numbers.
- `phone` is the primary business identifier and must be unique.
- One-to-one relations with Merchant and Courier ensure a user cannot be both.

### Zone

Hierarchical geographic zones for dispatch matching and reporting.

```prisma
model Zone {
  id          String    @id @default(uuid())
  parentId    String?
  level       ZoneLevel
  nameAr      String
  nameEn      String?
  code        String    @unique // e.g., EG-C-MAD (Egypt-Cairo-Maadi)
  polygon     Json?     // GeoJSON Polygon for geofencing
  centerLat   Float?
  centerLng   Float?
  isActive    Boolean   @default(true)
  createdAt   DateTime  @default(now())

  // Self-relation for hierarchy
  parent      Zone?     @relation("ZoneHierarchy", fields: [parentId], references: [id])
  children    Zone[]    @relation("ZoneHierarchy")

  // Relations
  shipments   Shipment[]

  @@index([parentId])
  @@index([level, isActive])
  @@index([code])
}
```

**Key Design Decisions:**
- `code` uses a hierarchical pattern for human readability and fast filtering.
- `polygon` stores GeoJSON for point-in-polygon queries (requires PostGIS extension for true spatial queries).
- Self-relation enables unlimited hierarchy depth (country → governorate → city → district).

## Business Models

### Merchant

Business profile for store owners and social sellers.

```prisma
model Merchant {
  id                  String   @id @default(uuid())
  userId              String   @unique
  businessName        String
  businessType        String   // ecommerce, social_seller, retail
  websiteUrl          String?
  socialMediaUrl      String?
  kycStatus           KycStatus @default(PENDING)
  kycDocuments        Json?    // {idScan: url, taxCard: url, commercialRegister: url}
  commissionRate      Decimal  @default(0) @db.Decimal(5,4) // 0.0500 = 5%
  feePerShipment      Decimal  @default(0) @db.Decimal(10,2)
  returnFee           Decimal  @default(0) @db.Decimal(10,2)
  cancellationFee     Decimal  @default(0) @db.Decimal(10,2)
  creditLimit         Decimal  @default(0) @db.Decimal(10,2)
  defaultPickupAddress Json?
  branding            Json?    // {logoUrl, primaryColor, trackingSubdomain}
  isActive            Boolean  @default(true)
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  // Relations
  user      User        @relation(fields: [userId], references: [id])
  shipments Shipment[]
  wallet    Wallet?
  payouts   Payout[]

  @@index([kycStatus, isActive])
  @@index([businessName])
}
```

**Key Design Decisions:**
- `commissionRate` uses DECIMAL(5,4) to precisely store percentages up to 999.99%.
- Fee fields (feePerShipment, returnFee, cancellationFee) are per-merchant configurable, enabling tiered pricing.
- `branding` JSON supports white-label tracking pages without schema migrations.

### Courier

Delivery agent profile with performance tracking and zone assignments.

```prisma
model Courier {
  id                    String   @id @default(uuid())
  userId                String   @unique
  employeeId            String?
  vehicleType           VehicleType @default(MOTORCYCLE)
  licensePlate          String?
  zoneCodes             String[] // Array of Zone.code strings
  maxDailyCapacity      Int      @default(25)
  currentPerformanceScore Int    @default(50)
  cashHeld              Decimal  @default(0) @db.Decimal(10,2)
  cashHeldLimit         Decimal  @default(5000) @db.Decimal(10,2)
  documents             Json?    // {license: url, id: url, contract: url}
  isActive              Boolean  @default(true)
  isAvailable           Boolean  @default(true)
  avgDeliveryTimeMinutes Int?    // Rolling average
  totalDelivered        Int      @default(0)
  totalFailed           Int      @default(0)
  totalReturned         Int      @default(0)
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  // Relations
  user        User         @relation(fields: [userId], references: [id])
  assignments Assignment[]
  shipments   Shipment[]   @relation("CourierAssignments")
  cashDeposits CourierCashDeposit[]

  @@index([isActive, isAvailable])
  @@index([zoneCodes])
  @@index([currentPerformanceScore])
}
```

**Key Design Decisions:**
- `zoneCodes` is a string array for simple zone matching. Could be normalized to a join table if zone assignments become complex.
- `currentPerformanceScore` is denormalized and updated by a nightly cron job for fast dispatch queries.
- `cashHeld` is tracked in real-time but should match the sum of un-deposited COD collections.

### Shipment

Central entity representing a package to be delivered.

```prisma
model Shipment {
  id                    String   @id @default(uuid())
  trackingNumber        String   @unique
  merchantId            String
  status                ShipmentStatus @default(PENDING)
  type                  ShipmentType @default(COD)
  customerName          String
  customerPhone         String
  customerPhone2        String?
  address               Json     // Structured address components
  addressText           String   @db.Text // Full raw address
  geoLocation           Json?    // {lat, lng}
  zoneId                String?  // Resolved district
  codAmount             Decimal  @default(0) @db.Decimal(10,2)
  productDescription    String   @db.Text
  productValue          Decimal  @default(0) @db.Decimal(10,2)
  weight                Decimal  @default(1) @db.Decimal(5,2)
  pieces                Int      @default(1)
  notes                 String?  @db.Text
  deliveryAttempts      Int      @default(0)
  preferredDeliveryDate DateTime?
  assignedCourierId     String?
  returnReason          ReturnReason?
  returnNotes           String?  @db.Text
  collectedCash         Decimal? @db.Decimal(10,2) // Actual collected
  customerOtp           String?  // 4-digit delivery verification
  deliveredAt           DateTime?
  returnedAt            DateTime?
  cancelledAt           DateTime?
  autoDispatchEligible  Boolean  @default(true)
  addressVerified       Boolean  @default(false)
  riskScore             Int      @default(0) // 0-100
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  // Relations
  merchant    Merchant    @relation(fields: [merchantId], references: [id])
  courier     Courier?    @relation("CourierAssignments", fields: [assignedCourierId], references: [id])
  zone        Zone?       @relation(fields: [zoneId], references: [id])
  statusLogs  ShipmentStatusLog[]
  assignments Assignment[]
  transactions Transaction[]
  shipmentRisk ShipmentRisk?
  notifications Notification[]

  @@index([trackingNumber])
  @@index([merchantId, status])
  @@index([assignedCourierId, status])
  @@index([zoneId, status, preferredDeliveryDate])
  @@index([status, createdAt])
  @@index([customerPhone])
  @@index([riskScore])
  // Full-text search index added via migration:
  // CREATE INDEX idx_shipment_search ON shipments USING gin(to_tsvector('simple', coalesce(customer_name,'') || ' ' || coalesce(customer_phone,'') || ' ' || coalesce(address_text,'')));
}
```

**Key Design Decisions:**
- `trackingNumber` is human-readable (e.g., `TRK-240502-A1B2`) for customer support and public tracking.
- `address` is JSON to accommodate variable address structures across MENA countries without schema changes.
- `addressText` is the raw Arabic text for display and fuzzy search.
- `riskScore` is calculated at creation and updated if signals change.

### ShipmentStatusLog

Immutable audit trail of every status transition.

```prisma
model ShipmentStatusLog {
  id              String   @id @default(uuid())
  shipmentId      String
  previousStatus  ShipmentStatus?
  newStatus       ShipmentStatus
  changedByUserId String?
  changedByRole   UserRole?
  reason          String?  @db.Text
  metadata        Json?    // {gpsLocation, photoUrl, signatureUrl, deviceInfo}
  createdAt       DateTime @default(now())

  // Relations
  shipment Shipment @relation(fields: [shipmentId], references: [id], onDelete: Cascade)
  user     User?    @relation(fields: [changedByUserId], references: [id])

  @@index([shipmentId, createdAt])
  @@index([newStatus, createdAt])
}
```

**Key Design Decisions:**
- `previousStatus` is nullable for the initial creation log.
- `metadata` stores evidence (GPS, photos) for dispute resolution.
- Partition this table by `createdAt` (monthly) when reaching 1M+ rows.

### Assignment

Explicit record of courier assignment for a shipment.

```prisma
model Assignment {
  id              String   @id @default(uuid())
  shipmentId      String   @unique
  courierId       String
  assignedByUserId String?
  assignmentType  AssignmentType
  status          AssignmentStatus @default(ACTIVE)
  assignedAt      DateTime @default(now())
  completedAt     DateTime?
  cancelledAt     DateTime?
  cancellationReason String?

  // Relations
  shipment    Shipment @relation(fields: [shipmentId], references: [id])
  courier     Courier  @relation(fields: [courierId], references: [id])
  assignedBy  User?    @relation("AssignmentCreator", fields: [assignedByUserId], references: [id])

  @@index([courierId, status])
  @@index([assignedAt])
}
```

**Key Design Decisions:**
- One active assignment per shipment (`shipmentId` is unique).
- Reassignment creates a new assignment record; old one is marked CANCELLED.
- `assignmentType` distinguishes manual dispatch from auto-dispatch for analytics.

### Wallet

Merchant wallet for COD reconciliation.

```prisma
model Wallet {
  id              String   @id @default(uuid())
  merchantId      String   @unique
  balance         Decimal  @default(0) @db.Decimal(10,2)
  pendingBalance  Decimal  @default(0) @db.Decimal(10,2)
  totalCredited   Decimal  @default(0) @db.Decimal(10,2)
  totalDebited    Decimal  @default(0) @db.Decimal(10,2)
  currency        String   @default("EGP")
  lastSettlementAt DateTime?
  version         Int      @default(0) // Optimistic locking
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  // Relations
  merchant     Merchant      @relation(fields: [merchantId], references: [id])
  transactions Transaction[]

  @@index([merchantId])
}
```

**Key Design Decisions:**
- `version` enables optimistic locking to prevent concurrent transaction updates.
- `pendingBalance` tracks COD in transit (shipments not yet delivered).
- `balance` is available for withdrawal.

### Transaction

Double-entry ledger record.

```prisma
model Transaction {
  id              String   @id @default(uuid())
  walletId        String
  shipmentId      String?
  type            TransactionType
  amount          Decimal  @db.Decimal(10,2) // Positive = credit, Negative = debit
  runningBalance  Decimal  @db.Decimal(10,2) // Snapshot after this transaction
  description     String   @db.Text
  metadata        Json?    // {feeBreakdown, reference, reversedTransactionId}
  createdAt       DateTime @default(now())

  // Relations
  wallet   Wallet    @relation(fields: [walletId], references: [id])
  shipment Shipment? @relation(fields: [shipmentId], references: [id])

  @@index([walletId, createdAt])
  @@index([shipmentId])
  @@index([type, createdAt])
}
```

**Key Design Decisions:**
- `amount` is signed: positive for credits, negative for debits.
- `runningBalance` is a denormalized snapshot for fast statement generation without recalculation.
- `metadata` stores fee breakdowns and reversal references.
- **Insert-only. Never update or delete.**

### Payout

Merchant withdrawal request and execution tracking.

```prisma
model Payout {
  id              String   @id @default(uuid())
  merchantId      String
  amount          Decimal  @db.Decimal(10,2)
  status          PayoutStatus @default(PENDING)
  method          PayoutMethod
  destination     Json     // {bankName, accountNumber, iban, walletNumber}
  approvedByUserId String?
  processedAt     DateTime?
  completedAt     DateTime?
  referenceNumber String?
  rejectionReason String?  @db.Text
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  // Relations
  merchant    Merchant @relation(fields: [merchantId], references: [id])
  approvedBy  User?    @relation("PayoutApprover", fields: [approvedByUserId], references: [id])

  @@index([merchantId, status])
  @@index([status, createdAt])
  @@index([referenceNumber])
}
```

**Key Design Decisions:**
- `destination` is JSON to support multiple payout methods without schema changes.
- `referenceNumber` stores bank reference for reconciliation.
- Status transitions: PENDING → APPROVED → PROCESSING → COMPLETED/REJECTED.

### CourierCashDeposit

Record of courier handing collected cash to finance/admin.

```prisma
model CourierCashDeposit {
  id           String   @id @default(uuid())
  courierId    String
  amount       Decimal  @db.Decimal(10,2)
  depositedAt  DateTime @default(now())
  verifiedByUserId String?
  notes        String?  @db.Text
  receiptUrl   String?

  // Relations
  courier Courier @relation(fields: [courierId], references: [id])

  @@index([courierId, depositedAt])
}
```

### ShipmentRisk

Fraud detection and risk assessment record.

```prisma
model ShipmentRisk {
  id            String   @id @default(uuid())
  shipmentId    String   @unique
  score         Int      @default(0)
  signals       Json     // [{signal: "BLACKLISTED_PHONE", weight: 50}]
  status        String   @default("ACTIVE") // ACTIVE, REVIEWED, CLEARED, CONFIRMED_FRAUD
  reviewedBy    String?
  reviewedAt    DateTime?
  actionTaken   String?  // e.g., "HELD_FOR_VERIFICATION"
  createdAt     DateTime @default(now())

  // Relations
  shipment Shipment @relation(fields: [shipmentId], references: [id], onDelete: Cascade)

  @@index([score])
  @@index([status])
}
```

### BlacklistedPhone

Phone numbers blocked due to fraud or repeated failures.

```prisma
model BlacklistedPhone {
  id          String   @id @default(uuid())
  phone       String   @unique
  reason      String
  evidence    Json?    // {shipmentIds: [], pattern: ""}
  blockedBy   String?
  blockedAt   DateTime @default(now())
  expiresAt   DateTime?
  isPermanent Boolean  @default(false)

  @@index([phone])
  @@index([blockedAt])
}
```

### Notification

In-app notification store.

```prisma
model Notification {
  id          String   @id @default(uuid())
  userId      String
  type        NotificationType
  title       String
  body        String   @db.Text
  data        Json?    // {shipmentId, trackingNumber, url}
  isRead      Boolean  @default(false)
  readAt      DateTime?
  createdAt   DateTime @default(now())

  // Relations
  user User @relation("NotificationRecipient", fields: [userId], references: [id])

  @@index([userId, isRead, createdAt])
}
```

### AuditLog

Global audit trail for admin actions.

```prisma
model AuditLog {
  id          String   @id @default(uuid())
  userId      String?
  action      String
  entityType  String
  entityId    String
  oldValue    Json?
  newValue    Json?
  ipAddress   String?
  userAgent   String?
  createdAt   DateTime @default(now())

  // Relations
  user User? @relation(fields: [userId], references: [id])

  @@index([entityType, entityId, createdAt])
  @@index([userId, createdAt])
  @@index([action, createdAt])
}
```

### WhatsAppTemplate

Template management for WhatsApp Business API.

```prisma
model WhatsAppTemplate {
  id            String   @id @default(uuid())
  name          String   @unique
  language      String   @default("ar")
  templateId    String?  // Provider's template ID
  status        String   @default("PENDING") // PENDING, APPROVED, REJECTED
  content       String   @db.Text
  variables     Json     // [{name: "customerName", type: "string"}]
  category      String   // UTILITY, MARKETING, AUTHENTICATION
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([status, language])
}
```

### BulkJob

Background job tracking for bulk operations.

```prisma
model BulkJob {
  id            String   @id @default(uuid())
  merchantId    String
  type          String   // IMPORT_SHIPMENTS, EXPORT_REPORT
  status        JobStatus @default(PROCESSING)
  fileUrl       String
  resultUrl     String?
  totalRows     Int      @default(0)
  successRows   Int      @default(0)
  failedRows    Int      @default(0)
  errors        Json?    // [{row: 5, message: "Invalid phone"}]
  createdAt     DateTime @default(now())
  completedAt   DateTime?

  @@index([merchantId, status])
  @@index([createdAt])
}
```

## Migration Notes

### Initial Migration Commands

```bash
# Generate migration from schema
npx prisma migrate dev --name init

# Deploy to production (after review)
npx prisma migrate deploy

# Generate Prisma Client
npx prisma generate
```

### Manual Index Additions

After initial migration, add these indexes for full-text search:

```sql
-- Enable pg_trgm extension
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Full-text search on shipments
CREATE INDEX idx_shipment_search ON "Shipment" USING gin(
  to_tsvector('simple', 
    coalesce("customerName",'') || ' ' || 
    coalesce("customerPhone",'') || ' ' || 
    coalesce("addressText",'')
  )
);

-- Trigram index for fuzzy phone search
CREATE INDEX idx_shipment_phone_trgm ON "Shipment" USING gin("customerPhone" gin_trgm_ops);

-- Trigram index for fuzzy address search
CREATE INDEX idx_shipment_address_trgm ON "Shipment" USING gin("addressText" gin_trgm_ops);
```

### Partitioning Setup (When Reaching Scale)

```sql
-- Convert ShipmentStatusLog to partitioned table
CREATE TABLE shipment_status_logs_partitioned (
  LIKE "ShipmentStatusLog" INCLUDING ALL
) PARTITION BY RANGE ("createdAt");

-- Create monthly partitions
CREATE TABLE shipment_status_logs_2024_05 
  PARTITION OF shipment_status_logs_partitioned
  FOR VALUES FROM ('2024-05-01') TO ('2024-06-01');

-- Similar for Transaction and AuditLog
```

## Seeding Strategy

```typescript
// prisma/seed.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Create zones
  const egypt = await prisma.zone.create({
    data: { level: 'COUNTRY', nameAr: 'مصر', nameEn: 'Egypt', code: 'EG' }
  });
  
  const cairo = await prisma.zone.create({
    data: { 
      level: 'GOVERNORATE', 
      nameAr: 'القاهرة', 
      nameEn: 'Cairo', 
      code: 'EG-C',
      parentId: egypt.id 
    }
  });
  
  // Create admin user
  const admin = await prisma.user.create({
    data: {
      phone: '201000000000',
      role: 'SUPER_ADMIN',
      name: 'System Admin',
      phoneVerified: new Date(),
    }
  });
  
  console.log('Seed completed');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
```

## Schema Validation Checklist

- [ ] All foreign keys have proper `onDelete` rules (Cascade for logs, Restrict for business entities)
- [ ] Decimal fields specify precision and scale
- [ ] Indexes cover all query patterns (filter, sort, join)
- [ ] Unique constraints prevent data duplication
- [ ] Nullable fields are intentional and documented
- [ ] JSON fields have consistent structure (documented in code comments)
- [ ] Enum values are comprehensive and MENA-relevant
- [ ] Optimistic locking configured for concurrent financial operations

---

**Next:** See `BUSINESS_FLOWS.md` for detailed process flows and state diagrams.
