import {
  IsArray,
  IsEnum,
  IsObject,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export enum SyncAction {
  STATUS_UPDATE = 'STATUS_UPDATE',
}

class SyncUpdateItemDto {
  @ApiProperty()
  @IsString()
  id!: string;

  @ApiProperty()
  @IsUUID('4')
  shipmentId!: string;

  @ApiProperty({ enum: SyncAction })
  @IsEnum(SyncAction)
  action!: SyncAction;

  @ApiProperty()
  @IsObject()
  payload!: Record<string, unknown>;

  @ApiProperty()
  @IsString()
  timestamp!: string;
}

export class SyncUpdatesDto {
  @ApiProperty({ type: [SyncUpdateItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncUpdateItemDto)
  updates!: SyncUpdateItemDto[];
}
