# Core Business Flows

## Overview

This document defines the step-by-step business processes for the Logistics & COD Shipment Management SaaS. Each flow includes actors, steps, data changes, and edge cases.

---

## 📦 1. Shipment Creation Flow

### Actors
- **Merchant:** Creates the shipment via portal or bulk upload
- **System:** Validates, geocodes, risk-scores, and dispatches

### Steps

1. **Merchant submits shipment data** via POST /shipments or bulk Excel upload
2. **Validation Service checks:**
   - Phone format (Egyptian: 01x xxxx xxxx)
   - Address completeness (landmark required if confidence low)
   - COD amount > 0 for COD type
   - Merchant credit limit
3. **Fraud Service calculates risk score:**
   - Check blacklisted phone
   - Check velocity (Redis counter)
   - Check COD amount threshold
   - Check address quality
4. **Geocoding Service resolves address:**
   - Tokenize Arabic address text
   - Match against Zone.nameAr using trigram similarity
   - Confidence > 0.7 = verified, < 0.7 = flag for manual review
5. **Database transaction:**
   - INSERT shipment (status: PENDING, trackingNumber generated)
   - INSERT shipment_status_log (null to PENDING)
   - INSERT shipment_risk (score, signals)
6. **Async jobs queued:**
   - Auto-dispatch attempt (if eligible)
   - WhatsApp confirmation to customer
   - Cache warm
7. **Response to merchant:** 201 Created with tracking number

### Data Changes

| Table | Operation | Record |
|-------|-----------|--------|
| Shipment | INSERT | New shipment with status PENDING |
| ShipmentStatusLog | INSERT | previousStatus: null, newStatus: PENDING |
| ShipmentRisk | INSERT | Calculated score and signals |

### Edge Cases

| Scenario | Handling |
|----------|----------|
| Duplicate phone/address | Warn merchant but allow. Could be legitimate re-order. Log warning. |
| Invalid phone format | Hard reject with specific error: Phone must be 11 digits starting with 01 |
| Address cannot be geocoded | Allow creation. Set addressVerified = false. Flag for manual zone assignment. |
| High risk score (>50) | Hold shipment. Notify merchant to verify customer. Alert admin. |
| Bulk upload partial failure | Process valid rows, return created shipments + errors with row numbers. Track in BulkJob. |
| Merchant at credit limit | Reject creation: Credit limit exceeded. Please settle outstanding balance. |

---

## 🚚 2. Assignment Flow

### Actors
- **Admin Dispatcher:** Manually assigns via dashboard
- **Smart Dispatch Algorithm:** Auto-assigns based on rules
- **Courier:** Receives and optionally accepts/rejects

### Steps - Manual Assignment

1. Admin selects shipment(s) and courier from dispatch board
2. System validates:
   - Shipments must be PENDING
   - Courier must be active and available
   - Courier active tasks < maxDailyCapacity
3. Database transaction:
   - INSERT assignment (type: MANUAL, status: ACTIVE)
   - UPDATE shipment (assignedCourierId, status remains PENDING)
4. Notifications queued:
   - Push notification to courier app
   - SMS backup to courier phone
5. Response to admin: 201 Created with assignments

### Steps - Auto-Assignment (Smart Dispatch)

1. BullMQ cron triggers at 6:00 AM (and every 2 hours)
2. Acquire distributed lock via Redis (prevents duplicate runs)
3. Query all PENDING shipments where preferredDeliveryDate <= today
4. Query available couriers (isActive, isAvailable, capacity remaining)
5. For each district:
   - Group shipments by district
   - Cluster by proximity (DBSCAN, 2km radius)
   - Score eligible couriers: successRate x 0.30 + loadBalance x 0.25 + proximity x 0.20 + speed x 0.15 + experience x 0.10
   - Distribute round-robin weighted by score
   - Reserve 10% capacity buffer
6. Database transaction per district:
   - INSERT assignments (type: AUTO_DISPATCH)
   - UPDATE shipments (assignedCourierId)
7. Bulk add notification jobs
8. Release distributed lock

### Data Changes

