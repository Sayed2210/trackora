import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '@core/prisma/prisma.service';
import { CouriersRepository } from '../repositories/couriers.repository';
import { Courier } from '../entities/courier.entity';
import {
  CourierResponseDto,
  CreateCourierDto,
} from '../dtos/create-courier.dto';

export interface CourierListQuery {
  search?: string;
  isActive?: boolean;
  isAvailable?: boolean;
  zoneCode?: string;
  page?: number;
  limit?: number;
}

type CourierWithUser = Prisma.CourierGetPayload<{
  include: {
    user: {
      select: {
        id: true;
        name: true;
        phone: true;
        email: true;
        role: true;
      };
    };
  };
}>;

@Injectable()
export class CouriersService {
  constructor(
    private readonly couriersRepository: CouriersRepository,
    private readonly prisma: PrismaService,
  ) {}

  async create(
    dto: CreateCourierDto,
    tenantId: string,
  ): Promise<CourierResponseDto> {
    try {
      const courier = await this.prisma.$transaction(async (tx) => {
        const existingPhone = await tx.user.findUnique({
          where: { phone: dto.phone },
          select: { id: true },
        });
        if (existingPhone) {
          throw new ConflictException('Phone number already registered');
        }

        if (dto.email) {
          const existingEmail = await tx.user.findUnique({
            where: { email: dto.email },
            select: { id: true },
          });
          if (existingEmail) {
            throw new ConflictException('Email already registered');
          }
        }

        const zones = await tx.zone.findMany({
          where: {
            code: { in: dto.zoneCodes },
            isActive: true,
          },
          select: { code: true },
        });
        const validZoneCodes = new Set(zones.map((zone) => zone.code));
        const invalidZoneCodes = dto.zoneCodes.filter(
          (zoneCode) => !validZoneCodes.has(zoneCode),
        );
        if (invalidZoneCodes.length > 0) {
          throw new BadRequestException({
            message: 'Invalid zoneCode',
            field: 'zoneCodes',
            invalidZoneCodes,
          });
        }

        const isActive = dto.isActive ?? true;
        const user = await tx.user.create({
          data: {
            name: dto.name,
            phone: dto.phone,
            email: dto.email,
            role: UserRole.COURIER,
            tenantId,
            isActive,
          },
          select: { id: true },
        });

        return tx.courier.create({
          data: {
            userId: user.id,
            tenantId,
            employeeId: dto.employeeId,
            vehicleType: dto.vehicleType,
            licensePlate: dto.licensePlate,
            zoneCodes: dto.zoneCodes,
            maxDailyCapacity: dto.maxDailyCapacity ?? 25,
            isActive,
            isAvailable: dto.isAvailable ?? true,
            cashHeld: 0,
            currentPerformanceScore: 50,
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                phone: true,
                email: true,
                role: true,
              },
            },
          },
        });
      });

      return this.toCourierResponse(courier);
    } catch (error) {
      this.handleCreateError(error);
    }
  }

  async findById(id: string, tenantId: string): Promise<Courier> {
    const courier = await this.couriersRepository.findByIdForTenant(
      id,
      tenantId,
    );
    if (!courier) {
      throw new NotFoundException('Courier not found');
    }
    return courier;
  }

  async findByUserId(
    userId: string,
    tenantId: string,
  ): Promise<Courier | null> {
    return this.couriersRepository.findByUserIdForTenant(userId, tenantId);
  }

  async findAll(tenantId: string, query: CourierListQuery = {}) {
    const page = Math.max(query.page ?? 1, 1);
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);
    const skip = (page - 1) * limit;

    const { data, total } =
      await this.couriersRepository.findWithFiltersForTenant(
        tenantId,
        {
          search: query.search,
          isActive: query.isActive,
          isAvailable: query.isAvailable,
          zoneCode: query.zoneCode,
        },
        skip,
        limit,
      );

    const activeTaskCounts =
      await this.couriersRepository.countActiveTasksByCourierIds(
        data.map((courier) => courier.id),
        tenantId,
      );

    return {
      data: data.map((courier) => ({
        id: courier.id,
        userId: courier.userId,
        name: courier.user?.name,
        phone: courier.user?.phone,
        email: courier.user?.email,
        employeeId: courier.employeeId,
        vehicleType: courier.vehicleType,
        licensePlate: courier.licensePlate,
        zoneCodes: courier.zoneCodes,
        isActive: courier.isActive,
        isAvailable: courier.isAvailable,
        currentTasks: activeTaskCounts.get(courier.id) ?? 0,
        maxDailyCapacity: courier.maxDailyCapacity,
        capacity: courier.maxDailyCapacity,
        rating: courier.currentPerformanceScore,
        cashHeld: courier.cashHeld,
        createdAt: courier.createdAt,
        updatedAt: courier.updatedAt,
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async updateZones(
    id: string,
    zoneCodes: string[],
    tenantId: string,
  ): Promise<Courier> {
    await this.findById(id, tenantId);
    return this.couriersRepository.updateForTenant(id, tenantId, { zoneCodes });
  }

  async updateAvailability(
    id: string,
    isAvailable: boolean,
    tenantId: string,
  ): Promise<Courier> {
    await this.findById(id, tenantId);
    return this.couriersRepository.updateForTenant(id, tenantId, {
      isAvailable,
    });
  }

  async remove(id: string, tenantId: string): Promise<void> {
    await this.findById(id, tenantId);
    await this.couriersRepository.softDeleteForTenant(id, tenantId);
  }

  private toCourierResponse(courier: CourierWithUser): CourierResponseDto {
    return {
      id: courier.id,
      userId: courier.userId,
      user: courier.user,
      name: courier.user.name,
      phone: courier.user.phone,
      email: courier.user.email,
      employeeId: courier.employeeId,
      vehicleType: courier.vehicleType,
      licensePlate: courier.licensePlate,
      zoneCodes: courier.zoneCodes,
      maxDailyCapacity: courier.maxDailyCapacity,
      isActive: courier.isActive,
      isAvailable: courier.isAvailable,
      currentPerformanceScore: courier.currentPerformanceScore,
      cashHeld: courier.cashHeld.toString(),
      cashHeldLimit: courier.cashHeldLimit.toString(),
      avgDeliveryTimeMinutes: courier.avgDeliveryTimeMinutes,
      totalDelivered: courier.totalDelivered,
      totalFailed: courier.totalFailed,
      totalReturned: courier.totalReturned,
      createdAt: courier.createdAt,
      updatedAt: courier.updatedAt,
    };
  }

  private handleCreateError(error: unknown): never {
    if (
      error instanceof ConflictException ||
      error instanceof BadRequestException
    ) {
      throw error;
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const rawTarget = error.meta?.target;
      const target = Array.isArray(rawTarget)
        ? rawTarget
            .filter((value): value is string => typeof value === 'string')
            .join(',')
        : typeof rawTarget === 'string'
          ? rawTarget
          : '';
      if (target.includes('phone')) {
        throw new ConflictException('Phone number already registered');
      }
      if (target.includes('email')) {
        throw new ConflictException('Email already registered');
      }
    }

    throw error;
  }
}
