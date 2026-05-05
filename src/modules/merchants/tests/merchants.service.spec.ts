import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { MerchantsService } from '../services/merchants.service';
import { MerchantsRepository } from '../repositories/merchants.repository';
import { WalletsService } from '@modules/wallets/services/wallets.service';
import { KycStatus } from '../entities/merchant.entity';

const mockMerchant: any = {
  id: 'merchant-1',
  userId: 'user-1',
  businessName: 'Test Store',
  businessType: 'ecommerce',
  websiteUrl: null,
  socialMediaUrl: null,
  kycStatus: KycStatus.PENDING,
  kycDocuments: null,
  commissionRate: 0.05,
  feePerShipment: 25,
  returnFee: 0,
  cancellationFee: 0,
  creditLimit: 0,
  defaultPickupAddress: null,
  branding: null,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('MerchantsService', () => {
  let service: MerchantsService;
  let repository: MerchantsRepository;
  let walletsService: WalletsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MerchantsService,
        {
          provide: MerchantsRepository,
          useValue: {
            findByUserId: jest.fn(),
            findById: jest.fn(),
            create: jest.fn().mockResolvedValue(mockMerchant),
            update: jest.fn().mockResolvedValue(mockMerchant),
            softDelete: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: WalletsService,
          useValue: {
            create: jest.fn().mockResolvedValue({ id: 'wallet-1' }),
          },
        },
      ],
    }).compile();

    service = module.get<MerchantsService>(MerchantsService);
    repository = module.get<MerchantsRepository>(MerchantsRepository);
    walletsService = module.get<WalletsService>(WalletsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create merchant', async () => {
      jest.spyOn(repository, 'findByUserId').mockResolvedValueOnce(null);

      const result = await service.create(
        { businessName: 'Test Store' },
        'user-1',
      );

      expect(result).toEqual(mockMerchant);
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          businessName: 'Test Store',
          userId: 'user-1',
          kycStatus: KycStatus.PENDING,
        }),
      );
    });

    it('should throw if merchant already exists for user', async () => {
      jest
        .spyOn(repository, 'findByUserId')
        .mockResolvedValueOnce(mockMerchant);

      await expect(
        service.create({ businessName: 'Test' }, 'user-1'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findById', () => {
    it('should return merchant', async () => {
      jest.spyOn(repository, 'findById').mockResolvedValueOnce(mockMerchant);

      const result = await service.findById('merchant-1');
      expect(result).toEqual(mockMerchant);
    });

    it('should throw NotFoundException if not found', async () => {
      jest.spyOn(repository, 'findById').mockResolvedValueOnce(null);

      await expect(service.findById('invalid')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateKycStatus', () => {
    it('should update KYC status', async () => {
      jest.spyOn(repository, 'findById').mockResolvedValueOnce(mockMerchant);
      jest.spyOn(repository, 'update').mockResolvedValueOnce({
        ...mockMerchant,
        kycStatus: KycStatus.APPROVED,
      });

      const result = await service.updateKycStatus(
        'merchant-1',
        KycStatus.APPROVED,
      );

      expect(result.kycStatus).toBe(KycStatus.APPROVED);
      expect(walletsService.create).toHaveBeenCalledWith('merchant-1');
    });

    it('should not create wallet if status is not APPROVED', async () => {
      jest.spyOn(repository, 'findById').mockResolvedValueOnce(mockMerchant);
      jest.spyOn(repository, 'update').mockResolvedValueOnce({
        ...mockMerchant,
        kycStatus: KycStatus.REJECTED,
      });

      await service.updateKycStatus('merchant-1', KycStatus.REJECTED);
      expect(walletsService.create).not.toHaveBeenCalled();
    });

    it('should not create wallet if already approved', async () => {
      jest.spyOn(repository, 'findById').mockResolvedValueOnce({
        ...mockMerchant,
        kycStatus: KycStatus.APPROVED,
      });
      jest.spyOn(repository, 'update').mockResolvedValueOnce({
        ...mockMerchant,
        kycStatus: KycStatus.APPROVED,
      });

      await service.updateKycStatus('merchant-1', KycStatus.APPROVED);
      expect(walletsService.create).not.toHaveBeenCalled();
    });
  });

  describe('updateFeeStructure', () => {
    it('should update fees', async () => {
      jest.spyOn(repository, 'findById').mockResolvedValueOnce(mockMerchant);

      await service.updateFeeStructure('merchant-1', {
        commissionRate: '0.1',
        feePerShipment: '30',
      });

      expect(repository.update).toHaveBeenCalledWith('merchant-1', {
        commissionRate: 0.1,
        feePerShipment: 30,
      });
    });
  });

  describe('remove', () => {
    it('should soft delete merchant', async () => {
      jest.spyOn(repository, 'findById').mockResolvedValueOnce(mockMerchant);

      await service.remove('merchant-1');
      expect(repository.softDelete).toHaveBeenCalledWith('merchant-1');
    });
  });
});
