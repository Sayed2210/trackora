import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DemoRequestStatus, UserRole } from '@prisma/client';
import { PlatformAuditLogService } from '@modules/platform/audit-logs/services/platform-audit-log.service';
import { DemoRequestsRepository } from '../repositories/demo-requests.repository';
import { DemoRequestsService } from '../services/demo-requests.service';
import { DemoRequestSortField, DemoRequestSortDirection } from '../dtos';

const demoRequestId = '123e4567-e89b-42d3-a456-426614174000';
const actorUserId = '123e4567-e89b-42d3-a456-426614174001';

function makeRecord(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: demoRequestId,
    name: 'Ahmed Ali',
    companyName: 'Cairo Express',
    phone: '01012345678',
    email: 'ahmed@cairoexpress.com',
    businessType: 'E-commerce',
    monthlyShipments: '500-1000',
    message: 'I want a demo',
    interestedPlanSlug: 'growth',
    status: DemoRequestStatus.NEW,
    contactedAt: null,
    notes: null,
    ipAddress: '::1',
    userAgent: 'curl/8',
    createdAt: new Date('2026-06-20T10:00:00.000Z'),
    updatedAt: new Date('2026-06-20T10:00:00.000Z'),
    ...overrides,
  };
}

const actor = {
  userId: actorUserId,
  role: UserRole.PLATFORM_OWNER,
  permissions: [],
};

