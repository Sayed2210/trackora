import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

export class AdminDashboardTodayResponseDto {
  @ApiProperty()
  shipmentsCreated: number;

  @ApiProperty()
  shipmentsDelivered: number;

  @ApiProperty()
  shipmentsFailed: number;

  @ApiProperty()
  totalCodCollected: number;
}

export class AdminDashboardResponseDto {
  @ApiProperty({ type: AdminDashboardTodayResponseDto })
  today: AdminDashboardTodayResponseDto;

  @ApiProperty()
  pendingAssignments: number;

  @ApiProperty()
  couriersOnline: number;

  @ApiProperty()
  couriersOffline: number;
}

export class ExpectedVsActualCashResponseDto {
  @ApiProperty()
  expected: number;

  @ApiProperty()
  actual: number;

  @ApiProperty()
  variance: number;
}

export class FinancialSummaryResponseDto {
  @ApiProperty()
  dailyCodCollected: number;

  @ApiProperty()
  pendingSettlements: number;

  @ApiProperty()
  totalCourierCashHeld: number;

  @ApiProperty({ type: ExpectedVsActualCashResponseDto })
  expectedVsActualCash: ExpectedVsActualCashResponseDto;
}

export class AuditLogResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid', nullable: true })
  userId: string | null;

  @ApiProperty({ format: 'uuid', nullable: true })
  actorUserId: string | null;

  @ApiProperty({ enum: UserRole, nullable: true })
  actorRole: UserRole | null;

  @ApiProperty({ format: 'uuid', nullable: true })
  tenantId: string | null;

  @ApiProperty()
  action: string;

  @ApiProperty()
  entityType: string;

  @ApiProperty()
  entityId: string;

  @ApiProperty({ nullable: true })
  resourceType: string | null;

  @ApiProperty({ nullable: true })
  resourceId: string | null;

  @ApiProperty({ type: Object, nullable: true })
  oldValue: unknown;

  @ApiProperty({ type: Object, nullable: true })
  newValue: unknown;

  @ApiProperty({ nullable: true })
  reason: string | null;

  @ApiProperty({ nullable: true })
  ipAddress: string | null;

  @ApiProperty({ nullable: true })
  userAgent: string | null;

  @ApiProperty({ type: Object, nullable: true })
  metadata: unknown;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;
}

export class PaginatedAuditLogsResponseDto {
  @ApiProperty({ type: [AuditLogResponseDto] })
  data: AuditLogResponseDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;
}

export class CourierPerformanceReportResponseDto {
  @ApiProperty({ format: 'uuid' })
  courierId: string;

  @ApiProperty()
  courierName: string;

  @ApiProperty()
  totalAssigned: number;

  @ApiProperty()
  delivered: number;

  @ApiProperty()
  failed: number;

  @ApiProperty()
  returned: number;

  @ApiProperty()
  successRate: number;

  @ApiProperty({ nullable: true })
  averageDeliveryTimeMinutes: number | null;
}

export class ReturnReasonCountResponseDto {
  @ApiProperty()
  reason: string;

  @ApiProperty()
  count: number;
}

export class MerchantDeliveryReportResponseDto {
  @ApiProperty({ format: 'uuid' })
  merchantId: string;

  @ApiProperty()
  merchantName: string;

  @ApiProperty()
  totalShipments: number;

  @ApiProperty()
  delivered: number;

  @ApiProperty()
  returned: number;

  @ApiProperty()
  successRate: number;

  @ApiProperty({ type: [ReturnReasonCountResponseDto] })
  returnReasons: ReturnReasonCountResponseDto[];
}
