import { Test, TestingModule } from '@nestjs/testing';
import { IS_PUBLIC_KEY } from '@common/decorators/public.decorator';
import { PublicPlansController } from '../controllers/public-plans.controller';
import { PublicPlansService } from '../services/public-plans.service';
import { PublicPlanResponseDto } from '../dtos';

describe('PublicPlansController', () => {
  let controller: PublicPlansController;
  let service: jest.Mocked<PublicPlansService>;

  const mockResponse: PublicPlanResponseDto = {
    id: 'plan-1',
    slug: 'growth',
    name: 'Growth',
    description: 'Growth plan',
    priceMonthly: '999.00',
    priceYearly: '9990.00',
    currency: 'EGP',
    shipmentLimit: 10000,
    features: ['Bulk Upload'],
    isPopular: false,
    ctaLabel: 'Request Demo',
    ctaHref: '/request-demo?plan=growth',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PublicPlansController],
      providers: [
        {
          provide: PublicPlansService,
          useValue: {
            findAll: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(PublicPlansController);
    service = module.get(PublicPlansService);
  });

  it('delegates to service.findAll', async () => {
    service.findAll.mockResolvedValueOnce([mockResponse]);

    const result = await controller.findAll();

    expect(service.findAll).toHaveBeenCalled();
    expect(result).toEqual([mockResponse]);
  });

  it('marks endpoint as public', () => {
    const isPublic = Reflect.getMetadata(IS_PUBLIC_KEY, controller.findAll);

    expect(isPublic).toBe(true);
  });
});
