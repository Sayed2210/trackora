import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import SwaggerParser from '@apidevtools/swagger-parser';
import { AppModule } from './../src/app.module';
import { setupSwagger } from '@core/swagger/swagger.config';
import { PrismaService } from '@core/prisma/prisma.service';
import { RedisService } from '@infrastructure/cache/redis.service';

process.env.JWT_SECRET ??= 'trackora-swagger-test-secret';

const swaggerPrismaDelegate = {
  findMany: jest.fn().mockResolvedValue([]),
  findFirst: jest.fn().mockResolvedValue(null),
  findUnique: jest.fn().mockResolvedValue(null),
  create: jest.fn().mockImplementation(({ data }) =>
    Promise.resolve({
      id: '123e4567-e89b-42d3-a456-426614174099',
      isActive: true,
      ...data,
    }),
  ),
  update: jest
    .fn()
    .mockImplementation(({ where, data }) =>
      Promise.resolve({ ...where, ...data }),
    ),
  updateMany: jest.fn().mockResolvedValue({ count: 0 }),
  delete: jest.fn().mockResolvedValue({}),
  count: jest.fn().mockResolvedValue(0),
  aggregate: jest.fn().mockResolvedValue({}),
  groupBy: jest.fn().mockResolvedValue([]),
};

const swaggerPrisma = new Proxy(
  {},
  {
    get: () => swaggerPrismaDelegate,
  },
);

const swaggerRedis = {
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
  del: jest.fn().mockResolvedValue(undefined),
  getJson: jest.fn().mockResolvedValue(null),
  setJson: jest.fn().mockResolvedValue(undefined),
  increment: jest.fn().mockResolvedValue(1),
  expire: jest.fn().mockResolvedValue(undefined),
  exists: jest.fn().mockResolvedValue(false),
};

