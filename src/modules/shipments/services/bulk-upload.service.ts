import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@core/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { ShipmentsRepository } from '../repositories/shipments.repository';
import { TrackingNumberService } from './tracking-number.service';
import { FraudDetectionService } from './fraud-detection.service';
import {
  Shipment,
  ShipmentStatus,
  ShipmentType,
} from '../entities/shipment.entity';
import { UserRole, Zone } from '@prisma/client';
import * as XLSX from 'xlsx';

export interface BulkRow {
  customerName: string;
  customerPhone: string;
  customerPhone2?: string;
  addressText: string;
  address?: string | Record<string, unknown>;
  type: string;
  codAmount?: number | string;
  productDescription: string;
  productValue?: number | string;
  weight?: number | string;
  pieces?: number | string;
  notes?: string;
  zone?: string;
  preferredDeliveryDate?: string;
}

export interface BulkShipmentData {
  customerName: string;
  customerPhone: string;
  customerPhone2?: string;
  addressText: string;
  address?: string | Record<string, unknown>;
  type: string;
  codAmount?: number | string;
  productDescription: string;
  productValue?: number | string;
  weight?: number | string;
  pieces?: number | string;
  notes?: string;
  zone?: string;
  preferredDeliveryDate?: string;
}

export interface BulkResult {
  totalRows: number;
  successCount: number;
  failedCount: number;
  errors: Array<{ rowIndex: number; message: string }>;
  shipments?: Shipment[];
}

