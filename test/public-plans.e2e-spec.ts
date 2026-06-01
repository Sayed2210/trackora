import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { Prisma } from '@prisma/client';
import { PublicPlansController } from '../src/modules/platform/plans/controllers/public-plans.controller';
import { PlatformPlansRepository } from '../src/modules/platform/plans/repositories/platform-plans.repository';
import { PublicPlansService } from '../src/modules/platform/plans/services/public-plans.service';
import { PrismaService } from '../src/core/prisma/prisma.service';

const makePlanRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'plan-1',
  slug: 'starter',
  name: 'Starter',
  description: 'Starter plan',
  monthlyPrice: new Prisma.Decimal('100.00'),
  yearlyPrice: new Prisma.Decimal('1000.00'),
  currency: 'EGP',
  monthlyShipmentLimit: 500,
  adminUserLimit: 2,
  merchantLimit: 10,
  courierLimit: 5,
  isPublic: true,
  isPopular: false,
  sortOrder: 0,
  isActive: true,
  archivedAt: null,
  metadata: null,
  createdAt: new Date('2026-05-01T00:00:00.000Z'),
  updatedAt: new Date('2026-05-01T00:00:00.000Z'),
  featureFlags: [
    {
      id: 'flag-1',
      planId: 'plan-1',
      featureKey: 'bulk_upload',
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      featureFlag: { name: 'Bulk Upload' },
    },
  ],
  ...overrides,
});

describe('PublicPlansController (e2e)', () => {
  let app: INestApplication<App>;

  const mockPrismaService = {
    plan: {
      findMany: jest.fn(),
    },
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [PublicPlansController],
      providers: [
        PublicPlansService,
        PlatformPlansRepository,
        { provide: PrismaService, useValue: mockPrismaService },
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
    mockPrismaService.plan.findMany.mockReset();
  });

  describe('GET /public/plans', () => {
    it('returns only active public non-archived plans', async () => {
      const plan = makePlanRow();
      mockPrismaService.plan.findMany.mockResolvedValueOnce([plan]);

      const response = await request(app.getHttpServer())
        .get('/public/plans')
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].id).toBe('plan-1');

      const findManyCall = mockPrismaService.plan.findMany.mock.calls[0][0];
      expect(findManyCall.where).toEqual({
        isActive: true,
        isPublic: true,
        archivedAt: null,
      });
    });

    it('excludes inactive plans via query filter', async () => {
      mockPrismaService.plan.findMany.mockResolvedValueOnce([]);

      await request(app.getHttpServer())
        .get('/public/plans')
        .expect(200);

      const findManyCall = mockPrismaService.plan.findMany.mock.calls[0][0];
      expect(findManyCall.where.isActive).toBe(true);
    });

    it('excludes private plans via query filter', async () => {
      mockPrismaService.plan.findMany.mockResolvedValueOnce([]);

      await request(app.getHttpServer())
        .get('/public/plans')
        .expect(200);

      const findManyCall = mockPrismaService.plan.findMany.mock.calls[0][0];
      expect(findManyCall.where.isPublic).toBe(true);
    });

    it('excludes archived plans via query filter', async () => {
      mockPrismaService.plan.findMany.mockResolvedValueOnce([]);

      await request(app.getHttpServer())
        .get('/public/plans')
        .expect(200);

      const findManyCall = mockPrismaService.plan.findMany.mock.calls[0][0];
      expect(findManyCall.where.archivedAt).toBe(null);
    });

    it('does not include internal fields in response', async () => {
      const plan = makePlanRow();
      mockPrismaService.plan.findMany.mockResolvedValueOnce([plan]);

      const response = await request(app.getHttpServer())
        .get('/public/plans')
        .expect(200);

      const body = response.body[0];
      expect(body).not.toHaveProperty('adminUserLimit');
      expect(body).not.toHaveProperty('merchantLimit');
      expect(body).not.toHaveProperty('courierLimit');
      expect(body).not.toHaveProperty('metadata');
      expect(body).not.toHaveProperty('createdAt');
      expect(body).not.toHaveProperty('updatedAt');
      expect(body).not.toHaveProperty('archivedAt');
      expect(body).not.toHaveProperty('isActive');
      expect(body).not.toHaveProperty('isPublic');
    });

    it('sorts by sortOrder asc then monthlyPrice asc', async () => {
      mockPrismaService.plan.findMany.mockResolvedValueOnce([]);

      await request(app.getHttpServer())
        .get('/public/plans')
        .expect(200);

      const findManyCall = mockPrismaService.plan.findMany.mock.calls[0][0];
      expect(findManyCall.orderBy).toEqual([{ sortOrder: 'asc' }, { monthlyPrice: 'asc' }]);
    });

    it('does not require authentication', async () => {
      const plan = makePlanRow();
      mockPrismaService.plan.findMany.mockResolvedValueOnce([plan]);

      const response = await request(app.getHttpServer())
        .get('/public/plans')
        .expect(200);

      expect(response.body).toHaveLength(1);
    });

    it('returns mapped response fields', async () => {
      const plan = makePlanRow();
      mockPrismaService.plan.findMany.mockResolvedValueOnce([plan]);

      const response = await request(app.getHttpServer())
        .get('/public/plans')
        .expect(200);

      const body = response.body[0];
      expect(body.id).toBe('plan-1');
      expect(body.slug).toBe('starter');
      expect(body.name).toBe('Starter');
      expect(body.priceMonthly).toBe('100.00');
      expect(body.priceYearly).toBe('1000.00');
      expect(body.currency).toBe('EGP');
      expect(body.shipmentLimit).toBe(500);
      expect(body.features).toEqual(['Bulk Upload']);
      expect(body.isPopular).toBe(false);
      expect(body.ctaLabel).toBe('Request Demo');
      expect(body.ctaHref).toBe('/request-demo?plan=starter');
    });
  });
});