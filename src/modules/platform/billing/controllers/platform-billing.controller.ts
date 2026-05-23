import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiUnauthorizedResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { PERMISSIONS } from '@common/constants/permissions.constant';
import { PlatformPermissions } from '@common/decorators/platform-permissions.decorator';
import { DangerousAction } from '@common/decorators/dangerous-action.decorator';
import { PlatformOnlyGuard } from '@common/guards/platform-only.guard';
import { AuthenticatedRequestUser } from '@common/interfaces/request-context.interface';
import {
  BillingExportFormat,
  BillingExportQueryDto,
  CreateManualInvoiceDto,
  InvoiceIdParamDto,
  ListInvoicesQueryDto,
  TenantBillingParamDto,
  UpdateManualInvoiceDto,
} from '../dtos';
import { PlatformBillingService } from '../services/platform-billing.service';

interface AuthenticatedRequest {
  user: AuthenticatedRequestUser;
  ip?: string;
  headers: { 'user-agent'?: string };
}

@ApiTags('Platform Billing')
@ApiBearerAuth()
@UseGuards(PlatformOnlyGuard)
@Controller('platform')
export class PlatformBillingController {
  constructor(private readonly billingService: PlatformBillingService) {}

  @Get('billing/overview')
  @PlatformPermissions(PERMISSIONS.VIEW_BILLING)
  @ApiOperation({
    summary: 'Get platform billing overview',
    description:
      'Returns high-level billing totals for the platform owner dashboard. Requires `view_billing` permission.',
  })
  @ApiOkResponse({ description: 'Platform billing overview.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  @ApiForbiddenResponse({
    description:
      'Authenticated user is not a platform user or lacks `view_billing`.',
  })
  async overview() {
    return this.billingService.getOverview();
  }

  @Get('billing/invoices')
  @PlatformPermissions(PERMISSIONS.VIEW_BILLING)
  @ApiOperation({
    summary: 'List manual invoices',
    description:
      'Returns paginated manual invoices with tenant, status, date, search, and sort filters. Requires `view_billing` permission.',
  })
  @ApiOkResponse({
    description: 'Paginated invoice list.',
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
      'Authenticated user is not a platform user or lacks `view_billing`.',
  })
  async findInvoices(@Query() query: ListInvoicesQueryDto) {
    return this.billingService.findInvoices(query);
  }

  @Post('billing/invoices')
  @PlatformPermissions(PERMISSIONS.VIEW_BILLING)
  @DangerousAction('billing invoice mutations')
  @ApiOperation({
    summary: 'Create manual invoice',
    description:
      'Creates a manual billing invoice for a tenant. Requires `view_billing` currently, a body `reason`, and is blocked during impersonation. Restricted to platform billing operators.',
  })
  @ApiCreatedResponse({ description: 'Manual invoice created.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  @ApiForbiddenResponse({
    description:
      'Authenticated user is not a platform user, lacks `view_billing`, or is impersonating.',
  })
  @ApiNotFoundResponse({ description: 'Tenant was not found.' })
  @ApiConflictResponse({
    description: 'Invoice conflicts with existing billing state.',
  })
  async createInvoice(
    @Body() dto: CreateManualInvoiceDto,
    @Req() request?: AuthenticatedRequest,
  ) {
    // TODO(permissions): require view_billing + manage_subscriptions when AND permission composition exists.
    const audit = this.toAuditContext(request);
    return audit
      ? this.billingService.createInvoice(dto, audit)
      : this.billingService.createInvoice(dto);
  }

  @Patch('billing/invoices/:id')
  @PlatformPermissions(PERMISSIONS.VIEW_BILLING)
  @DangerousAction('billing invoice mutations')
  @ApiOperation({
    summary: 'Update manual invoice',
    description:
      'Updates manual invoice amount, status, payment status, due date, paid date, or notes. Requires `view_billing` currently, a body `reason`, and is blocked during impersonation.',
  })
  @ApiOkResponse({ description: 'Manual invoice updated.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  @ApiForbiddenResponse({
    description:
      'Authenticated user is not a platform user, lacks `view_billing`, or is impersonating.',
  })
  @ApiNotFoundResponse({ description: 'Invoice was not found.' })
  @ApiConflictResponse({
    description: 'Invoice update conflicts with current billing state.',
  })
  async updateInvoice(
    @Param() params: InvoiceIdParamDto,
    @Body() dto: UpdateManualInvoiceDto,
    @Req() request?: AuthenticatedRequest,
  ) {
    const audit = this.toAuditContext(request);
    return audit
      ? this.billingService.updateInvoice(params.id, dto, audit)
      : this.billingService.updateInvoice(params.id, dto);
  }

  @Get('tenants/:id/billing')
  @PlatformPermissions(PERMISSIONS.VIEW_BILLING)
  @ApiOperation({
    summary: 'Get tenant billing summary',
    description:
      'Returns billing summary for one tenant. Requires `view_billing` permission.',
  })
  @ApiOkResponse({ description: 'Tenant billing summary.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  @ApiForbiddenResponse({
    description:
      'Authenticated user is not a platform user or lacks `view_billing`.',
  })
  @ApiNotFoundResponse({ description: 'Tenant was not found.' })
  async tenantBilling(@Param() params: TenantBillingParamDto) {
    return this.billingService.getTenantBilling(params.id);
  }

  @Get('billing/export')
  @PlatformPermissions(PERMISSIONS.VIEW_BILLING)
  @ApiOperation({
    summary: 'Export billing invoices',
    description:
      'Exports invoices for a required date range as JSON or CSV. Requires `view_billing` permission.',
  })
  @ApiProduces('application/json', 'text/csv')
  @ApiOkResponse({
    description: 'Invoice export payload. CSV requests return `text/csv`.',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  @ApiForbiddenResponse({
    description:
      'Authenticated user is not a platform user or lacks `view_billing`.',
  })
  async exportInvoices(
    @Query() query: BillingExportQueryDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    if (query.format === BillingExportFormat.CSV) {
      response.type('text/csv');
    }
    return this.billingService.exportInvoices(query);
  }

  private toAuditContext(request?: AuthenticatedRequest) {
    if (!request) return undefined;
    return {
      user: request.user,
      ipAddress: request.ip,
      userAgent: request.headers?.['user-agent'],
    };
  }
}
