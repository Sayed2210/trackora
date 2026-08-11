import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CloneTenantConfigurationDto } from '../dtos';

describe('CloneTenantConfigurationDto', () => {
  it('defaults both supported clone scopes to true', async () => {
    const dto = plainToInstance(CloneTenantConfigurationDto, {
      name: 'Alexandria Express',
      slug: 'alexandria-express',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.copyMetadata).toBe(true);
    expect(dto.copyFeatureFlagOverrides).toBe(true);
  });

  it('validates boolean scope selectors and kebab-case slugs', async () => {
    const dto = plainToInstance(CloneTenantConfigurationDto, {
      name: 'Alexandria Express',
      slug: 'Not Kebab Case',
      copyMetadata: 'true',
      copyFeatureFlagOverrides: 1,
    });

    const errors = await validate(dto);
    expect(errors.map((error) => error.property).sort()).toEqual([
      'copyFeatureFlagOverrides',
      'copyMetadata',
      'slug',
    ]);
  });
});
