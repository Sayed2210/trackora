import { Test, TestingModule } from '@nestjs/testing';
import { PERMISSIONS } from '@common/constants/permissions.constant';
import { PERMISSIONS_KEY } from '@common/decorators/permissions.decorator';
import { PlatformBillingController } from '../controllers/platform-billing.controller';
import { PlatformBillingService } from '../services/platform-billing.service';

const invoiceId = '123e4567-e89b-42d3-a456-426614174000';
const tenantId = '123e4567-e89b-42d3-a456-426614174001';

describe('PlatformBillingController', () => {
  let controller: PlatformBillingController;
  let service: jest.Mocked<PlatformBillingService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PlatformBillingController],
      providers: [
        {
          provide: PlatformBillingService,
          useValue: {
            getOverview: jest.fn(),
            findInvoices: jest.fn(),
            createInvoice: jest.fn(),
            updateInvoice: jest.fn(),
            getTenantBilling: jest.fn(),
            exportInvoices: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(PlatformBillingController);
    service = module.get(PlatformBillingService);
  });

  it('delegates billing endpoint calls', async () => {
    service.getOverview.mockResolvedValueOnce({ totalManualInvoices: 1 } as any);
    service.findInvoices.mockResolvedValueOnce({ data: [], total: 0, page: 1, limit: 20 } as any);
    service.createInvoice.mockResolvedValueOnce({ id: invoiceId } as any);
    service.updateInvoice.mockResolvedValueOnce({ id: invoiceId, amount: '200' } as any);
    service.getTenantBilling.mockResolvedValueOnce({ tenant: { id: tenantId } } as any);
    service.exportInvoices.mockResolvedValueOnce([{ id: invoiceId }] as any);

    await expect(controller.overview()).resolves.toEqual({ totalManualInvoices: 1 });
    await expect(controller.findInvoices({ page: 1, limit: 20 })).resolves.toEqual({ data: [], total: 0, page: 1, limit: 20 });
    await expect(controller.createInvoice({ tenantId, amount: '100', reason: 'billing' })).resolves.toEqual({ id: invoiceId });
    await expect(controller.updateInvoice({ id: invoiceId }, { reason: 'correction', amount: '200' })).resolves.toEqual({ id: invoiceId, amount: '200' });
    await expect(controller.tenantBilling({ id: tenantId })).resolves.toEqual({ tenant: { id: tenantId } });
    await expect(controller.exportInvoices({ from: new Date(), to: new Date() }, { type: jest.fn() } as any)).resolves.toEqual([{ id: invoiceId }]);
  });

  it('requires view_billing for all billing endpoints', () => {
    for (const handler of [
      controller.overview,
      controller.findInvoices,
      controller.createInvoice,
      controller.updateInvoice,
      controller.tenantBilling,
      controller.exportInvoices,
    ]) {
      expect(Reflect.getMetadata(PERMISSIONS_KEY, handler)).toEqual([
        PERMISSIONS.VIEW_BILLING,
      ]);
    }
  });
});
