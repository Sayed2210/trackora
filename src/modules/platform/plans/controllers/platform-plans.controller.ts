import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthenticatedRequestUser } from '@common/interfaces/request-context.interface';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@common/constants/permissions.constant';
import {
  PlatformAnyPermissions,
  PlatformPermissions,
} from '@common/decorators/platform-permissions.decorator';
import { DangerousAction } from '@common/decorators/dangerous-action.decorator';
import { PlatformOnlyGuard } from '@common/guards/platform-only.guard';
import {
  CreatePlanDto,
  ListPlansQueryDto,
  PlanIdParamDto,
  UpdatePlanDto,
} from '../dtos';
import { PlatformPlansService } from '../services/platform-plans.service';

interface AuthenticatedRequest {
  user: AuthenticatedRequestUser;
  ip?: string;
  headers: { 'user-agent'?: string };
}

@ApiTags('Platform Plans')
@ApiBearerAuth()
@UseGuards(PlatformOnlyGuard)
@Controller('platform/plans')
export class PlatformPlansController {
  constructor(private readonly plansService: PlatformPlansService) {}

  @Get()
  @PlatformAnyPermissions(
    PERMISSIONS.MANAGE_PLANS,
    PERMISSIONS.MANAGE_SUBSCRIPTIONS,
    PERMISSIONS.VIEW_PLATFORM_ANALYTICS,
  )
  @ApiOperation({ summary: 'List platform plans' })
  async findAll(@Query() query: ListPlansQueryDto) {
    return this.plansService.findAll(query);
  }

  @Post()
  @PlatformPermissions(PERMISSIONS.MANAGE_PLANS)
  @DangerousAction('plan changes')
  @ApiOperation({ summary: 'Create platform plan' })
  async create(@Body() dto: CreatePlanDto, @Req() request?: AuthenticatedRequest) {
    const audit = this.toAuditContext(request);
    return audit ? this.plansService.create(dto, audit) : this.plansService.create(dto);
  }

  @Get(':id')
  @PlatformAnyPermissions(
    PERMISSIONS.MANAGE_PLANS,
    PERMISSIONS.MANAGE_SUBSCRIPTIONS,
    PERMISSIONS.VIEW_PLATFORM_ANALYTICS,
  )
  @ApiOperation({ summary: 'Get platform plan details' })
  async findById(@Param() params: PlanIdParamDto) {
    return this.plansService.findById(params.id);
  }

  @Patch(':id')
  @PlatformPermissions(PERMISSIONS.MANAGE_PLANS)
  @DangerousAction('plan changes')
  @ApiOperation({ summary: 'Update platform plan' })
  async update(
    @Param() params: PlanIdParamDto,
    @Body() dto: UpdatePlanDto,
    @Req() request?: AuthenticatedRequest,
  ) {
    const audit = this.toAuditContext(request);
    return audit ? this.plansService.update(params.id, dto, audit) : this.plansService.update(params.id, dto);
  }

  @Delete(':id')
  @PlatformPermissions(PERMISSIONS.MANAGE_PLANS)
  @DangerousAction('plan archive/delete')
  @ApiOperation({ summary: 'Archive or delete platform plan safely' })
  async remove(@Param() params: PlanIdParamDto, @Req() request?: AuthenticatedRequest) {
    const audit = this.toAuditContext(request);
    return audit ? this.plansService.remove(params.id, audit) : this.plansService.remove(params.id);
  }

  private toAuditContext(request?: AuthenticatedRequest) {
    if (!request) return undefined;
    return {
      user: request.user,
      ipAddress: request.ip,
      userAgent: request.headers?.['user-agent'],
    };
  }
}
