import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { KycStatus } from '../entities/merchant.entity';

export class UpdateKycDto {
  @ApiProperty({ enum: KycStatus })
  @IsEnum(KycStatus)
  status: KycStatus;
}
