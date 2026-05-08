import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiQuery, ApiConsumes } from '@nestjs/swagger';
import { ShipmentsService } from '../services/shipments.service';
import { BulkUploadService } from '../services/bulk-upload.service';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { UserRole } from '@modules/users/entities/user.entity';
import { ShipmentStatus } from '../entities/shipment.entity';
import { CreateShipmentDto } from '../dtos/create-shipment.dto';
import { UpdateShipmentStatusDto } from '../dtos/update-shipment-status.dto';

@ApiTags('Shipments')
@ApiBearerAuth()
@Controller('shipments')
@UseGuards(JwtAuthGuard)
export class ShipmentsController {
  constructor(
    private readonly shipmentsService: ShipmentsService,
    private readonly bulkUploadService: BulkUploadService,
  ) {}

  @Post()
  @Roles(UserRole.MERCHANT)
  async create(@Body() dto: CreateShipmentDto) {
    return this.shipmentsService.create(dto, 'temp-merchant-id');
  }

  @Post('bulk-upload')
  @Roles(UserRole.MERCHANT)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async bulkUpload(@UploadedFile() file: { buffer: Buffer } | undefined) {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    return this.bulkUploadService.processFile(file.buffer, 'temp-merchant-id');
  }

  @Get()
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ShipmentStatus,
    isArray: true,
  })
  @ApiQuery({ name: 'merchantId', required: false })
  @ApiQuery({ name: 'courierId', required: false })
  @ApiQuery({ name: 'zoneId', required: false })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'trackingNumber', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findAll(
    @Query('status') status?: ShipmentStatus | ShipmentStatus[],
    @Query('merchantId') merchantId?: string,
    @Query('courierId') courierId?: string,
    @Query('zoneId') zoneId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('trackingNumber') trackingNumber?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.shipmentsService.findAll(
      {
        status,
        merchantId,
        courierId,
        zoneId,
        from: from ? new Date(from) : undefined,
        to: to ? new Date(to) : undefined,
        trackingNumber,
        search,
      },
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Get('cursor')
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ShipmentStatus,
    isArray: true,
  })
  @ApiQuery({ name: 'merchantId', required: false })
  @ApiQuery({ name: 'courierId', required: false })
  @ApiQuery({ name: 'zoneId', required: false })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'trackingNumber', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'cursor', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findAllCursor(
    @Query('status') status?: ShipmentStatus | ShipmentStatus[],
    @Query('merchantId') merchantId?: string,
    @Query('courierId') courierId?: string,
    @Query('zoneId') zoneId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('trackingNumber') trackingNumber?: string,
    @Query('search') search?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.shipmentsService.findAllCursor(
      {
        status,
        merchantId,
        courierId,
        zoneId,
        from: from ? new Date(from) : undefined,
        to: to ? new Date(to) : undefined,
        trackingNumber,
        search,
      },
      cursor,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Get(':id')
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.shipmentsService.findById(id);
  }

  @Get('tracking/:trackingNumber')
  async findByTrackingNumber(@Param('trackingNumber') trackingNumber: string) {
    return this.shipmentsService.findByTrackingNumber(trackingNumber);
  }

  @Get(':id/timeline')
  async getTimeline(@Param('id', ParseUUIDPipe) id: string) {
    return this.shipmentsService.getTimeline(id);
  }

  @Patch(':id/status')
  @Roles(UserRole.COURIER, UserRole.OPERATIONS_MANAGER)
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateShipmentStatusDto,
  ) {
    return this.shipmentsService.updateStatus(id, dto);
  }
}
