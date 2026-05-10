import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { MerchantsRepository } from '../repositories/merchants.repository';
import { WalletsService } from '@modules/wallets/services/wallets.service';
import { Merchant, KycStatus } from '../entities/merchant.entity';
import { CreateMerchantDto, UpdateFeesDto } from '../dtos/create-merchant.dto';
import { ListMerchantsDto } from '../dtos/list-merchants.dto';

@Injectable()
export class MerchantsService {
  constructor(
    private readonly merchantsRepository: MerchantsRepository,
    private readonly walletsService: WalletsService,
  ) {}

  async create(dto: CreateMerchantDto, userId: string): Promise<Merchant> {
    const existing = await this.merchantsRepository.findByUserId(userId);
    if (existing) {
      throw new ConflictException('Merchant already exists for this user');
    }

    return this.merchantsRepository.create({
      businessName: dto.businessName,
      businessType: dto.businessType,
      websiteUrl: dto.websiteUrl,
      commissionRate: dto.commissionRate
        ? parseFloat(dto.commissionRate)
        : undefined,
      feePerShipment: dto.feePerShipment
        ? parseFloat(dto.feePerShipment)
        : undefined,
      userId,
      kycStatus: KycStatus.PENDING,
    });
  }

  async findAll(query: ListMerchantsDto): Promise<{ data: Merchant[]; total: number; page: number; limit: number }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (query.kycStatus !== undefined) {
      where.kycStatus = query.kycStatus;
    }
    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }
    if (query.search) {
      where.OR = [
        { businessName: { contains: query.search, mode: 'insensitive' } },
        { businessType: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.merchantsRepository.findMany(where, { createdAt: 'desc' }, skip, limit),
      this.merchantsRepository.count(where),
    ]);

    return { data, total, page, limit };
  }

  async findById(id: string): Promise<Merchant> {
    const merchant = await this.merchantsRepository.findById(id);
    if (!merchant) {
      throw new NotFoundException('Merchant not found');
    }
    return merchant;
  }

  async findByUserId(userId: string): Promise<Merchant | null> {
    return this.merchantsRepository.findByUserId(userId);
  }

  async updateKycStatus(id: string, status: KycStatus): Promise<Merchant> {
    const merchant = await this.findById(id);
    const updated = await this.merchantsRepository.update(id, {
      kycStatus: status,
    });

    if (
      status === KycStatus.APPROVED &&
      merchant.kycStatus !== KycStatus.APPROVED
    ) {
      await this.walletsService.create(id);
    }

    return updated;
  }

  async updateFeeStructure(id: string, dto: UpdateFeesDto): Promise<Merchant> {
    await this.findById(id);
    const data: Record<string, unknown> = {};
    if (dto.commissionRate !== undefined) {
      data.commissionRate = parseFloat(dto.commissionRate);
    }
    if (dto.feePerShipment !== undefined) {
      data.feePerShipment = parseFloat(dto.feePerShipment);
    }
    return this.merchantsRepository.update(id, data);
  }

  async remove(id: string): Promise<void> {
    await this.findById(id);
    await this.merchantsRepository.softDelete(id);
  }
}
