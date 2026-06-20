import { Type } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PublicSubscribeCompanyDto {
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

  @ApiProperty({ required: false, example: 'E-commerce' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  businessType?: string;

  @ApiProperty({ required: false, example: 'https://cairoexpress.com' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  websiteUrl?: string;
}

export class PublicSubscribeOwnerDto {
  @ApiProperty({ example: 'Ahmed Ali', minLength: 2, maxLength: 120 })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @ApiProperty({ example: '01012345678' })
  @IsString()
  @Matches(/^01[0-9]{9}$/, {
    message:
      'phone must be a valid Egyptian number (11 digits starting with 01)',
  })
  phone: string;

  @ApiProperty({ example: 'securePassword123', minLength: 6 })
  @IsString()
  @MinLength(6)
  @MaxLength(72)
  password: string;

  @ApiProperty({ required: false, example: 'ahmed@cairoexpress.com' })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;
}

export class PublicSubscribeDto {
  @ApiProperty({ type: PublicSubscribeCompanyDto })
  @ValidateNested()
  @Type(() => PublicSubscribeCompanyDto)
  company: PublicSubscribeCompanyDto;

  @ApiProperty({ type: PublicSubscribeOwnerDto })
  @ValidateNested()
  @Type(() => PublicSubscribeOwnerDto)
  owner: PublicSubscribeOwnerDto;

  @ApiProperty({ example: 'pro' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  planSlug: string;
}

export class PublicSubscribeResponseDto {
  @ApiProperty()
  tenant: {
    id: string;
    name: string;
    slug: string;
    status: string;
    trialStartsAt: Date | null;
    trialEndsAt: Date | null;
  };

  @ApiProperty()
  subscription: {
    id: string;
    planId: string;
    status: string;
    paymentStatus: string;
    trialStartsAt: Date | null;
    trialEndsAt: Date | null;
  };

  @ApiProperty()
  plan: {
    id: string;
    name: string;
    slug: string;
  };

  @ApiProperty()
  accessToken: string;

  @ApiProperty()
  refreshToken: string;

  @ApiProperty()
  expiresIn: number;
}