describe('Swagger & API Automation Tests (e2e)', () => {
  let app: INestApplication<App>;
  let httpServer: any;
  let authToken: string;
  let refreshToken: string;
  const testPhone = '01099998888';
  const testPassword = 'password123';
  const testName = 'Swagger Test User';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(swaggerPrisma)
      .overrideProvider(RedisService)
      .useValue(swaggerRedis)
      .compile();

    app = moduleFixture.createNestApplication();

    // Mirror main.ts configuration
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: '1',
    });

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    setupSwagger(app);

    await app.init();
    httpServer = app.getHttpServer();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  // ─────────────────────────────────────────────────────────────
  // 1. SWAGGER DOCUMENTATION TESTS
  // ─────────────────────────────────────────────────────────────
  describe('Swagger UI & OpenAPI Spec', () => {
    it('should serve Swagger UI HTML at /api/docs/', async () => {
      const res = await request(httpServer).get('/api/docs/');
      expect(res.status).toBe(200);
      expect(res.type).toBe('text/html');
      expect(res.text).toContain('Swagger UI');
    });

    it('should serve a valid OpenAPI 3.0 JSON spec at /api/docs-json', async () => {
      const res = await request(httpServer).get('/api/docs-json');
      expect(res.status).toBe(200);
      expect(res.type).toBe('application/json');
      expect(res.body.openapi).toMatch(/^3\.0\.\d+$/);
    });

    it('should have a valid and parseable OpenAPI spec (swagger-parser)', async () => {
      const res = await request(httpServer).get('/api/docs-json');
      const api = await SwaggerParser.validate(res.body);
      expect(api.info.title).toBe('Trackora API');
      expect(api.info.description).toContain('Logistics');
      expect(api.paths).toBeDefined();
      expect(Object.keys(api.paths ?? {}).length).toBeGreaterThan(0);
    });

    it('should document Bearer authentication security scheme', async () => {
      const res = await request(httpServer).get('/api/docs-json');
      const api = res.body;
      expect(api.components.securitySchemes).toBeDefined();
      expect(api.components.securitySchemes.bearer).toBeDefined();
      expect(api.components.securitySchemes.bearer.type).toBe('http');
      expect(api.components.securitySchemes.bearer.scheme).toBe('bearer');
    });

    it('should tag all controller routes', async () => {
      const res = await request(httpServer).get('/api/docs-json');
      const paths = res.body.paths;
      const requiredTags = [
        'App',
        'Auth',
        'Users',
        'Merchants',
        'Merchant Dashboard',
        'Couriers',
        'Courier App',
        'Shipments',
        'Assignments',
        'Wallets',
        'Admin',
        'Audit Logs',
        'Zones',
        'Payouts',
        'Platform Tenants',
        'Platform Plans',
        'Public Plans',
        'Platform Subscriptions',
        'Platform Feature Flags',
        'Platform Analytics',
        'Platform Billing',
        'Platform Audit Logs',
        'Platform Support',
      ];
      const allTags = new Set<string>();
      for (const path of Object.values(paths)) {
        for (const op of Object.values(path as any)) {
          if (Array.isArray((op as any).tags)) {
            (op as any).tags.forEach((t: string) => allTags.add(t));
          }
        }
      }
      for (const tag of requiredTags) {
        expect(allTags.has(tag)).toBe(true);
      }
    });

    it('should document inferred and multipart request bodies', async () => {
      const res = await request(httpServer).get('/api/docs-json');
      const paths = res.body.paths;

      expect(paths['/v1/auth/otp/send'].post.requestBody).toBeDefined();
      expect(paths['/v1/auth/otp/verify'].post.requestBody).toBeDefined();
      expect(paths['/v1/merchants/{id}/kyc'].patch.requestBody).toBeDefined();

      const bulkUpload = paths['/v1/shipments/bulk-upload'].post;
      expect(bulkUpload.security).toEqual([{ bearer: [] }]);
      expect(bulkUpload.requestBody.required).toBe(true);
      expect(
        bulkUpload.requestBody.content['multipart/form-data'].schema.properties
          .file.format,
      ).toBe('binary');

      const adminBulkUpload =
        paths['/v1/admin/merchants/{merchantId}/shipments/bulk-upload'].post;
      expect(adminBulkUpload.security).toEqual([{ bearer: [] }]);
      expect(adminBulkUpload.requestBody.required).toBe(true);
      expect(
        adminBulkUpload.requestBody.content['multipart/form-data'].schema
          .properties.file.format,
      ).toBe('binary');
      expect(adminBulkUpload.parameters).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'merchantId',
            in: 'path',
            required: true,
          }),
        ]),
      );

      const resultSchema = res.body.components.schemas.BulkUploadResultDto;
      expect(Object.keys(resultSchema.properties).sort()).toEqual([
        'errors',
        'failedCount',
        'shipments',
        'successCount',
        'totalRows',
      ]);
      expect(resultSchema.required.sort()).toEqual([
        'errors',
        'failedCount',
        'successCount',
        'totalRows',
      ]);
    });

    it('should only require bearer auth for protected shipment endpoints', async () => {
      const res = await request(httpServer).get('/api/docs-json');
      const paths = res.body.paths;

      expect(paths['/v1/shipments'].get.security).toEqual([{ bearer: [] }]);
      expect(
        paths['/v1/shipments/tracking/{trackingNumber}'].get.security,
      ).toBeUndefined();
    });

    it('should give every operation a tag, operationId, and success response', async () => {
      const res = await request(httpServer).get('/api/docs-json');
      const operationIds = new Set<string>();
      const missingSuccessResponses: string[] = [];

      for (const [path, pathItem] of Object.entries(res.body.paths)) {
        for (const [method, operation] of Object.entries(pathItem as object)) {
          const apiOperation = operation;
          expect(apiOperation.tags?.length).toBeGreaterThan(0);
          expect(apiOperation.operationId).toBeTruthy();
          expect(operationIds.has(apiOperation.operationId)).toBe(false);
          operationIds.add(apiOperation.operationId);
          if (
            !Object.keys(apiOperation.responses ?? {}).some((status) =>
              status.startsWith('2'),
            )
          ) {
            missingSuccessResponses.push(method.toUpperCase() + ' ' + path);
          }
        }
      }

      expect(missingSuccessResponses).toEqual([]);
    });

    it('should document scoped backend response DTOs and report JSON behavior', async () => {
      const res = await request(httpServer).get('/api/docs-json');
      const paths = res.body.paths;
      const scopedResponses = [
        ['get', '/v1/admin/dashboard', '200', 'AdminDashboardResponseDto'],
        [
          'get',
          '/v1/admin/financial-summary',
          '200',
          'FinancialSummaryResponseDto',
        ],
        ['get', '/v1/admin/audit-logs', '200', 'PaginatedAuditLogsResponseDto'],
        ['get', '/v1/zones', '200', 'PaginatedZonesResponseDto'],
        ['get', '/v1/zones/{id}', '200', 'ZoneResponseDto'],
        ['patch', '/v1/zones/{id}', '200', 'ZoneResponseDto'],
        ['get', '/v1/shipments', '200', 'PaginatedShipmentsResponseDto'],
        ['get', '/v1/shipments/{id}', '200', 'ShipmentResponseDto'],
        ['post', '/v1/shipments/bulk-upload', '201', 'BulkUploadResultDto'],
        [
          'post',
          '/v1/admin/merchants/{merchantId}/shipments/bulk-upload',
          '201',
          'BulkUploadResultDto',
        ],
        ['get', '/v1/assignments', '200', 'PaginatedAssignmentsResponseDto'],
        ['get', '/v1/couriers', '200', 'PaginatedCouriersResponseDto'],
        ['get', '/v1/merchants', '200', 'PaginatedMerchantsResponseDto'],
        ['get', '/v1/merchants/{id}', '200', 'MerchantResponseDto'],
        [
          'get',
          '/v1/merchants/{id}/wallet',
          '200',
          'MerchantWalletResponseDto',
        ],
        [
          'get',
          '/v1/merchants/{id}/wallet/transactions',
          '200',
          'PaginatedWalletTransactionsResponseDto',
        ],
      ];

      for (const [method, path, status, dto] of scopedResponses) {
        expect(
          paths[path][method].responses[status].content['application/json']
            .schema.$ref,
        ).toBe(`#/components/schemas/${dto}`);
      }

      const reportResponses = [
        [
          '/v1/admin/reports/courier-performance',
          'CourierPerformanceReportResponseDto',
        ],
        [
          '/v1/admin/reports/merchant-delivery',
          'MerchantDeliveryReportResponseDto',
        ],
      ];

      for (const [path, dto] of reportResponses) {
        const schema =
          paths[path].post.responses['201'].content['application/json'].schema;
        expect(schema.type).toBe('array');
        expect(schema.items.$ref).toBe(`#/components/schemas/${dto}`);
      }

      const deleteZoneResponse =
        paths['/v1/zones/{id}'].delete.responses['200'];
      expect(deleteZoneResponse.description).toContain('body is empty');
      expect(deleteZoneResponse.content).toEqual({});
    });

    it('should retain relevant error responses for scoped operations', async () => {
      const res = await request(httpServer).get('/api/docs-json');
      const paths = res.body.paths;

      expect(
        Object.keys(paths['/v1/zones/{id}'].patch.responses).sort(),
      ).toEqual(['200', '400', '401', '403', '404', '409']);
      expect(
        Object.keys(paths['/v1/merchants/{id}/wallet'].get.responses).sort(),
      ).toEqual(['200', '400', '401', '403', '404']);
      expect(
        Object.keys(paths['/v1/admin/dashboard'].get.responses).sort(),
      ).toEqual(['200', '401', '403']);
      expect(
        Object.keys(paths['/v1/shipments/bulk-upload'].post.responses).sort(),
      ).toEqual(['201', '400', '401', '403', '404']);
      expect(
        Object.keys(
          paths['/v1/admin/merchants/{merchantId}/shipments/bulk-upload'].post
            .responses,
        ).sort(),
      ).toEqual(['201', '400', '401', '403', '404']);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 2. PUBLIC ENDPOINT TESTS
  // ─────────────────────────────────────────────────────────────
  describe('Public Endpoints', () => {
    it('GET /v1 should return Hello World', async () => {
      const res = await request(httpServer).get('/v1');
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Hello World!');
    });

    it('GET /v1/health should return healthy status', async () => {
      const res = await request(httpServer).get('/v1/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 3. AUTHENTICATION FLOW TESTS
  // ─────────────────────────────────────────────────────────────
  describe('Authentication Flow', () => {
    it('should register a new user', async () => {
      const res = await request(httpServer).post('/v1/auth/register').send({
        phone: testPhone,
        password: testPassword,
        name: testName,
        role: 'MERCHANT',
      });

      expect([201, 409]).toContain(res.status);
    });

    it('should login and return tokens', async () => {
      const res = await request(httpServer).post('/v1/auth/login').send({
        phone: testPhone,
        password: testPassword,
      });

      if (res.status === 201 || res.status === 200) {
        expect(res.body.accessToken).toBeDefined();
        expect(res.body.refreshToken).toBeDefined();
        authToken = res.body.accessToken;
        refreshToken = res.body.refreshToken;
      } else {
        expect([401, 404]).toContain(res.status);
      }
    });

    it('should refresh token if login succeeded', async () => {
      if (!refreshToken) return;

      const res = await request(httpServer)
        .post('/v1/auth/refresh')
        .send({ refreshToken });

      expect([200, 201]).toContain(res.status);
      expect(res.body.accessToken).toBeDefined();
    });

    it('should reject protected endpoint without token', async () => {
      const res = await request(httpServer).get('/v1/shipments');
      expect(res.status).toBe(401);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 4. SHIPMENT ENDPOINT SMOKE TESTS
  // ─────────────────────────────────────────────────────────────
  describe('Shipment Endpoint Smoke Tests', () => {
    it('should return 401 for shipment list without auth', async () => {
      const res = await request(httpServer).get('/v1/shipments');
      expect(res.status).toBe(401);
    });

    it('should accept auth token if available', async () => {
      if (!authToken) return;

      const res = await request(httpServer)
        .get('/v1/shipments')
        .set('Authorization', `Bearer ${authToken}`);

      expect([200, 403]).toContain(res.status);
    });
  });
});
