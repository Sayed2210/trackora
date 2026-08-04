import { Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { UsersRepository } from '../repositories/users.repository';
import { User } from '../entities/user.entity';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async findAll(tenantId: string): Promise<User[]> {
    return this.usersRepository.findActiveUsersForTenant(tenantId);
  }

  async findById(id: string, tenantId: string): Promise<User> {
    const user = await this.usersRepository.findByIdForTenant(id, tenantId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async findByPhone(phone: string): Promise<User | null> {
    return this.usersRepository.findByPhone(phone);
  }

  async create(data: Partial<User>): Promise<User> {
    if (data.passwordHash) {
      data.passwordHash = await bcrypt.hash(data.passwordHash, 12);
    }
    return this.usersRepository.create(data);
  }

  async update(
    id: string,
    data: Partial<User>,
    tenantId: string,
  ): Promise<User> {
    await this.findById(id, tenantId);
    if (data.passwordHash) {
      data.passwordHash = await bcrypt.hash(data.passwordHash, 12);
    }
    return this.usersRepository.updateForTenant(id, tenantId, data);
  }

  async remove(id: string, tenantId: string): Promise<void> {
    await this.findById(id, tenantId);
    await this.usersRepository.softDeleteForTenant(id, tenantId);
  }

  async validateCredentials(
    phone: string,
    password: string,
  ): Promise<User | null> {
    const user = await this.findByPhone(phone);
    if (!user || !user.passwordHash) {
      return null;
    }
    const isValid = await bcrypt.compare(password, user.passwordHash);
    return isValid ? user : null;
  }
}
