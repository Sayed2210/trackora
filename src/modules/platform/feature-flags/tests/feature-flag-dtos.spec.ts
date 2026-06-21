import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { FeatureFlagKeyParamDto } from '../dtos/feature-flag-key-param.dto';
import { UpdateGlobalFeatureFlagDto } from '../dtos/update-global-feature-flag.dto';
import { UpdateTenantFeatureFlagDto } from '../dtos/update-tenant-feature-flag.dto';

describe('Feature flag DTO validation', () => {
  it('rejects invalid feature flag keys', async () => {
    const dto = plainToInstance(FeatureFlagKeyParamDto, {
      key: 'invalid_flag',
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'key')).toBe(true);
  });

  it('requires reason for global mutations', async () => {
    const dto = plainToInstance(UpdateGlobalFeatureFlagDto, { enabled: true });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'reason')).toBe(true);
  });

  it('requires a boolean global enabled value', async () => {
    const dto = plainToInstance(UpdateGlobalFeatureFlagDto, {
      enabled: null,
      reason: 'Enable globally',
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'enabled')).toBe(true);
  });

  it('allows null tenant override enabled values', async () => {
    const dto = plainToInstance(UpdateTenantFeatureFlagDto, {
      enabled: null,
      reason: 'Return to inherited behavior',
    });

    await expect(validate(dto)).resolves.toEqual([]);
  });

  it('rejects missing tenant mutation reason', async () => {
    const dto = plainToInstance(UpdateTenantFeatureFlagDto, { enabled: false });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'reason')).toBe(true);
  });
});
