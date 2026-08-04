import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { WalletsController } from '../controllers/wallets.controller';
import { WalletsService } from '../services/wallets.service';
import { WalletsRepository } from '../repositories/wallets.repository';
import { TransactionsService } from '../services/transactions.service';
import { FeeCalculatorService } from '../services/fee-calculator.service';
import { PrismaService } from '@core/prisma/prisma.service';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { TransactionType } from '@prisma/client';

const mockPrisma = {
  wallet: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    create: jest.fn(),
    count: jest.fn().mockResolvedValue(0),
  },
  transaction: {
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn(),
    count: jest.fn().mockResolvedValue(0),
  },
  $transaction: jest.fn((fn) => Promise.resolve(fn(mockPrisma))),
};

// Alias findFirst to findUnique for controller tests
mockPrisma.wallet.findFirst = mockPrisma.wallet.findUnique;

const mockGuard = { canActivate: jest.fn(() => true) };

describe('WalletsController (integration)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [WalletsController],
      providers: [
        WalletsService,
        WalletsRepository,
        TransactionsService,
        FeeCalculatorService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockGuard)
      .compile();

    app = moduleRef.createNestApplication();
    app.use((req: { user?: unknown }, _res: unknown, next: () => void) => {
      req.user = {
        userId: 'admin-1',
        role: 'SUPER_ADMIN',
        tenantId: 'tenant-1',
        permissions: [],
      };
      next();
    });
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /wallets/:id', () => {
    it('should return wallet by id', async () => {
      const wallet = {
        id: 'wallet-1',
        merchantId: 'merchant-1',
        balance: 1000,
        currency: 'EGP',
        version: 1,
      };
      mockPrisma.wallet.findUnique.mockResolvedValue(wallet);

      const response = await request(app.getHttpServer())
        .get('/wallets/11111111-1111-1111-1111-111111111111')
        .expect(200);

      expect(response.body).toEqual(wallet);
      expect(mockPrisma.wallet.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: '11111111-1111-1111-1111-111111111111',
            tenantId: 'tenant-1',
          },
        }),
      );
    });
  });

  describe('GET /wallets/:id/transactions', () => {
    it('should return transactions with pagination', async () => {
      mockPrisma.wallet.findUnique.mockResolvedValue({
        id: '11111111-1111-1111-1111-111111111111',
      });
      const txs = [
        { id: 'tx-1', type: TransactionType.COD_CREDIT, amount: 100 },
      ];
      mockPrisma.transaction.findMany.mockResolvedValue(txs);
      mockPrisma.transaction.count.mockResolvedValue(1);

      const response = await request(app.getHttpServer())
        .get(
          '/wallets/11111111-1111-1111-1111-111111111111/transactions?page=1&limit=10',
        )
        .expect(200);

      expect(response.body.data).toEqual(txs);
      expect(response.body.total).toBe(1);
    });
  });
});
