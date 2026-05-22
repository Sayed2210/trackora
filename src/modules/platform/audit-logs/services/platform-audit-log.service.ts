import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '@core/prisma/prisma.service';
import { AuthenticatedRequestUser } from '@common/interfaces/request-context.interface';
import { ListAuditLogsQueryDto } from '../dtos';
import { PlatformAuditLogsRepository } from '../repositories/platform-audit-logs.repository';

export interface AuditActorContext {
  user?: AuthenticatedRequestUser;
  ipAddress?: string;
  userAgent?: string;
}

export interface WriteAuditLogInput extends AuditActorContext {
  actorUserId?: string;
  actorRole?: UserRole;
  tenantId?: string | null;
  action: string;
  resourceType: string;
  resourceId: string;
  oldValue?: unknown;
  newValue?: unknown;
  reason?: string | null;
}

const SENSITIVE_KEYS = [
  'password',
  'passcode',
  'token',
  'refreshToken',
  'accessToken',
  'otp',
  'secret',
  'apiKey',
  'cardNumber',
  'cvv',
  'iban',
  'bankAccount',
];

@Injectable()
export class PlatformAuditLogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsRepository: PlatformAuditLogsRepository,
  ) {}

  async findAll(query: ListAuditLogsQueryDto) {
    this.assertDateRange(query.from, query.to);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const where = this.buildWhere(query);
    const [logs, total] = await Promise.all([
      this.auditLogsRepository.findMany(
        where,
        this.auditLogsRepository.toOrderBy(query.sortBy, query.sortDirection),
        skip,
        limit,
      ),
      this.auditLogsRepository.count(where),
    ]);

    return {
      data: logs.map((log) => ({
        id: log.id,
        actorUserId: log.actorUserId,
        actorRole: log.actorRole,
        tenantId: log.tenantId,
        action: log.action,
        resourceType: log.resourceType ?? log.entityType,
        resourceId: log.resourceId ?? log.entityId,
        oldValue: this.maskSensitiveValues(log.oldValue),
        newValue: this.maskSensitiveValues(log.newValue),
        reason: log.reason,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        createdAt: log.createdAt,
      })),
      total,
      page,
      limit,
    };
  }

  async writeAuditLog(input: WriteAuditLogInput, tx?: Prisma.TransactionClient) {
    const actorUserId = input.actorUserId ?? input.user?.userId;
    const actorRole = input.actorRole ?? input.user?.role;
    const client = tx ?? this.prisma;

    return client.auditLog.create({
      data: {
        userId: actorUserId ?? null,
        actorUserId: actorUserId ?? null,
        actorRole: actorRole ?? null,
        tenantId: input.tenantId ?? null,
        action: input.action,
        entityType: input.resourceType,
        entityId: input.resourceId,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        oldValue: this.safeJson(input.oldValue),
        newValue: this.safeJson(input.newValue),
        reason: input.reason ?? null,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      },
    });
  }

  maskSensitiveValues(value: unknown): unknown {
    if (value === null || value === undefined) return value;
    if (value instanceof Prisma.Decimal) return value.toString();
    if (value instanceof Date) return value.toISOString();
    if (Array.isArray(value)) return value.map((item) => this.maskSensitiveValues(item));
    if (typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => [
          key,
          this.isSensitiveKey(key) ? '[REDACTED]' : this.maskSensitiveValues(nestedValue),
        ]),
      );
    }
    return value;
  }

  safeJson(value: unknown): Prisma.InputJsonValue | undefined {
    if (value === undefined) return undefined;
    return this.maskSensitiveValues(value) as Prisma.InputJsonValue;
  }

  private buildWhere(query: ListAuditLogsQueryDto): Prisma.AuditLogWhereInput {
    const where: Prisma.AuditLogWhereInput = {
      actorUserId: query.actorUserId,
      actorRole: query.actorRole,
      tenantId: query.tenantId,
      action: query.action,
      resourceType: query.resourceType,
      resourceId: query.resourceId,
    };
    if (query.from || query.to) where.createdAt = { gte: query.from, lte: query.to };
    if (query.search) where.reason = { contains: query.search, mode: 'insensitive' };
    return where;
  }

  private assertDateRange(from?: Date, to?: Date): void {
    if (from && to && from > to) throw new BadRequestException('Date range start must be before end');
  }

  private isSensitiveKey(key: string): boolean {
    const normalized = key.toLowerCase();
    return SENSITIVE_KEYS.some((sensitiveKey) => normalized.includes(sensitiveKey.toLowerCase()));
  }
}
