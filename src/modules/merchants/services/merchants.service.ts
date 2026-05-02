import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { MerchantsRepository } from '../repositories/merchants.repository';
import { Merchant, KycStatus } from '../entities/merchant.entity';
import { CreateMerchantDto, UpdateFeesDto } from '../dtos/create-merchant.dto';

@Injectable()
export class MerchantsService {
  constructor(private readonly merchantsRepository: MerchantsRepository) {}

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
    await this.findById(id);
    return this.merchantsRepository.update(id, { kycStatus: status });
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
