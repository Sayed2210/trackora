import {
  Controller,
  Get,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { MerchantDashboardService } from '../services/merchant-dashboard.service';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { UserRole } from '@modules/users/entities/user.entity';

@ApiTags('Merchant Dashboard')
@ApiBearerAuth()
@Controller('merchant')
@UseGuards(JwtAuthGuard)
export class MerchantDashboardController {
  constructor(
    private readonly merchantDashboardService: MerchantDashboardService,
  ) {}

  @Get(':id/dashboard')
  @Roles(UserRole.MERCHANT, UserRole.SUPER_ADMIN, UserRole.OPERATIONS_MANAGER)
  async getDashboard(@Param('id', ParseUUIDPipe) id: string) {
    return this.merchantDashboardService.getDashboard(id);
  }

  @Get(':id/analytics')
  @ApiQuery({ name: 'days', required: false, type: Number })
  @Roles(UserRole.MERCHANT, UserRole.SUPER_ADMIN, UserRole.OPERATIONS_MANAGER)
  async getAnalytics(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('days') days?: string,
  ) {
    return this.merchantDashboardService.getAnalytics(
      id,
      days ? parseInt(days, 10) : 30,
    );
  }
}
