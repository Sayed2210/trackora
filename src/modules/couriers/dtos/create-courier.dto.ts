import { IsString, IsNotEmpty, IsOptional, IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCourierDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  employeeId: string;

  @ApiProperty()
  @IsArray()
  @IsString({ each: true })
  zoneCodes: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  licensePlate?: string;
}

export class UpdateZonesDto {
  @ApiProperty()
  @IsArray()
  @IsString({ each: true })
  zoneCodes: string[];
}
