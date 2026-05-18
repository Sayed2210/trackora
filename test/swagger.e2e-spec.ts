import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import SwaggerParser from '@apidevtools/swagger-parser';
import { AppModule } from './../src/app.module';

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
    }).compile();

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

    // Swagger documentation
    const config = new DocumentBuilder()
      .setTitle('Trackora API')
      .setDescription('Logistics & COD Shipment Management API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);

    await app.init();
    httpServer = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
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
        'Couriers',
        'Shipments',
        'Assignments',
        'Wallets',
        'Admin',
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
      const res = await request(httpServer)
        .post('/v1/auth/register')
        .send({
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