| Table | Operation | Record |
|-------|-----------|--------|
| Assignment | INSERT | New assignment linking shipment to courier |
| Shipment | UPDATE | assignedCourierId set (status stays PENDING until pickup) |

### Edge Cases

| Scenario | Handling |
|----------|----------|
| No courier in zone | Shipment remains unassigned. Alert admin after 12 hours. |
| All couriers at capacity | Queue for next dispatch run. Escalate to admin if >24h unassigned. |
| Courier rejects assignment | Mark assignment REJECTED. Add courier to zone blacklist for 4h. Return to pool. |
| Courier goes offline | Heartbeat timeout (>30min) marks isAvailable = false. Reassign active tasks. |
| Customer reschedules | Status to POSTPONED. Remove from today's dispatch pool. Add to tomorrow's pool. |
| Reassignment | Cancel old assignment (status=CANCELLED). Create new. Log reason. |

---

## 📲 3. Courier Status Update Flow

### Actors
- **Courier:** Updates status via PWA
- **System:** Validates transition, logs, triggers side effects

### Steps

1. Courier submits status update via PATCH /shipments/{id}/status
   - Payload: {status, otp (if DELIVERED), photo, gpsLocation, notes}
2. State Machine validates transition from current to new status
3. If DELIVERED and COD: Verify OTP against customerOtp (3 attempts max)
4. Database transaction:
   - UPDATE shipment (status, timestamps, collectedCash)
   - INSERT shipment_status_log (previous to new, metadata with evidence)
   - If DELIVERED: trigger delivery side effects
   - If FAILED: increment deliveryAttempts, set returnReason
5. If DELIVERED:
   - Wallet Service creates transactions (COD_CREDIT, COMMISSION_DEBIT, FEE_DEBIT)
   - Update wallet balance with optimistic locking
   - Update courier cashHeld
6. Cache invalidation: Delete shipment and tracking cache keys
7. Async jobs queued:
   - WhatsApp notification to merchant
   - Analytics update
   - Cash risk check

### State Transition Matrix

| From/To | PENDING | PICKED_UP | IN_WAREHOUSE | OUT_FOR_DELIVERY | DELIVERED | FAILED | POSTPONED | RETURNED | CANCELLED |
|---------|---------|-----------|--------------|------------------|-----------|--------|-----------|----------|-----------|
| PENDING | - | Yes | Yes | No | No | No | No | No | Yes |
| PICKED_UP | No | - | Yes | Yes | No | No | No | No | Yes |
| IN_WAREHOUSE | No | No | - | Yes | No | No | No | Yes | Yes |
| OUT_FOR_DELIVERY | No | No | No | - | Yes | Yes | Yes | Yes | No |
| FAILED | Yes* | No | No | Yes | No | - | Yes | Yes | No |
| POSTPONED | No | No | No | Yes | No | No | - | No | Yes |
| DELIVERED | No | No | No | No | - | No | No | No | No |
| RETURNED | No | No | No | No | No | No | No | - | No |
| CANCELLED | No | No | No | No | No | No | No | No | - |

* After failed delivery, shipment returns to PENDING for retry (if attempts < 3)

### Data Changes

| Status Change | Tables Updated | Notes |
|--------------|----------------|-------|
| PENDING to PICKED_UP | Shipment, ShipmentStatusLog | Courier collected from merchant |
| PICKED_UP to OUT_FOR_DELIVERY | Shipment, ShipmentStatusLog | Courier starts route |
| OUT_FOR_DELIVERY to DELIVERED | Shipment, ShipmentStatusLog, Transaction x3, Wallet, Courier | Financial side effects |
| OUT_FOR_DELIVERY to FAILED | Shipment, ShipmentStatusLog, Courier | deliveryAttempts incremented |
| FAILED to RETURNED (auto) | Shipment, ShipmentStatusLog | After 3 failed attempts |

### Edge Cases

