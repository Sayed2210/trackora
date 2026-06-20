import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { IS_PUBLIC_KEY } from '@common/decorators/public.decorator';
import { PublicOnboardingController } from '../controllers/public-onboarding.controller';
import { PublicOnboardingService } from '../services/public-onboarding.service';
import { RequestDemoDto, RequestDemoResponseDto } from '../dtos';

describe('PublicOnboardingController - requestDemo', () => {
  let controller: PublicOnboardingController;
  let service: jest.Mocked<PublicOnboardingService>;

  const demoDto: RequestDemoDto = {
    name: 'Ahmed Ali',
    companyName: 'Cairo Express',
    phone: '01012345678',
    email: 'ahmed@cairoexpress.com',
    businessType: 'E-commerce',
    monthlyShipments: '500-1000',
    message: 'I want a demo for my team',
    interestedPlanSlug: 'growth',
  };

  const demoResponse: RequestDemoResponseDto = {
    id: 'demo-uuid',
    message: 'Demo request received',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PublicOnboardingController],
      providers: [
        {
          provide: PublicOnboardingService,
          useValue: {
            requestDemo: jest.fn(),
            subscribe: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(PublicOnboardingController);
    service = module.get(PublicOnboardingService);
  });

  it('delegates to service.requestDemo with request context', async () => {
    service.requestDemo.mockResolvedValueOnce(demoResponse);

    const result = await controller.requestDemo(demoDto, {
      ip: '197.45.1.10',
      headers: { 'user-agent': 'curl/8.0' },
    });

    expect(service.requestDemo).toHaveBeenCalledWith(demoDto, {
      ipAddress: '197.45.1.10',
      userAgent: 'curl/8.0',
    });
    expect(result).toEqual(demoResponse);
  });

  it('marks the endpoint as public (no auth)', () => {
    const isPublic = Reflect.getMetadata(
      IS_PUBLIC_KEY,
      controller.requestDemo,
    ) as boolean | undefined;

    expect(isPublic).toBe(true);
  });

  it('returns only id and message (no tokens)', async () => {
    service.requestDemo.mockResolvedValueOnce(demoResponse);

    const result = await controller.requestDemo(demoDto, {
      headers: {},
    });

    expect(Object.keys(result).sort()).toEqual(['id', 'message']);
  });
});
