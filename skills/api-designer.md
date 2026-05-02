# Skill: API Designer

## Description
Expert in designing RESTful APIs, GraphQL schemas, OpenAPI specifications, and integration patterns for logistics and fintech platforms.

## When to Use
- Designing new API endpoints
- Creating OpenAPI/Swagger documentation
- Reviewing API contracts
- Designing webhook schemas
- Planning third-party integrations

## RESTful Design Principles

### Resource Naming
```
GET    /shipments           # List shipments
GET    /shipments/:id       # Get single shipment
POST   /shipments           # Create shipment
PATCH  /shipments/:id       # Update shipment (partial)
PUT    /shipments/:id       # Replace shipment (full)
DELETE /shipments/:id       # Delete shipment
```

### Nested Resources
```
GET    /shipments/:id/timeline           # Shipment status history
GET    /shipments/:id/assignment         # Current assignment
POST   /shipments/:id/assign             # Assign to courier
GET    /merchants/:id/wallet             # Merchant wallet
GET    /merchants/:id/wallet/transactions # Wallet transactions
```

### Action Endpoints
```
POST   /shipments/:id/cancel             # Cancel shipment
POST   /shipments/:id/duplicate          # Duplicate shipment
POST   /couriers/:id/deposits            # Record cash deposit
```

## Response Standards

### Success Response
```json
{
  "success": true,
  "data": { },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

### Error Response
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

## Pagination Patterns

### Offset Pagination (for small datasets)
```typescript
GET /merchants?page=3&limit=20

// Response
{
  "meta": {
    "page": 3,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

### Cursor Pagination (for large datasets)
```typescript
GET /shipments?cursor=eyJpZCI6InV1aWQtMTIzIn0=&limit=20

// Response
{
  "meta": {
    "limit": 20,
    "nextCursor": "eyJpZCI6InV1aWQtNDU2In0=",
    "hasNextPage": true
  }
}
```

## Filtering Patterns

### Basic Filters
```
GET /shipments?status=PENDING,OUT_FOR_DELIVERY
GET /shipments?merchantId=uuid&status=DELIVERED
GET /shipments?from=2024-05-01&to=2024-05-31
```

### Range Filters
```
GET /shipments?codMin=100&codMax=5000
GET /shipments?weightMin=0.5&weightMax=10
```

### Search
```
GET /shipments?search=Ahmed+Maadi
GET /shipments?trackingNumber=TRK-240502-A1B2
```

### Sorting
```
GET /shipments?sortBy=createdAt&sortOrder=desc
GET /shipments?sortBy=codAmount&sortOrder=asc
```

## DTO Design

### Create Shipment DTO
```typescript
export class CreateShipmentDto {
  @IsString()
  @IsNotEmpty()
  customerName: string;

  @IsString()
  @Matches(/^01[0-2,5]{1}[0-9]{8}$/, {
    message: 'Phone must be 11 digits starting with 01'
  })
  customerPhone: string;

  @IsString()
  @IsOptional()
  customerPhone2?: string;

  @ValidateNested()
  @Type(() => AddressDto)
  address: AddressDto;

  @IsEnum(ShipmentType)
  type: ShipmentType = ShipmentType.COD;

  @IsDecimal({ decimal_digits: '2' })
  @Min(0)
  @ValidateIf(o => o.type === ShipmentType.COD)
  codAmount: string;

  @IsString()
  @IsNotEmpty()
  productDescription: string;

  @IsDateString()
  @IsOptional()
  preferredDeliveryDate?: string;
}
```

## Webhook Design

### Outbound Webhooks (to merchant systems)
```typescript
interface ShipmentWebhookPayload {
  event: 'shipment.created' | 'shipment.delivered' | 'shipment.returned';
  timestamp: string;
  data: {
    trackingNumber: string;
    status: ShipmentStatus;
    // ... shipment fields
  };
}

// Delivery with signature verification
async sendWebhook(
  url: string, 
  payload: ShipmentWebhookPayload,
  secret: string
): Promise<void> {
  const body = JSON.stringify(payload);
  const signature = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');
  
  await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Webhook-Signature': signature,
    },
    body,
  });
}
```

### Inbound Webhooks (from providers)
```typescript
@Post('webhooks/twilio/whatsapp')
async handleTwilioWebhook(
  @Headers('X-Twilio-Signature') signature: string,
  @Body() payload: TwilioWebhookPayload
) {
  // Validate signature
  const isValid = this.twilioService.validateRequest(
    signature,
    process.env.TWILIO_AUTH_TOKEN,
    webhookUrl,
    payload
  );
  
  if (!isValid) {
    throw new UnauthorizedException('Invalid signature');
  }
  
  // Process webhook
}
```

## Versioning Strategy

### URL Versioning (Recommended)
```
/api/v1/shipments
/api/v2/shipments
```

### Header Versioning (Alternative)
```
GET /shipments
Accept: application/vnd.trackora.v1+json
```

## Rate Limiting Headers
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1714647300
Retry-After: 60
```

## OpenAPI/Swagger Documentation

```typescript
@ApiTags('Shipments')
@Controller('shipments')
export class ShipmentController {
  
  @Post()
  @ApiOperation({ summary: 'Create a new shipment' })
  @ApiResponse({ status: 201, description: 'Shipment created', type: ShipmentResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 409, description: 'Credit limit exceeded' })
  async create(@Body() dto: CreateShipmentDto): Promise<ShipmentResponseDto> {
    return this.shipmentService.create(dto);
  }
}
```

## Common API Mistakes to Avoid

1. **Inconsistent naming** — Use kebab-case for URLs, camelCase for JSON
2. **Missing pagination** — All list endpoints must support pagination
3. **Wrong HTTP methods** — Use POST for creates, PATCH for partial updates
4. **Leaking internals** — Never expose database IDs if sensitive
5. **No idempotency** — Financial endpoints need idempotency keys
6. **Poor error messages** — Include field-level errors, not just generic messages
7. **Missing caching headers** — Use ETag and Cache-Control for cacheable resources

## Example Usage
User: "Design an API endpoint for bulk shipment updates"
→ Use this skill to design the endpoint, request/response format, validation rules, and error handling.
