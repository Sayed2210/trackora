import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PublicOnboardingController } from '../src/modules/public-onboarding/controllers/public-onboarding.controller';
import { PublicOnboardingService } from '../src/modules/public-onboarding/services/public-onboarding.service';
import { PrismaService } from '../src/core/prisma/prisma.service';
import { AuthService } from '../src/modules/auth/services/auth.service';
import { PlatformAuditLogService } from '../src/modules/platform/audit-logs/services/platform-audit-log.service';
import { ConfigService } from '@nestjs/config';

interface DemoResponseBody {
  id: string;
  message: string;
}

interface AuditLogCall {
  action: string;
  resourceType: string;
  resourceId: string;
}

function omit<T extends Record<string, unknown>>(
  obj: T,
  key: keyof T,
): Record<string, unknown> {
  const copy: Record<string, unknown> = { ...obj };
  delete copy[key];
  return copy;
}

const validBody = {
  name: 'Ahmed Ali',
  companyName: 'Cairo Express',
  phone: '01012345678',
  email: 'ahmed@cairoexpress.com',
  businessType: 'E-commerce',
  monthlyShipments: '500-1000',
  message: 'I want a demo for my team',
  interestedPlanSlug: 'pro',
};

describe('PublicOnboardingController - request-demo (e2e)', () => {
  let app: INestApplication<App>;

  const mockPrismaService = {
    $transaction: jest.fn(),
  };

  const mockAuthService = {};

  const mockAuditLogService = {
    writeAuditLog: jest.fn().mockResolvedValue({}),
  };

  const mockConfigService = { get: jest.fn() };

  function setupTransactionCreate() {
    const tx = {
      demoRequest: {
        create: jest.fn().mockResolvedValue({ id: 'demo-uuid' }),
      },
    };
    mockPrismaService.$transaction.mockImplementation(
      async (cb: (tx: any) => Promise<unknown>) => cb(tx),
    );
    return tx;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [PublicOnboardingController],
      providers: [
        PublicOnboardingService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: PlatformAuditLogService, useValue: mockAuditLogService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    mockPrismaService.$transaction.mockReset();
    mockAuditLogService.writeAuditLog.mockClear();
  });

  describe('POST /public/request-demo', () => {
    it('accepts a valid payload and returns 201 with the lead id', async () => {
      setupTransactionCreate();

      const response = await request(app.getHttpServer())
        .post('/public/request-demo')
        .send(validBody)
        .expect(201);

      const body = response.body as DemoResponseBody;
      expect(body.id).toBe('demo-uuid');
      expect(body.message).toBe('Demo request received');
    });

    it('does not require authentication', async () => {
      setupTransactionCreate();

      await request(app.getHttpServer())
        .post('/public/request-demo')
        .send(validBody)
        .expect(201);
    });

    it('works with only the required fields (no optional fields)', async () => {
      setupTransactionCreate();

      const response = await request(app.getHttpServer())
        .post('/public/request-demo')
        .send({
          name: 'Ahmed Ali',
          companyName: 'Cairo Express',
          phone: '01012345678',
          businessType: 'E-commerce',
        })
        .expect(201);

      const body = response.body as DemoResponseBody;
      expect(body.id).toBe('demo-uuid');
    });

    it('rejects missing name with 400', async () => {
      await request(app.getHttpServer())
        .post('/public/request-demo')
        .send(omit(validBody, 'name'))
        .expect(400);

      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    });

    it('rejects missing companyName with 400', async () => {
      await request(app.getHttpServer())
        .post('/public/request-demo')
        .send(omit(validBody, 'companyName'))
        .expect(400);
    });

    it('rejects missing phone with 400', async () => {
      await request(app.getHttpServer())
        .post('/public/request-demo')
        .send(omit(validBody, 'phone'))
        .expect(400);
    });

    it('rejects missing businessType with 400', async () => {
      await request(app.getHttpServer())
        .post('/public/request-demo')
        .send(omit(validBody, 'businessType'))
        .expect(400);
    });

    it('rejects an invalid Egyptian phone with 400', async () => {
      await request(app.getHttpServer())
        .post('/public/request-demo')
        .send({ ...validBody, phone: '1234567890' })
        .expect(400);

      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    });

    it('rejects a non-Egyptian phone (missing leading 01) with 400', async () => {
      await request(app.getHttpServer())
        .post('/public/request-demo')
        .send({ ...validBody, phone: '201123456789' })
        .expect(400);
    });

    it('rejects an invalid email with 400', async () => {
      await request(app.getHttpServer())
        .post('/public/request-demo')
        .send({ ...validBody, email: 'not-an-email' })
        .expect(400);
    });

    it('accepts a valid payload without email (email is optional)', async () => {
      setupTransactionCreate();

      await request(app.getHttpServer())
        .post('/public/request-demo')
        .send(omit(validBody, 'email'))
        .expect(201);
    });

    it('rejects non-whitelisted extra fields with 400', async () => {
      await request(app.getHttpServer())
        .post('/public/request-demo')
        .send({ ...validBody, role: 'ADMIN', tenantId: 'hack' })
        .expect(400);
    });

    it('rejects an empty body with 400', async () => {
      await request(app.getHttpServer())
        .post('/public/request-demo')
        .send({})
        .expect(400);

      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    });

    it('writes a platform audit log for the public demo event', async () => {
      setupTransactionCreate();

      await request(app.getHttpServer())
        .post('/public/request-demo')
        .send(validBody)
        .expect(201);

      expect(mockAuditLogService.writeAuditLog).toHaveBeenCalledTimes(1);
      const auditCalls = mockAuditLogService.writeAuditLog.mock
        .calls as unknown as Array<[AuditLogCall]>;
      const auditInput = auditCalls[0][0];
      expect(auditInput.action).toBe('demo_request.created');
      expect(auditInput.resourceType).toBe('DemoRequest');
      expect(auditInput.resourceId).toBe('demo-uuid');
    });
  });
});
