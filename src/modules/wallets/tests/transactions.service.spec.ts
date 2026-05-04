import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '@core/prisma/prisma.service';
import { TransactionsService } from '../services/transactions.service';
import { TransactionType } from '@prisma/client';

describe('TransactionsService', () => {
  let service: TransactionsService;
  let prisma: PrismaService;

  const mockWallet = {
    id: 'wallet-1',
    balance: 100,
    totalCredited: 200,
    totalDebited: 100,
    version: 1,
  };

  const mockTxCreate = jest.fn();
  const mockWalletFindUnique = jest.fn();
  const mockWalletUpdateMany = jest.fn();
  const mockTxFindMany = jest.fn();
  const mockTxCount = jest.fn();
  const mockWalletFindUniqueOuter = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();
    mockWalletFindUnique.mockResolvedValue(mockWallet);
    mockWalletUpdateMany.mockResolvedValue({ count: 1 });
    mockTxCreate.mockResolvedValue({ id: 'tx-1' });
    mockTxFindMany.mockResolvedValue([]);
    mockTxCount.mockResolvedValue(0);
    mockWalletFindUniqueOuter.mockResolvedValue(mockWallet);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        {
          provide: PrismaService,
          useValue: {
            $transaction: jest.fn((fn) =>
              Promise.resolve(
                fn({
                  wallet: {
                    findUnique: mockWalletFindUnique,
                    updateMany: mockWalletUpdateMany,
                  },
                  transaction: {
                    create: mockTxCreate,
                    findMany: mockTxFindMany,
                    count: mockTxCount,
                  },
                }),
              ),
            ),
            transaction: {
              findMany: mockTxFindMany,
              count: mockTxCount,
            },
            wallet: {
              findUnique: mockWalletFindUniqueOuter,
            },
          },
        },
      ],
    }).compile();

    service = module.get<TransactionsService>(TransactionsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createCredit', () => {
    it('should create a credit transaction and update wallet', async () => {
      const result = await service.createCredit({
        walletId: 'wallet-1',
        type: TransactionType.COD_CREDIT,
        amount: 50,
        description: 'Test credit',
      });

      expect(result.id).toBe('tx-1');
      expect(mockWalletUpdateMany).toHaveBeenCalledWith({
        where: { id: 'wallet-1', version: 1 },
        data: expect.objectContaining({
          balance: 150,
          totalCredited: 250,
          version: 2,
        }),
      });
      expect(mockTxCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            walletId: 'wallet-1',
            amount: 50,
            runningBalance: 150,
            type: TransactionType.COD_CREDIT,
          }),
        }),
      );
    });

    it('should throw NotFoundException if wallet not found', async () => {
      mockWalletFindUnique.mockResolvedValue(null);

      await expect(
        service.createCredit({
          walletId: 'wallet-missing',
          type: TransactionType.COD_CREDIT,
          amount: 50,
          description: 'Test',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('createDebit', () => {
    it('should create a debit transaction and update wallet', async () => {
      const result = await service.createDebit({
        walletId: 'wallet-1',
        type: TransactionType.FEE_DEBIT,
        amount: 30,
        description: 'Test debit',
      });

      expect(result.id).toBe('tx-1');
      expect(mockWalletUpdateMany).toHaveBeenCalledWith({
        where: { id: 'wallet-1', version: 1 },
        data: expect.objectContaining({
          balance: 70,
          totalDebited: 130,
          version: 2,
        }),
      });
      expect(mockTxCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            amount: -30,
            runningBalance: 70,
            type: TransactionType.FEE_DEBIT,
          }),
        }),
      );
    });
  });

  describe('concurrent updates', () => {
    it('should retry on version conflict and eventually succeed', async () => {
      mockWalletUpdateMany
        .mockResolvedValueOnce({ count: 0 })
        .mockResolvedValueOnce({ count: 1 });

      const result = await service.createCredit({
        walletId: 'wallet-1',
        type: TransactionType.COD_CREDIT,
        amount: 50,
        description: 'Test',
      });

      expect(result.id).toBe('tx-1');
      expect(mockWalletUpdateMany).toHaveBeenCalledTimes(2);
    });

    it('should fail after max retries exhausted', async () => {
      mockWalletUpdateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.createCredit({
          walletId: 'wallet-1',
          type: TransactionType.COD_CREDIT,
          amount: 50,
          description: 'Test',
        }),
      ).rejects.toThrow('Failed to create transaction after maximum retries');
    });
  });

  describe('getRunningBalance', () => {
    it('should return current balance', async () => {
      const balance = await service.getRunningBalance('wallet-1');
      expect(balance).toBe(100);
    });

    it('should throw NotFoundException for missing wallet', async () => {
      mockWalletFindUniqueOuter.mockResolvedValue(null);

      await expect(
        service.getRunningBalance('wallet-missing'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getTransactions', () => {
    it('should return paginated transactions', async () => {
      const tx = { id: 'tx-1', amount: 50 };
      mockTxFindMany.mockResolvedValue([tx]);
      mockTxCount.mockResolvedValue(1);

      const result = await service.getTransactions('wallet-1', {
        page: 1,
        limit: 10,
      });

      expect(result.data).toEqual([tx]);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });
  });
});
