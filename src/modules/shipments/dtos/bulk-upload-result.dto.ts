import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ShipmentResponseDto } from './shipment-response.dto';

export class BulkUploadErrorDto {
  @ApiProperty({ example: 2, description: 'One-based Excel row number.' })
  rowIndex: number;

  @ApiProperty({ example: 'customerPhone must be a valid Egyptian phone' })
  message: string;
}

export class BulkUploadResultDto {
  @ApiProperty({ example: 10 })
  totalRows: number;

  @ApiProperty({ example: 8 })
  successCount: number;

  @ApiProperty({ example: 2 })
  failedCount: number;

  @ApiProperty({ type: [BulkUploadErrorDto] })
  errors: BulkUploadErrorDto[];

  @ApiPropertyOptional({ type: [ShipmentResponseDto] })
  shipments?: ShipmentResponseDto[];
}
