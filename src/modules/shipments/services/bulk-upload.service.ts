import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@core/prisma/prisma.service';
import { Prisma, UserRole, Zone } from '@prisma/client';
import { TrackingNumberService } from './tracking-number.service';
import { FraudDetectionService } from './fraud-detection.service';
import {
  Shipment,
  ShipmentStatus,
  ShipmentType,
} from '../entities/shipment.entity';
import * as XLSX from 'xlsx';

export interface BulkUploadContext {
  merchantId: string;
  tenantId: string | null;
  uploadedByUserId: string;
  uploadedByRole: UserRole;
}

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

export type BulkShipmentData = BulkRow;

export interface BulkResult {
  totalRows: number;
  successCount: number;
  failedCount: number;
  errors: Array<{ rowIndex: number; message: string }>;
  shipments?: Shipment[];
}

interface ValidatedBulkRow {
  customerName: string;
  customerPhone: string;
  customerPhone2: string | null;
  addressText: string;
  address?: string | Record<string, unknown>;
  type: ShipmentType;
  codAmount: Prisma.Decimal;
  codAmountNumber: number;
  productDescription: string;
  productValue: Prisma.Decimal;
  weight: Prisma.Decimal;
  pieces: number;
  notes: string | null;
  preferredDeliveryDate: Date | null;
}

type ResolvedMerchant = {
  id: string;
  tenantId: string | null;
  isActive: boolean;
};

const ADMIN_UPLOAD_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.OPERATIONS_MANAGER,
];

