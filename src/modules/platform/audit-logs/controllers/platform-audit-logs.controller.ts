import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiUnauthorizedResponse,
  ApiTags,
} from '@nestjs/swagger';
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
  @ApiOperation({
    summary: 'List platform audit logs',
    description:
      'Returns paginated platform audit entries with actor, tenant, action, resource, date, search, and sort filters. Requires `view_audit_logs` permission. Sensitive request internals are not exposed.',
  })
  @ApiOkResponse({
    description: 'Paginated audit log list.',
    schema: {
      example: {
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  @ApiForbiddenResponse({
    description:
      'Authenticated user is not a platform user or lacks `view_audit_logs`.',
  })
  async findAll(@Query() query: ListAuditLogsQueryDto) {
    return this.auditLogService.findAll(query);
  }
}
