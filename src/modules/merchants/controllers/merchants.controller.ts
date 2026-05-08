import {
  Controller,
  Post,
  Get,
  Param,
  Patch,
  Body,
  Query,
  ParseUUIDPipe,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { MerchantsService } from '../services/merchants.service';
import { WalletsService } from '@modules/wallets/services/wallets.service';
import { Roles } from '@common/decorators/roles.decorator';
import { UserRole } from '@modules/users/entities/user.entity';
import { KycStatus } from '../entities/merchant.entity';
import { CreateMerchantDto } from '../dtos/create-merchant.dto';
import { UpdateFeesDto } from '../dtos/update-fees.dto';

interface RequestWithUser extends Request {
  user: { userId: string; role: UserRole };
}

@ApiTags('Merchants')
@ApiBearerAuth()
@Controller('merchants')
export class MerchantsController {
  constructor(
    private readonly merchantsService: MerchantsService,
    private readonly walletsService: WalletsService,
  ) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.OPERATIONS_MANAGER)
  async create(@Body() dto: CreateMerchantDto, @Req() req: RequestWithUser) {
    return this.merchantsService.create(dto, req.user.userId);
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

  @Get(':id/wallet')
  @Roles(UserRole.SUPER_ADMIN, UserRole.FINANCE_ADMIN, UserRole.MERCHANT)
  async getWallet(@Param('id', ParseUUIDPipe) id: string) {
    return this.walletsService.getBalance(id);
  }

  @Get(':id/wallet/transactions')
  @Roles(UserRole.SUPER_ADMIN, UserRole.FINANCE_ADMIN, UserRole.MERCHANT)
  async getWalletTransactions(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('type') type?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.walletsService.getTransactions(id, {
      type: type as import('@prisma/client').TransactionType,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }
}
