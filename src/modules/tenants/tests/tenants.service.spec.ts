import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { TenantStatus } from '@prisma/client';
import { TenantsRepository } from '../repositories/tenants.repository';
import { TenantsService } from '../services/tenants.service';

const mockTenant = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  name: 'Cairo Express',
  slug: 'cairo-express',
  status: TenantStatus.TRIAL,
  trialStartsAt: new Date('2026-05-01T00:00:00.000Z'),
  trialEndsAt: new Date('2026-05-15T00:00:00.000Z'),
  currentPlanId: null,
  metadata: null,
  createdAt: new Date('2026-05-01T00:00:00.000Z'),
  updatedAt: new Date('2026-05-01T00:00:00.000Z'),
};

describe('TenantsService', () => {
  let service: TenantsService;
  let repository: jest.Mocked<TenantsRepository>;

  beforeEach(() => {
    repository = {
      create: jest.fn(),
      findBySlug: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
    } as unknown as jest.Mocked<TenantsRepository>;

    service = new TenantsService(repository);
  });

  it('creates tenant when slug is available', async () => {
    repository.findBySlug.mockResolvedValueOnce(null);
    repository.create.mockResolvedValueOnce(mockTenant);

    const result = await service.create({
      name: 'Cairo Express',
      slug: 'cairo-express',
    });

    expect(repository.create).toHaveBeenCalledWith({
      name: 'Cairo Express',
      slug: 'cairo-express',
      trialStartsAt: undefined,
      trialEndsAt: undefined,
      metadata: undefined,
    });
    expect(result).toEqual(mockTenant);
  });

  it('rejects duplicate slug on create', async () => {
    repository.findBySlug.mockResolvedValueOnce(mockTenant);

    await expect(
      service.create({ name: 'Other', slug: 'cairo-express' }),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects invalid trial date range', async () => {
    repository.findBySlug.mockResolvedValueOnce(null);

    await expect(
      service.create({
        name: 'Cairo Express',
        slug: 'cairo-express',
        trialStartsAt: new Date('2026-05-15T00:00:00.000Z'),
        trialEndsAt: new Date('2026-05-01T00:00:00.000Z'),
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('lists tenants with pagination and search', async () => {
    repository.findMany.mockResolvedValueOnce([mockTenant]);
    repository.count.mockResolvedValueOnce(1);

    const result = await service.findAll({
      status: TenantStatus.TRIAL,
      search: 'cairo',
      page: 2,
      limit: 10,
    });

    expect(repository.findMany).toHaveBeenCalledWith(
      {
        status: TenantStatus.TRIAL,
        OR: [
          { name: { contains: 'cairo', mode: 'insensitive' } },
          { slug: { contains: 'cairo', mode: 'insensitive' } },
        ],
      },
      10,
      10,
    );
    expect(result).toEqual({ data: [mockTenant], total: 1, page: 2, limit: 10 });
  });

  it('throws when tenant is not found', async () => {
    repository.findById.mockResolvedValueOnce(null);

    await expect(service.findById(mockTenant.id)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('updates tenant when slug remains unique', async () => {
    repository.findById.mockResolvedValueOnce(mockTenant);
    repository.findBySlug.mockResolvedValueOnce(null);
    repository.update.mockResolvedValueOnce({ ...mockTenant, slug: 'new-slug' });

    const result = await service.update(mockTenant.id, { slug: 'new-slug' });

    expect(repository.update).toHaveBeenCalledWith(mockTenant.id, {
      slug: 'new-slug',
    });
    expect(result.slug).toBe('new-slug');
  });

  it('changes tenant status', async () => {
    repository.findById.mockResolvedValueOnce(mockTenant);
    repository.update.mockResolvedValueOnce({
      ...mockTenant,
      status: TenantStatus.SUSPENDED,
    });

    const result = await service.changeStatus(mockTenant.id, {
      status: TenantStatus.SUSPENDED,
    });

    expect(repository.update).toHaveBeenCalledWith(mockTenant.id, {
      status: TenantStatus.SUSPENDED,
    });
    expect(result.status).toBe(TenantStatus.SUSPENDED);
  });
});
