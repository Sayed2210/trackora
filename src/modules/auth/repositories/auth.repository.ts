import { Injectable, MethodNotAllowedException } from '@nestjs/common';
import { PrismaService } from '@core/prisma/prisma.service';
import { AbstractRepository } from '@common/database/abstract.repository';
import { User } from '../entities/auth.entity';

@Injectable()
export class AuthRepository extends AbstractRepository<User> {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  protected get delegate() {
    return this.prisma.user;
  }

  protected get baseWhere() {
    return { isActive: true };
  }

  async softDelete(): Promise<void> {
    await Promise.resolve();
    throw new MethodNotAllowedException(
      'Use UsersRepository.softDelete() instead',
    );
  }

  async findByPhone(phone: string): Promise<User | null> {
    return this.findOne({ phone });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.findOne({ email });
  }
}
