import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  ParseUUIDPipe,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { CourierAppService } from '../services/courier-app.service';
import { Roles } from '@common/decorators/roles.decorator';
import { UserRole } from '@modules/users/entities/user.entity';
import { UpdateTaskStatusDto } from '../dtos/update-task-status.dto';
import { CourierDepositDto } from '../dtos/courier-deposit.dto';
import { SyncUpdatesDto } from '../dtos/sync-updates.dto';

interface RequestWithUser extends Request {
  user: { userId: string; role: UserRole };
}

@ApiTags('Courier App')
@ApiBearerAuth()
@Controller('courier')
@Roles(UserRole.COURIER)
export class CourierAppController {
  constructor(private readonly courierAppService: CourierAppService) {}

  @Get('tasks')
  async getTasks(@Req() req: RequestWithUser) {
    return this.courierAppService.getTasks(req.user.userId);
  }

  @Get('tasks/:shipmentId')
  async getTaskById(
    @Param('shipmentId', ParseUUIDPipe) shipmentId: string,
    @Req() req: RequestWithUser,
  ) {
    return this.courierAppService.getTaskById(req.user.userId, shipmentId);
  }

  @Patch('tasks/:shipmentId/status')
  async updateTaskStatus(
    @Param('shipmentId', ParseUUIDPipe) shipmentId: string,
    @Body() dto: UpdateTaskStatusDto,
    @Req() req: RequestWithUser,
  ) {
    return this.courierAppService.updateTaskStatus(
      req.user.userId,
      shipmentId,
      dto,
    );
  }

  @Post('deposits')
  async logDeposit(@Body() dto: CourierDepositDto, @Req() req: RequestWithUser) {
    return this.courierAppService.logDeposit(req.user.userId, dto);
  }

  @Get('performance')
  async getPerformance(@Req() req: RequestWithUser) {
    return this.courierAppService.getPerformance(req.user.userId);
  }

  @Post('sync')
  async syncUpdates(@Body() dto: SyncUpdatesDto, @Req() req: RequestWithUser) {
    return this.courierAppService.syncUpdates(req.user.userId, dto);
  }
}