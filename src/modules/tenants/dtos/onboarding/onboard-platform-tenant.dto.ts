import { Type } from 'class-transformer';
import {
  IsDate,
  IsEmail,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PaymentStatus, SubscriptionStatus, UserRole } from '@prisma/client';

export const ALLOWED_TENANT_OWNER_ROLES: readonly UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.OPERATIONS_MANAGER,
  UserRole.FINANCE_ADMIN,
];

export class OnboardTenantDto {
  @ApiProperty({ example: 'Cairo Express', minLength: 2, maxLength: 120 })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @ApiProperty({ example: 'cairo-express', minLength: 2, maxLength: 80 })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug must be kebab-case (lowercase letters, numbers, hyphens)',
  })
  slug: string;

  @ApiProperty({ required: false, type: String, format: 'date-time' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  trialStartsAt?: Date;

  @ApiProperty({ required: false, type: String, format: 'date-time' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  trialEndsAt?: Date;

  @ApiProperty({ required: false, type: Object })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class OnboardSubscriptionDto {
  @ApiProperty({
    format: 'uuid',
    description: 'Platform plan to subscribe the tenant to.',
  })
  @IsUUID('4')
  planId: string;

  @ApiProperty({
    enum: SubscriptionStatus,
    required: false,
    default: SubscriptionStatus.TRIALING,
  })
  @IsOptional()
  @IsEnum(SubscriptionStatus)
  status?: SubscriptionStatus;

  @ApiProperty({
    enum: PaymentStatus,
    required: false,
    default: PaymentStatus.NOT_REQUIRED,
  })
  @IsOptional()
  @IsEnum(PaymentStatus)
  paymentStatus?: PaymentStatus;

  @ApiProperty({ required: false, type: String, format: 'date-time' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  currentPeriodStart?: Date;

  @ApiProperty({ required: false, type: String, format: 'date-time' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  currentPeriodEnd?: Date;

  @ApiProperty({
    description:
      'Required audit reason for onboarding the tenant (e.g. offline contract signature).',
    example: 'Tenant onboarding after offline contract',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;
}

export class OnboardOwnerDto {
  @ApiProperty({ example: 'Ahmed Ali', minLength: 2, maxLength: 120 })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @ApiProperty({ example: '01000000000' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({ required: false, example: 'owner@company.com' })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @ApiProperty({
    required: false,
    description:
      'Optional strong temporary password (min 8 chars, at least one letter and one digit). ' +
      'If omitted, a secure password is generated and returned.',
    example: 'Trackora@12345',
  })
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
    message:
      'temporaryPassword must be at least 8 characters and contain both letters and digits',
  })
  temporaryPassword?: string;

  @ApiProperty({
    enum: ALLOWED_TENANT_OWNER_ROLES,
    required: false,
    default: UserRole.SUPER_ADMIN,
    description:
      'Tenant-side admin role for the first owner. Platform roles are not allowed.',
  })
  @IsOptional()
  @IsIn(ALLOWED_TENANT_OWNER_ROLES, {
    message:
      'role must be one of SUPER_ADMIN, OPERATIONS_MANAGER, FINANCE_ADMIN (platform roles are not allowed)',
  })
  role?: UserRole;
}

export class OnboardPlatformTenantDto {
  @ApiProperty({ type: OnboardTenantDto })
  @ValidateNested()
  @Type(() => OnboardTenantDto)
  tenant: OnboardTenantDto;

  @ApiProperty({ type: OnboardSubscriptionDto })
  @ValidateNested()
  @Type(() => OnboardSubscriptionDto)
  subscription: OnboardSubscriptionDto;

  @ApiProperty({ type: OnboardOwnerDto })
  @ValidateNested()
  @Type(() => OnboardOwnerDto)
  owner: OnboardOwnerDto;
}

export class OnboardPlatformTenantResponseDto {
  @ApiProperty()
  tenant: {
    id: string;
    name: string;
    slug: string;
    status: string;
    currentPlanId: string | null;
  };

  @ApiProperty()
  subscription: {
    id: string;
    tenantId: string;
    planId: string;
    status: string;
    paymentStatus: string;
    currentPeriodStart: Date | null;
    currentPeriodEnd: Date | null;
  };

  @ApiProperty()
  owner: {
    id: string;
    tenantId: string;
    name: string;
    phone: string;
    email: string | null;
    role: string;
    isActive: boolean;
  };

  @ApiProperty({ description: 'Generated or echoed temporary password.' })
  credentials: {
    temporaryPassword: string;
  };
}
