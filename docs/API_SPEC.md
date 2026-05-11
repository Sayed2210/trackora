# API Specification

## Overview

RESTful API design for the Logistics & COD Shipment Management SaaS. Runtime routes are versioned under `/v1`; deployments may expose that under an `/api` gateway prefix.

## Base URL

```
Production:  https://api.trackora.com/v1
Staging:     https://api-staging.trackora.com/v1
```

## Authentication

All endpoints (except public tracking) require Bearer token authentication.

```
Authorization: Bearer <jwt_access_token>
```

### Token Structure

```json
{
  "sub": "user-uuid",
  "role": "MERCHANT",
  "permissions": ["shipments:create", "shipments:read:own"],
  "iat": 1714646400,
  "exp": 1714647300
}
```

### Response Format

The current API returns raw resource payloads for most endpoints. Paginated list endpoints return a list payload with pagination metadata, usually `{ "data": [...], "meta": { ... } }`. Older clients may still tolerate the legacy `{ "success": true, "data": ... }` envelope during migration.

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

### Error Format

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [
      { "field": "customerPhone", "message": "Phone must be 11 digits" }
    ]
  }
}
```

### Standard HTTP Status Codes

| Code | Meaning | Usage |
|------|---------|-------|
| 200 | OK | Successful GET, PATCH |
| 201 | Created | Successful POST |
| 204 | No Content | Successful DELETE |
| 400 | Bad Request | Validation errors |
| 401 | Unauthorized | Missing or invalid token |
| 403 | Forbidden | Valid token, insufficient permissions |
| 404 | Not Found | Resource does not exist |
| 409 | Conflict | Business rule violation (e.g., invalid state transition) |
| 422 | Unprocessable | Semantic errors (e.g., OTP incorrect) |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Error | Server error |

---

## Authentication Endpoints

### POST /auth/login

Login with phone/password or request OTP.

**Request:**
```json
{
  "phone": "201000000000",
  "password": "string",
  "method": "PASSWORD" // or "OTP"
}
```

**Response:**
```json
{
  "accessToken": "eyJhbG...",
  "refreshToken": "eyJhbG...",
  "expiresIn": 900,
  "user": {
    "id": "uuid",
    "name": "Ahmed",
    "role": "MERCHANT",
    "roles": ["MERCHANT"],
    "permissions": [],
    "merchantId": "merchant-uuid",
    "courierId": null,
    "phoneVerified": true
  }
}
```

### POST /auth/otp/request

Request OTP for phone verification or login.

**Request:**
```json
{
  "phone": "201000000000",
  "purpose": "LOGIN" // or "VERIFY_PHONE", "RESET_PASSWORD"
}
```

### POST /auth/otp/verify

Verify OTP and complete authentication.

**Request:**
```json
{
  "phone": "201000000000",
  "otp": "123456",
  "purpose": "LOGIN"
}
```

### POST /auth/refresh

Refresh access token using refresh token.

**Request:**
```json
{
  "refreshToken": "eyJhbG..."
}
```

### POST /auth/logout

Invalidate refresh token.

---

## Shipment Endpoints

### GET /shipments

List shipments with filtering and pagination.

**Query Parameters:**

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| status | string[] | Filter by status (comma-separated) | `PENDING,OUT_FOR_DELIVERY` |
| merchantId | string | Filter by merchant (admin only) | `uuid` |
| courierId | string | Filter by courier (admin only) | `uuid` |
| zoneId | string | Filter by zone | `uuid` |
| from | date | Start date (createdAt) | `2024-05-01` |
| to | date | End date (createdAt) | `2024-05-31` |
| trackingNumber | string | Exact match | `TRK-240502-A1B2` |
| search | string | Fuzzy search (name, phone, address) | `Ahmed` |
| codMin | number | Minimum COD amount | `100` |
| codMax | number | Maximum COD amount | `5000` |
| page | number | Page number (default: 1) | `1` |
| limit | number | Items per page (default: 20, max: 100) | `20` |
| sortBy | string | Sort field (default: createdAt) | `createdAt` |
| sortOrder | string | asc or desc (default: desc) | `desc` |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "trackingNumber": "TRK-240502-A1B2",
      "status": "OUT_FOR_DELIVERY",
      "type": "COD",
      "customerName": "Mohamed Ali",
      "customerPhone": "201000000001",
      "addressText": "Maadi, Cairo",
      "codAmount": 450.00,
      "productDescription": "Wireless headphones",
      "deliveryAttempts": 0,
      "assignedCourier": {
        "id": "uuid",
        "name": "Khaled",
        "phone": "201000000002"
      },
      "createdAt": "2024-05-02T08:00:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

### GET /shipments/:id

Get single shipment details.

### GET /shipments/:id/timeline

Get status history for a shipment.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "previousStatus": null,
      "newStatus": "PENDING",
      "changedBy": { "name": "Ahmed (Merchant)", "role": "MERCHANT" },
      "reason": null,
      "metadata": null,
      "createdAt": "2024-05-02T08:00:00Z"
    },
    {
      "id": "uuid",
      "previousStatus": "PENDING",
      "newStatus": "OUT_FOR_DELIVERY",
      "changedBy": { "name": "Khaled (Courier)", "role": "COURIER" },
      "reason": null,
      "metadata": { "gpsLocation": { "lat": 29.96, "lng": 31.25 } },
      "createdAt": "2024-05-02T10:30:00Z"
    }
  ]
}
```