@Injectable()
export class BulkUploadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly trackingNumberService: TrackingNumberService,
    private readonly fraudDetection: FraudDetectionService,
  ) {}

  processFile(buffer: Buffer, context: BulkUploadContext): Promise<BulkResult>;
  processFile(
    buffer: Buffer,
    context: BulkUploadContext,
  ): Promise<BulkResult>;
  async processFile(
    buffer: Buffer,
    tenantId: string,
    actorUserId: string,
    actorRole: UserRole,
    requestedMerchantId?: string,
  ): Promise<BulkResult>;
  async processFile(
    buffer: Buffer,
    contextOrTenantId: BulkUploadContext | string,
    actorUserId?: string,
    actorRole?: UserRole,
    requestedMerchantId?: string,
  ): Promise<BulkResult> {
    let context: BulkUploadContext;

    if (typeof contextOrTenantId === 'string') {
      if (!actorUserId || !actorRole) {
        throw new ForbiddenException('Invalid bulk upload identity context');
      }

      const tenantId = contextOrTenantId;
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

      context = {
        merchantId: merchant.id,
        tenantId,
        uploadedByUserId: actorUserId,
        uploadedByRole: actorRole,
      };
    } else {
      context = contextOrTenantId;
    }

    const rows = this.parseFile(buffer);
    return this.processRows(rows, context);
  }

  private parseFile(buffer: Buffer): BulkRow[] {
    try {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
        defval: '',
      });

      return raw.map((row) => {
        const addressRaw = this.firstCellValue(row, ['address']);
        let address: string | Record<string, unknown> | undefined;
        if (typeof addressRaw === 'string' && addressRaw.trim()) {
          address = addressRaw.trim();
        } else if (typeof addressRaw === 'object' && addressRaw !== null) {
          address = addressRaw as Record<string, unknown>;
        }

        return {
          customerName: this.firstCellText(row, [
            'customerName',
            'customer_name',
          ]),
          customerPhone: this.firstCellText(row, [
            'customerPhone',
            'customer_phone',
          ]),
          customerPhone2: this.firstCellText(row, [
            'customerPhone2',
            'customer_phone2',
          ]),
          addressText: this.firstCellText(row, ['addressText', 'address_text']),
          address,
          type: this.firstCellText(row, ['type']),
          codAmount: this.firstCellValue(row, ['codAmount', 'cod_amount']) as
            | number
            | string
            | undefined,
          productDescription: this.firstCellText(row, [
            'productDescription',
            'product_description',
          ]),
          productValue: this.firstCellValue(row, [
            'productValue',
            'product_value',
          ]) as number | string | undefined,
          weight: this.firstCellValue(row, ['weight']) as
            | number
            | string
            | undefined,
          pieces: this.firstCellValue(row, ['pieces']) as
            | number
            | string
            | undefined,
          notes: this.firstCellText(row, ['notes']),
          zone: this.firstCellText(row, ['zone']),
          preferredDeliveryDate: this.firstCellText(row, [
            'preferredDeliveryDate',
            'preferred_delivery_date',
          ]),
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
    context: BulkUploadContext,
  ): Promise<BulkResult> {
    this.assertAllowedContext(context);
    const tenantId = context.tenantId;
    const merchant = await this.prisma.merchant.findFirst({
      where: { id: context.merchantId, tenantId },
      select: { id: true, tenantId: true, isActive: true },
    });
    this.assertMerchantContext(merchant, context);

    if (rows.length === 0) {
      throw new BadRequestException('File contains no data rows');
    }
    if (rows.length > 5000) {
      throw new BadRequestException('Maximum 5,000 rows allowed per upload');
    }

    const zones = await this.prisma.zone.findMany({
      where: { isActive: true },
      select: { id: true, code: true, nameAr: true },
    });
    const zoneByCode = new Map(
      zones.map((zone) => [this.normalizeZoneValue(zone.code), zone]),
    );
    const zoneByNameAr = new Map(
      zones.map((zone) => [this.normalizeZoneValue(zone.nameAr), zone]),
    );

    const errors: Array<{ rowIndex: number; message: string }> = [];
    const validRows: Array<{
      rowIndex: number;
      data: ValidatedBulkRow;
      zoneId?: string;
    }> = [];

    for (let index = 0; index < rows.length; index++) {
      const rowIndex = index + 2;
      const validation = this.validateRow(
        rows[index],
        zoneByCode,
        zoneByNameAr,
      );
      if (validation.error) {
        errors.push({ rowIndex, message: validation.error });
      } else {
        validRows.push({
          rowIndex,
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

    const trackingNumbers = await this.trackingNumberService.generateBatch(
      validRows.length,
    );

    const shipmentCreates: Prisma.ShipmentCreateManyInput[] = validRows.map(
      (validRow, index) => {
        const data = validRow.data;
        const address = this.parseAddress(data.address, data.addressText);

        return {
          trackingNumber: trackingNumbers[index],
          merchantId: context.merchantId,
          tenantId,
          status: ShipmentStatus.PENDING,
          type: data.type,
          customerName: data.customerName,
          customerPhone: data.customerPhone,
          customerPhone2: data.customerPhone2,
          address: address as Prisma.InputJsonValue,
          addressText: data.addressText,
          codAmount: data.codAmount,
          productDescription: data.productDescription,
          productValue: data.productValue,
          weight: data.weight,
          pieces: data.pieces,
          notes: data.notes,
          zoneId: validRow.zoneId ?? null,
          preferredDeliveryDate: data.preferredDeliveryDate,
          riskScore: this.fraudDetection.calculateRiskScore({
            customerPhone: data.customerPhone,
            addressText: data.addressText,
            codAmount: data.codAmountNumber,
            customerName: data.customerName,
          }),
          deliveryAttempts: 0,
          autoDispatchEligible: true,
          addressVerified: false,
        };
      },
    );

    this.assertCreateDataContext(shipmentCreates, context);

    const batchSize = 100;
    const createdShipments: Shipment[] = [];

    for (let index = 0; index < shipmentCreates.length; index += batchSize) {
      const batch = shipmentCreates.slice(index, index + batchSize);
      const result = await this.prisma.$transaction(async (tx) => {
        const currentMerchant = await tx.merchant.findFirst({
          where: { id: context.merchantId, tenantId },
          select: { id: true, tenantId: true, isActive: true },
        });
        this.assertMerchantContext(currentMerchant, context);
        this.assertCreateDataContext(batch, context);

        await tx.shipment.createMany({ data: batch });

        const shipments = await tx.shipment.findMany({
          where: {
            trackingNumber: {
              in: batch.map((shipment) => shipment.trackingNumber),
            },
            merchantId: context.merchantId,
            tenantId: context.tenantId,
          },
        });

        const logData: Prisma.ShipmentStatusLogCreateManyInput[] =
          shipments.map((shipment) => ({
            shipmentId: shipment.id,
            newStatus: ShipmentStatus.PENDING,
            previousStatus: null,
            changedByUserId: context.uploadedByUserId,
            changedByRole: context.uploadedByRole,
            metadata: {
              riskScore: shipment.riskScore,
              source: 'bulk-upload',
            },
          }));

        if (logData.length > 0) {
          await tx.shipmentStatusLog.createMany({ data: logData });
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
    zoneByCode: Map<string, Pick<Zone, 'id' | 'code' | 'nameAr'>>,
    zoneByNameAr: Map<string, Pick<Zone, 'id' | 'code' | 'nameAr'>>,
  ): { error?: string; data?: ValidatedBulkRow; zoneId?: string } {
    const errors: string[] = [];
    const customerName = row.customerName?.trim();
    const customerPhone = row.customerPhone?.trim();
    const customerPhone2 = row.customerPhone2?.trim() || null;
    const addressText = row.addressText?.trim();
    const productDescription = row.productDescription?.trim();

    if (!customerName) errors.push('customerName is required');
    if (!customerPhone) errors.push('customerPhone is required');
    else if (!this.isValidEgyptianPhone(customerPhone)) {
      errors.push(
        'customerPhone must be a valid Egyptian phone (11 digits starting with 01)',
      );
    }
    if (!addressText) errors.push('addressText is required');
    if (!productDescription) {
      errors.push('productDescription is required');
    }

    const type = this.parseShipmentType(row.type);
    if (!type) {
      errors.push(
        `type must be one of: ${Object.values(ShipmentType).join(', ')}`,
      );
    }

    const hasCodAmount = this.hasCellValue(row.codAmount);
    if (type === ShipmentType.COD && !hasCodAmount) {
      errors.push('codAmount is required for COD shipments');
    }
    const codAmount = hasCodAmount
      ? this.parseDecimal(row.codAmount)
      : this.zeroDecimalValue();
    if (hasCodAmount && (!codAmount || codAmount.number < 0)) {
      errors.push('codAmount must be finite and non-negative');
    }

    const productValue = this.hasCellValue(row.productValue)
      ? this.parseDecimal(row.productValue)
      : this.zeroDecimalValue();
    if (!productValue || productValue.number < 0) {
      errors.push('productValue must be finite and non-negative');
    }

    const weight = this.hasCellValue(row.weight)
      ? this.parseDecimal(row.weight)
      : this.oneDecimalValue();
    if (!weight || weight.number <= 0) {
      errors.push('weight must be finite and greater than zero');
    }

    const pieces = this.hasCellValue(row.pieces)
      ? this.parseFiniteNumber(row.pieces)
      : 1;
    if (pieces === null || !Number.isInteger(pieces) || pieces <= 0) {
      errors.push('pieces must be a positive integer');
    }

    const preferredDeliveryDate = row.preferredDeliveryDate?.trim()
      ? this.parsePreferredDeliveryDate(row.preferredDeliveryDate)
      : null;
    if (row.preferredDeliveryDate?.trim() && !preferredDeliveryDate) {
      errors.push('preferredDeliveryDate must be a valid date');
    }

    let zoneId: string | undefined;
    if (row.zone?.trim()) {
      const zoneKey = this.normalizeZoneValue(row.zone);
      const matched = zoneByCode.get(zoneKey) || zoneByNameAr.get(zoneKey);
      if (matched) {
        zoneId = matched.id;
      } else {
        errors.push(
          `zone "${row.zone}" not found. Use an active zone code or Arabic name.`,
        );
      }
    }

    if (errors.length > 0) {
      return { error: errors.join('; ') };
    }

    return {
      data: {
        customerName,
        customerPhone,
        customerPhone2,
        addressText,
        address: row.address,
        type: type!,
        codAmount:
          type === ShipmentType.COD
            ? codAmount!.decimal
            : new Prisma.Decimal(0),
        codAmountNumber: type === ShipmentType.COD ? codAmount!.number : 0,
        productDescription,
        productValue: productValue!.decimal,
        weight: weight!.decimal,
        pieces: pieces!,
        notes: row.notes?.trim() || null,
        preferredDeliveryDate,
      },
      zoneId,
    };
  }

  private assertAllowedContext(
    context: BulkUploadContext,
  ): asserts context is BulkUploadContext & { tenantId: string } {
    const allowedRoles = [UserRole.MERCHANT, ...ADMIN_UPLOAD_ROLES];
    if (!allowedRoles.includes(context.uploadedByRole)) {
      throw new ForbiddenException('Role cannot perform shipment bulk upload');
    }
    if (!context.merchantId || !context.uploadedByUserId) {
      throw new ForbiddenException('Invalid bulk upload identity context');
    }
    if (!context.tenantId) {
      throw new ForbiddenException('Bulk upload tenant context is required');
    }
  }

  private assertMerchantContext(
    merchant: ResolvedMerchant | null,
    context: BulkUploadContext,
  ): asserts merchant is ResolvedMerchant {
    if (!merchant) {
      throw new NotFoundException('Merchant not found');
    }
    if (!merchant.isActive) {
      throw new ForbiddenException('Merchant profile is inactive');
    }
    if (
      merchant.id !== context.merchantId ||
      merchant.tenantId !== context.tenantId
    ) {
      throw new ForbiddenException('Merchant tenant context mismatch');
    }
  }

  private assertCreateDataContext(
    data: Prisma.ShipmentCreateManyInput[],
    context: BulkUploadContext,
  ): void {
    const invalidContext = data.some(
      (shipment) =>
        shipment.merchantId !== context.merchantId ||
        shipment.tenantId !== context.tenantId,
    );
    if (invalidContext) {
      throw new ForbiddenException('Shipment bulk upload context mismatch');
    }
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
        // A non-JSON address cell is retained as free text.
      }
      return { text: raw.trim() };
    }
    if (typeof raw === 'object' && raw !== null) {
      return raw;
    }
    return { text: fallbackText };
  }

  private parseDecimal(
    value: number | string | undefined,
  ): { decimal: Prisma.Decimal; number: number } | null {
    const numberValue = this.parseFiniteNumber(value);
    if (numberValue === null) return null;

    try {
      return {
        decimal: new Prisma.Decimal(String(value).trim()),
        number: numberValue,
      };
    } catch {
      return null;
    }
  }

  private parseFiniteNumber(value: number | string | undefined): number | null {
    if (!this.hasCellValue(value)) return null;
    const parsed = Number(String(value).trim());
    return Number.isFinite(parsed) ? parsed : null;
  }

  private zeroDecimalValue() {
    return { decimal: new Prisma.Decimal(0), number: 0 };
  }

  private oneDecimalValue() {
    return { decimal: new Prisma.Decimal(1), number: 1 };
  }

  private parsePreferredDeliveryDate(value: string): Date | null {
    const normalized = value.trim();
    if (/^\d+(?:\.\d+)?$/.test(normalized)) {
      const serial = Number(normalized);
      if (!Number.isFinite(serial) || serial <= 0 || serial > 2_958_465) {
        return null;
      }
      const excelEpoch = Date.UTC(1899, 11, 30);
      const parsedExcelDate = new Date(
        excelEpoch + Math.round(serial * 86_400_000),
      );
      return Number.isNaN(parsedExcelDate.getTime()) ? null : parsedExcelDate;
    }

    const calendarDate = normalized.match(/^(\d{4})-(\d{2})-(\d{2})(?:T|$)/);
    if (calendarDate) {
      const year = Number(calendarDate[1]);
      const month = Number(calendarDate[2]);
      const day = Number(calendarDate[3]);
      const validationDate = new Date(Date.UTC(year, month - 1, day));
      if (
        validationDate.getUTCFullYear() !== year ||
        validationDate.getUTCMonth() !== month - 1 ||
        validationDate.getUTCDate() !== day
      ) {
        return null;
      }
    }

    const parsed = new Date(normalized);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private firstCellValue(
    row: Record<string, unknown>,
    keys: string[],
  ): unknown {
    for (const key of keys) {
      const value = row[key];
      if (this.hasCellValue(value)) return value;
    }
    return undefined;
  }

  private firstCellText(row: Record<string, unknown>, keys: string[]): string {
    const value = this.firstCellValue(row, keys);
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    if (value instanceof Date) return value.toISOString();
    return '';
  }

  private hasCellValue(value: unknown): boolean {
    return (
      value !== undefined &&
      value !== null &&
      (typeof value !== 'string' || value.trim() !== '')
    );
  }

  private normalizeZoneValue(value: string): string {
    return value.trim().toLocaleLowerCase('ar-EG');
  }

  private isValidEgyptianPhone(phone: string): boolean {
    return /^01[0-25]\d{8}$/.test(phone);
  }
}
