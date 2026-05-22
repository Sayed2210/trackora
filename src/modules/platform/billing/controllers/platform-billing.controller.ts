import { Body, Controller, Get, Param, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { PERMISSIONS } from '@common/constants/permissions.constant';
import { PlatformPermissions } from '@common/decorators/platform-permissions.decorator';
import { PlatformOnlyGuard } from '@common/guards/platform-only.guard';
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

@ApiTags('Platform Billing')
@ApiBearerAuth()
@UseGuards(PlatformOnlyGuard)
@Controller('platform')
export class PlatformBillingController {
  constructor(private readonly billingService: PlatformBillingService) {}

  @Get('billing/overview')
  @PlatformPermissions(PERMISSIONS.VIEW_BILLING)
  @ApiOperation({ summary: 'Get platform billing overview' })
  async overview() {
    return this.billingService.getOverview();
  }

  @Get('billing/invoices')
  @PlatformPermissions(PERMISSIONS.VIEW_BILLING)
  @ApiOperation({ summary: 'List manual invoices' })
  async findInvoices(@Query() query: ListInvoicesQueryDto) {
    return this.billingService.findInvoices(query);
  }

  @Post('billing/invoices')
  @PlatformPermissions(PERMISSIONS.VIEW_BILLING)
  @ApiOperation({ summary: 'Create manual invoice' })
  async createInvoice(@Body() dto: CreateManualInvoiceDto) {
    // TODO(permissions): require view_billing + manage_subscriptions when AND permission composition exists.
    return this.billingService.createInvoice(dto);
  }

  @Patch('billing/invoices/:id')
  @PlatformPermissions(PERMISSIONS.VIEW_BILLING)
  @ApiOperation({ summary: 'Update manual invoice' })
  async updateInvoice(
    @Param() params: InvoiceIdParamDto,
    @Body() dto: UpdateManualInvoiceDto,
  ) {
    return this.billingService.updateInvoice(params.id, dto);
  }

  @Get('tenants/:id/billing')
  @PlatformPermissions(PERMISSIONS.VIEW_BILLING)
  @ApiOperation({ summary: 'Get tenant billing summary' })
  async tenantBilling(@Param() params: TenantBillingParamDto) {
    return this.billingService.getTenantBilling(params.id);
  }

  @Get('billing/export')
  @PlatformPermissions(PERMISSIONS.VIEW_BILLING)
  @ApiOperation({ summary: 'Export billing invoices' })
  async exportInvoices(
    @Query() query: BillingExportQueryDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    if (query.format === BillingExportFormat.CSV) {
      response.type('text/csv');
    }
    return this.billingService.exportInvoices(query);
  }
}
