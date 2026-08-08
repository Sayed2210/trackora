import { Controller, Get, Post, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AdminDashboardService } from '../services/admin-dashboard.service';
import { ReportsService } from '../services/reports.service';
import { Roles } from '@common/decorators/roles.decorator';
import { UserRole } from '@modules/users/entities/user.entity';
import { EffectiveTenantId } from '@common/tenant/effective-tenant';
import {
  AdminDashboardResponseDto,
  CourierPerformanceReportResponseDto,
  FinancialSummaryResponseDto,
  MerchantDeliveryReportResponseDto,
} from '../dtos/admin-response.dto';

@ApiTags('Admin')
@ApiBearerAuth()
@Controller('admin')
@Roles(
  UserRole.SUPER_ADMIN,
  UserRole.OPERATIONS_MANAGER,
  UserRole.FINANCE_ADMIN,
)
export class AdminController {
  constructor(
    private readonly adminDashboardService: AdminDashboardService,
    private readonly reportsService: ReportsService,
  ) {}

  @Get('dashboard')
  @ApiOkResponse({ type: AdminDashboardResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  @ApiForbiddenResponse({ description: 'Admin role is required.' })
  async getDashboard(@EffectiveTenantId() tenantId: string) {
    return this.adminDashboardService.getDashboard(tenantId);
  }

  @Get('financial-summary')
  @ApiOkResponse({ type: FinancialSummaryResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  @ApiForbiddenResponse({ description: 'Admin role is required.' })
  async getFinancialSummary(@EffectiveTenantId() tenantId: string) {
    return this.adminDashboardService.getFinancialSummary(tenantId);
  }

  @Post('reports/daily')
  @ApiQuery({ name: 'date', required: true, type: String })
  async generateDailyReport(
    @Query('date') date: string,
    @EffectiveTenantId() tenantId: string,
  ) {
    return this.reportsService.generateDailyReport(date, tenantId);
  }

  @Post('reports/courier-performance')
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiCreatedResponse({
    description: 'Courier performance report returned as JSON.',
    type: CourierPerformanceReportResponseDto,
    isArray: true,
  })
  @ApiBadRequestResponse({ description: 'Invalid report date range.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  @ApiForbiddenResponse({ description: 'Admin role is required.' })
  async generateCourierPerformanceReport(
    @EffectiveTenantId() tenantId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reportsService.generateCourierPerformanceReport(
      tenantId,
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    );
  }

  @Post('reports/merchant-delivery')
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiCreatedResponse({
    description: 'Merchant delivery report returned as JSON.',
    type: MerchantDeliveryReportResponseDto,
    isArray: true,
  })
  @ApiBadRequestResponse({ description: 'Invalid report date range.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  @ApiForbiddenResponse({ description: 'Admin role is required.' })
  async generateMerchantDeliveryReport(
    @EffectiveTenantId() tenantId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reportsService.generateMerchantDeliveryReport(
      tenantId,
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    );
  }
}
