import { Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { UsersRepository } from '../repositories/users.repository';
import { User } from '../entities/user.entity';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async findAll(): Promise<User[]> {
    return this.usersRepository.findActiveUsers();
  }

  async findById(id: string): Promise<User> {
    const user = await this.usersRepository.findById(id);
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

  async update(id: string, data: Partial<User>): Promise<User> {
    await this.findById(id);
    if (data.passwordHash) {
      data.passwordHash = await bcrypt.hash(data.passwordHash, 12);
    }
    return this.usersRepository.update(id, data);
  }

  async remove(id: string): Promise<void> {
    await this.findById(id);
    await this.usersRepository.softDelete(id);
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
