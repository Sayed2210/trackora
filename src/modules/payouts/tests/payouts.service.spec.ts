import { BadRequestException } from '@nestjs/common';
import { PayoutMethod, PayoutStatus, TransactionType, UserRole } from '@prisma/client';
import { PrismaService } from '@core/prisma/prisma.service';
import { PayoutsRepository } from '../repositories/payouts.repository';
import { PayoutsService } from '../services/payouts.service';

describe('PayoutsService', () => {
  let service: PayoutsService;
  const repository = {
    findMany: jest.fn(),
    count: jest.fn(),
    findById: jest.fn(),
  };
  const tx = {
    wallet: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    payout: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    transaction: {
      create: jest.fn(),
    },
  };
  const prisma = {
    merchant: { findUnique: jest.fn() },
    payout: { update: jest.fn() },
    $transaction: jest.fn((fn) => fn(tx)),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PayoutsService(prisma as unknown as PrismaService, repository as unknown as PayoutsRepository);
    prisma.merchant.findUnique.mockResolvedValue({ id: 'merchant-1' });
    tx.wallet.findUnique.mockResolvedValue({
      id: 'wallet-1',
      merchantId: 'merchant-1',
      balance: 1000,
      totalCredited: 1000,
      totalDebited: 0,
    });
    tx.payout.findFirst.mockResolvedValue(null);
    tx.payout.create.mockResolvedValue({
      id: 'payout-1',
      merchantId: 'merchant-1',
      amount: 600,
      status: PayoutStatus.PENDING,
      method: PayoutMethod.INSTAPAY,
      destination: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  it('requests a payout and debits the merchant wallet', async () => {
    const result = await service.requestPayout('user-1', {
      amount: 600,
      method: PayoutMethod.INSTAPAY,
      destination: { accountNumber: '01000000000' },
    });

    expect(result.id).toBe('payout-1');
    expect(tx.wallet.update).toHaveBeenCalledWith({
      where: { id: 'wallet-1' },
      data: expect.objectContaining({ balance: 400, totalDebited: 600 }),
    });
    expect(tx.transaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: TransactionType.PAYOUT_DEBIT,
        amount: -600,
        runningBalance: 400,
      }),
    });
  });

  it('blocks duplicate open payout requests', async () => {
    tx.payout.findFirst.mockResolvedValue({ id: 'existing' });

    await expect(
      service.requestPayout('user-1', {
        amount: 600,
        method: PayoutMethod.INSTAPAY,
        destination: {},
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('blocks payout requests above available balance', async () => {
    await expect(
      service.requestPayout('user-1', {
        amount: 1200,
        method: PayoutMethod.INSTAPAY,
        destination: {},
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('lists merchant payouts scoped to the authenticated merchant', async () => {
    repository.findMany.mockResolvedValue([]);
    repository.count.mockResolvedValue(0);

    await service.findAll({}, { userId: 'user-1', role: UserRole.MERCHANT });

    expect(repository.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ merchantId: 'merchant-1' }),
      0,
      20,
    );
  });

  it('rejects a payout and restores wallet balance', async () => {
    repository.findById.mockResolvedValue({
      id: 'payout-1',
      merchantId: 'merchant-1',
      amount: 600,
      status: PayoutStatus.PENDING,
    });
    tx.payout.update.mockResolvedValue({
      id: 'payout-1',
      merchantId: 'merchant-1',
      amount: 600,
      status: PayoutStatus.REJECTED,
      destination: {},
    });

    await service.reject('payout-1', 'Invalid account');

    expect(tx.wallet.update).toHaveBeenCalledWith({
      where: { id: 'wallet-1' },
      data: expect.objectContaining({ balance: 1600, totalCredited: 1600 }),
    });
    expect(tx.transaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: TransactionType.ADJUSTMENT_CREDIT,
        amount: 600,
        runningBalance: 1600,
      }),
    });
  });
});
