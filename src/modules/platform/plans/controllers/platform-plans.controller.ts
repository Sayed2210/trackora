import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@common/constants/permissions.constant';
import {
  PlatformAnyPermissions,
  PlatformPermissions,
} from '@common/decorators/platform-permissions.decorator';
import { PlatformOnlyGuard } from '@common/guards/platform-only.guard';
import {
  CreatePlanDto,
  ListPlansQueryDto,
  PlanIdParamDto,
  UpdatePlanDto,
} from '../dtos';
import { PlatformPlansService } from '../services/platform-plans.service';

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
  @ApiOperation({ summary: 'Create platform plan' })
  async create(@Body() dto: CreatePlanDto) {
    return this.plansService.create(dto);
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
  @ApiOperation({ summary: 'Update platform plan' })
  async update(@Param() params: PlanIdParamDto, @Body() dto: UpdatePlanDto) {
    return this.plansService.update(params.id, dto);
  }

  @Delete(':id')
  @PlatformPermissions(PERMISSIONS.MANAGE_PLANS)
  @ApiOperation({ summary: 'Archive or delete platform plan safely' })
  async remove(@Param() params: PlanIdParamDto) {
    return this.plansService.remove(params.id);
  }
}
