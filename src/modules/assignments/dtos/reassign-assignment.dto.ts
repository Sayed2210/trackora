import { IsNotEmpty, IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReassignAssignmentDto {
  @ApiProperty()
  @IsUUID('4')
  newCourierId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  reason!: string;
}
