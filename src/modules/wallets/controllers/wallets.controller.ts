import {
  Controller,
  Get,
  Param,
  Query,
  ParseUUIDPipe,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { WalletsService } from '../services/wallets.service';
import { TransactionsService } from '../services/transactions.service';
import { Roles } from '@common/decorators/roles.decorator';
import { UserRole } from '@modules/users/entities/user.entity';
import { WalletTransactionsQueryDto } from '../dtos/wallet-transactions-query.dto';
import { EffectiveTenantId } from '@common/tenant/effective-tenant';

@ApiTags('Wallets')
@ApiBearerAuth()
@Controller('wallets')
export class WalletsController {
  constructor(
    private readonly walletsService: WalletsService,
    private readonly transactionsService: TransactionsService,
  ) {}

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.FINANCE_ADMIN)
  async findById(
    @Param('id', ParseUUIDPipe) id: string,
    @EffectiveTenantId() tenantId: string,
  ) {
    const wallet = await this.walletsService.findById(id, tenantId);
    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }
    return wallet;
  }

  @Get(':id/transactions')
  @Roles(UserRole.SUPER_ADMIN, UserRole.FINANCE_ADMIN)
  async getTransactions(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: WalletTransactionsQueryDto,
    @EffectiveTenantId() tenantId: string,
  ) {
    const wallet = await this.walletsService.findById(id, tenantId);
    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    return this.transactionsService.getTransactions(id, tenantId, {
      page: query.page,
      limit: query.limit,
      type: query.type,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
    });
  }
}
