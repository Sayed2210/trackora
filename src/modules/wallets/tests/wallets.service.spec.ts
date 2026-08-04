import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { WalletsService } from '../services/wallets.service';
import { WalletsRepository } from '../repositories/wallets.repository';
import { TransactionsService } from '../services/transactions.service';
import { PrismaService } from '@core/prisma/prisma.service';
import { TransactionType } from '@prisma/client';

describe('WalletsService', () => {
  let service: WalletsService;
  let walletsRepository: WalletsRepository;
  let transactionsService: TransactionsService;

  const mockWallet = {
    id: 'wallet-1',
    merchantId: 'merchant-1',
    balance: 1000,
    pendingBalance: 200,
    totalCredited: 5000,
    totalDebited: 4000,
    currency: 'EGP',
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPrisma = {
    merchant: { findFirst: jest.fn().mockResolvedValue({ id: 'merchant-1' }) },
    wallet: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletsService,
        {
          provide: WalletsRepository,
          useValue: {
            findByMerchantIdForTenant: jest.fn(),
            findByIdForTenant: jest.fn(),
            create: jest.fn().mockResolvedValue(mockWallet),
          },
        },
        {
          provide: TransactionsService,
          useValue: {
            getTransactions: jest.fn().mockResolvedValue({
              data: [],
              total: 0,
              page: 1,
              limit: 20,
            }),
          },
        },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<WalletsService>(WalletsService);
    walletsRepository = module.get<WalletsRepository>(WalletsRepository);
    transactionsService = module.get<TransactionsService>(TransactionsService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new wallet', async () => {
      jest
        .spyOn(walletsRepository, 'findByMerchantIdForTenant')
        .mockResolvedValueOnce(null);

      const result = await service.create('merchant-1', 'tenant-1');

      expect(result).toEqual(mockWallet);
      expect(walletsRepository.create).toHaveBeenCalledWith({
        merchantId: 'merchant-1',
        tenantId: 'tenant-1',
        balance: 0,
        pendingBalance: 0,
        totalCredited: 0,
        totalDebited: 0,
        currency: 'EGP',
        version: 0,
      });
    });

    it('should return existing wallet if already exists', async () => {
      jest
        .spyOn(walletsRepository, 'findByMerchantIdForTenant')
        .mockResolvedValueOnce(mockWallet as any);

      const result = await service.create('merchant-1', 'tenant-1');

      expect(result).toEqual(mockWallet);
      expect(walletsRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('findByMerchantId', () => {
    it('should return wallet by merchant id', async () => {
      jest
        .spyOn(walletsRepository, 'findByMerchantIdForTenant')
        .mockResolvedValueOnce(mockWallet as any);

      const result = await service.findByMerchantId('merchant-1', 'tenant-1');

      expect(result).toEqual(mockWallet);
      expect(walletsRepository.findByMerchantIdForTenant).toHaveBeenCalledWith(
        'merchant-1',
        'tenant-1',
      );
    });
  });

  describe('findById', () => {
    it('should return wallet by id', async () => {
      jest
        .spyOn(walletsRepository, 'findByIdForTenant')
        .mockResolvedValueOnce(mockWallet as any);

      const result = await service.findById('wallet-1', 'tenant-1');

      expect(result).toEqual(mockWallet);
      expect(walletsRepository.findByIdForTenant).toHaveBeenCalledWith(
        'wallet-1',
        'tenant-1',
      );
    });
  });

  describe('getBalance', () => {
    it('should return wallet balance as numbers', async () => {
      jest
        .spyOn(walletsRepository, 'findByMerchantIdForTenant')
        .mockResolvedValueOnce(mockWallet as any);

      const result = await service.getBalance('merchant-1', 'tenant-1');

      expect(result).toEqual({
        id: 'wallet-1',
        merchantId: 'merchant-1',
        balance: 1000,
        availableBalance: 1000,
        pendingBalance: 200,
        totalCredited: 5000,
        totalDebited: 4000,
        currency: 'EGP',
        updatedAt: mockWallet.updatedAt,
      });
    });

    it('should throw NotFoundException if wallet not found', async () => {
      jest
        .spyOn(walletsRepository, 'findByMerchantIdForTenant')
        .mockResolvedValueOnce(null);

      await expect(
        service.getBalance('merchant-1', 'tenant-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getTransactions', () => {
    it('should return transactions for merchant', async () => {
      jest
        .spyOn(walletsRepository, 'findByMerchantIdForTenant')
        .mockResolvedValueOnce(mockWallet as any);

      const result = await service.getTransactions('merchant-1', 'tenant-1', {
        type: TransactionType.COD_CREDIT,
        page: 1,
        limit: 10,
      });

      expect(result).toEqual({
        data: [],
        total: 0,
        page: 1,
        limit: 20,
      });
      expect(transactionsService.getTransactions).toHaveBeenCalledWith(
        'wallet-1',
        'tenant-1',
        expect.objectContaining({
          type: TransactionType.COD_CREDIT,
          page: 1,
          limit: 10,
        }),
      );
    });

    it('should throw NotFoundException if wallet not found', async () => {
      jest
        .spyOn(walletsRepository, 'findByMerchantIdForTenant')
        .mockResolvedValueOnce(null);

      await expect(
        service.getTransactions('merchant-1', 'tenant-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
