import { BadRequestException } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { PlatformAuditLogsRepository } from '../repositories/platform-audit-logs.repository';
import { PlatformAuditLogService } from '../services/platform-audit-log.service';

const actorUserId = '123e4567-e89b-42d3-a456-426614174000';
const tenantId = '123e4567-e89b-42d3-a456-426614174001';
const resourceId = '123e4567-e89b-42d3-a456-426614174002';

describe('PlatformAuditLogService', () => {
  let service: PlatformAuditLogService;
  let prisma: { auditLog: { create: jest.Mock } };
  let repository: jest.Mocked<PlatformAuditLogsRepository>;

  beforeEach(() => {
    prisma = {
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'log-id' }) },
    };
    repository = {
      findMany: jest.fn(),
      count: jest.fn(),
      toOrderBy: jest.fn().mockReturnValue({ createdAt: 'desc' }),
    } as unknown as jest.Mocked<PlatformAuditLogsRepository>;
    service = new PlatformAuditLogService(prisma as any, repository);
  });

  it('lists audit logs with filters and masks sensitive values', async () => {
    repository.findMany.mockResolvedValueOnce([
      {
        id: 'log-id',
        actorUserId,
        actorRole: UserRole.PLATFORM_ADMIN,
        tenantId,
        action: 'tenant.updated',
        entityType: 'Tenant',
        entityId: resourceId,
        resourceType: 'Tenant',
        resourceId,
        oldValue: { password: 'secret', nested: { otp: '1234', name: 'safe' } },
        newValue: { token: 'token', amount: new Prisma.Decimal('10.50') },
        reason: 'support request',
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla',
        createdAt: new Date('2026-05-01T00:00:00.000Z'),
      },
    ] as any);
    repository.count.mockResolvedValueOnce(1);

    const result = await service.findAll({
      actorUserId,
      tenantId,
      resourceId,
      search: 'support',
      page: 1,
      limit: 20,
    });

    expect(repository.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId,
        tenantId,
        resourceId,
        reason: { contains: 'support', mode: 'insensitive' },
      }),
      { createdAt: 'desc' },
      0,
      20,
    );
    expect(result.data[0].oldValue).toEqual({
      password: '[REDACTED]',
      nested: { otp: '[REDACTED]', name: 'safe' },
    });
    expect(result.data[0].newValue).toEqual({
      token: '[REDACTED]',
      amount: '10.5',
    });
  });

  it('writes masked audit logs with actor context', async () => {
    await service.writeAuditLog({
      user: {
        userId: actorUserId,
        role: UserRole.PLATFORM_FINANCE,
        permissions: [],
      },
      tenantId,
      action: 'manual_invoice.updated',
      resourceType: 'ManualInvoice',
      resourceId,
      oldValue: { cardNumber: '4111111111111111' },
      newValue: { amount: new Prisma.Decimal('250') },
      metadata: { sourceTenantId: tenantId, copiedScopes: ['metadata'] },
      reason: 'correction',
      ipAddress: '127.0.0.1',
      userAgent: 'Mozilla',
    });

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorUserId,
        actorRole: UserRole.PLATFORM_FINANCE,
        tenantId,
        action: 'manual_invoice.updated',
        entityType: 'ManualInvoice',
        resourceType: 'ManualInvoice',
        oldValue: { cardNumber: '[REDACTED]' },
        newValue: { amount: '250' },
        metadata: {
          sourceTenantId: tenantId,
          copiedScopes: ['metadata'],
        },
        reason: 'correction',
      }),
    });
  });

  it('rejects invalid date ranges', async () => {
    await expect(
      service.findAll({
        from: new Date('2026-05-02T00:00:00.000Z'),
        to: new Date('2026-05-01T00:00:00.000Z'),
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
