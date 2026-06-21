import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreatePlanDto } from '../dtos/create-plan.dto';

describe('Plan DTO validation', () => {
  it('rejects invalid limits', async () => {
    const dto = plainToInstance(CreatePlanDto, {
      name: 'Growth',
      slug: 'growth',
      monthlyPrice: '999.00',
      monthlyShipmentLimit: 0,
    });

    const errors = await validate(dto);

    expect(
      errors.some((error) => error.property === 'monthlyShipmentLimit'),
    ).toBe(true);
  });

  it('rejects invalid feature flag keys', async () => {
    const dto = plainToInstance(CreatePlanDto, {
      name: 'Growth',
      slug: 'growth',
      monthlyPrice: '999.00',
      featureEntitlements: [{ key: 'invalid_flag', enabled: true }],
    });

    const errors = await validate(dto);

    expect(
      errors.some((error) => error.property === 'featureEntitlements'),
    ).toBe(true);
  });

  it('accepts null limits as unlimited', async () => {
    const dto = plainToInstance(CreatePlanDto, {
      name: 'Enterprise',
      slug: 'enterprise',
      monthlyPrice: '0.00',
      monthlyShipmentLimit: null,
    });

    await expect(validate(dto)).resolves.toEqual([]);
  });
});
