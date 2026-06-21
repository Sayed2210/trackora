import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PaymentStatus,
  Prisma,
  SubscriptionStatus,
  TenantStatus,
  UserRole,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '@core/prisma/prisma.service';
import { AuthService } from '@modules/auth/services/auth.service';
import {
  AuditActorContext,
  PlatformAuditLogService,
} from '@modules/platform/audit-logs/services/platform-audit-log.service';
import {
  PublicSubscribeDto,
  RequestDemoDto,
  RequestDemoResponseDto,
} from '../dtos';

export interface OnboardingRequestContext {
  ipAddress?: string;
  userAgent?: string;
}

const DEFAULT_TRIAL_DAYS = 14;

@Injectable()
export class PublicOnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly auditLogService: PlatformAuditLogService,
    private readonly configService: ConfigService,
  ) {}

  async subscribe(
    dto: PublicSubscribeDto,
    requestContext?: OnboardingRequestContext,
  ) {
    const plan = await this.findPublicPlan(dto.planSlug);

    await this.assertNoConflicts(dto);

    const trialDays = this.parseTrialDays(
      this.configService.get<string>('TRIAL_DAYS'),
    );
    const trialStartsAt = new Date();
    const trialEndsAt = new Date(trialStartsAt);
    trialEndsAt.setDate(trialEndsAt.getDate() + trialDays);

    const passwordHash = await bcrypt.hash(dto.owner.password, 12);

    const audit: AuditActorContext = {
      ipAddress: requestContext?.ipAddress,
      userAgent: requestContext?.userAgent,
    };

    let createdTenant: {
      id: string;
      name: string;
      slug: string;
      status: TenantStatus;
      trialStartsAt: Date | null;
      trialEndsAt: Date | null;
    };
    let createdSubscription: {
      id: string;
      planId: string;
      status: SubscriptionStatus;
      paymentStatus: PaymentStatus;
      trialStartsAt: Date | null;
      trialEndsAt: Date | null;
    };

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const tenant = await tx.tenant.create({
          data: {
            name: dto.company.name,
            slug: dto.company.slug,
            status: TenantStatus.TRIAL,
            trialStartsAt,
            trialEndsAt,
            currentPlanId: plan.id,
            metadata: {
              ...(dto.company.businessType
                ? { businessType: dto.company.businessType }
                : {}),
              ...(dto.company.websiteUrl
                ? { websiteUrl: dto.company.websiteUrl }
                : {}),
              signupSource: 'public',
            },
          },
        });

        const user = await tx.user.create({
          data: {
            name: dto.owner.name,
            phone: dto.owner.phone,
            email: dto.owner.email ?? null,
            passwordHash,
            role: UserRole.SUPER_ADMIN,
            tenantId: tenant.id,
            phoneVerified: new Date(),
          },
        });

        const subscription = await tx.subscription.create({
          data: {
            tenantId: tenant.id,
            planId: plan.id,
            status: SubscriptionStatus.TRIALING,
            paymentStatus: PaymentStatus.NOT_REQUIRED,
            trialStartsAt,
            trialEndsAt,
            currentPeriodStart: trialStartsAt,
            currentPeriodEnd: trialEndsAt,
          },
        });

        await this.auditLogService.writeAuditLog(
          {
            ...audit,
            actorUserId: user.id,
            actorRole: UserRole.SUPER_ADMIN,
            tenantId: tenant.id,
            action: 'tenant.self_registered',
            resourceType: 'Tenant',
            resourceId: tenant.id,
            newValue: {
              name: tenant.name,
              slug: tenant.slug,
              planSlug: plan.slug,
            },
            reason: 'Public self-service signup',
          },
          tx,
        );

        return { tenant, user, subscription };
      });

      createdTenant = result.tenant;
      createdSubscription = result.subscription;
    } catch (error) {
      this.handleUniqueViolation(error);
      throw error;
    }

    const loginResponse = await this.authService.login(
      dto.owner.phone,
      dto.owner.password,
    );

    return {
      tenant: {
        id: createdTenant.id,
        name: createdTenant.name,
        slug: createdTenant.slug,
        status: createdTenant.status,
        trialStartsAt: createdTenant.trialStartsAt,
        trialEndsAt: createdTenant.trialEndsAt,
      },
      subscription: {
        id: createdSubscription.id,
        planId: createdSubscription.planId,
        status: createdSubscription.status,
        paymentStatus: createdSubscription.paymentStatus,
        trialStartsAt: createdSubscription.trialStartsAt,
        trialEndsAt: createdSubscription.trialEndsAt,
      },
      plan: {
        id: plan.id,
        name: plan.name,
        slug: plan.slug,
      },
      user: loginResponse.user,
      accessToken: loginResponse.accessToken,
      refreshToken: loginResponse.refreshToken,
      expiresIn: loginResponse.expiresIn,
    };
  }

  private async findPublicPlan(slug: string) {
    const plan = await this.prisma.plan.findUnique({ where: { slug } });
    if (!plan || !plan.isActive || plan.archivedAt || !plan.isPublic) {
      throw new NotFoundException('Selected plan is not available');
    }
    return plan;
  }

  private async assertNoConflicts(dto: PublicSubscribeDto): Promise<void> {
    const [existingTenant, existingUser, existingEmail] = await Promise.all([
      this.prisma.tenant.findUnique({ where: { slug: dto.company.slug } }),
      this.prisma.user.findUnique({ where: { phone: dto.owner.phone } }),
      dto.owner.email
        ? this.prisma.user.findUnique({ where: { email: dto.owner.email } })
        : Promise.resolve(null),
    ]);

    if (existingTenant) {
      throw new ConflictException('Company slug already taken');
    }
    if (existingUser) {
      throw new ConflictException('Phone number already registered');
    }
    if (existingEmail) {
      throw new ConflictException('Email already registered');
    }
  }

  private handleUniqueViolation(error: unknown): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const target = (error.meta?.target as string[] | undefined) ?? [];
      if (target.includes('slug')) {
        throw new ConflictException('Company slug already taken');
      }
      if (target.includes('phone')) {
        throw new ConflictException('Phone number already registered');
      }
      if (target.includes('email')) {
        throw new ConflictException('Email already registered');
      }
      throw new ConflictException('A record with these details already exists');
    }
  }

  private parseTrialDays(raw: string | undefined): number {
    const parsed = raw ? parseInt(raw, 10) : DEFAULT_TRIAL_DAYS;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TRIAL_DAYS;
  }

  async requestDemo(
    dto: RequestDemoDto,
    requestContext?: OnboardingRequestContext,
  ): Promise<RequestDemoResponseDto> {
    const audit: AuditActorContext = {
      ipAddress: requestContext?.ipAddress,
      userAgent: requestContext?.userAgent,
    };

    const demoRequest = await this.prisma.$transaction(async (tx) => {
      const created = await tx.demoRequest.create({
        data: {
          name: dto.name,
          companyName: dto.companyName,
          phone: dto.phone,
          email: dto.email ?? null,
          businessType: dto.businessType,
          monthlyShipments: dto.monthlyShipments ?? null,
          message: dto.message ?? null,
          interestedPlanSlug: dto.interestedPlanSlug ?? null,
          ipAddress: audit.ipAddress ?? null,
          userAgent: audit.userAgent ?? null,
        },
        select: { id: true },
      });

      await this.auditLogService.writeAuditLog(
        {
          ...audit,
          action: 'demo_request.created',
          resourceType: 'DemoRequest',
          resourceId: created.id,
          newValue: {
            name: dto.name,
            companyName: dto.companyName,
            businessType: dto.businessType,
            interestedPlanSlug: dto.interestedPlanSlug ?? null,
          },
          reason: 'Public demo request submission',
        },
        tx,
      );

      return created;
    });

    return {
      id: demoRequest.id,
      message: 'Demo request received',
    };
  }
}
