-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'OPERATIONS_MANAGER', 'FINANCE_ADMIN', 'MERCHANT', 'COURIER');

-- CreateEnum
CREATE TYPE "ShipmentStatus" AS ENUM ('PENDING', 'PICKED_UP', 'IN_WAREHOUSE', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED', 'POSTPONED', 'RETURNED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ShipmentType" AS ENUM ('COD', 'PREPAID', 'RETURN');

-- CreateEnum
CREATE TYPE "AssignmentType" AS ENUM ('MANUAL', 'AUTO_DISPATCH');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('COD_CREDIT', 'FEE_DEBIT', 'COMMISSION_DEBIT', 'RETURN_FEE_DEBIT', 'CANCELLATION_FEE_DEBIT', 'PAYOUT_DEBIT', 'ADJUSTMENT_CREDIT', 'ADJUSTMENT_DEBIT', 'BONUS_CREDIT');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'APPROVED', 'PROCESSING', 'COMPLETED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PayoutMethod" AS ENUM ('BANK_TRANSFER', 'INSTAPAY', 'VODAFONE_CASH', 'ETISALAT_CASH');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('SHIPMENT_CREATED', 'SHIPMENT_ASSIGNED', 'SHIPMENT_STATUS_UPDATE', 'CASH_COLLECTED', 'PAYOUT_PROCESSED', 'SYSTEM_ALERT');

-- CreateEnum
CREATE TYPE "KycStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "VehicleType" AS ENUM ('MOTORCYCLE', 'CAR', 'VAN', 'BICYCLE');

-- CreateEnum
CREATE TYPE "ReturnReason" AS ENUM ('CUSTOMER_NOT_AVAILABLE', 'CUSTOMER_REFUSED', 'WRONG_ADDRESS', 'PHONE_UNREACHABLE', 'PRODUCT_DAMAGED', 'PRODUCT_MISMATCH', 'COURIER_ACCESS_ISSUE', 'CUSTOMER_CANCELLED');

-- CreateEnum
CREATE TYPE "ZoneLevel" AS ENUM ('COUNTRY', 'GOVERNORATE', 'CITY', 'DISTRICT');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT NOT NULL,
    "passwordHash" TEXT,
    "role" "UserRole" NOT NULL,
    "name" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "emailVerified" TIMESTAMP(3),
    "phoneVerified" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Zone" (
    "id" TEXT NOT NULL,
    "parentId" TEXT,
    "level" "ZoneLevel" NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT,
    "code" TEXT NOT NULL,
    "polygon" JSONB,
    "centerLat" DOUBLE PRECISION,
    "centerLng" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Zone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Merchant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "businessType" TEXT NOT NULL,
    "websiteUrl" TEXT,
    "socialMediaUrl" TEXT,
    "kycStatus" "KycStatus" NOT NULL DEFAULT 'PENDING',
    "kycDocuments" JSONB,
    "commissionRate" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "feePerShipment" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "returnFee" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "cancellationFee" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "creditLimit" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "defaultPickupAddress" JSONB,
    "branding" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Merchant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Courier" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "employeeId" TEXT,
    "vehicleType" "VehicleType" NOT NULL DEFAULT 'MOTORCYCLE',
    "licensePlate" TEXT,
    "zoneCodes" TEXT[],
    "maxDailyCapacity" INTEGER NOT NULL DEFAULT 25,
    "currentPerformanceScore" INTEGER NOT NULL DEFAULT 50,
    "cashHeld" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "cashHeldLimit" DECIMAL(10,2) NOT NULL DEFAULT 5000,
    "documents" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "avgDeliveryTimeMinutes" INTEGER,
    "totalDelivered" INTEGER NOT NULL DEFAULT 0,
    "totalFailed" INTEGER NOT NULL DEFAULT 0,
    "totalReturned" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Courier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shipment" (
    "id" TEXT NOT NULL,
    "trackingNumber" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "status" "ShipmentStatus" NOT NULL DEFAULT 'PENDING',
    "type" "ShipmentType" NOT NULL DEFAULT 'COD',
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "customerPhone2" TEXT,
    "address" JSONB NOT NULL,
    "addressText" TEXT NOT NULL,
    "geoLocation" JSONB,
    "zoneId" TEXT,
    "codAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "productDescription" TEXT NOT NULL,
    "productValue" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "weight" DECIMAL(5,2) NOT NULL DEFAULT 1,
    "pieces" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "deliveryAttempts" INTEGER NOT NULL DEFAULT 0,
    "preferredDeliveryDate" TIMESTAMP(3),
    "assignedCourierId" TEXT,
    "returnReason" "ReturnReason",
    "returnNotes" TEXT,
    "collectedCash" DECIMAL(10,2),
    "customerOtp" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "returnedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "autoDispatchEligible" BOOLEAN NOT NULL DEFAULT true,
    "addressVerified" BOOLEAN NOT NULL DEFAULT false,
    "riskScore" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShipmentStatusLog" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "previousStatus" "ShipmentStatus",
    "newStatus" "ShipmentStatus" NOT NULL,
    "changedByUserId" TEXT,
    "changedByRole" "UserRole",
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShipmentStatusLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assignment" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "courierId" TEXT NOT NULL,
    "assignedByUserId" TEXT,
    "assignmentType" "AssignmentType" NOT NULL,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "balance" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "pendingBalance" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalCredited" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalDebited" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'EGP',
    "lastSettlementAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "shipmentId" TEXT,
    "type" "TransactionType" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "runningBalance" DECIMAL(10,2) NOT NULL,
    "description" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payout" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "method" "PayoutMethod" NOT NULL,
    "destination" JSONB NOT NULL,
    "approvedByUserId" TEXT,
    "processedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "referenceNumber" TEXT,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourierCashDeposit" (
    "id" TEXT NOT NULL,
    "courierId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "depositedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedByUserId" TEXT,
    "notes" TEXT,
    "receiptUrl" TEXT,

    CONSTRAINT "CourierCashDeposit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShipmentRisk" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "signals" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "actionTaken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShipmentRisk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlacklistedPhone" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "evidence" JSONB,
    "blockedBy" TEXT,
    "blockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "isPermanent" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "BlacklistedPhone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "shipmentId" TEXT,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "oldValue" JSONB,
    "newValue" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'ar',
    "templateId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "content" TEXT NOT NULL,
    "variables" JSONB NOT NULL,
    "category" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BulkJob" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PROCESSING',
    "fileUrl" TEXT NOT NULL,
    "resultUrl" TEXT,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "successRows" INTEGER NOT NULL DEFAULT 0,
    "failedRows" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "BulkJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE INDEX "User_role_isActive_idx" ON "User"("role", "isActive");

-- CreateIndex
CREATE INDEX "User_phone_idx" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Zone_code_key" ON "Zone"("code");

-- CreateIndex
CREATE INDEX "Zone_parentId_idx" ON "Zone"("parentId");

-- CreateIndex
CREATE INDEX "Zone_level_isActive_idx" ON "Zone"("level", "isActive");

-- CreateIndex
CREATE INDEX "Zone_code_idx" ON "Zone"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Merchant_userId_key" ON "Merchant"("userId");

-- CreateIndex
CREATE INDEX "Merchant_kycStatus_isActive_idx" ON "Merchant"("kycStatus", "isActive");

-- CreateIndex
CREATE INDEX "Merchant_businessName_idx" ON "Merchant"("businessName");

-- CreateIndex
CREATE UNIQUE INDEX "Courier_userId_key" ON "Courier"("userId");

-- CreateIndex
CREATE INDEX "Courier_isActive_isAvailable_idx" ON "Courier"("isActive", "isAvailable");

-- CreateIndex
CREATE INDEX "Courier_zoneCodes_idx" ON "Courier"("zoneCodes");

-- CreateIndex
CREATE INDEX "Courier_currentPerformanceScore_idx" ON "Courier"("currentPerformanceScore");

-- CreateIndex
CREATE UNIQUE INDEX "Shipment_trackingNumber_key" ON "Shipment"("trackingNumber");

-- CreateIndex
CREATE INDEX "Shipment_trackingNumber_idx" ON "Shipment"("trackingNumber");

-- CreateIndex
CREATE INDEX "Shipment_merchantId_status_idx" ON "Shipment"("merchantId", "status");

-- CreateIndex
CREATE INDEX "Shipment_assignedCourierId_status_idx" ON "Shipment"("assignedCourierId", "status");

-- CreateIndex
CREATE INDEX "Shipment_zoneId_status_preferredDeliveryDate_idx" ON "Shipment"("zoneId", "status", "preferredDeliveryDate");

-- CreateIndex
CREATE INDEX "Shipment_status_createdAt_idx" ON "Shipment"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Shipment_customerPhone_idx" ON "Shipment"("customerPhone");

-- CreateIndex
CREATE INDEX "Shipment_riskScore_idx" ON "Shipment"("riskScore");

-- CreateIndex
CREATE INDEX "ShipmentStatusLog_shipmentId_createdAt_idx" ON "ShipmentStatusLog"("shipmentId", "createdAt");

-- CreateIndex
CREATE INDEX "ShipmentStatusLog_newStatus_createdAt_idx" ON "ShipmentStatusLog"("newStatus", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Assignment_shipmentId_key" ON "Assignment"("shipmentId");

-- CreateIndex
CREATE INDEX "Assignment_courierId_status_idx" ON "Assignment"("courierId", "status");

-- CreateIndex
CREATE INDEX "Assignment_assignedAt_idx" ON "Assignment"("assignedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_merchantId_key" ON "Wallet"("merchantId");

-- CreateIndex
CREATE INDEX "Wallet_merchantId_idx" ON "Wallet"("merchantId");

-- CreateIndex
CREATE INDEX "Transaction_walletId_createdAt_idx" ON "Transaction"("walletId", "createdAt");

-- CreateIndex
CREATE INDEX "Transaction_shipmentId_idx" ON "Transaction"("shipmentId");

-- CreateIndex
CREATE INDEX "Transaction_type_createdAt_idx" ON "Transaction"("type", "createdAt");

-- CreateIndex
CREATE INDEX "Payout_merchantId_status_idx" ON "Payout"("merchantId", "status");

-- CreateIndex
CREATE INDEX "Payout_status_createdAt_idx" ON "Payout"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Payout_referenceNumber_idx" ON "Payout"("referenceNumber");

-- CreateIndex
CREATE INDEX "CourierCashDeposit_courierId_depositedAt_idx" ON "CourierCashDeposit"("courierId", "depositedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ShipmentRisk_shipmentId_key" ON "ShipmentRisk"("shipmentId");

-- CreateIndex
CREATE INDEX "ShipmentRisk_score_idx" ON "ShipmentRisk"("score");

-- CreateIndex
CREATE INDEX "ShipmentRisk_status_idx" ON "ShipmentRisk"("status");

-- CreateIndex
CREATE UNIQUE INDEX "BlacklistedPhone_phone_key" ON "BlacklistedPhone"("phone");

-- CreateIndex
CREATE INDEX "BlacklistedPhone_phone_idx" ON "BlacklistedPhone"("phone");

-- CreateIndex
CREATE INDEX "BlacklistedPhone_blockedAt_idx" ON "BlacklistedPhone"("blockedAt");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_createdAt_idx" ON "Notification"("userId", "isRead", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_createdAt_idx" ON "AuditLog"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppTemplate_name_key" ON "WhatsAppTemplate"("name");

-- CreateIndex
CREATE INDEX "WhatsAppTemplate_status_language_idx" ON "WhatsAppTemplate"("status", "language");

-- CreateIndex
CREATE INDEX "BulkJob_merchantId_status_idx" ON "BulkJob"("merchantId", "status");

-- CreateIndex
CREATE INDEX "BulkJob_createdAt_idx" ON "BulkJob"("createdAt");

-- AddForeignKey
ALTER TABLE "Zone" ADD CONSTRAINT "Zone_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Zone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Merchant" ADD CONSTRAINT "Merchant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Courier" ADD CONSTRAINT "Courier_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_assignedCourierId_fkey" FOREIGN KEY ("assignedCourierId") REFERENCES "Courier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentStatusLog" ADD CONSTRAINT "ShipmentStatusLog_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentStatusLog" ADD CONSTRAINT "ShipmentStatusLog_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_courierId_fkey" FOREIGN KEY ("courierId") REFERENCES "Courier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourierCashDeposit" ADD CONSTRAINT "CourierCashDeposit_courierId_fkey" FOREIGN KEY ("courierId") REFERENCES "Courier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentRisk" ADD CONSTRAINT "ShipmentRisk_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
