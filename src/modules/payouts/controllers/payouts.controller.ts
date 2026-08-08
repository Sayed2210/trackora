import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { UserRole } from '@modules/users/entities/user.entity';
import { Roles } from '@common/decorators/roles.decorator';
import { CreatePayoutDto } from '../dtos/create-payout.dto';
import { ListPayoutsDto } from '../dtos/list-payouts.dto';
import { CompletePayoutDto } from '../dtos/complete-payout.dto';
import { RejectPayoutDto } from '../dtos/reject-payout.dto';
import {
  PaginatedPayoutsResponseDto,
  PayoutResponseDto,
} from '../dtos/payout-response.dto';
import { PayoutsService } from '../services/payouts.service';
import { EffectiveTenantId } from '@common/tenant/effective-tenant';

interface RequestWithUser extends Request {
  user: { userId: string; role: UserRole };
}

@ApiTags('Payouts')
@ApiBearerAuth()
@Controller('payouts')
export class PayoutsController {
  constructor(private readonly payoutsService: PayoutsService) {}

  @Get()
  @Roles(UserRole.MERCHANT, UserRole.SUPER_ADMIN, UserRole.FINANCE_ADMIN)
  @ApiOkResponse({ type: PaginatedPayoutsResponseDto })
  async findAll(
    @Query() query: ListPayoutsDto,
    @Req() req: RequestWithUser,
    @EffectiveTenantId() tenantId: string,
  ) {
    return this.payoutsService.findAll(query, req.user, tenantId);
  }

  @Post()
  @Roles(UserRole.MERCHANT)
  @ApiCreatedResponse({ type: PayoutResponseDto })
  async create(
    @Body() dto: CreatePayoutDto,
    @Req() req: RequestWithUser,
    @EffectiveTenantId() tenantId: string,
  ) {
    return this.payoutsService.requestPayout(req.user.userId, dto, tenantId);
  }

  @Patch(':id/approve')
  @Roles(UserRole.SUPER_ADMIN, UserRole.FINANCE_ADMIN)
  @ApiOkResponse({ type: PayoutResponseDto })
  async approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithUser,
    @EffectiveTenantId() tenantId: string,
  ) {
    return this.payoutsService.approve(id, req.user.userId, tenantId);
  }

  @Patch(':id/complete')
  @Roles(UserRole.SUPER_ADMIN, UserRole.FINANCE_ADMIN)
  @ApiOkResponse({ type: PayoutResponseDto })
  async complete(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CompletePayoutDto,
    @EffectiveTenantId() tenantId: string,
  ) {
    return this.payoutsService.complete(id, dto.referenceNumber, tenantId);
  }

  @Patch(':id/reject')
  @Roles(UserRole.SUPER_ADMIN, UserRole.FINANCE_ADMIN)
  @ApiOkResponse({ type: PayoutResponseDto })
  async reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectPayoutDto,
    @EffectiveTenantId() tenantId: string,
  ) {
    return this.payoutsService.reject(id, dto.reason, tenantId);
  }
}