@Injectable()
export class BulkUploadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly shipmentsRepository: ShipmentsRepository,
    private readonly trackingNumberService: TrackingNumberService,
    private readonly fraudDetection: FraudDetectionService,
  ) {}

  async processFile(
    buffer: Buffer,
    tenantId: string,
    actorUserId: string,
    actorRole: UserRole,
    requestedMerchantId?: string,
  ): Promise<BulkResult> {
    const merchant = await this.prisma.merchant.findFirst({
      where:
        actorRole === UserRole.MERCHANT
          ? { tenantId, userId: actorUserId, isActive: true }
          : requestedMerchantId
            ? { id: requestedMerchantId, tenantId, isActive: true }
            : { tenantId, userId: actorUserId, isActive: true },
      select: { id: true },
    });
    if (!merchant) throw new NotFoundException('Merchant not found');
    const rows = this.parseFile(buffer);
    return this.processRows(rows, merchant.id, tenantId);
  }

  private parseFile(buffer: Buffer): BulkRow[] {
    try {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
        defval: '',
      });

      return raw.map((r) => {
        const addressRaw = r['address'];
        let address: string | Record<string, unknown> | undefined;
        if (typeof addressRaw === 'string' && addressRaw.trim()) {
          address = addressRaw.trim();
        } else if (typeof addressRaw === 'object' && addressRaw !== null) {
          address = addressRaw as Record<string, unknown>;
        }

        return {
          customerName: this.toCellString(
            r['customerName'] || r['customer_name'],
          ),
          customerPhone: this.toCellString(
            r['customerPhone'] || r['customer_phone'],
          ),
          customerPhone2: this.toCellString(
            r['customerPhone2'] || r['customer_phone2'],
          ),
          addressText: this.toCellString(r['addressText'] || r['address_text']),
          address,
          type: this.toCellString(r['type']),
          codAmount: (r['codAmount'] || r['cod_amount'] || undefined) as
            | number
            | string
            | undefined,
          productDescription: this.toCellString(
            r['productDescription'] || r['product_description'],
          ),
          productValue: (r['productValue'] ||
            r['product_value'] ||
            undefined) as number | string | undefined,
          weight: (r['weight'] || undefined) as number | string | undefined,
          pieces: (r['pieces'] || undefined) as number | string | undefined,
          notes: this.toCellString(r['notes']),
          zone: this.toCellString(r['zone']),
          preferredDeliveryDate: this.toCellString(
            r['preferredDeliveryDate'] || r['preferred_delivery_date'],
          ),
        };
      });
    } catch {
      throw new BadRequestException(
        'Failed to parse file. Ensure it is a valid Excel or CSV file.',
      );
    }
  }

  private async processRows(
    rows: BulkRow[],
    merchantId: string,
    tenantId: string,
  ): Promise<BulkResult> {
    if (rows.length === 0) {
      throw new BadRequestException('File contains no data rows');
    }
    if (rows.length > 5000) {
      throw new BadRequestException('Maximum 5,000 rows allowed per upload');
    }

    // Pre-load all zones for fast lookup
    const zones = await this.prisma.zone.findMany({
      where: { isActive: true },
      select: { id: true, code: true, nameAr: true },
    });
    const zoneByCode = new Map(
      zones.map((z) => [z.code.toLowerCase().trim(), z]),
    );
    const zoneByNameAr = new Map(
      zones.map((z) => [z.nameAr.toLowerCase().trim(), z]),
    );

    const errors: Array<{ rowIndex: number; message: string }> = [];
    const validRows: Array<{
      rowIndex: number;
      data: BulkShipmentData;
      zoneId?: string;
    }> = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // +1 for header, +1 for 0-index
      const validation = this.validateRow(
        row,
        rowNum,
        zones,
        zoneByCode,
        zoneByNameAr,
      );
      if (validation.error) {
        errors.push({ rowIndex: rowNum, message: validation.error });
      } else {
        validRows.push({
          rowIndex: rowNum,
          data: validation.data!,
          zoneId: validation.zoneId,
        });
      }
    }

    if (validRows.length === 0) {
      return {
        totalRows: rows.length,
        successCount: 0,
        failedCount: errors.length,
        errors,
      };
    }

    // Generate tracking numbers in batch
    const trackingNumbers = await this.trackingNumberService.generateBatch(
      validRows.length,
    );

    // Build shipment creates
    const shipmentCreates = validRows.map((vr, idx) => {
      const type = this.parseShipmentType(String(vr.data.type))!;
      const codAmount =
        type === ShipmentType.COD ? Number(vr.data.codAmount ?? 0) : 0;

      const address = this.parseAddress(
        vr.data.address,
        String(vr.data.addressText),
      );

      return {
        trackingNumber: trackingNumbers[idx],
        tenantId,
        merchantId,
        status: ShipmentStatus.PENDING,
        type,
        customerName: String(vr.data.customerName),
        customerPhone: String(vr.data.customerPhone),
        customerPhone2: vr.data.customerPhone2?.trim() || null,
        address,
        addressText: String(vr.data.addressText),
        codAmount,
        productDescription: String(vr.data.productDescription),
        productValue: Number(vr.data.productValue ?? 0),
        weight: Number(vr.data.weight ?? 1),
        pieces: Number(vr.data.pieces ?? 1),
        notes: vr.data.notes?.trim() || null,
        zoneId: vr.zoneId ?? null,
        preferredDeliveryDate: vr.data.preferredDeliveryDate
          ? new Date(vr.data.preferredDeliveryDate)
          : null,
        riskScore: this.fraudDetection.calculateRiskScore({
          customerPhone: String(vr.data.customerPhone),
          addressText: String(vr.data.addressText),
          codAmount,
          customerName: String(vr.data.customerName),
        }),
        deliveryAttempts: 0,
        autoDispatchEligible: true,
        addressVerified: false,
      };
    });

    // Insert in batches of 100
    const BATCH_SIZE = 100;
    const createdShipments: Shipment[] = [];

    for (let i = 0; i < shipmentCreates.length; i += BATCH_SIZE) {
      const batch = shipmentCreates.slice(i, i + BATCH_SIZE);
      const result = await this.prisma.$transaction(async (tx) => {
        await tx.shipment.createMany({
          data: batch as unknown as Prisma.ShipmentCreateManyInput[],
        });

        // Fetch created shipments by tracking numbers to return them
        const shipments = await tx.shipment.findMany({
          where: {
            tenantId,
            trackingNumber: { in: batch.map((s) => s.trackingNumber) },
          },
        });

        // Create status logs
        const logData = shipments.map((s) => ({
          shipmentId: s.id,
          newStatus: ShipmentStatus.PENDING,
          previousStatus: null as ShipmentStatus | null,
          metadata: { riskScore: s.riskScore, source: 'bulk-upload' },
        }));

        if (logData.length > 0) {
          await tx.shipmentStatusLog.createMany({
            data: logData as unknown as Prisma.ShipmentStatusLogCreateManyInput[],
          });
        }

        return shipments;
      });

      createdShipments.push(...result);
    }

    return {
      totalRows: rows.length,
      successCount: createdShipments.length,
      failedCount: errors.length,
      errors,
      shipments: createdShipments,
    };
  }

  private validateRow(
    row: BulkRow,
    rowNum: number,
    _zones: Pick<Zone, 'id' | 'code' | 'nameAr'>[],
    zoneByCode: Map<string, Pick<Zone, 'id' | 'code' | 'nameAr'>>,
    zoneByNameAr: Map<string, Pick<Zone, 'id' | 'code' | 'nameAr'>>,
  ): { error?: string; data?: BulkShipmentData; zoneId?: string } {
    const errors: string[] = [];

    if (!row.customerName?.trim()) errors.push('customerName is required');
    if (!row.customerPhone?.trim()) errors.push('customerPhone is required');
    else if (!this.isValidEgyptianPhone(row.customerPhone.trim())) {
      errors.push(
        'customerPhone must be a valid Egyptian phone (11 digits starting with 01)',
      );
    }

    if (!row.addressText?.trim()) errors.push('addressText is required');
    if (!row.productDescription?.trim())
      errors.push('productDescription is required');

    const type = this.parseShipmentType(row.type);
    if (!type)
      errors.push(
        `type must be one of: ${Object.values(ShipmentType).join(', ')}`,
      );
    if (
      type === ShipmentType.COD &&
      (row.codAmount === undefined || row.codAmount === '')
    ) {
      errors.push('codAmount is required for COD shipments');
    }

    let zoneId: string | undefined;
    if (row.zone?.trim()) {
      const zoneKey = row.zone.trim().toLowerCase();
      const matched = zoneByCode.get(zoneKey) || zoneByNameAr.get(zoneKey);
      if (matched) {
        zoneId = matched.id;
      } else {
        errors.push(
          `zone "${row.zone}" not found. Use an existing zone code or Arabic name.`,
        );
      }
    }

    if (errors.length > 0) {
      return { error: errors.join('; ') };
    }

    return {
      data: row,
      zoneId,
    };
  }

  private parseShipmentType(value: string): ShipmentType | null {
    const normalized = value.toUpperCase().trim();
    if (Object.values(ShipmentType).includes(normalized as ShipmentType)) {
      return normalized as ShipmentType;
    }
    return null;
  }

  private parseAddress(
    raw: string | Record<string, unknown> | undefined,
    fallbackText: string,
  ): Record<string, unknown> {
    if (typeof raw === 'string' && raw.trim()) {
      try {
        const parsed: unknown = JSON.parse(raw);
        if (typeof parsed === 'object' && parsed !== null) {
          return parsed as Record<string, unknown>;
        }
      } catch {
        // not JSON, treat as text
      }
      return { text: raw.trim() };
    }
    if (typeof raw === 'object' && raw !== null) {
      return raw;
    }
    return { text: fallbackText };
  }

  private isValidEgyptianPhone(phone: string): boolean {
    return /^01[0-25]\d{8}$/.test(phone);
  }

  private toCellString(value: unknown): string {
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      return String(value);
    }
    return '';
  }
}
