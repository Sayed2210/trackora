import {
  Injectable,
  NotFoundException,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '@core/prisma/prisma.service';
import { Prisma, Transaction, TransactionType, Wallet } from '@prisma/client';

interface CreateTransactionInput {
  walletId: string;
  shipmentId?: string;
  type: TransactionType;
  amount: number;
  description: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);
  private readonly MAX_RETRIES = 3;
  private readonly BASE_DELAY_MS = 100;

  constructor(private readonly prisma: PrismaService) {}

  async createCredit(input: CreateTransactionInput): Promise<Transaction> {
    return this.createTransaction(input, 'credit');
  }

  async createDebit(input: CreateTransactionInput): Promise<Transaction> {
    const tx = await this.createTransaction(input, 'debit');
    // Return negative amount for debit consistency in some views, but store as positive in DB
    return tx;
  }

  private async createTransaction(
    input: CreateTransactionInput,
    direction: 'credit' | 'debit',
  ): Promise<Transaction> {
    for (let attempt = 0; attempt < this.MAX_RETRIES; attempt++) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          // Pessimistic read: fetch wallet and ensure it exists
          const wallet = await tx.wallet.findUnique({
            where: { id: input.walletId },
          });

          if (!wallet) {
            throw new NotFoundException(
              `Wallet not found for id ${input.walletId}`,
            );
          }

          const amount = Math.abs(input.amount);
          const currentBalance = Number(wallet.balance);
          const newBalance =
            direction === 'credit'
              ? currentBalance + amount
              : currentBalance - amount;

          if (direction === 'debit' && newBalance < 0) {
            throw new InternalServerErrorException(
              'Insufficient wallet balance for debit',
            );
          }

          const newTotalCredited =
            direction === 'credit'
              ? Number(wallet.totalCredited) + amount
              : Number(wallet.totalCredited);

          const newTotalDebited =
            direction === 'debit'
              ? Number(wallet.totalDebited) + amount
              : Number(wallet.totalDebited);

          const newVersion = wallet.version + 1;

          // Optimistic locking: update only if version matches
          const updated = await tx.wallet.updateMany({
            where: { id: input.walletId, version: wallet.version },
            data: {
              balance: newBalance,
              totalCredited: newTotalCredited,
              totalDebited: newTotalDebited,
              version: newVersion,
            },
          });

          if (updated.count === 0) {
            throw new Error('VERSION_CONFLICT');
          }

          // Create transaction record (insert-only)
          return tx.transaction.create({
            data: {
              walletId: input.walletId,
              shipmentId: input.shipmentId || null,
              type: input.type,
              amount: direction === 'debit' ? -amount : amount,
              runningBalance: newBalance,
              description: input.description,
              metadata: (input.metadata as Prisma.InputJsonValue) ?? undefined,
            },
          });
        });
      } catch (error: unknown) {
        const err = error as Error;
        if (err.message === 'VERSION_CONFLICT') {
          if (attempt < this.MAX_RETRIES - 1) {
            const delay = this.BASE_DELAY_MS * Math.pow(2, attempt);
            this.logger.warn(
              `Wallet version conflict on ${input.walletId}, retry ${attempt + 1}/${this.MAX_RETRIES} in ${delay}ms`,
            );
            await this.sleep(delay);
            continue;
          }
          throw new InternalServerErrorException(
            'Failed to create transaction after maximum retries',
          );
        }
        throw error;
      }
    }

    throw new InternalServerErrorException(
      'Failed to create transaction after maximum retries',
    );
  }

  async getRunningBalance(walletId: string): Promise<number> {
    const wallet = await this.prisma.wallet.findUnique({
      where: { id: walletId },
    });
    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }
    return Number(wallet.balance);
  }

  async getTransactions(
    walletId: string,
    options: {
      page?: number;
      limit?: number;
      type?: TransactionType;
      from?: Date;
      to?: Date;
    } = {},
  ): Promise<{ data: Transaction[]; total: number; page: number; limit: number }> {
    const page = options.page ?? 1;
    const limit = options.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { walletId };
    if (options.type) where.type = options.type;
    if (options.from || options.to) {
      where.createdAt = {};
      if (options.from) (where.createdAt as Record<string, Date>).gte = options.from;
      if (options.to) (where.createdAt as Record<string, Date>).lte = options.to;
    }

    const [data, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