| Scenario | Handling |
|----------|----------|
| Wrong OTP | Allow 3 attempts, then lock. Courier must call admin for override. |
| Partial COD payment | Courier records actual amount. System flags discrepancy. Admin reviews photo evidence. |
| Offline update | Queue in IndexedDB. Auto-sync when online. Show conflict resolution UI if needed. |
| Photo upload fails | Status accepted without photo, flagged for admin review. Courier can retry upload. |
| GPS unavailable | Status accepted. Log metadata.gpsLocation = null. No penalty. |
| Admin override | Admin with SHIPMENT_STATUS_OVERRIDE can revert any status. Creates reversal transactions and audit log. |
| Duplicate status update | Idempotency key prevents double-processing. Return 200 if already processed. |

---

## 💰 4. Delivery & COD Flow

### Actors
- **System:** Calculates fees, creates transactions, updates balances
- **Merchant:** Receives wallet credit
- **Courier:** Cash holding tracked

### Steps

1. Shipment Module calls Wallet Service: processCodCredit(shipment)
2. Calculate fees:
   - gross = shipment.collectedCash
   - commission = gross x merchant.commissionRate
   - fee = merchant.feePerShipment
   - net = gross - commission - fee
3. Database transaction with optimistic locking:
   - SELECT wallet FOR UPDATE (lock by version)
   - INSERT transaction: type COD_CREDIT, amount +gross
   - INSERT transaction: type COMMISSION_DEBIT, amount -commission
   - INSERT transaction: type FEE_DEBIT, amount -fee
   - UPDATE wallet: balance, pendingBalance, totals, version += 1
   - UPDATE courier: cashHeld += collectedCash
4. If optimistic lock conflict: Retry (max 3) with exponential backoff
5. Async jobs:
   - WhatsApp COD notification to merchant
   - Cash risk check alert

### Financial Example

**Scenario:** COD amount = EGP 500, Commission = 5%, Fee = EGP 15

| Step | Transaction Type | Amount | Running Balance |
|------|-----------------|--------|-----------------|
| 1 | COD_CREDIT | +500.00 | 500.00 |
| 2 | COMMISSION_DEBIT | -25.00 | 475.00 |
| 3 | FEE_DEBIT | -15.00 | 460.00 |

**Merchant receives:** EGP 460.00 net credit
**Platform earns:** EGP 40.00 (25 commission + 15 fee)

### Edge Cases

| Scenario | Handling |
|----------|----------|
| Collected cash < COD amount | Flag discrepancy. Courier must provide reason. Admin reviews. |
| Collected cash > COD amount | Flag discrepancy. Excess may be tip or error. Admin reviews. |
| Wallet update fails | Entire transaction rolls back. Shipment status remains OUT_FOR_DELIVERY. Retry job. |
| Concurrent deliveries for same merchant | Optimistic locking (version field) serializes updates. One succeeds, other retries. |

---

## 💸 5. Merchant Payout Flow

### Actors
- **Merchant:** Requests withdrawal
- **System:** Validates balance, creates payout record
- **Finance Admin:** Reviews and approves
- **Bank/InstaPay:** Processes transfer

### Steps

1. **Request:**
   - Merchant clicks Request Payout in portal
   - System validates: balance >= minimumPayoutThreshold (default EGP 500)
   - Creates Payout with status PENDING
   - Creates Transaction: type PAYOUT_DEBIT, amount -requestedAmount
   - Deducts amount from available balance immediately (prevents double-spending)

2. **Review (Finance Admin):**
   - Finance team reviews payout list daily
   - Checks for flagged shipments or disputes
   - Approves or rejects with reason

3. **Processing:**
   - If approved: Status to PROCESSING
   - Finance exports batch file for bank or transfers via InstaPay
   - Uploads reference number
   - Status to COMPLETED
   - Transaction finalized

4. **Notification:**
   - Merchant receives WhatsApp: Your payout of EGP X has been processed. Reference: Y
   - Email receipt with breakdown

### Status Flow

PENDING -> APPROVED -> PROCESSING -> COMPLETED
   |           |
   +-> REJECTED (restore balance)

### Data Changes

| Table | Operation | Record |
|-------|-----------|--------|
| Payout | INSERT | New payout request |
| Transaction | INSERT | PAYOUT_DEBIT (balance reduced) |
| Wallet | UPDATE | balance -= amount, version += 1 |
| Payout | UPDATE | Status transitions, reference number |
| Transaction | UPDATE | Finalized on completion |

### Edge Cases