describe('DemoRequestsService', () => {
  let service: DemoRequestsService;
  let repository: jest.Mocked<DemoRequestsRepository>;
  let auditLogService: { writeAuditLog: jest.Mock };

  beforeEach(() => {
    repository = {
      buildListWhere: jest.fn().mockReturnValue({}),
      findMany: jest.fn(),
      count: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      toOrderBy: jest.fn().mockReturnValue({ createdAt: 'desc' }),
    } as unknown as jest.Mocked<DemoRequestsRepository>;
    auditLogService = { writeAuditLog: jest.fn().mockResolvedValue({}) };
    service = new DemoRequestsService(
      repository,
      auditLogService as unknown as PlatformAuditLogService,
    );
  });

  describe('listDemoRequests', () => {
    it('returns paginated results with meta including totalPages', async () => {
      repository.findMany.mockResolvedValueOnce([makeRecord()]);
      repository.count.mockResolvedValueOnce(25);

      const result = await service.listDemoRequests({
        page: 2,
        limit: 20,
      });

      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({
        page: 2,
        limit: 20,
        total: 25,
        totalPages: 2,
      });
      expect(repository.findMany).toHaveBeenCalledWith(
        {},
        { createdAt: 'desc' },
        20,
        20,
      );
    });

    it('returns totalPages=0 when no records exist', async () => {
      repository.findMany.mockResolvedValueOnce([]);
      repository.count.mockResolvedValueOnce(0);

      const result = await service.listDemoRequests({});

      expect(result.data).toEqual([]);
      expect(result.meta.totalPages).toBe(0);
      expect(result.meta.total).toBe(0);
    });

    it('applies default page=1 and limit=20 when not provided', async () => {
      repository.findMany.mockResolvedValueOnce([]);
      repository.count.mockResolvedValueOnce(0);

      await service.listDemoRequests({});

      expect(repository.findMany).toHaveBeenCalledWith(
        {},
        { createdAt: 'desc' },
        0,
        20,
      );
    });

    it('caps limit at 100', async () => {
      repository.findMany.mockResolvedValueOnce([]);
      repository.count.mockResolvedValueOnce(0);

      await service.listDemoRequests({
        limit: 500,
      });

      expect(repository.findMany).toHaveBeenCalledWith(
        {},
        { createdAt: 'desc' },
        0,
        100,
      );
    });

    it('passes filters and sort to repository', async () => {
      repository.findMany.mockResolvedValueOnce([]);
      repository.count.mockResolvedValueOnce(0);
      const builtWhere = { status: DemoRequestStatus.NEW };
      repository.buildListWhere.mockReturnValueOnce(builtWhere);
      repository.toOrderBy.mockReturnValueOnce({ createdAt: 'asc' });

      await service.listDemoRequests({
        status: DemoRequestStatus.NEW,
        businessType: 'E-commerce',
        search: 'cairo',
        sortBy: DemoRequestSortField.CREATED_AT,
        sortOrder: DemoRequestSortDirection.ASC,
      });

      expect(repository.buildListWhere).toHaveBeenCalledWith(
        expect.objectContaining({
          status: DemoRequestStatus.NEW,
          businessType: 'E-commerce',
          search: 'cairo',
        }),
      );
      expect(repository.toOrderBy).toHaveBeenCalledWith(
        DemoRequestSortField.CREATED_AT,
        DemoRequestSortDirection.ASC,
      );
      expect(repository.findMany).toHaveBeenCalledWith(
        builtWhere,
        { createdAt: 'asc' },
        0,
        20,
      );
    });

    it('throws BadRequestException when from > to', async () => {
      await expect(
        service.listDemoRequests({
          from: new Date('2026-06-21'),
          to: new Date('2026-06-20'),
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getDemoRequestById', () => {
    it('returns the demo request when found', async () => {
      repository.findById.mockResolvedValueOnce(makeRecord());

      const result = await service.getDemoRequestById(demoRequestId);

      expect(result.id).toBe(demoRequestId);
      expect(result.name).toBe('Ahmed Ali');
      expect(repository.findById).toHaveBeenCalledWith(demoRequestId);
    });

    it('throws NotFoundException when not found', async () => {
      repository.findById.mockResolvedValueOnce(null);

      await expect(service.getDemoRequestById(demoRequestId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateDemoRequest', () => {
    it('updates status and writes an audit log', async () => {
      repository.findById.mockResolvedValueOnce(makeRecord());
      repository.update.mockResolvedValueOnce(
        makeRecord({ status: DemoRequestStatus.CONTACTED }),
      );

      const result = await service.updateDemoRequest(
        demoRequestId,
        { status: DemoRequestStatus.CONTACTED },
        { user: actor },
      );

      expect(result.status).toBe(DemoRequestStatus.CONTACTED);
      expect(repository.update).toHaveBeenCalledWith(
        demoRequestId,
        expect.objectContaining({
          status: DemoRequestStatus.CONTACTED,
        }),
      );
      const updateData = repository.update.mock.calls[0][1];
      expect(updateData.contactedAt).toBeInstanceOf(Date);
      expect(auditLogService.writeAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'demo_request.updated',
          resourceType: 'DemoRequest',
          resourceId: demoRequestId,
          user: actor,
        }),
      );
    });

    it('auto-sets contactedAt when status becomes CONTACTED and it is null', async () => {
      repository.findById.mockResolvedValueOnce(makeRecord());
      repository.update.mockResolvedValueOnce(
        makeRecord({
          status: DemoRequestStatus.CONTACTED,
          contactedAt: new Date(),
        }),
      );

      await service.updateDemoRequest(
        demoRequestId,
        { status: DemoRequestStatus.CONTACTED },
        { user: actor },
      );

      const updateCall = repository.update.mock.calls[0];
      expect(updateCall[1]).toEqual(
        expect.objectContaining({
          status: DemoRequestStatus.CONTACTED,
        }),
      );
      expect(updateCall[1].contactedAt).toBeInstanceOf(Date);
    });

    it('does not override contactedAt when explicitly provided', async () => {
      repository.findById.mockResolvedValueOnce(makeRecord());
      const explicitDate = new Date('2026-06-15T12:00:00.000Z');
      repository.update.mockResolvedValueOnce(
        makeRecord({
          status: DemoRequestStatus.CONTACTED,
          contactedAt: explicitDate,
        }),
      );

      await service.updateDemoRequest(
        demoRequestId,
        {
          status: DemoRequestStatus.CONTACTED,
          contactedAt: explicitDate,
        },
        { user: actor },
      );

      const updateData = repository.update.mock.calls[0][1];
      expect(updateData.contactedAt).toBe(explicitDate);
    });

    it('updates notes only', async () => {
      repository.findById.mockResolvedValueOnce(makeRecord());
      repository.update.mockResolvedValueOnce(
        makeRecord({ notes: 'Called, no answer' }),
      );

      const result = await service.updateDemoRequest(
        demoRequestId,
        { notes: 'Called, no answer' },
        { user: actor },
      );

      expect(result.notes).toBe('Called, no answer');
      expect(repository.update).toHaveBeenCalledWith(demoRequestId, {
        notes: 'Called, no answer',
      });
    });

    it('throws NotFoundException when demo request does not exist', async () => {
      repository.findById.mockResolvedValueOnce(null);

      await expect(
        service.updateDemoRequest(
          demoRequestId,
          { status: DemoRequestStatus.QUALIFIED },
          { user: actor },
        ),
      ).rejects.toThrow(NotFoundException);
      expect(repository.update).not.toHaveBeenCalled();
      expect(auditLogService.writeAuditLog).not.toHaveBeenCalled();
    });

    it('writes audit log with oldValue and newValue', async () => {
      const existing = makeRecord();
      repository.findById.mockResolvedValueOnce(existing);
      const updated = makeRecord({ status: DemoRequestStatus.QUALIFIED });
      repository.update.mockResolvedValueOnce(updated);

      await service.updateDemoRequest(
        demoRequestId,
        { status: DemoRequestStatus.QUALIFIED },
        { user: actor, ipAddress: '10.0.0.1', userAgent: 'test-agent' },
      );

      const calls = auditLogService.writeAuditLog.mock.calls as Array<
        [
          {
            oldValue?: { status: DemoRequestStatus };
            newValue?: { status: DemoRequestStatus };
            ipAddress?: string;
            userAgent?: string;
          },
        ]
      >;
      const auditCall = calls[0][0];
      expect(auditCall.oldValue?.status).toBe(DemoRequestStatus.NEW);
      expect(auditCall.newValue?.status).toBe(DemoRequestStatus.QUALIFIED);
      expect(auditCall.ipAddress).toBe('10.0.0.1');
      expect(auditCall.userAgent).toBe('test-agent');
    });
  });
});
