# Skill: Testing Engineer

## Description
Expert in designing and implementing test strategies for NestJS applications, including unit tests, integration tests, and E2E tests for logistics and financial systems.

## When to Use
- Writing unit tests for services
- Setting up integration test infrastructure
- Creating test data factories
- Mocking external services
- Designing E2E test scenarios

## Testing Pyramid for Trackora

```
    /\
   /  \  E2E Tests (5%) - Critical user journeys
  /----\
 /      \ Integration Tests (25%) - API endpoints, DB operations
/--------\
          Unit Tests (70%) - Business logic, calculations
```

## Unit Testing Patterns

### Service Unit Test
```typescript
describe('ShipmentService', () => {
  let service: ShipmentService;
  let prisma: DeepMockProxy<PrismaClient>;
  let eventEmitter: MockProxy<EventEmitter2>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShipmentService,
        { provide: PrismaService, useValue: mockDeep<PrismaClient>() },
        { provide: EventEmitter2, useValue: mock<EventEmitter2>() },
      ],
    }).compile();

    service = module.get(ShipmentService);
    prisma = module.get(PrismaService);
    eventEmitter = module.get(EventEmitter2);
  });

  describe('create', () => {
    it('should create shipment with tracking number', async () => {
      const dto: CreateShipmentDto = {
        customerName: 'Mohamed Ali',
        customerPhone: '01000000001',
        address: mockAddress,
        type: ShipmentType.COD,
        codAmount: '450.00',
        productDescription: 'Headphones',
      };

      prisma.shipment.create.mockResolvedValue(mockShipment);

      const result = await service.create(dto, 'merchant-id');

      expect(result.trackingNumber).toMatch(/^TRK-\d{6}-[A-Z0-9]{4}$/);
      expect(prisma.shipment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: ShipmentStatus.PENDING,
            merchantId: 'merchant-id',
          }),
        })
      );
    });

    it('should reject invalid phone format', async () => {
      const dto = { ...mockCreateDto, customerPhone: 'invalid' };

      await expect(service.create(dto, 'merchant-id'))
        .rejects
        .toThrow(BadRequestException);
    });
  });
});
```

### Financial Logic Test
```typescript
describe('FeeCalculator', () => {
  const calculator = new FeeCalculator();

  it('should calculate net credit correctly', () => {
    const result = calculator.calculateNetCredit(
      new Decimal('500'),
      { commissionRate: new Decimal('0.05'), feePerShipment: new Decimal('15') }
    );

    expect(result.gross).toEqual(new Decimal('500'));
    expect(result.commission).toEqual(new Decimal('25'));
    expect(result.fee).toEqual(new Decimal('15'));
    expect(result.net).toEqual(new Decimal('460'));
  });

  it('should apply tiered commission', () => {
    const result = calculator.calculateNetCredit(
      new Decimal('1500'),
      {
        commissionRate: new Decimal('0.05'),
        feePerShipment: new Decimal('15'),
        codAmountTiers: [
          { maxAmount: new Decimal('500'), commissionRate: new Decimal('0.05') },
          { maxAmount: new Decimal('1000'), commissionRate: new Decimal('0.04') },
          { maxAmount: new Decimal('999999'), commissionRate: new Decimal('0.035') },
        ]
      }
    );

    expect(result.commissionRate).toEqual(new Decimal('0.035'));
    expect(result.commission).toEqual(new Decimal('52.50'));
  });
});
```

## Integration Testing

### API Integration Test
```typescript
describe('ShipmentsController (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    prisma = moduleRef.get(PrismaService);
    await app.init();
  });

  beforeEach(async () => {
    await prisma.shipment.deleteMany();
    await prisma.merchant.deleteMany();
  });

  describe('POST /shipments', () => {
    it('should create shipment and return 201', async () => {
      const merchant = await prisma.merchant.create({
        data: { /* ... */ }
      });

      const token = generateTestToken(merchant.userId, UserRole.MERCHANT);

      const response = await request(app.getHttpServer())
        .post('/api/v1/shipments')
        .set('Authorization', `Bearer ${token}`)
        .send({
          customerName: 'Test Customer',
          customerPhone: '01000000001',
          address: {
            governorate: 'Cairo',
            city: 'Maadi',
            district: 'Degla',
            street: 'Street 9',
            landmark: 'Near CIB',
          },
          type: 'COD',
          codAmount: '450.00',
          productDescription: 'Test Product',
        })
        .expect(201);

      expect(response.body.data.trackingNumber).toBeDefined();
      expect(response.body.data.status).toBe('PENDING');

      // Verify database state
      const shipment = await prisma.shipment.findUnique({
        where: { id: response.body.data.id },
      });
      expect(shipment).toBeTruthy();
    });
  });

  afterAll(async () => {
    await app.close();
  });
});
```

