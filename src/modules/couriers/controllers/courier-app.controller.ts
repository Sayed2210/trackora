import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CourierAppService } from '../services/courier-app.service';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { UserRole } from '@modules/users/entities/user.entity';
import { UpdateTaskStatusDto } from '../dtos/update-task-status.dto';
import { CourierDepositDto } from '../dtos/courier-deposit.dto';
import { SyncUpdatesDto } from '../dtos/sync-updates.dto';

@ApiTags('Courier App')
@ApiBearerAuth()
@Controller('courier')
@UseGuards(JwtAuthGuard)
@Roles(UserRole.COURIER)
export class CourierAppController {
  constructor(private readonly courierAppService: CourierAppService) {}

  @Get('tasks')
  async getTasks() {
    // TODO: Extract courierId from authenticated user context
    return this.courierAppService.getTasks('temp-courier-id');
  }

  @Get('tasks/:shipmentId')
  async getTaskById(@Param('shipmentId', ParseUUIDPipe) shipmentId: string) {
    // TODO: Extract courierId from authenticated user context
    return this.courierAppService.getTaskById('temp-courier-id', shipmentId);
  }

  @Patch('tasks/:shipmentId/status')
  async updateTaskStatus(
    @Param('shipmentId', ParseUUIDPipe) shipmentId: string,
    @Body() dto: UpdateTaskStatusDto,
  ) {
    // TODO: Extract courierId from authenticated user context
    return this.courierAppService.updateTaskStatus(
      'temp-courier-id',
      shipmentId,
      dto,
    );
  }

  @Post('deposits')
  async logDeposit(@Body() dto: CourierDepositDto) {
    // TODO: Extract courierId from authenticated user context
    return this.courierAppService.logDeposit('temp-courier-id', dto);
  }

  @Get('performance')
  async getPerformance() {
    // TODO: Extract courierId from authenticated user context
    return this.courierAppService.getPerformance('temp-courier-id');
  }

  @Post('sync')
  async syncUpdates(@Body() dto: SyncUpdatesDto) {
    // TODO: Extract courierId from authenticated user context
    return this.courierAppService.syncUpdates('temp-courier-id', dto);
  }
}
