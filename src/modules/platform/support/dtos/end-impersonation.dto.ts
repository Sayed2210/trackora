import { IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class EndImpersonationDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID('4')
  sessionId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  reason?: string;
}
