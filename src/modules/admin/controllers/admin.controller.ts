import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AdminDashboardService } from '../services/admin-dashboard.service';
import { ReportsService } from '../services/reports.service';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { UserRole } from '@modules/users/entities/user.entity';

@ApiTags('Admin')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(JwtAuthGuard)
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
  async getDashboard() {
    return this.adminDashboardService.getDashboard();
  }

  @Get('financial-summary')
  async getFinancialSummary() {
    return this.adminDashboardService.getFinancialSummary();
  }

  @Post('reports/daily')
  @ApiQuery({ name: 'date', required: true, type: String })
  async generateDailyReport(@Query('date') date: string) {
    return this.reportsService.generateDailyReport(date);
  }

  @Post('reports/courier-performance')
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  async generateCourierPerformanceReport(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reportsService.generateCourierPerformanceReport(
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    );
  }

  @Post('reports/merchant-delivery')
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  async generateMerchantDeliveryReport(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reportsService.generateMerchantDeliveryReport(
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    );
  }
}