| Scenario | Handling |
|----------|----------|
| Insufficient balance after request | If dispute reduces balance below payout amount before processing, auto-reject with reason. |
| Bank rejection | Mark as REJECTED, restore balance, notify merchant. |
| Payout request while COD in transit | Available balance only (excludes pendingBalance). Merchant cannot withdraw undelivered COD. |
| Partial payout approval | Not supported. Admin must reject and merchant re-requests correct amount. |

---

## 🔁 6. Return Handling Flow

### Actors
- **Courier:** Marks delivery failure
- **System:** Tracks attempts, auto-returns after threshold
- **Merchant:** Receives return notification and physical package

### Steps

1. **Initiation:**
   - Courier marks FAILED with structured reason
   - Or customer calls merchant to cancel before delivery
   - Or auto-trigger after 3 failed delivery attempts

2. **Status update:**
   - OUT_FOR_DELIVERY to RETURNED (or PENDING to CANCELLED if before pickup)
   - deliveryAttempts incremented (if failed)

3. **Financial impact:**
   - No wallet credit if never delivered
   - If return fee configured: Transaction type RETURN_FEE_DEBIT

4. **Courier action:**
   - Returns physical package to merchant warehouse
   - Courier app: Returned to warehouse confirmation with photo
   - Status: RETURNED to IN_WAREHOUSE (merchant pickup pending)

5. **Merchant notification:**
   - Order #TRK123 returned. Reason: Customer refused. Action: Review product description.
   - Analytics updated: return reason counters incremented

6. **Analytics:**
   - Adjust merchant success rate
   - Update zone-level return metrics
   - Generate insights (e.g., Product doesnt match description trending)

### Return Reasons

| Reason | When Used | Merchant Action |
|--------|-----------|-----------------|
| CUSTOMER_NOT_AVAILABLE | 3 attempts, never home | Verify address, suggest time slot |
| CUSTOMER_REFUSED | Changed mind or dissatisfied | Review product description |
| WRONG_ADDRESS | Incomplete or invalid address | Require landmark, verify with customer |
| PHONE_UNREACHABLE | 3 attempts, no answer | Verify phone, alternative contact |
| PRODUCT_DAMAGED | Packaging damaged in transit | Review packaging standards |
| PRODUCT_MISMATCH | Item not as described | Improve product descriptions |
| COURIER_ACCESS_ISSUE | Security, weather, road blocked | Reschedule or alternative route |
| CUSTOMER_CANCELLED | Cancelled before delivery | None |

### Auto-Return Logic

```
IF deliveryAttempts >= 3 AND status == FAILED:
  SET status = RETURNED
  SET returnedAt = NOW()
  CREATE status_log (FAILED -> RETURNED)
  NOTIFY merchant (auto-return triggered)
  CREATE transaction (RETURN_FEE_DEBIT if applicable)
```

### Edge Cases

| Scenario | Handling |
|----------|----------|
| Return lost in transit | Courier says returned, merchant claims not received. Audit via photos and signatures. |
| Exchange instead of return | Future feature: Create new shipment linked to return with exchange flag. |
| Return after delivery | Customer changes mind after accepting. Requires new return shipment creation (reverse logistics). |
| Damaged return | Package damaged during return. Courier photo evidence determines liability. |

---

## 📊 Flow Summary Table

| Flow | Primary Actor | Critical DB Tables | Async Jobs |
|------|--------------|-------------------|------------|
| Shipment Creation | Merchant | Shipment, ShipmentStatusLog, ShipmentRisk | Auto-dispatch, WhatsApp confirmation |
| Assignment | Admin/System | Assignment, Shipment | Courier push notification |
| Status Update | Courier | Shipment, ShipmentStatusLog, Wallet, Transaction | WhatsApp, Analytics, Cash risk |
| COD Delivery | System | Transaction, Wallet, Courier | Merchant notification, Cash alert |
| Payout | Merchant/Admin | Payout, Transaction, Wallet | Merchant notification |
| Return | Courier/System | Shipment, ShipmentStatusLog, Transaction | Merchant notification, Analytics |

---

**Next:** See API_SPEC.md for complete REST API documentation.
