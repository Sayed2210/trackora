import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ShipmentStatus } from '@prisma/client';
import { AnalyticsGroupBy, AnalyticsShipmentsQueryDto, AnalyticsUsageQueryDto } from '../dtos';

describe('Analytics DTO validation', () => {
  it('rejects invalid groupBy values', async () => {
    const dto = plainToInstance(AnalyticsUsageQueryDto, { groupBy: 'quarter' });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'groupBy')).toBe(true);
  });

  it('rejects invalid tenant ids', async () => {
    const dto = plainToInstance(AnalyticsUsageQueryDto, { tenantId: 'not-a-uuid' });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'tenantId')).toBe(true);
  });

  it('rejects invalid shipment status values', async () => {
    const dto = plainToInstance(AnalyticsShipmentsQueryDto, { status: 'LOST' });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'status')).toBe(true);
  });

  it('accepts valid usage and shipment query values', async () => {
    const usage = plainToInstance(AnalyticsUsageQueryDto, {
      from: '2026-05-01T00:00:00.000Z',
      to: '2026-05-02T00:00:00.000Z',
      groupBy: AnalyticsGroupBy.DAY,
      tenantId: '123e4567-e89b-42d3-a456-426614174000',
    });
    const shipments = plainToInstance(AnalyticsShipmentsQueryDto, {
      status: ShipmentStatus.DELIVERED,
    });

    await expect(validate(usage)).resolves.toEqual([]);
    await expect(validate(shipments)).resolves.toEqual([]);
  });
});
