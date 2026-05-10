import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AuditLogsController } from '../controllers/audit-logs.controller';
import { AuditLogService } from '../services/audit-log.service';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';

const mockAuditLogService = {
  findAll: jest.fn(),
};

const mockGuard = { canActivate: jest.fn(() => true) };

describe('AuditLogsController (integration)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [AuditLogsController],
      providers: [{ provide: AuditLogService, useValue: mockAuditLogService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockGuard)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /admin/audit-logs', () => {
    it('should return audit logs with default pagination', async () => {
      const logs = {
        data: [{ id: 'log-1', action: 'UPDATE' }],
        total: 1,
        page: 1,
        limit: 20,
      };
      mockAuditLogService.findAll.mockResolvedValue(logs);

      const res = await request(app.getHttpServer())
        .get('/admin/audit-logs')
        .expect(200);

      expect(res.body).toEqual(logs);
      expect(mockAuditLogService.findAll).toHaveBeenCalledWith({
        userId: undefined,
        action: undefined,
        entityType: undefined,
        entityId: undefined,
        from: undefined,
        to: undefined,
        page: 1,
        limit: 20,
      });
    });

    it('should filter by query params', async () => {
      const logs = {
        data: [],
        total: 0,
        page: 2,
        limit: 10,
      };
      mockAuditLogService.findAll.mockResolvedValue(logs);

      const res = await request(app.getHttpServer())
        .get(
          '/admin/audit-logs?userId=user-1&action=UPDATE&entityType=Shipment&entityId=ship-1&from=2024-05-01&to=2024-05-31&page=2&limit=10',
        )
        .expect(200);

      expect(res.body).toEqual(logs);
      expect(mockAuditLogService.findAll).toHaveBeenCalledWith({
        userId: 'user-1',
        action: 'UPDATE',
        entityType: 'Shipment',
        entityId: 'ship-1',
        from: new Date('2024-05-01'),
        to: new Date('2024-05-31'),
        page: 2,
        limit: 10,
      });
    });
  });
});
