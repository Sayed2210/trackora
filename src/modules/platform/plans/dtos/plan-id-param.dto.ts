import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PlanIdParamDto {
  @ApiProperty()
  @IsUUID('4')
  id: string;
}
