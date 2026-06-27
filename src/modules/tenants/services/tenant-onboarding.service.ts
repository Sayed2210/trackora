import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import {
  PaymentStatus,
  Prisma,
  SubscriptionStatus,
  TenantStatus,
  UserRole,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '@core/prisma/prisma.service';
import {
  AuditActorContext,
  PlatformAuditLogService,
} from '@modules/platform/audit-logs/services/platform-audit-log.service';
import {
  OnboardPlatformTenantDto,
  OnboardPlatformTenantResponseDto,
} from '../dtos';

const BCRYPT_COST = 12;
const GENERATED_PASSWORD_LENGTH = 18;

/**
 * Hierarchical separator so strong passwords mix character classes
 * without relying on user input.
 */
const PASSWORD_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

@Injectable()
export class TenantOnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: PlatformAuditLogService,
  ) {}

  async onboard(
    dto: OnboardPlatformTenantDto,
    audit?: AuditActorContext,
  ): Promise<OnboardPlatformTenantResponseDto> {
    this.assertDateRange(
      dto.tenant.trialStartsAt,
      dto.tenant.trialEndsAt,
      'Trial end date must be after start date',
    );
    this.assertDateRange(
      dto.subscription.currentPeriodStart,
      dto.subscription.currentPeriodEnd,
      'Current period end date must be after start date',
    );

    const temporaryPassword = dto.owner.temporaryPassword?.trim()
      ? dto.owner.temporaryPassword
      : this.generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, BCRYPT_COST);

    const role = dto.owner.role ?? UserRole.SUPER_ADMIN;
    const subscriptionStatus =
      dto.subscription.status ?? SubscriptionStatus.TRIALING;
    const paymentStatus =
      dto.subscription.paymentStatus ?? PaymentStatus.NOT_REQUIRED;
    const reason = dto.subscription.reason;

    try {
      return await this.prisma.$transaction(async (tx) => {
        // Re-validate inside the transaction to guarantee ACID semantics.
        this.assertDateRange(
          dto.tenant.trialStartsAt,
          dto.tenant.trialEndsAt,
          'Trial end date must be after start date',
        );
        this.assertDateRange(
          dto.subscription.currentPeriodStart,
          dto.subscription.currentPeriodEnd,
          'Current period end date must be after start date',
        );

        const existingTenant = await tx.tenant.findUnique({
          where: { slug: dto.tenant.slug },
          select: { id: true },
        });
        if (existingTenant) {
          throw new ConflictException('Tenant slug already exists');
        }

        const plan = await tx.plan.findUnique({
          where: { id: dto.subscription.planId },
        });
        if (!plan) {
          throw new NotFoundException('Plan not found');
        }
        if (!plan.isActive || plan.archivedAt) {
          throw new ConflictException('Target plan is not active');
        }

        const existingPhone = await tx.user.findUnique({
          where: { phone: dto.owner.phone },
          select: { id: true },
        });
        if (existingPhone) {
          throw new ConflictException('Owner phone already registered');
        }

        if (dto.owner.email) {
          const existingEmail = await tx.user.findUnique({
            where: { email: dto.owner.email },
            select: { id: true },
          });
          if (existingEmail) {
            throw new ConflictException('Owner email already registered');
          }
        }

        const tenant = await tx.tenant.create({
          data: {
            name: dto.tenant.name,
            slug: dto.tenant.slug,
            status: TenantStatus.TRIAL,
            trialStartsAt: dto.tenant.trialStartsAt ?? null,
            trialEndsAt: dto.tenant.trialEndsAt ?? null,
            currentPlanId: plan.id,
            metadata:
              (dto.tenant.metadata as unknown as
                | Prisma.InputJsonObject
                | undefined) ?? Prisma.JsonNull,
          },
        });

        const owner = await tx.user.create({
          data: {
            tenantId: tenant.id,
            name: dto.owner.name,
            phone: dto.owner.phone,
            email: dto.owner.email ?? null,
            role,
            passwordHash,
            isActive: true,
          },
        });

        const subscription = await tx.subscription.create({
          data: {
            tenantId: tenant.id,
            planId: plan.id,
            status: subscriptionStatus,
            paymentStatus,
            trialStartsAt: dto.tenant.trialStartsAt ?? null,
            trialEndsAt: dto.tenant.trialEndsAt ?? null,
            currentPeriodStart: dto.subscription.currentPeriodStart ?? null,
            currentPeriodEnd: dto.subscription.currentPeriodEnd ?? null,
            metadata: { reason } satisfies Prisma.InputJsonObject,
          },
        });

        await tx.tenant.update({
          where: { id: tenant.id },
          data: { currentPlanId: plan.id },
        });

        const auditBase: AuditActorContext = audit ?? {};
        await this.auditLogService.writeAuditLog(
          {
            ...auditBase,
            tenantId: tenant.id,
            action: 'tenant.created',
            resourceType: 'Tenant',
            resourceId: tenant.id,
            newValue: {
              name: tenant.name,
              slug: tenant.slug,
              status: tenant.status,
              trialStartsAt: tenant.trialStartsAt,
              trialEndsAt: tenant.trialEndsAt,
            },
            reason,
          },
          tx,
        );

        await this.auditLogService.writeAuditLog(
          {
            ...auditBase,
            tenantId: tenant.id,
            actorUserId: owner.id,
            actorRole: role,
            action: 'tenant.owner_created',
            resourceType: 'User',
            resourceId: owner.id,
            newValue: {
              id: owner.id,
              tenantId: owner.tenantId,
              name: owner.name,
              phone: owner.phone,
              email: owner.email,
              role: owner.role,
              isActive: owner.isActive,
            },
            reason,
          },
          tx,
        );

        await this.auditLogService.writeAuditLog(
          {
            ...auditBase,
            tenantId: tenant.id,
            action: 'subscription.created',
            resourceType: 'Subscription',
            resourceId: subscription.id,
            newValue: {
              id: subscription.id,
              tenantId: subscription.tenantId,
              planId: subscription.planId,
              status: subscription.status,
              paymentStatus: subscription.paymentStatus,
              currentPeriodStart: subscription.currentPeriodStart,
              currentPeriodEnd: subscription.currentPeriodEnd,
            },
            reason,
          },
          tx,
        );

        return {
          tenant: {
            id: tenant.id,
            name: tenant.name,
            slug: tenant.slug,
            status: tenant.status,
            currentPlanId: tenant.currentPlanId,
          },
          subscription: {
            id: subscription.id,
            tenantId: subscription.tenantId,
            planId: subscription.planId,
            status: subscription.status,
            paymentStatus: subscription.paymentStatus,
            currentPeriodStart: subscription.currentPeriodStart,
            currentPeriodEnd: subscription.currentPeriodEnd,
          },
          owner: {
            id: owner.id,
            tenantId: owner.tenantId ?? tenant.id,
            name: owner.name,
            phone: owner.phone,
            email: owner.email,
            role: owner.role,
            isActive: owner.isActive,
          },
          credentials: {
            temporaryPassword,
          },
        };
      });
    } catch (error) {
      this.handleUniqueViolation(error);
      throw error;
    }
  }

  private assertDateRange(start?: Date, end?: Date, message?: string): void {
    if (start && end && end <= start) {
      throw new BadRequestException(
        message ?? 'End date must be after start date',
      );
    }
  }

  private generateTemporaryPassword(): string {
    const bytes = randomBytes(GENERATED_PASSWORD_LENGTH);
    const chars: string[] = [];
    for (let i = 0; i < GENERATED_PASSWORD_LENGTH; i++) {
      chars.push(PASSWORD_ALPHABET[bytes[i] % PASSWORD_ALPHABET.length]);
    }
    const base = chars.join('');
    // Guarantee the password contains at least one letter and one digit
    // so the strong-password regex used in the DTO is always satisfied.
    return `${base}Aa9!`;
  }

  private handleUniqueViolation(error: unknown): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const target = (error.meta?.target as string[] | undefined) ?? [];
      if (target.includes('slug')) {
        throw new ConflictException('Tenant slug already exists');
      }
      if (target.includes('phone')) {
        throw new ConflictException('Owner phone already registered');
      }
      if (target.includes('email')) {
        throw new ConflictException('Owner email already registered');
      }
      throw new ConflictException('A record with these details already exists');
    }
  }
}
