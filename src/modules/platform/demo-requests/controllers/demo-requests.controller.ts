import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiUnauthorizedResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PERMISSIONS } from '@common/constants/permissions.constant';
import { PlatformPermissions } from '@common/decorators/platform-permissions.decorator';
import { PlatformOnlyGuard } from '@common/guards/platform-only.guard';
import { AuthenticatedRequestUser } from '@common/interfaces/request-context.interface';
import {
  DemoRequestIdParamDto,
  DemoRequestResponseDto,
  ListDemoRequestsQueryDto,
  UpdateDemoRequestDto,
} from '../dtos';
import { DemoRequestsService } from '../services/demo-requests.service';

interface AuthenticatedRequest {
  user: AuthenticatedRequestUser;
  ip?: string;
  headers: { 'user-agent'?: string };
}

@ApiTags('System Owner Demo Requests')
@ApiBearerAuth()
@UseGuards(PlatformOnlyGuard)
@Controller('system-owner/demo-requests')
export class DemoRequestsController {
  constructor(private readonly demoRequestsService: DemoRequestsService) {}

  @Get()
  @PlatformPermissions(PERMISSIONS.VIEW_DEMO_REQUESTS)
  @ApiOperation({
    summary: 'List demo request leads (System Owner)',
    description:
      'Returns paginated demo request leads with status, businessType, search, date-range, and sort filters. ' +
      'Requires `view_demo_requests` permission. Only platform owner/admin users can access.',
  })
  @ApiOkResponse({
    description: 'Paginated demo request list.',
    schema: {
      example: {
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  @ApiForbiddenResponse({
    description:
      'Authenticated user is not a platform user or lacks `view_demo_requests`.',
  })
  async listDemoRequests(@Query() query: ListDemoRequestsQueryDto): Promise<{
    data: DemoRequestResponseDto[];
    meta: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    return this.demoRequestsService.listDemoRequests(query);
  }

  @Get(':id')
  @PlatformPermissions(PERMISSIONS.VIEW_DEMO_REQUESTS)
  @ApiOperation({
    summary: 'Get a single demo request lead by ID (System Owner)',
    description:
      'Returns one demo request lead by ID. Requires `view_demo_requests` permission.',
  })
  @ApiOkResponse({
    description: 'Demo request detail.',
    type: DemoRequestResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  @ApiForbiddenResponse({
    description:
      'Authenticated user is not a platform user or lacks `view_demo_requests`.',
  })
  @ApiNotFoundResponse({ description: 'Demo request not found.' })
  async getDemoRequest(
    @Param() params: DemoRequestIdParamDto,
  ): Promise<DemoRequestResponseDto> {
    return this.demoRequestsService.getDemoRequestById(params.id);
  }

  @Patch(':id')
  @PlatformPermissions(PERMISSIONS.MANAGE_DEMO_REQUESTS)
  @ApiOperation({
    summary: 'Update a demo request lead lifecycle (System Owner)',
    description:
      'Updates only `status`, `notes`, and `contactedAt` for a demo request lead. ' +
      'Original submitted lead fields (name, companyName, phone, email, businessType, monthlyShipments, message, interestedPlanSlug) cannot be edited. ' +
      'When status transitions to CONTACTED and `contactedAt` is omitted, it is set automatically. ' +
      'An audit log entry is written. Requires `manage_demo_requests` permission.',
  })
  @ApiOkResponse({
    description: 'Updated demo request.',
    type: DemoRequestResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  @ApiForbiddenResponse({
    description:
      'Authenticated user is not a platform user or lacks `manage_demo_requests`.',
  })
  @ApiNotFoundResponse({ description: 'Demo request not found.' })
  @ApiBadRequestResponse({
    description: 'Invalid status enum or date range validation failed.',
  })
  async updateDemoRequest(
    @Param() params: DemoRequestIdParamDto,
    @Body() dto: UpdateDemoRequestDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<DemoRequestResponseDto> {
    return this.demoRequestsService.updateDemoRequest(params.id, dto, {
      user: request.user,
      ipAddress: request.ip,
      userAgent: request.headers?.['user-agent'],
    });
  }
}