### POST /shipments

Create a new shipment.

**Request:**
```json
{
  "customerName": "Mohamed Ali",
  "customerPhone": "01000000001",
  "customerPhone2": "01100000002",
  "address": {
    "governorate": "Cairo",
    "city": "Maadi",
    "district": "Degla",
    "street": "Street 9",
    "building": "15",
    "floor": "3",
    "apartment": "12",
    "landmark": "Near CIB Bank"
  },
  "addressText": "Maadi Degla, Street 9, Building 15, Floor 3, Apt 12, Near CIB Bank",
  "type": "COD",
  "codAmount": 450.00,
  "productDescription": "Wireless headphones - Black",
  "productValue": 500.00,
  "weight": 0.5,
  "pieces": 1,
  "notes": "Call before delivery",
  "preferredDeliveryDate": "2024-05-03"
}
```

**Response:** 201 Created

### POST /shipments/bulk-upload

Bulk upload shipments via Excel/CSV.

**Request:** Multipart form-data with file

**Response:**
```json
{
  "success": true,
  "data": {
    "jobId": "uuid",
    "status": "PROCESSING",
    "message": "Your file is being processed. You will be notified when complete."
  }
}
```

### PATCH /shipments/:id/status

Update shipment status (courier and admin).

**Request:**
```json
{
  "status": "DELIVERED",
  "otp": "1234",
  "collectedCash": 450.00,
  "notes": "Customer was happy",
  "gpsLocation": { "lat": 29.96, "lng": 31.25 }
}
```

Manual assignment is handled by `POST /assignments`.

---

## Assignment Endpoints

### GET /assignments

List assignments with filters.

**Query Parameters:**
- courierId, shipmentId, status, assignmentType, from, to, page, limit

### POST /assignments

Create manual assignment.

**Request:**
```json
{
  "shipmentIds": ["uuid1", "uuid2"],
  "courierId": "uuid",
  "reason": "Manual dispatch from board"
}
```

### PATCH /assignments/:id/reassign

Reassign to different courier.

**Request:**
```json
{
  "newCourierId": "uuid",
  "reason": "Original courier overloaded"
}
```

### PATCH /assignments/:id/cancel

Cancel assignment.

**Request:**
```json
{
  "reason": "Customer postponed delivery"
}
```

---

## Wallet Endpoints

### GET /wallets

List wallets (admin: all, merchant: own).

### GET /wallets/:id

Get wallet details.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "merchantId": "uuid",
    "balance": 2340.50,
    "pendingBalance": 1200.00,
    "totalCredited": 15000.00,
    "totalDebited": 12659.50,
    "currency": "EGP",
    "lastSettlementAt": "2024-05-01T00:00:00Z"
  }
}
```

### GET /wallets/:id/transactions

Get transaction history.

**Query Parameters:**
- type, from, to, page, limit

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "type": "COD_CREDIT",
      "amount": 500.00,
      "runningBalance": 2340.50,
      "description": "COD for TRK-240502-A1B2",
      "shipmentId": "uuid",
      "createdAt": "2024-05-02T14:00:00Z"
    },
    {
      "id": "uuid",
      "type": "COMMISSION_DEBIT",
      "amount": -25.00,
      "runningBalance": 1840.50,
      "description": "5% commission on COD",
      "shipmentId": "uuid",
      "createdAt": "2024-05-02T14:00:00Z"
    }
  ]
}
```

