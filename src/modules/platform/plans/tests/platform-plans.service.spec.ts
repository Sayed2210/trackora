import { ConflictException, NotFoundException } from '@nestjs/common';
import { FeatureFlagKey, Prisma } from '@prisma/client';
import { PlatformPlansRepository } from '../repositories/platform-plans.repository';
import { PlatformPlansService } from '../services/platform-plans.service';

const mockPlan = {
  id: '123e4567-e89b-42d3-a456-426614174000',
  name: 'Growth',
  slug: 'growth',
  description: 'Growth plan',
  monthlyPrice: new Prisma.Decimal('999.00'),
  currency: 'EGP',
  monthlyShipmentLimit: 10000,
  adminUserLimit: 10,
  merchantLimit: 100,
  courierLimit: 50,
  isActive: true,
  archivedAt: null,
  metadata: null,
  createdAt: new Date('2026-05-01T00:00:00.000Z'),
  updatedAt: new Date('2026-05-01T00:00:00.000Z'),
  featureFlags: [
    {
      id: 'flag-1',
      planId: '123e4567-e89b-42d3-a456-426614174000',
      featureKey: FeatureFlagKey.bulk_upload,
      enabled: true,
      createdAt: new Date('2026-05-01T00:00:00.000Z'),
      updatedAt: new Date('2026-05-01T00:00:00.000Z'),
    },
  ],
  _count: { subscriptions: 0 },
};

describe('PlatformPlansService', () => {
  let service: PlatformPlansService;
  let repository: jest.Mocked<PlatformPlansRepository>;

  beforeEach(() => {
    repository = {
      findMany: jest.fn(),
      count: jest.fn(),
      findById: jest.fn(),
      findByName: jest.fn(),
      findBySlug: jest.fn(),
      createWithFlags: jest.fn(),
      updateWithFlags: jest.fn(),
      getReferenceCounts: jest.fn(),
      archive: jest.fn(),
      delete: jest.fn(),
      toOrderBy: jest.fn().mockReturnValue({ createdAt: 'desc' }),
    } as unknown as jest.Mocked<PlatformPlansRepository>;

    service = new PlatformPlansService(repository);
  });

  it('creates plan with normalized feature flags', async () => {
    repository.findByName.mockResolvedValueOnce(null);
    repository.findBySlug.mockResolvedValueOnce(null);
    repository.createWithFlags.mockResolvedValueOnce(mockPlan as any);

    const result = await service.create({
      name: 'Growth',
      slug: 'growth',
      monthlyPrice: '999.00',
      featureEntitlements: [
        { key: FeatureFlagKey.bulk_upload, enabled: true },
      ],
    });

    expect(repository.createWithFlags).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Growth',
        slug: 'growth',
        monthlyPrice: expect.any(Prisma.Decimal),
        currency: 'EGP',
      }),
      expect.arrayContaining([
        { key: FeatureFlagKey.bulk_upload, enabled: true },
        { key: FeatureFlagKey.fraud_detection, enabled: false },
      ]),
    );
    expect(result).toMatchObject({
      id: mockPlan.id,
      monthlyPrice: '999',
      subscriptionCount: 0,
    });
  });

  it('rejects duplicate plan name', async () => {
    repository.findByName.mockResolvedValueOnce(mockPlan as any);

    await expect(
      service.create({ name: 'Growth', slug: 'growth-new', monthlyPrice: '999.00' }),
    ).rejects.toThrow(ConflictException);
  });

  it('throws 404 for missing plan', async () => {
    repository.findById.mockResolvedValueOnce(null);

    await expect(service.findById(mockPlan.id)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('updates plan and replaces flags when provided', async () => {
    repository.findById.mockResolvedValueOnce(mockPlan as any);
    repository.updateWithFlags.mockResolvedValueOnce({
      ...mockPlan,
      name: 'Growth Plus',
    } as any);

    const result = await service.update(mockPlan.id, {
      name: 'Growth Plus',
      featureEntitlements: [
        { key: FeatureFlagKey.api_access, enabled: true },
      ],
    });

    expect(repository.updateWithFlags).toHaveBeenCalledWith(
      mockPlan.id,
      { name: 'Growth Plus' },
      expect.arrayContaining([{ key: FeatureFlagKey.api_access, enabled: true }]),
    );
    expect(result.name).toBe('Growth Plus');
  });

  it('archives referenced plans instead of deleting unsafely', async () => {
    repository.findById.mockResolvedValueOnce(mockPlan as any);
    repository.getReferenceCounts.mockResolvedValueOnce({
      subscriptions: 1,
      currentTenants: 0,
    });
    repository.archive.mockResolvedValueOnce({
      ...mockPlan,
      isActive: false,
      archivedAt: new Date('2026-05-02T00:00:00.000Z'),
    } as any);

    const result = await service.remove(mockPlan.id);

    expect(repository.delete).not.toHaveBeenCalled();
    expect(repository.archive).toHaveBeenCalledWith(mockPlan.id);
    expect(result).toMatchObject({ isActive: false });
  });

  it('deletes unused plans', async () => {
    repository.findById.mockResolvedValueOnce(mockPlan as any);
    repository.getReferenceCounts.mockResolvedValueOnce({
      subscriptions: 0,
      currentTenants: 0,
    });
    repository.delete.mockResolvedValueOnce(undefined);

    await expect(service.remove(mockPlan.id)).resolves.toEqual({ deleted: true });
  });
});
