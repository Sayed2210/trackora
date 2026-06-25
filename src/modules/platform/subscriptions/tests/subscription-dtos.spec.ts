import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ChangeSubscriptionPlanDto } from '../dtos/change-subscription-plan.dto';
import { CancelSubscriptionDto } from '../dtos/cancel-subscription.dto';
import { CreateSubscriptionDto } from '../dtos/create-subscription.dto';
import { RenewSubscriptionDto } from '../dtos/renew-subscription.dto';

describe('Subscription DTO validation', () => {
  it('requires reason for plan changes', async () => {
    const dto = plainToInstance(ChangeSubscriptionPlanDto, {
      planId: '123e4567-e89b-42d3-a456-426614174002',
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'reason')).toBe(true);
  });

  it('requires reason for cancellations', async () => {
    const dto = plainToInstance(CancelSubscriptionDto, {});

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'reason')).toBe(true);
  });

  it('requires reason for renewals', async () => {
    const dto = plainToInstance(RenewSubscriptionDto, {
      currentPeriodEnd: new Date('2026-07-01T00:00:00.000Z'),
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'reason')).toBe(true);
  });

  it('requires tenantId, planId, and reason for create', async () => {
    const errors = await validate(plainToInstance(CreateSubscriptionDto, {}));

    expect(errors.some((error) => error.property === 'tenantId')).toBe(true);
    expect(errors.some((error) => error.property === 'planId')).toBe(true);
    expect(errors.some((error) => error.property === 'reason')).toBe(true);
  });

  it('passes when tenantId, planId, and reason are provided', async () => {
    const errors = await validate(
      plainToInstance(CreateSubscriptionDto, {
        tenantId: '123e4567-e89b-42d3-a456-426614174001',
        planId: '123e4567-e89b-42d3-a456-426614174002',
        reason: 'onboarding merchant',
      }),
    );

    expect(errors).toHaveLength(0);
  });
});
