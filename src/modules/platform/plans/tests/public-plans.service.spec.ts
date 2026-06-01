import { FeatureFlagKey, Prisma } from '@prisma/client';
import { PlatformPlansRepository, PublicPlanWithFeatures } from '../repositories/platform-plans.repository';
import { PublicPlansService } from '../services/public-plans.service';

function makePlan(overrides: Partial<PublicPlanWithFeatures> = {}): PublicPlanWithFeatures {
  return {
    id: 'plan-1',
    slug: 'growth',
    name: 'Growth',
    description: 'Growth plan',
    monthlyPrice: new Prisma.Decimal('999.00'),
    yearlyPrice: new Prisma.Decimal('9990.00'),
    currency: 'EGP',
    monthlyShipmentLimit: 10000,
    adminUserLimit: 10,
    merchantLimit: 100,
    courierLimit: 50,
    isPublic: true,
    isPopular: false,
    sortOrder: 0,
    isActive: true,
    archivedAt: null,
    metadata: null,
    createdAt: new Date('2026-05-01T00:00:00.000Z'),
    updatedAt: new Date('2026-05-01T00:00:00.000Z'),
    featureFlags: [],
    ...overrides,
  };
}

function makeFeatureFlag(
  key: FeatureFlagKey,
  name: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    id: `flag-${key}`,
    planId: 'plan-1',
    featureKey: key,
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    featureFlag: { name },
    ...overrides,
  };
}

describe('PublicPlansService', () => {
  let service: PublicPlansService;
  let repository: jest.Mocked<PlatformPlansRepository>;

  beforeEach(() => {
    repository = {
      findPublicPlans: jest.fn(),
    } as unknown as jest.Mocked<PlatformPlansRepository>;

    service = new PublicPlansService(repository);
  });

  describe('findAll', () => {
    it('returns only active public non-archived plans from repository', async () => {
      const activePublicPlan = makePlan({
        id: 'plan-active',
        slug: 'starter',
        name: 'Starter',
      });

      repository.findPublicPlans.mockResolvedValueOnce([activePublicPlan]);

      const result = await service.findAll();

      expect(repository.findPublicPlans).toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('plan-active');
    });

    it('excludes internal fields from response', async () => {
      const plan = makePlan({
        featureFlags: [
          makeFeatureFlag(FeatureFlagKey.bulk_upload, 'Bulk Upload'),
        ],
      });

      repository.findPublicPlans.mockResolvedValueOnce([plan]);

      const result = await service.findAll();
      const responseKeys = Object.keys(result[0]);

      expect(responseKeys).not.toContain('adminUserLimit');
      expect(responseKeys).not.toContain('merchantLimit');
      expect(responseKeys).not.toContain('courierLimit');
      expect(responseKeys).not.toContain('metadata');
      expect(responseKeys).not.toContain('createdAt');
      expect(responseKeys).not.toContain('updatedAt');
      expect(responseKeys).not.toContain('archivedAt');
      expect(responseKeys).not.toContain('isActive');
      expect(responseKeys).not.toContain('isPublic');
      expect(responseKeys).not.toContain('subscriptions');
      expect(responseKeys).not.toContain('currentTenants');
    });

    it('maps feature flag names to features array', async () => {
      const plan = makePlan({
        featureFlags: [
          makeFeatureFlag(FeatureFlagKey.bulk_upload, 'Bulk Upload'),
          makeFeatureFlag(FeatureFlagKey.api_access, 'API Access'),
        ],
      });

      repository.findPublicPlans.mockResolvedValueOnce([plan]);

      const result = await service.findAll();

      expect(result[0].features).toEqual(['Bulk Upload', 'API Access']);
    });

    it('falls back to metadata.publicFeatures when no feature flag names exist', async () => {
      const plan = makePlan({
        featureFlags: [],
        metadata: {
          publicFeatures: ['Basic Tracking', 'COD Collection'],
        },
      });

      repository.findPublicPlans.mockResolvedValueOnce([plan]);

      const result = await service.findAll();

      expect(result[0].features).toEqual(['Basic Tracking', 'COD Collection']);
    });

    it('returns empty features when no flags and no metadata', async () => {
      const plan = makePlan({ featureFlags: [], metadata: null });

      repository.findPublicPlans.mockResolvedValueOnce([plan]);

      const result = await service.findAll();

      expect(result[0].features).toEqual([]);
    });

    it('does not expose raw feature flag keys', async () => {
      const plan = makePlan({
        featureFlags: [
          makeFeatureFlag(FeatureFlagKey.bulk_upload, 'Bulk Upload'),
        ],
      });

      repository.findPublicPlans.mockResolvedValueOnce([plan]);

      const result = await service.findAll();

      expect(result[0].features).toEqual(['Bulk Upload']);
      expect(result[0].features).not.toContain('bulk_upload');
    });

    it('serializes prices as strings', async () => {
      const plan = makePlan({
        monthlyPrice: new Prisma.Decimal('999.00'),
        yearlyPrice: new Prisma.Decimal('9990.00'),
      });

      repository.findPublicPlans.mockResolvedValueOnce([plan]);

      const result = await service.findAll();

      expect(result[0].priceMonthly).toBe('999.00');
      expect(result[0].priceYearly).toBe('9990.00');
    });

    it('returns null priceYearly when not set', async () => {
      const plan = makePlan({ yearlyPrice: null });

      repository.findPublicPlans.mockResolvedValueOnce([plan]);

      const result = await service.findAll();

      expect(result[0].priceYearly).toBeNull();
    });

    it('maps monthlyPrice to priceMonthly', async () => {
      const plan = makePlan({
        monthlyPrice: new Prisma.Decimal('500.00'),
      });

      repository.findPublicPlans.mockResolvedValueOnce([plan]);

      const result = await service.findAll();

      expect(result[0].priceMonthly).toBe('500.00');
    });

    it('maps monthlyShipmentLimit to shipmentLimit', async () => {
      const plan = makePlan({ monthlyShipmentLimit: 5000 });

      repository.findPublicPlans.mockResolvedValueOnce([plan]);

      const result = await service.findAll();

      expect(result[0].shipmentLimit).toBe(5000);
    });

    it('generates ctaHref from slug', async () => {
      const plan = makePlan({ slug: 'enterprise' });

      repository.findPublicPlans.mockResolvedValueOnce([plan]);

      const result = await service.findAll();

      expect(result[0].ctaHref).toBe('/request-demo?plan=enterprise');
      expect(result[0].ctaLabel).toBe('Request Demo');
    });

    it('sets isPopular from plan', async () => {
      const plan = makePlan({ isPopular: true });

      repository.findPublicPlans.mockResolvedValueOnce([plan]);

      const result = await service.findAll();

      expect(result[0].isPopular).toBe(true);
    });

    it('returns multiple plans in repository order (sorted by sortOrder then monthlyPrice)', async () => {
      const plan1 = makePlan({ id: 'plan-1', sortOrder: 0, monthlyPrice: new Prisma.Decimal('100.00') });
      const plan2 = makePlan({ id: 'plan-2', sortOrder: 1, monthlyPrice: new Prisma.Decimal('500.00') });

      repository.findPublicPlans.mockResolvedValueOnce([plan1, plan2]);

      const result = await service.findAll();

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('plan-1');
      expect(result[1].id).toBe('plan-2');
    });
  });
});