# Courier Sync Protocol

> For the Courier PWA frontend team.
> Last updated: 2026-05-04

## Overview

The Courier PWA must work offline. This document defines the sync protocol between the PWA and the Trackora backend.

## Endpoints

### 1. Fetch Tasks (Online Only)

```http
GET /courier/tasks
Authorization: Bearer <token>
```

**Response:** Array of tasks with masked phone numbers.

### 2. Sync Offline Updates

```http
POST /courier/sync
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "updates": [
    {
      "id": "uuid-generated-locally",
      "shipmentId": "ship-uuid",
      "action": "STATUS_UPDATE",
      "payload": {
        "status": "DELIVERED",
        "collectedCash": 500,
        "otp": "1234",
        "notes": "Customer happy",
        "gpsLocation": { "lat": 30.0444, "lng": 31.2357 }
      },
      "timestamp": "2026-05-04T10:00:00Z"
    }
  ]
}
```

**Idempotency:** Each update must have a unique `id` generated locally. The backend deduplicates by this ID.

**Response:**
```json
{
  "processed": 1,
  "failed": 0,
  "conflicts": [
    {
      "updateId": "uuid",
      "shipmentId": "ship-uuid",
      "serverStatus": "DELIVERED",
      "localStatus": "OUT_FOR_DELIVERY",
      "resolution": "REJECTED_LOCAL"
    }
  ]
}
```

### 3. Conflict Resolution

If the server status is already ahead of the local update:
- The local update is **rejected**
- The PWA should update its local state to match the server status
- The conflict is returned in the `conflicts` array

## Offline Strategy

1. **Queue updates** in IndexedDB while offline
2. **Retry sync** when connectivity returns
3. **Show pending count** to the courier
4. **Block logout** if unsynced updates exist

## Status Update Rules

| Current Status | Allowed Update |
|----------------|----------------|
| PICKED_UP | OUT_FOR_DELIVERY |
| OUT_FOR_DELIVERY | DELIVERED, FAILED, POSTPONED |
| POSTPONED | OUT_FOR_DELIVERY |

## COD Delivery Requirements

- `collectedCash` must be provided
- `otp` must match the 4-digit code sent to customer
- Max 3 OTP attempts (locked after that)

## Photo & Signature

- Upload photos/signatures to storage when online.
- Include returned URLs in payload as `photoUrl` / `signatureUrl`.
- Keep local blobs queued offline until upload succeeds.

## Cash Deposit

```http
POST /courier/deposits
Authorization: Bearer <token>
```

**Body:**
```json
{
  "amount": 1500,
  "depositedTo": "admin-user-uuid",
  "notes": "Daily deposit",
  "receiptPhoto": "base64..."
}
```

## Error Handling

- **Network errors:** Queue and retry
- **409 Conflict:** Update local state from server
- **400 Bad Request:** Show validation error
- **401 Unauthorized:** Redirect to login

## Performance Budget

- Sync response should complete in < 3 seconds for up to 50 updates
- Task list should load in < 1 second
