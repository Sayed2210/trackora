import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Payout,
  PayoutStatus,
  Prisma,
  TransactionType,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '@core/prisma/prisma.service';
import { CreatePayoutDto } from '../dtos/create-payout.dto';
import { ListPayoutsDto } from '../dtos/list-payouts.dto';
import { PayoutsRepository } from '../repositories/payouts.repository';

const MIN_PAYOUT_AMOUNT = 500;
const OPEN_PAYOUT_STATUSES = [
  PayoutStatus.PENDING,
  PayoutStatus.APPROVED,
  PayoutStatus.PROCESSING,
];

@Injectable()
export class PayoutsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payoutsRepository: PayoutsRepository,
  ) {}

  async findAll(
    query: ListPayoutsDto,
    user: { userId: string; role: UserRole },
  ) {
    const merchantId =
      user.role === UserRole.MERCHANT
        ? await this.getMerchantIdForUser(user.userId)
        : query.merchantId;

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const filters = {
      merchantId,
      status: query.status,
      method: query.method,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
    };

    const [data, total] = await Promise.all([
      this.payoutsRepository.findMany(filters, (page - 1) * limit, limit),
      this.payoutsRepository.count(filters),
    ]);

    return {
      data: data.map((payout) => this.toResponse(payout)),
      total,
      page,
      limit,
    };
  }

  async requestPayout(userId: string, dto: CreatePayoutDto) {
    const merchantId = await this.getMerchantIdForUser(userId);
    if (dto.amount < MIN_PAYOUT_AMOUNT) {
      throw new BadRequestException(
        `Minimum payout amount is ${MIN_PAYOUT_AMOUNT} EGP`,
      );
    }

    const payout = await this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({ where: { merchantId } });
      if (!wallet) {
        throw new NotFoundException('Wallet not found for merchant');
      }

      const amount = Math.abs(dto.amount);
      const balance = Number(wallet.balance);
      if (amount > balance) {
        throw new BadRequestException('Insufficient wallet balance');
      }

      const existingPayout = await tx.payout.findFirst({
        where: {
          merchantId,
          status: { in: OPEN_PAYOUT_STATUSES },
        },
      });
      if (existingPayout) {
        throw new BadRequestException(
          'You already have a pending payout request',
        );
      }

      const nextBalance = balance - amount;
      const created = await tx.payout.create({
        data: {
          merchantId,
          amount,
          method: dto.method,
          destination: dto.destination as Prisma.InputJsonValue,
          status: PayoutStatus.PENDING,
        },
      });

      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: nextBalance,
          totalDebited: Number(wallet.totalDebited) + amount,
          version: { increment: 1 },
        },
      });

      await tx.transaction.create({
        data: {
          walletId: wallet.id,
          type: TransactionType.PAYOUT_DEBIT,
          amount: -amount,
          runningBalance: nextBalance,
          description: `Payout request #${created.id}`,
          metadata: { payoutId: created.id },
        },
      });

      return created;
    });

    return this.toResponse(payout);
  }

  async approve(id: string, adminUserId: string) {
    const payout = await this.payoutsRepository.findById(id);
    if (!payout) throw new NotFoundException('Payout not found');
    if (payout.status !== PayoutStatus.PENDING) {
      throw new BadRequestException('Only pending payouts can be approved');
    }

    const updated = await this.prisma.payout.update({
      where: { id },
      data: {
        status: PayoutStatus.APPROVED,
        approvedByUserId: adminUserId,
      },
    });
    return this.toResponse(updated);
  }

  async complete(id: string, referenceNumber: string) {
    const payout = await this.payoutsRepository.findById(id);
    if (!payout) throw new NotFoundException('Payout not found');
    const completableStatuses: PayoutStatus[] = [
      PayoutStatus.APPROVED,
      PayoutStatus.PROCESSING,
    ];
    if (!completableStatuses.includes(payout.status)) {
      throw new BadRequestException(
        'Only approved or processing payouts can be completed',
      );
    }

    const updated = await this.prisma.payout.update({
      where: { id },
      data: {
        status: PayoutStatus.COMPLETED,
        referenceNumber,
        completedAt: new Date(),
        processedAt: payout.processedAt ?? new Date(),
      },
    });
    return this.toResponse(updated);
  }

  async reject(id: string, reason: string) {
    const payout = await this.payoutsRepository.findById(id);
    if (!payout) throw new NotFoundException('Payout not found');
    const rejectableStatuses: PayoutStatus[] = [
      PayoutStatus.PENDING,
      PayoutStatus.APPROVED,
      PayoutStatus.PROCESSING,
    ];
    if (!rejectableStatuses.includes(payout.status)) {
      throw new BadRequestException('Only open payouts can be rejected');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({
        where: { merchantId: payout.merchantId },
      });
      if (!wallet) {
        throw new NotFoundException('Wallet not found for merchant');
      }

      const amount = Number(payout.amount);
      const nextBalance = Number(wallet.balance) + amount;

      const rejected = await tx.payout.update({
        where: { id },
        data: {
          status: PayoutStatus.REJECTED,
          rejectionReason: reason,
        },
      });

      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: nextBalance,
          totalCredited: Number(wallet.totalCredited) + amount,
          version: { increment: 1 },
        },
      });

      await tx.transaction.create({
        data: {
          walletId: wallet.id,
          type: TransactionType.ADJUSTMENT_CREDIT,
          amount,
          runningBalance: nextBalance,
          description: `Payout rejected: ${reason}`,
          metadata: { payoutId: payout.id },
        },
      });

      return rejected;
    });

    return this.toResponse(updated);
  }

  private async getMerchantIdForUser(userId: string): Promise<string> {
    const merchant = await this.prisma.merchant.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!merchant) {
      throw new ForbiddenException('User is not linked to a merchant account');
    }
    return merchant.id;
  }

  private toResponse(payout: Payout) {
    return {
      ...payout,
      amount: Number(payout.amount),
      destination: payout.destination as Record<string, unknown>,
    };
  }
}
