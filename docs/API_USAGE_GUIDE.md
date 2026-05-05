# Trackora API Usage Guide

> For frontend teams integrating with the Trackora backend.
> Last updated: 2026-05-04

## Base URL

- **Development:** `http://localhost:3000`
- **Staging:** TBD
- **Production:** TBD

## Authentication

All endpoints (except public tracking) require a Bearer token:

```http
Authorization: Bearer <jwt_token>
```

### Obtaining Tokens

1. **Register** → `POST /auth/register`
2. **Login** → `POST /auth/login` → returns `accessToken` and `refreshToken`
3. **Refresh** → `POST /auth/refresh`

## API Modules

### 1. Authentication (`/auth`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Register new user |
| POST | `/auth/login` | Login with phone + password |
| POST | `/auth/refresh` | Refresh access token |
| POST | `/auth/logout` | Invalidate refresh token |

### 2. Shipments (`/shipments`)

| Method | Endpoint | Auth Role |
|--------|----------|-----------|
| POST | `/shipments` | MERCHANT |
| GET | `/shipments` | All |
| GET | `/shipments/:id` | All |
| GET | `/shipments/:id/timeline` | All |
| PATCH | `/shipments/:id/status` | COURIER, OPERATIONS_MANAGER |

### 3. Courier App (`/courier`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/courier/tasks` | List today's tasks |
| GET | `/courier/tasks/:shipmentId` | Single task detail |
| PATCH | `/courier/tasks/:shipmentId/status` | Update task status |
| POST | `/courier/deposits` | Log cash deposit |
| GET | `/courier/performance` | Performance metrics |
| POST | `/courier/sync` | Batch offline sync |

### 4. Merchant Dashboard (`/merchant`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/merchant/:id/dashboard` | Shipment counts, success rate, recent activity |
| GET | `/merchant/:id/analytics` | Trends, zone performance, COD collection |
| GET | `/merchant/:id/wallet` | Wallet balance |
| GET | `/merchant/:id/wallet/transactions` | Transaction history |

### 5. Admin (`/admin`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/dashboard` | Today's stats, courier status |
| GET | `/admin/financial-summary` | COD, settlements, cash holdings |
| POST | `/admin/reports/daily` | Daily operations report |
| POST | `/admin/reports/courier-performance` | Per-courier stats |
| POST | `/admin/reports/merchant-delivery` | Per-merchant delivery rates |
| GET | `/admin/audit-logs` | Filterable audit trail |

## Rate Limits

- **Default:** 100 requests / minute
- **Auth endpoints:** 10 requests / minute
- **Public endpoints:** 30 requests / minute

## Pagination

List endpoints support `page` and `limit` query parameters:

```http
GET /shipments?page=1&limit=20
```

## Response Format

Success:
```json
{
  "data": [...],
  "total": 100,
  "page": 1,
  "limit": 20
}
```

Error:
```json
{
  "statusCode": 400,
  "message": "Error description"
}
```

## WebSocket / Events

Events are emitted internally via EventEmitter2:
- `shipment.delivered` → triggers COD wallet credit
- `assignment.completed` → cleanup logic

## Support

For API issues, contact the backend team or check Swagger docs at `/api/docs`.
