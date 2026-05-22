import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@common/constants/permissions.constant';
import { PlatformPermissions } from '@common/decorators/platform-permissions.decorator';
import { PlatformOnlyGuard } from '@common/guards/platform-only.guard';
import { ListAuditLogsQueryDto } from '../dtos';
import { PlatformAuditLogService } from '../services/platform-audit-log.service';

@ApiTags('Platform Audit Logs')
@ApiBearerAuth()
@UseGuards(PlatformOnlyGuard)
@Controller('platform/audit-logs')
export class PlatformAuditLogsController {
  constructor(private readonly auditLogService: PlatformAuditLogService) {}

  @Get()
  @PlatformPermissions(PERMISSIONS.VIEW_AUDIT_LOGS)
  @ApiOperation({ summary: 'List platform audit logs' })
  async findAll(@Query() query: ListAuditLogsQueryDto) {
    return this.auditLogService.findAll(query);
  }
}
