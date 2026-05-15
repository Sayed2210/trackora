import { PayoutMethod, PayoutStatus, UserRole } from '@prisma/client';
import { PayoutsController } from '../controllers/payouts.controller';
import { PayoutsService } from '../services/payouts.service';

describe('PayoutsController', () => {
  const service = {
    findAll: jest.fn(),
    requestPayout: jest.fn(),
    approve: jest.fn(),
    complete: jest.fn(),
    reject: jest.fn(),
  };
  let controller: PayoutsController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new PayoutsController(service as unknown as PayoutsService);
  });

  it('lists payouts with filters and request user context', async () => {
    service.findAll.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 });
    const req = { user: { userId: 'user-1', role: UserRole.MERCHANT } } as any;

    await controller.findAll({ status: PayoutStatus.PENDING }, req);

    expect(service.findAll).toHaveBeenCalledWith({ status: PayoutStatus.PENDING }, req.user);
  });

  it('creates a merchant payout request', async () => {
    service.requestPayout.mockResolvedValue({ id: 'payout-1' });

    await controller.create(
      { amount: 600, method: PayoutMethod.INSTAPAY, destination: {} },
      { user: { userId: 'user-1', role: UserRole.MERCHANT } } as any,
    );

    expect(service.requestPayout).toHaveBeenCalledWith('user-1', {
      amount: 600,
      method: PayoutMethod.INSTAPAY,
      destination: {},
    });
  });

  it('approves, completes, and rejects payouts', async () => {
    await controller.approve('11111111-1111-1111-1111-111111111111', {
      user: { userId: 'admin-1', role: UserRole.FINANCE_ADMIN },
    } as any);
    await controller.complete('11111111-1111-1111-1111-111111111111', {
      referenceNumber: 'REF-1',
    });
    await controller.reject('11111111-1111-1111-1111-111111111111', {
      reason: 'Invalid account',
    });

    expect(service.approve).toHaveBeenCalledWith(
      '11111111-1111-1111-1111-111111111111',
      'admin-1',
    );
    expect(service.complete).toHaveBeenCalledWith(
      '11111111-1111-1111-1111-111111111111',
      'REF-1',
    );
    expect(service.reject).toHaveBeenCalledWith(
      '11111111-1111-1111-1111-111111111111',
      'Invalid account',
    );
  });
});
