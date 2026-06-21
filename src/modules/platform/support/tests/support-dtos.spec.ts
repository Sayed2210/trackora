import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { StartImpersonationDto } from '../dtos';

describe('Support DTO validation', () => {
  it('requires reason to start impersonation', async () => {
    const dto = plainToInstance(StartImpersonationDto, {});

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'reason')).toBe(true);
  });

  it('validates duration range', async () => {
    const dto = plainToInstance(StartImpersonationDto, {
      reason: 'support',
      durationMinutes: 0,
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'durationMinutes')).toBe(
      true,
    );
  });
});