### Database Transaction Test
```typescript
describe('WalletService - Transactions', () => {
  it('should rollback on error', async () => {
    // Setup: Create merchant with wallet
    const merchant = await merchantFactory.create();
    
    // Attempt transaction that will fail
    await expect(
      walletService.createTransactions([
        { type: 'COD_CREDIT', amount: new Decimal('500') },
        { type: 'INVALID_TYPE', amount: new Decimal('-25') }, // This will fail
      ])
    ).rejects.toThrow();

    // Verify no partial changes
    const wallet = await prisma.wallet.findUnique({
      where: { merchantId: merchant.id }
    });
    expect(wallet.balance).toEqual(new Decimal('0'));
    
    const transactions = await prisma.transaction.findMany({
      where: { walletId: wallet.id }
    });
    expect(transactions).toHaveLength(0);
  });
});
```

## E2E Testing

### Critical User Journeys
```typescript
describe('E2E - Complete Delivery Flow', () => {
  it('should create, assign, deliver, and credit wallet', async () => {
    // 1. Merchant creates shipment
    const shipment = await merchantClient.createShipment({
      customerName: 'Test Customer',
      customerPhone: '01000000001',
      // ...
    });
    expect(shipment.status).toBe('PENDING');

    // 2. Admin assigns to courier
    await adminClient.assignShipment(shipment.id, courier.id);
    
    const assigned = await prisma.shipment.findUnique({
      where: { id: shipment.id }
    });
    expect(assigned.assignedCourierId).toBe(courier.id);

    // 3. Courier marks as delivered
    await courierClient.updateStatus(shipment.id, 'DELIVERED', {
      otp: shipment.customerOtp,
      collectedCash: '450.00',
    });

    // 4. Verify wallet credited
    const wallet = await prisma.wallet.findUnique({
      where: { merchantId: merchant.id }
    });
    expect(wallet.balance).toBeGreaterThan(0);

    // 5. Verify transactions created
    const transactions = await prisma.transaction.findMany({
      where: { walletId: wallet.id }
    });
    expect(transactions).toHaveLength(3); // COD, Commission, Fee
  });
});
```

## Test Data Factories

```typescript
// factories/merchant.factory.ts
export class MerchantFactory {
  async create(overrides: Partial<Merchant> = {}): Promise<Merchant> {
    return prisma.merchant.create({
      data: {
        businessName: faker.company.name(),
        businessType: 'ecommerce',
        commissionRate: new Decimal('0.05'),
        feePerShipment: new Decimal('15'),
        user: {
          create: {
            phone: faker.phone.number('01#########'),
            role: UserRole.MERCHANT,
            name: faker.person.fullName(),
            phoneVerified: new Date(),
          }
        },
        wallet: { create: {} },
        ...overrides,
      },
    });
  }
}

// factories/shipment.factory.ts
export class ShipmentFactory {
  async create(merchantId: string, overrides: Partial<Shipment> = {}): Promise<Shipment> {
    return prisma.shipment.create({
      data: {
        trackingNumber: generateTrackingNumber(),
        merchantId,
        status: ShipmentStatus.PENDING,
        type: ShipmentType.COD,
        customerName: faker.person.fullName(),
        customerPhone: faker.phone.number('01#########'),
        addressText: faker.location.streetAddress(),
        address: {
          governorate: 'Cairo',
          city: 'Maadi',
          district: 'Degla',
          street: faker.location.street(),
          landmark: 'Near CIB',
        },
        codAmount: new Decimal(faker.finance.amount({ min: 100, max: 1000 })),
        productDescription: faker.commerce.productName(),
        ...overrides,
      },
    });
  }
}
```

## Mocking External Services

```typescript
// Mock Twilio
jest.mock('twilio', () => {
  return jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn().mockResolvedValue({ sid: 'mock-sid' }),
    },
    verify: {
      v2: {
        services: jest.fn().mockReturnValue({
          verifications: {
            create: jest.fn().mockResolvedValue({ status: 'pending' }),
          },
        }),
      },
    },
  }));
});

// Mock Redis
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    incr: jest.fn().mockResolvedValue(1),
    del: jest.fn().mockResolvedValue(1),
  }));
});
```

## Test Coverage Requirements

| Layer | Target Coverage |
|-------|----------------|
| Services (business logic) | >90% |
| Controllers | >80% |
| DTOs/Validation | >80% |
| Guards/Interceptors | >80% |
| Repositories | >70% |

## CI/CD Integration

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npx prisma migrate deploy
      - run: npx prisma generate
      - run: npm run test:unit -- --coverage
      - run: npm run test:integration
      - run: npm run test:e2e
```

## Example Usage
User: "Write unit tests for the wallet transaction service"
→ Use this skill to create comprehensive unit tests covering normal cases, edge cases, error handling, and concurrent updates.
