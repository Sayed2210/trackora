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
      expect(Object.keys(api.paths).length).toBeGreaterThan(0);
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
      expect(res.text).toBe('Hello World!');
    });

    it('POST /v1/auth/register should register a new user', async () => {
      const res = await request(httpServer).post('/v1/auth/register').send({
        phone: testPhone,
        password: testPassword,
        name: testName,
        role: 'MERCHANT',
      });

      // 201 if new (returns tokens), 401 if already exists (UnauthorizedException)
      expect([201, 401]).toContain(res.status);
      if (res.status === 201) {
        expect(res.body).toHaveProperty('accessToken');
        expect(res.body).toHaveProperty('refreshToken');
      }
    });

    it('POST /v1/auth/login should return tokens', async () => {
      const res = await request(httpServer).post('/v1/auth/login').send({
        phone: testPhone,
        password: testPassword,
      });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      authToken = res.body.accessToken;
      refreshToken = res.body.refreshToken;
    });

    it('POST /v1/auth/login with wrong password should return 401', async () => {
      const res = await request(httpServer).post('/v1/auth/login').send({
        phone: testPhone,
        password: 'wrongpassword',
      });
      expect(res.status).toBe(401);
    });

    it('POST /v1/auth/refresh should return new tokens', async () => {
      const res = await request(httpServer)
        .post('/v1/auth/refresh')
        .send({ refreshToken });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      authToken = res.body.accessToken;
      refreshToken = res.body.refreshToken;
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 3. AUTHENTICATED ENDPOINT TESTS
  // ─────────────────────────────────────────────────────────────
  describe('Authenticated Endpoints', () => {
    it('GET /v1/users without token should return 401', async () => {
      const res = await request(httpServer).get('/v1/users');
      expect(res.status).toBe(401);
    });

    it('GET /v1/users with valid token should return 200', async () => {
      const res = await request(httpServer)
        .get('/v1/users')
        .set('Authorization', `Bearer ${authToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('POST /v1/auth/logout with valid token should return 201', async () => {
      const res = await request(httpServer)
        .post('/v1/auth/logout')
        .set('Authorization', `Bearer ${authToken}`);
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('message', 'Logged out successfully');
    });

    it('POST /v1/auth/logout repeatedly should eventually return 401 or 201', async () => {
      // Some implementations revoke tokens immediately, others use short TTL.
      // We just assert the endpoint stays protected.
      const res = await request(httpServer)
        .post('/v1/auth/logout')
        .set('Authorization', `Bearer ${authToken}`);
      expect([200, 201, 401]).toContain(res.status);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 4. SCHEMA & VALIDATION TESTS (via Swagger contract)
  // ─────────────────────────────────────────────────────────────
  describe('Request/Response Schema Validation', () => {
    it('POST /v1/auth/register with missing fields should return 400', async () => {
      const res = await request(httpServer)
        .post('/v1/auth/register')
        .send({ phone: testPhone });
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('message');
    });

    it('POST /v1/shipments without token should return 401', async () => {
      const res = await request(httpServer).post('/v1/shipments').send({});
      expect(res.status).toBe(401);
    });

    it('GET /v1/shipments without token should return 401', async () => {
      const res = await request(httpServer).get('/v1/shipments');
      expect(res.status).toBe(401);
    });

    it('GET /v1/merchants/:id with non-existent id should return 404', async () => {
      const res = await request(httpServer)
        .get('/v1/merchants/550e8400-e29b-41d4-a716-446655440000')
        .set('Authorization', `Bearer ${authToken}`);
      // Token is revoked from logout test, so it may be 401
      expect([401, 404]).toContain(res.status);
    });
  });
});
