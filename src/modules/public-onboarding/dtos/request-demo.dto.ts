import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RequestDemoDto {
  @ApiProperty({ example: 'Ahmed Ali', minLength: 2, maxLength: 120 })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @ApiProperty({ example: 'Cairo Express', minLength: 2, maxLength: 120 })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  companyName: string;

  @ApiProperty({ example: '01012345678' })
  @IsString()
  @Matches(/^01[0-9]{9}$/, {
    message:
      'phone must be a valid Egyptian number (11 digits starting with 01)',
  })
  phone: string;

  @ApiProperty({ required: false, example: 'ahmed@cairoexpress.com' })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @ApiProperty({ example: 'E-commerce', minLength: 1, maxLength: 80 })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  businessType: string;

  @ApiProperty({ required: false, example: '500-1000' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  monthlyShipments?: string;

  @ApiProperty({ required: false, example: 'I want a demo for my team' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;

  @ApiProperty({ required: false, example: 'growth' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  interestedPlanSlug?: string;
}

export class RequestDemoResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: 'Demo request received' })
  message: string;
}
