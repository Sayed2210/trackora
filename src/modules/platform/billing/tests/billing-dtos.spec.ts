import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PaymentStatus } from '@prisma/client';
import { BillingExportQueryDto, CreateManualInvoiceDto, ListInvoicesQueryDto, UpdateManualInvoiceDto } from '../dtos';

const tenantId = '123e4567-e89b-42d3-a456-426614174001';

describe('Billing DTO validation', () => {
  it('requires reason for invoice creation', async () => {
    const dto = plainToInstance(CreateManualInvoiceDto, { tenantId, amount: '100.00' });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'reason')).toBe(true);
  });

  it('requires reason for invoice updates', async () => {
    const dto = plainToInstance(UpdateManualInvoiceDto, { status: PaymentStatus.PAID });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'reason')).toBe(true);
  });

  it('validates pagination and safe status filters', async () => {
    const dto = plainToInstance(ListInvoicesQueryDto, { page: 0, limit: 10, status: 'INVALID' });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'page')).toBe(true);
    expect(errors.some((error) => error.property === 'status')).toBe(true);
  });

  it('validates export query date fields', async () => {
    const dto = plainToInstance(BillingExportQueryDto, { from: '2026-05-01T00:00:00.000Z', to: '2026-05-31T00:00:00.000Z' });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.from).toBeInstanceOf(Date);
    expect(dto.to).toBeInstanceOf(Date);
  });
});
