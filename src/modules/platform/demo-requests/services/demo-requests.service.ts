import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DemoRequestStatus } from '@prisma/client';
import { AuthenticatedRequestUser } from '@common/interfaces/request-context.interface';
import { PlatformAuditLogService } from '@modules/platform/audit-logs/services/platform-audit-log.service';
import {
  DemoRequestResponseDto,
  ListDemoRequestsQueryDto,
  UpdateDemoRequestDto,
} from '../dtos';
import {
  DemoRequestRecord,
  DemoRequestsRepository,
} from '../repositories/demo-requests.repository';

export interface DemoRequestAuditContext {
  user: AuthenticatedRequestUser;
  ipAddress?: string;
  userAgent?: string;
}

const DEFAULT_LIMIT = 20;
const DEFAULT_PAGE = 1;
const MAX_LIMIT = 100;

@Injectable()
export class DemoRequestsService {
  constructor(
    private readonly demoRequestsRepository: DemoRequestsRepository,
    private readonly auditLogService: PlatformAuditLogService,
  ) {}

  async listDemoRequests(query: ListDemoRequestsQueryDto): Promise<{
    data: DemoRequestResponseDto[];
    meta: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    this.assertDateRange(query.from, query.to);

    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const where = this.demoRequestsRepository.buildListWhere(query);
    const orderBy = this.demoRequestsRepository.toOrderBy(
      query.sortBy,
      query.sortOrder,
    );

    const [records, total] = await Promise.all([
      this.demoRequestsRepository.findMany(where, orderBy, skip, limit),
      this.demoRequestsRepository.count(where),
    ]);

    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    return {
      data: records.map((record) => this.toResponse(record)),
      meta: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  async getDemoRequestById(id: string): Promise<DemoRequestResponseDto> {
    const record = await this.demoRequestsRepository.findById(id);
    if (!record) {
      throw new NotFoundException('Demo request not found');
    }
    return this.toResponse(record);
  }

  async updateDemoRequest(
    id: string,
    dto: UpdateDemoRequestDto,
    context: DemoRequestAuditContext,
  ): Promise<DemoRequestResponseDto> {
    const existing = await this.demoRequestsRepository.findById(id);
    if (!existing) {
      throw new NotFoundException('Demo request not found');
    }

    const data: Record<string, unknown> = {};
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.notes !== undefined) data.notes = dto.notes;
    if (dto.contactedAt !== undefined) data.contactedAt = dto.contactedAt;

    if (
      dto.status === DemoRequestStatus.CONTACTED &&
      dto.contactedAt === undefined &&
      existing.contactedAt === null
    ) {
      data.contactedAt = new Date();
    }

    const updated = await this.demoRequestsRepository.update(id, data);

    await this.auditLogService.writeAuditLog({
      user: context.user,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      action: 'demo_request.updated',
      resourceType: 'DemoRequest',
      resourceId: id,
      oldValue: this.toResponse(existing),
      newValue: this.toResponse(updated),
      reason: `Status updated to ${updated.status}`,
    });

    return this.toResponse(updated);
  }

  private toResponse(record: DemoRequestRecord): DemoRequestResponseDto {
    return {
      id: record.id,
      name: record.name,
      companyName: record.companyName,
      phone: record.phone,
      email: record.email,
      businessType: record.businessType,
      monthlyShipments: record.monthlyShipments,
      message: record.message,
      interestedPlanSlug: record.interestedPlanSlug,
      status: record.status,
      contactedAt: record.contactedAt,
      notes: record.notes,
      ipAddress: record.ipAddress,
      userAgent: record.userAgent,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  private assertDateRange(from?: Date, to?: Date): void {
    if (from && to && from > to) {
      throw new BadRequestException('Date range start must be before end');
    }
  }
}
