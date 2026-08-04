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
  ApiBadRequestResponse,
  ApiTags,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiQuery,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { MerchantsService } from '../services/merchants.service';
import { WalletsService } from '@modules/wallets/services/wallets.service';
import { Roles } from '@common/decorators/roles.decorator';
import { UserRole } from '@modules/users/entities/user.entity';
import { EffectiveTenantId } from '@common/tenant/effective-tenant';
import { KycStatus } from '../entities/merchant.entity';
import { CreateMerchantDto } from '../dtos/create-merchant.dto';
import { UpdateFeesDto } from '../dtos/update-fees.dto';
import { UpdateKycDto } from '../dtos/update-kyc.dto';
import { WalletTransactionsQueryDto } from '@modules/wallets/dtos/wallet-transactions-query.dto';
import {
  MerchantResponseDto,
  MerchantWalletResponseDto,
  PaginatedMerchantsResponseDto,
  PaginatedWalletTransactionsResponseDto,
} from '../dtos/merchant-response.dto';

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
  async create(
    @Body() dto: CreateMerchantDto,
    @Req() req: RequestWithUser,
    @EffectiveTenantId() tenantId: string,
  ) {
    return this.merchantsService.create(dto, req.user.userId, tenantId);
  }

  @Get()
  @ApiQuery({ name: 'kycStatus', required: false, enum: KycStatus })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiOkResponse({ type: PaginatedMerchantsResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid merchant query values.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  async findAll(
    @EffectiveTenantId() tenantId: string,
    @Query('kycStatus') kycStatus?: KycStatus,
    @Query('isActive') isActive?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.merchantsService.findAll(
      {
        kycStatus,
        isActive: isActive !== undefined ? isActive === 'true' : undefined,
        search,
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 20,
      },
      tenantId,
    );
  }

  @Get(':id')
  @ApiOkResponse({ type: MerchantResponseDto })
  @ApiBadRequestResponse({ description: 'Merchant id must be a UUID.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  @ApiNotFoundResponse({ description: 'Merchant was not found.' })
  async findById(
    @Param('id', ParseUUIDPipe) id: string,
    @EffectiveTenantId() tenantId: string,
  ) {
    return this.merchantsService.findById(id, tenantId);
  }

  @Patch(':id/kyc')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OPERATIONS_MANAGER)
  async updateKyc(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateKycDto,
    @EffectiveTenantId() tenantId: string,
  ) {
    return this.merchantsService.updateKycStatus(id, dto.status, tenantId);
  }

  @Patch(':id/fees')
  @Roles(UserRole.SUPER_ADMIN, UserRole.FINANCE_ADMIN)
  async updateFees(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFeesDto,
    @EffectiveTenantId() tenantId: string,
  ) {
    return this.merchantsService.updateFeeStructure(id, dto, tenantId);
  }

  @Get(':id/wallet')
  @Roles(UserRole.SUPER_ADMIN, UserRole.FINANCE_ADMIN, UserRole.MERCHANT)
  @ApiOkResponse({ type: MerchantWalletResponseDto })
  @ApiBadRequestResponse({ description: 'Merchant id must be a UUID.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  @ApiForbiddenResponse({ description: 'Wallet access is not permitted.' })
  @ApiNotFoundResponse({ description: 'Merchant wallet was not found.' })
  async getWallet(
    @Param('id', ParseUUIDPipe) id: string,
    @EffectiveTenantId() tenantId: string,
  ) {
    return this.walletsService.getBalance(id, tenantId);
  }

  @Get(':id/wallet/transactions')
  @Roles(UserRole.SUPER_ADMIN, UserRole.FINANCE_ADMIN, UserRole.MERCHANT)
  @ApiOkResponse({ type: PaginatedWalletTransactionsResponseDto })
  @ApiBadRequestResponse({
    description: 'Merchant id or transaction query values are invalid.',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  @ApiForbiddenResponse({ description: 'Wallet access is not permitted.' })
  @ApiNotFoundResponse({ description: 'Merchant wallet was not found.' })
  async getWalletTransactions(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: WalletTransactionsQueryDto,
    @EffectiveTenantId() tenantId: string,
  ) {
    return this.walletsService.getTransactions(id, tenantId, {
      type: query.type,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      page: query.page,
      limit: query.limit,
    });
  }
}
