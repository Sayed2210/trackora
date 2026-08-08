import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiBearerAuth,
  ApiQuery,
  ApiConsumes,
  ApiBody,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiUnauthorizedResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { ShipmentsService } from '../services/shipments.service';
import { BulkUploadService } from '../services/bulk-upload.service';
import { Roles } from '@common/decorators/roles.decorator';
import { Public } from '@common/decorators/public.decorator';
import { UserRole } from '@modules/users/entities/user.entity';
import { ShipmentStatus } from '../entities/shipment.entity';
import { EffectiveTenantId } from '@common/tenant/effective-tenant';
import { AuthenticatedRequestUser } from '@common/interfaces/request-context.interface';
import { CreateShipmentDto } from '../dtos/create-shipment.dto';
import { UpdateShipmentStatusDto } from '../dtos/update-shipment-status.dto';
import {
  PaginatedShipmentsResponseDto,
  ShipmentResponseDto,
} from '../dtos/shipment-response.dto';
import { BulkUploadResultDto } from '../dtos/bulk-upload-result.dto';

interface RequestWithUser extends Request {
  user: AuthenticatedRequestUser;
}

@ApiTags('Shipments')
@Controller('shipments')
export class ShipmentsController {
  constructor(
    private readonly shipmentsService: ShipmentsService,
    private readonly bulkUploadService: BulkUploadService,
  ) {}

  @Post()
  @ApiBearerAuth()
  @Roles(UserRole.MERCHANT, UserRole.SUPER_ADMIN, UserRole.OPERATIONS_MANAGER)
  async create(
    @Body() dto: CreateShipmentDto,
    @EffectiveTenantId() tenantId: string,
    @Req() req: RequestWithUser,
  ) {
    return this.shipmentsService.create(
      dto,
      tenantId,
      req.user.userId,
      req.user.role,
    );
  }

  @Post('bulk-upload')
  @ApiBearerAuth()
  @Roles(UserRole.MERCHANT)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Bulk import shipments for the authenticated Merchant',
    description:
      'Resolves the authenticated user to an active Merchant profile. Merchant and tenant identity are never read from the workbook.',
  })
  @ApiBody({
    required: true,
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Excel workbook containing up to 5,000 shipments.',
        },
        merchantId: {
          type: 'string',
          format: 'uuid',
          description:
            'Tenant admin target merchant. Ignored for merchant users.',
        },
      },
    },
  })
  @ApiCreatedResponse({
    description:
      'Workbook processed. Invalid data rows are returned in the errors array.',
    type: BulkUploadResultDto,
  })
  @ApiBadRequestResponse({
    description:
      'File is missing, unreadable, empty, exceeds the row limit, or contains row data that cannot be parsed.',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  @ApiForbiddenResponse({
    description: 'Merchant role required or Merchant profile is inactive.',
  })
  @ApiNotFoundResponse({
    description: 'Merchant profile was not found for the authenticated user.',
  })
  @UseInterceptors(FileInterceptor('file'))
  async bulkUpload(
    @UploadedFile() file: { buffer: Buffer } | undefined,
    @Body('merchantId') merchantId: string | undefined,
    @EffectiveTenantId() tenantId: string,
    @Req() req: RequestWithUser,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    return this.bulkUploadService.processFile(
      file.buffer,
      tenantId,
      req.user.userId,
      req.user.role,
      merchantId,
    );
  }

  @Get()
  @ApiBearerAuth()
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
  @ApiOkResponse({ type: PaginatedShipmentsResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid shipment query values.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  async findAll(
    @EffectiveTenantId() tenantId: string,
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
      tenantId,
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
  @ApiBearerAuth()
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
    @EffectiveTenantId() tenantId: string,
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
      tenantId,
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

  @Public()
  @Get('tracking/:trackingNumber')
  async findByTrackingNumber(@Param('trackingNumber') trackingNumber: string) {
    return this.shipmentsService.findPublicTracking(trackingNumber);
  }

  @Get(':id')
  @ApiBearerAuth()
  @ApiOkResponse({ type: ShipmentResponseDto })
  @ApiBadRequestResponse({ description: 'Shipment id must be a UUID.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  @ApiNotFoundResponse({ description: 'Shipment was not found.' })
  async findById(
    @Param('id', ParseUUIDPipe) id: string,
    @EffectiveTenantId() tenantId: string,
  ) {
    return this.shipmentsService.findById(id, tenantId);
  }

  @Get(':id/timeline')
  @ApiBearerAuth()
  async getTimeline(
    @Param('id', ParseUUIDPipe) id: string,
    @EffectiveTenantId() tenantId: string,
  ) {
    return this.shipmentsService.getTimeline(id, tenantId);
  }

  @Patch(':id/status')
  @ApiBearerAuth()
  @Roles(UserRole.COURIER, UserRole.OPERATIONS_MANAGER)
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @EffectiveTenantId() tenantId: string,
    @Body() dto: UpdateShipmentStatusDto,
    @Req() req: RequestWithUser,
  ) {
    return this.shipmentsService.updateStatus(
      id,
      tenantId,
      dto,
      req.user.userId,
      req.user.role,
    );
  }
}
