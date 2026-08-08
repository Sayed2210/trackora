import {
  BadRequestException,
  Controller,
  ForbiddenException,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { PrismaService } from '@core/prisma/prisma.service';
import { Roles } from '@common/decorators/roles.decorator';
import { AuthenticatedRequestUser } from '@common/interfaces/request-context.interface';
import { EffectiveTenantId } from '@common/tenant/effective-tenant';
import { UserRole } from '@modules/users/entities/user.entity';
import { BulkUploadService } from '@modules/shipments/services/bulk-upload.service';
import { BulkUploadResultDto } from '@modules/shipments/dtos/bulk-upload-result.dto';
import { PlatformAuditLogService } from '@modules/platform/audit-logs/services/platform-audit-log.service';

interface AdminBulkUploadRequest extends Request {
  user: AuthenticatedRequestUser;
}

const ADMIN_BULK_UPLOAD_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.OPERATIONS_MANAGER,
];

@ApiTags('Admin')
@ApiBearerAuth()
@Controller('admin')
@Roles(UserRole.SUPER_ADMIN, UserRole.OPERATIONS_MANAGER)
export class AdminShipmentBulkUploadController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bulkUploadService: BulkUploadService,
    private readonly auditLogService: PlatformAuditLogService,
  ) {}

  @Post('merchants/:merchantId/shipments/bulk-upload')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Bulk import shipments for a selected Merchant',
    description:
      'Tenant Admins can upload only for an active Merchant in their own tenant. Platform users must first use the existing tenant impersonation flow.',
  })
  @ApiParam({
    name: 'merchantId',
    format: 'uuid',
    description: 'Merchant profile ID that will own every created shipment.',
  })
  @ApiBody({
    required: true,
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Excel workbook containing up to 5,000 shipments.',
        },
      },
    },
  })
  @ApiCreatedResponse({
    description:
      'Workbook processed. Invalid data rows are returned in the errors array.',
    type: BulkUploadResultDto,
  })
  @ApiBadRequestResponse({
    description:
      'Merchant ID is not a UUID, or the file is missing, unreadable, empty, exceeds the row limit, or contains row data that cannot be parsed.',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  @ApiForbiddenResponse({
    description:
      'Role is unauthorized, Merchant is inactive, Admin has no tenant context, or Merchant belongs to another tenant.',
  })
  @ApiNotFoundResponse({ description: 'Merchant was not found.' })
  @UseInterceptors(FileInterceptor('file'))
  async bulkUpload(
    @Param('merchantId', ParseUUIDPipe) merchantId: string,
    @UploadedFile() file: { buffer: Buffer } | undefined,
    @EffectiveTenantId() tenantId: string,
    @Req() request: AdminBulkUploadRequest,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    if (!ADMIN_BULK_UPLOAD_ROLES.includes(request.user.role)) {
      throw new ForbiddenException('Admin role cannot bulk upload shipments');
    }

    const admin = await this.prisma.user.findUnique({
      where: { id: request.user.userId },
      select: { id: true, tenantId: true, role: true, isActive: true },
    });
    if (
      !admin ||
      !admin.isActive ||
      admin.role !== request.user.role ||
      !ADMIN_BULK_UPLOAD_ROLES.includes(admin.role)
    ) {
      throw new ForbiddenException('Active tenant Admin profile is required');
    }
    if (!admin.tenantId || admin.tenantId !== tenantId) {
      throw new ForbiddenException('Invalid Admin tenant context');
    }

    const merchant = await this.prisma.merchant.findFirst({
      where: { id: merchantId, tenantId },
      select: { id: true, tenantId: true, isActive: true },
    });
    if (!merchant) {
      throw new NotFoundException('Merchant not found');
    }
    if (!merchant.isActive) {
      throw new ForbiddenException('Merchant profile is inactive');
    }
    const result = await this.bulkUploadService.processFile(file.buffer, {
      merchantId: merchant.id,
      tenantId,
      uploadedByUserId: request.user.userId,
      uploadedByRole: request.user.role,
    });

    const auditActor = await this.resolveAuditActor(request.user);
    await this.auditLogService.writeAuditLog({
      actorUserId: auditActor.id,
      actorRole: auditActor.role,
      tenantId,
      action: 'shipment.bulk-upload',
      resourceType: 'Merchant',
      resourceId: merchant.id,
      newValue: {
        merchantId: merchant.id,
        tenantId,
        totalRows: result.totalRows,
        successCount: result.successCount,
        failedCount: result.failedCount,
      },
      ipAddress: request.ip,
      userAgent: request.headers?.['user-agent'],
    });

    return result;
  }

  private async resolveAuditActor(user: AuthenticatedRequestUser) {
    const actorUserId = user.impersonationContext?.actorUserId;
    if (!actorUserId) {
      return { id: user.userId, role: user.role };
    }

    const actor = await this.prisma.user.findUnique({
      where: { id: actorUserId },
      select: { id: true, role: true },
    });
    return actor ?? { id: user.userId, role: user.role };
  }
}
