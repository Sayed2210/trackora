import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class DemoRequestIdParamDto {
  @ApiProperty({ format: 'uuid', description: 'Demo request ID.' })
  @IsUUID('4')
  id: string;
}
