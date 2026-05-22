import { Test, TestingModule } from '@nestjs/testing';
import { PERMISSIONS } from '@common/constants/permissions.constant';
import { PERMISSIONS_KEY } from '@common/decorators/permissions.decorator';
import { PlatformAuditLogsController } from '../controllers/platform-audit-logs.controller';
import { PlatformAuditLogService } from '../services/platform-audit-log.service';

describe('PlatformAuditLogsController', () => {
  let controller: PlatformAuditLogsController;
  let service: jest.Mocked<PlatformAuditLogService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PlatformAuditLogsController],
      providers: [
        {
          provide: PlatformAuditLogService,
          useValue: { findAll: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get(PlatformAuditLogsController);
    service = module.get(PlatformAuditLogService);
  });

  it('delegates audit log listing', async () => {
    const response = { data: [], total: 0, page: 1, limit: 20 };
    service.findAll.mockResolvedValueOnce(response as any);

    await expect(controller.findAll({ page: 1, limit: 20 })).resolves.toEqual(response);
  });

  it('requires view_audit_logs permission', () => {
    expect(Reflect.getMetadata(PERMISSIONS_KEY, controller.findAll)).toEqual([
      PERMISSIONS.VIEW_AUDIT_LOGS,
    ]);
  });
});