### POST /wallets/:id/adjust

Admin adjustment with reason.

**Request:**
```json
{
  "amount": 50.00,
  "type": "ADJUSTMENT_CREDIT",
  "reason": "Correction for overcharged fee on TRK-xxx"
}
```

---

## Payout Endpoints

### GET /payouts

List payouts with filters.

**Query Parameters:**
- merchantId, status, method, from, to, page, limit

### POST /payouts

Request payout (merchant only).

**Request:**
```json
{
  "amount": 1000.00,
  "method": "INSTAPAY",
  "destination": {
    "accountName": "Ahmed Mohamed",
    "accountNumber": "1234567890",
    "bankName": "CIB"
  }
}
```

**Validation:**
- amount >= minimumPayoutThreshold (EGP 500)
- amount <= available balance
- No pending payouts for this merchant

### PATCH /payouts/:id/approve

Approve payout (finance admin).

### PATCH /payouts/:id/complete

Mark payout as completed with reference.

**Request:**
```json
{
  "referenceNumber": "REF-2024-001"
}
```

### PATCH /payouts/:id/reject

Reject payout.

**Request:**
```json
{
  "reason": "Invalid bank account details"
}
```

---

## Tracking Endpoints (Public, No Auth)

### GET /tracking/:trackingNumber

Get public tracking information.

**Response:**
```json
{
  "success": true,
  "data": {
    "trackingNumber": "TRK-240502-A1B2",
    "status": "OUT_FOR_DELIVERY",
    "merchantName": "TechStore Egypt",
    "estimatedDelivery": "2024-05-03",
    "customerName": "Mohamed Ali",
    "customerPhoneMasked": "0100*****01",
    "timeline": [
      {
        "status": "PENDING",
        "description": "Order received",
        "timestamp": "2024-05-02T08:00:00Z",
        "completed": true
      },
      {
        "status": "OUT_FOR_DELIVERY",
        "description": "Out for delivery today",
        "timestamp": "2024-05-02T10:30:00Z",
        "completed": true
      },
      {
        "status": "DELIVERED",
        "description": "Delivered to customer",
        "timestamp": null,
        "completed": false
      }
    ]
  }
}
```

### GET /tracking/:trackingNumber/timeline

Get detailed timeline (same as above, timeline-focused).

---

## Courier App Endpoints

### GET /courier/tasks

Get today's tasks for logged-in courier.

**Response:**
```json
[
  {
    "shipmentId": "uuid",
    "trackingNumber": "TRK-240502-A1B2",
    "customerName": "Mohamed Ali",
    "customerPhoneMasked": "0100*****01",
    "addressText": "Maadi, Cairo",
    "codAmount": 450.00,
    "status": "OUT_FOR_DELIVERY",
    "orderInRoute": 1,
    "mapUrl": "https://maps.google.com/?q=29.96,31.25"
  }
]
```

### PATCH /courier/tasks/:id/status

Update task status.

**Request:**
```json
{
  "status": "DELIVERED",
  "otp": "1234",
  "collectedCash": 450.00,
  "photoUrl": "https://storage.example/proof.jpg",
  "signatureUrl": "https://storage.example/signature.png",
  "gpsLocation": { "lat": 29.96, "lng": 31.25 },
  "notes": "Left with neighbor"
}
```

### POST /courier/deposits

Log cash deposit to admin.

**Request:**
```json
{
  "amount": 1500.00,
  "depositedTo": "admin-user-uuid",
  "notes": "Daily collection"
}
```

### GET /courier/performance

Get courier performance metrics.

**Response:**
```json
{
  "score": 87,
  "totalDelivered": 245,
  "totalFailed": 12,
  "successRate": 95.3,
  "avgDeliveryTimeMinutes": 28,
  "cashHeld": 3200.00,
  "rank": 3,
  "weeklyTrend": [85, 86, 87, 88, 87]
}
```

### POST /courier/sync

Batch sync offline updates.

**Request:**
```json
{
  "updates": [
    {
      "id": "offline-uuid-1",
      "shipmentId": "uuid",
      "action": "STATUS_UPDATE",
      "payload": { "status": "DELIVERED", "collectedCash": 450 },
      "timestamp": "2024-05-02T14:00:00Z"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "processed": 5,
    "failed": 0,
    "conflicts": [
      {
        "updateId": "offline-uuid-2",
        "shipmentId": "uuid",
        "serverStatus": "DELIVERED",
        "localStatus": "FAILED",
        "resolution": "REJECTED_LOCAL"
      }
    ]
  }
}
```

