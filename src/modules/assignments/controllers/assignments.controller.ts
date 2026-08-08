import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
  Req,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { AssignmentsService } from '../services/assignments.service';
import { Roles } from '@common/decorators/roles.decorator';
import { UserRole } from '@modules/users/entities/user.entity';
import {
  AssignmentStatus,
  AssignmentType,
} from '../entities/assignment.entity';
import { CreateAssignmentDto } from '../dtos/create-assignment.dto';
import { ReassignAssignmentDto } from '../dtos/reassign-assignment.dto';
import { CancelAssignmentDto } from '../dtos/cancel-assignment.dto';
import { QueryAssignmentsDto } from '../dtos/query-assignments.dto';
import { PaginatedAssignmentsResponseDto } from '../dtos/assignment-response.dto';
import { EffectiveTenantId } from '@common/tenant/effective-tenant';

interface RequestWithUser extends Request {
  user: { userId: string; role: UserRole };
}

@ApiTags('Assignments')
@ApiBearerAuth()
@Controller('assignments')
export class AssignmentsController {
  constructor(private readonly assignmentsService: AssignmentsService) {}

  @Post()
  @Roles(UserRole.OPERATIONS_MANAGER, UserRole.SUPER_ADMIN)
  async create(
    @Body() dto: CreateAssignmentDto,
    @EffectiveTenantId() tenantId: string,
    @Req() req: RequestWithUser,
  ) {
    return this.assignmentsService.createManualAssignments(
      dto,
      tenantId,
      req.user.userId,
    );
  }

  @Get()
  @ApiQuery({ name: 'courierId', required: false })
  @ApiQuery({ name: 'shipmentId', required: false })
  @ApiQuery({ name: 'status', required: false, enum: AssignmentStatus })
  @ApiQuery({ name: 'assignmentType', required: false, enum: AssignmentType })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiOkResponse({ type: PaginatedAssignmentsResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid assignment query values.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  async findAll(
    @Query() query: QueryAssignmentsDto,
    @EffectiveTenantId() tenantId: string,
  ) {
    return this.assignmentsService.findAll(
      tenantId,
      {
        courierId: query.courierId,
        shipmentId: query.shipmentId,
        status: query.status,
        assignmentType: query.assignmentType,
        from: query.from ? new Date(query.from) : undefined,
        to: query.to ? new Date(query.to) : undefined,
      },
      query.page ? parseInt(query.page, 10) : 1,
      query.limit ? parseInt(query.limit, 10) : 20,
    );
  }

  @Get(':id')
  async findById(
    @Param('id', ParseUUIDPipe) id: string,
    @EffectiveTenantId() tenantId: string,
  ) {
    return this.assignmentsService.findById(id, tenantId);
  }

  @Patch(':id/reassign')
  @Roles(UserRole.OPERATIONS_MANAGER, UserRole.SUPER_ADMIN)
  async reassign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReassignAssignmentDto,
    @EffectiveTenantId() tenantId: string,
    @Req() req: RequestWithUser,
  ) {
    return this.assignmentsService.reassign(
      id,
      dto.newCourierId,
      tenantId,
      dto.reason,
      req.user.userId,
    );
  }

  @Patch(':id/cancel')
  @Roles(UserRole.OPERATIONS_MANAGER, UserRole.SUPER_ADMIN)
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelAssignmentDto,
    @EffectiveTenantId() tenantId: string,
  ) {
    return this.assignmentsService.cancel(id, tenantId, dto.reason);
  }
}
