import {
  Controller,
  Post,
  Get,
  Param,
  Patch,
  Body,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { MerchantsService } from '../services/merchants.service';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { UserRole } from '@modules/users/entities/user.entity';
import { KycStatus } from '../entities/merchant.entity';
import { CreateMerchantDto } from '../dtos/create-merchant.dto';
import { UpdateFeesDto } from '../dtos/update-fees.dto';

@ApiTags('Merchants')
@ApiBearerAuth()
@Controller('merchants')
@UseGuards(JwtAuthGuard)
export class MerchantsController {
  constructor(private readonly merchantsService: MerchantsService) {}

  @Post()
  async create(@Body() dto: CreateMerchantDto) {
    return this.merchantsService.create(dto, 'temp-user-id');
  }

  @Get(':id')
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.merchantsService.findById(id);
  }

  @Patch(':id/kyc')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OPERATIONS_MANAGER)
  async updateKyc(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('status') status: KycStatus,
  ) {
    return this.merchantsService.updateKycStatus(id, status);
  }

  @Patch(':id/fees')
  @Roles(UserRole.SUPER_ADMIN, UserRole.FINANCE_ADMIN)
  async updateFees(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFeesDto,
  ) {
    return this.merchantsService.updateFeeStructure(id, dto);
  }
}
