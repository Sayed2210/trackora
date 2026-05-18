import { Injectable, MethodNotAllowedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@core/prisma/prisma.service';
import { AbstractRepository } from '@common/database/abstract.repository';
import { User } from '../entities/auth.entity';

export type AuthUserWithAccounts = Prisma.UserGetPayload<{
  include: { merchant: { select: { id: true } }; courier: { select: { id: true } } };
}>;

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

  async findByPhoneWithAccounts(
    phone: string,
  ): Promise<AuthUserWithAccounts | null> {
    return this.delegate.findFirst({
      where: { ...this.baseWhere, phone },
      include: {
        merchant: { select: { id: true } },
        courier: { select: { id: true } },
      },
    }) as Promise<AuthUserWithAccounts | null>;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.findOne({ email });
  }
}
