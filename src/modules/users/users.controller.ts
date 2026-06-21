import { Controller, Get, Param, Patch, Delete, Body } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './services/users.service';
import { Roles } from '@common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { UpdateUserDto } from './dtos/update-user.dto';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.OPERATIONS_MANAGER)
  async findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN)
  async remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
