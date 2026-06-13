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
import {
  ApiTags,
  ApiBearerAuth,
  ApiOkResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { Request } from 'express';
import { MerchantsService } from '../services/merchants.service';
import { WalletsService } from '@modules/wallets/services/wallets.service';
import { Roles } from '@common/decorators/roles.decorator';
import { UserRole } from '@modules/users/entities/user.entity';
import { KycStatus } from '../entities/merchant.entity';
import { CreateMerchantDto } from '../dtos/create-merchant.dto';
import { UpdateFeesDto } from '../dtos/update-fees.dto';
import { UpdateKycDto } from '../dtos/update-kyc.dto';
import { WalletTransactionsQueryDto } from '@modules/wallets/dtos/wallet-transactions-query.dto';

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

  @Get()
  @ApiQuery({ name: 'kycStatus', required: false, enum: KycStatus })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findAll(
    @Query('kycStatus') kycStatus?: KycStatus,
    @Query('isActive') isActive?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.merchantsService.findAll({
      kycStatus,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      search,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Get(':id')
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.merchantsService.findById(id);
  }

  @Patch(':id/kyc')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OPERATIONS_MANAGER)
  async updateKyc(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateKycDto,
  ) {
    return this.merchantsService.updateKycStatus(id, dto.status);
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
  @ApiOkResponse({ description: 'Merchant wallet balance' })
  async getWallet(@Param('id', ParseUUIDPipe) id: string) {
    return this.walletsService.getBalance(id);
  }

  @Get(':id/wallet/transactions')
  @Roles(UserRole.SUPER_ADMIN, UserRole.FINANCE_ADMIN, UserRole.MERCHANT)
  async getWalletTransactions(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: WalletTransactionsQueryDto,
  ) {
    return this.walletsService.getTransactions(id, {
      type: query.type,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      page: query.page,
      limit: query.limit,
    });
  }
}
