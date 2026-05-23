import { IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class EndImpersonationDto {
  @ApiProperty({
    required: false,
    format: 'uuid',
    description:
      'Optional impersonation session ID. If omitted, ends the current session for the caller context.',
  })
  @IsOptional()
  @IsUUID('4')
  sessionId?: string;

  @ApiProperty({
    required: false,
    description: 'Optional audit note for ending impersonation.',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
