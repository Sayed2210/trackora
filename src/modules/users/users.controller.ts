import { Controller, Get, Param, Patch, Delete, Body } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './services/users.service';
import { Roles } from '@common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { UpdateUserDto } from './dtos/update-user.dto';
import { EffectiveTenantId } from '@common/tenant/effective-tenant';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.OPERATIONS_MANAGER)
  async findAll(@EffectiveTenantId() tenantId: string) {
    return this.usersService.findAll(tenantId);
  }

  @Get(':id')
  async findById(
    @Param('id') id: string,
    @EffectiveTenantId() tenantId: string,
  ) {
    return this.usersService.findById(id, tenantId);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @EffectiveTenantId() tenantId: string,
  ) {
    return this.usersService.update(id, dto, tenantId);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN)
  async remove(@Param('id') id: string, @EffectiveTenantId() tenantId: string) {
    return this.usersService.remove(id, tenantId);
  }
}
