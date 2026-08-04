import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ExecutionContext } from '@nestjs/common';
import request from 'supertest';
import { MerchantsController } from '../controllers/merchants.controller';
import { MerchantsService } from '../services/merchants.service';
import { WalletsService } from '@modules/wallets/services/wallets.service';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { KycStatus } from '../entities/merchant.entity';
import { UserRole } from '@modules/users/entities/user.entity';

const mockMerchantsService = {
  create: jest.fn(),
  findById: jest.fn(),
  updateKycStatus: jest.fn(),
  updateFeeStructure: jest.fn(),
};

const mockWalletsService = {
  getBalance: jest.fn(),
  getTransactions: jest.fn(),
};

const mockAuthGuard = {
  canActivate: jest.fn((context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest();
    request.user = {
      userId: 'mock-user-id',
      role: UserRole.SUPER_ADMIN,
      tenantId: 'tenant-1',
    };
    return true;
  }),
};

const TEST_UUID = '123e4567-e89b-12d3-a456-426614174001';

const mockMerchant = {
  id: TEST_UUID,
  userId: 'user-1',
  businessName: 'Test Store',
  businessType: 'RETAIL',
  kycStatus: KycStatus.PENDING,
  commissionRate: 10,
  feePerShipment: 25,
  createdAt: new Date().toISOString(),
};

describe('MerchantsController (integration)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [MerchantsController],
      providers: [
        { provide: MerchantsService, useValue: mockMerchantsService },
        { provide: WalletsService, useValue: mockWalletsService },
        {
          provide: 'APP_GUARD',
          useValue: mockAuthGuard,
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new (require('@nestjs/common').ValidationPipe)({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /merchants', () => {
    it('should create a merchant', async () => {
      mockMerchantsService.create.mockResolvedValue(mockMerchant);

      const dto = { businessName: 'Test Store' };
      const res = await request(app.getHttpServer())
        .post('/merchants')
        .send(dto)
        .expect(201);

      expect(res.body).toEqual(mockMerchant);
      expect(mockMerchantsService.create).toHaveBeenCalledWith(
        expect.objectContaining(dto),
        'mock-user-id',
        'tenant-1',
      );
    });
  });

  describe('GET /merchants/:id', () => {
    it('should return merchant by id', async () => {
      mockMerchantsService.findById.mockResolvedValue(mockMerchant);

      const res = await request(app.getHttpServer())
        .get(`/merchants/${TEST_UUID}`)
        .expect(200);

      expect(res.body).toEqual(mockMerchant);
      expect(mockMerchantsService.findById).toHaveBeenCalledWith(
        TEST_UUID,
        'tenant-1',
      );
    });
  });

  describe('PATCH /merchants/:id/kyc', () => {
    it('should update KYC status', async () => {
      const updated = { ...mockMerchant, kycStatus: KycStatus.APPROVED };
      mockMerchantsService.updateKycStatus.mockResolvedValue(updated);

      const res = await request(app.getHttpServer())
        .patch(`/merchants/${TEST_UUID}/kyc`)
        .send({ status: KycStatus.APPROVED })
        .expect(200);

      expect(res.body).toEqual(updated);
      expect(mockMerchantsService.updateKycStatus).toHaveBeenCalledWith(
        TEST_UUID,
        KycStatus.APPROVED,
        'tenant-1',
      );
    });
  });

  describe('PATCH /merchants/:id/fees', () => {
    it('should update fee structure', async () => {
      const updated = { ...mockMerchant, commissionRate: 15 };
      mockMerchantsService.updateFeeStructure.mockResolvedValue(updated);

      const res = await request(app.getHttpServer())
        .patch(`/merchants/${TEST_UUID}/fees`)
        .send({ commissionRate: '15', feePerShipment: '30' })
        .expect(200);

      expect(res.body).toEqual(updated);
      expect(mockMerchantsService.updateFeeStructure).toHaveBeenCalledWith(
        TEST_UUID,
        expect.objectContaining({ commissionRate: '15', feePerShipment: '30' }),
        'tenant-1',
      );
    });
  });

  describe('GET /merchants/:id/wallet', () => {
    it('should return wallet balance', async () => {
      const balance = {
        balance: 1000,
        pendingBalance: 200,
        totalCredited: 5000,
        totalDebited: 4000,
        currency: 'EGP',
      };
      mockWalletsService.getBalance.mockResolvedValue(balance);

      const res = await request(app.getHttpServer())
        .get(`/merchants/${TEST_UUID}/wallet`)
        .expect(200);

      expect(res.body).toEqual(balance);
      expect(mockWalletsService.getBalance).toHaveBeenCalledWith(
        TEST_UUID,
        'tenant-1',
      );
    });
  });

  describe('GET /merchants/:id/wallet/transactions', () => {
    it('should return wallet transactions with filters', async () => {
      const txs = {
        data: [{ id: 'tx-1', amount: 100 }],
        total: 1,
        page: 1,
        limit: 20,
      };
      mockWalletsService.getTransactions.mockResolvedValue(txs);

      const res = await request(app.getHttpServer())
        .get(
          `/merchants/${TEST_UUID}/wallet/transactions?type=COD_CREDIT&from=2024-05-01&to=2024-05-31&page=1&limit=10`,
        )
        .expect(200);

      expect(res.body).toEqual(txs);
      expect(mockWalletsService.getTransactions).toHaveBeenCalledWith(
        TEST_UUID,
        'tenant-1',
        expect.objectContaining({
          type: 'COD_CREDIT',
          from: new Date('2024-05-01'),
          to: new Date('2024-05-31'),
          page: 1,
          limit: 10,
        }),
      );
    });
  });
});