---

## Admin Endpoints

### GET /admin/dashboard

Get operations dashboard metrics.

**Response:**
```json
{
  "success": true,
  "data": {
    "today": {
      "shipmentsCreated": 450,
      "delivered": 320,
      "failed": 25,
      "codCollected": 145000.00,
      "pendingAssignments": 45
    },
    "courierStatus": {
      "online": 35,
      "offline": 5,
      "onDelivery": 28
    },
    "alerts": [
      {
        "type": "CASH_RISK",
        "severity": "HIGH",
        "message": "Courier Khaled has held EGP 6,200 for 4 days",
        "courierId": "uuid"
      }
    ]
  }
}
```

### GET /admin/reports/daily

Generate daily operations report.

**Query Parameters:**
- date (default: yesterday)

**Response:** Report download URL or inline data.

### GET /admin/audit-logs

Query audit logs.

**Query Parameters:**
- userId, action, entityType, entityId, from, to, page, limit

### GET /couriers

List couriers for admin dispatch and courier management.

**Query Parameters:**
- search, isActive, isAvailable, zoneCode, page, limit

### PATCH /couriers/:id/availability

Set courier availability explicitly.

**Request:**
```json
{
  "isAvailable": true
}
```

---

## Merchant Portal Endpoints

### GET /merchant/:id/dashboard

Get merchant dashboard data.

**Response:**
```json
{
  "shipments": {
    "total": 120,
    "pending": 15,
    "inTransit": 45,
    "delivered": 55,
    "returned": 5
  },
  "deliveryRate": 91.7,
  "avgCodAmount": 320.50,
  "wallet": {
    "balance": 2340.50,
    "pending": 1200.00
  },
  "recentActivity": [
    { "type": "DELIVERED", "trackingNumber": "TRK-xxx", "amount": 450, "time": "2 hours ago" }
  ]
}
```

### GET /merchant/:id/analytics

Get delivery analytics.

**Query Parameters:**
- days

**Response:**
```json
{
  "successRate": { "current": 92.5, "previous": 89.0, "trend": "up" },
  "returnReasons": [
    { "reason": "CUSTOMER_NOT_AVAILABLE", "count": 12, "percentage": 40 },
    { "reason": "CUSTOMER_REFUSED", "count": 8, "percentage": 27 }
  ],
  "zonePerformance": [
    { "zone": "Maadi", "delivered": 45, "failed": 3, "rate": 93.8 },
    { "zone": "Nasr City", "delivered": 32, "failed": 8, "rate": 80.0 }
  ],
  "codTrend": [
    { "date": "2024-04-26", "collected": 3200 },
    { "date": "2024-04-27", "collected": 4100 }
  ]
}
```

---

## Webhook Endpoints

### POST /webhooks/twilio/whatsapp

Incoming WhatsApp message webhook from Twilio.

**Security:** Validates Twilio signature.

**Processing:**
1. Parse From, Body, MessageSid
2. Detect intent (track, postpone, stop, unknown)
3. Query appropriate data
4. Send response message

### POST /webhooks/twilio/sms-status

SMS delivery status callback.

**Processing:**
1. Log delivery status
2. If failed, retry or escalate

---

## Rate Limiting

| Endpoint Group | Limit | Window |
|----------------|-------|--------|
| Auth (login, otp) | 5 requests | 1 minute |
| General API | 100 requests | 1 minute |
| Courier sync | 30 requests | 1 minute |
| Public tracking | 20 requests | 1 minute |
| Bulk operations | 5 requests | 5 minutes |

**Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1714647300
```

---

## Pagination Strategy

### Offset Pagination (for low-volume lists)

Used for: Merchants, Couriers, Payouts, Wallets

```
GET /merchants?page=3&limit=20
```

### Cursor Pagination (for high-volume lists)

Used for: Shipments, Transactions, Status Logs

```
GET /shipments?cursor=eyJpZCI6InV1aWQtMTIzIn0=&limit=20
```

**Response includes:**
```json
{
  "meta": {
    "limit": 20,
    "nextCursor": "eyJpZCI6InV1aWQtNDU2In0=",
    "hasNextPage": true
  }
}
```

---

**Next:** See DISPATCH_ALGORITHM.md for the smart dispatch deep-dive.
