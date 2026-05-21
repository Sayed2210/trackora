import { IsString, IsNotEmpty, MinLength, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

const REGISTERABLE_ROLES = ['MERCHANT', 'COURIER'] as const;

export class RegisterDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty()
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ enum: REGISTERABLE_ROLES })
  @IsIn(REGISTERABLE_ROLES)
  role: typeof REGISTERABLE_ROLES[number];
}

export class LoginDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  password: string;
}

export class RefreshTokenDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

export class AuthUserResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  phone: string;

  @ApiProperty({ required: false })
  email?: string;

  @ApiProperty({ enum: UserRole })
  role: UserRole;

  @ApiProperty({ enum: UserRole, isArray: true })
  roles: UserRole[];

  @ApiProperty({ type: [String] })
  permissions: string[];

  @ApiProperty({ required: false })
  tenantId?: string;

  @ApiProperty()
  isPlatformUser: boolean;

  @ApiProperty({ required: false })
  platformContext?: Record<string, unknown>;

  @ApiProperty({ required: false })
  impersonationContext?: Record<string, unknown>;

  @ApiProperty({ required: false })
  merchantId?: string;

  @ApiProperty({ required: false })
  courierId?: string;

  @ApiProperty()
  isActive: boolean;
}

export class LoginResponseDto {
  @ApiProperty()
  accessToken: string;

  @ApiProperty()
  refreshToken: string;

  @ApiProperty()
  expiresIn: number;

  @ApiProperty({ type: AuthUserResponseDto })
  user: AuthUserResponseDto;
}
