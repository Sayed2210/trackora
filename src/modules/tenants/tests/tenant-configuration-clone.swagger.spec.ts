import { INestApplication, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { SwaggerModule } from '@nestjs/swagger';
import { OpenAPIObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import { TenantsController } from '../controllers/tenants.controller';
import { TenantConfigurationCloneService } from '../services/tenant-configuration-clone.service';
import { TenantOnboardingService } from '../services/tenant-onboarding.service';
import { TenantsService } from '../services/tenants.service';

describe('tenant configuration clone Swagger contract', () => {
  let app: INestApplication;
  let document: OpenAPIObject;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [TenantsController],
      providers: [
        { provide: TenantsService, useValue: {} },
        { provide: TenantOnboardingService, useValue: {} },
        { provide: TenantConfigurationCloneService, useValue: {} },
      ],
    }).compile();

    app = module.createNestApplication();
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: '1',
    });
    await app.init();
    document = SwaggerModule.createDocument(app, {
      openapi: '3.0.0',
      info: { title: 'Trackora Test', version: '1' },
      paths: {},
      components: {
        securitySchemes: {
          bearer: { type: 'http', scheme: 'bearer' },
        },
        schemas: {},
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('documents the endpoint, request, response, UUID param, and errors', () => {
    const operation =
      document.paths[
        '/v1/platform/tenants/{sourceTenantId}/clone-configuration'
      ]?.post;

    expect(operation).toBeDefined();
    expect(operation?.security).toEqual([{ bearer: [] }]);
    const sourceTenantIdParameter = operation?.parameters?.find(
      (parameter) => 'name' in parameter && parameter.name === 'sourceTenantId',
    );
    expect(sourceTenantIdParameter).toMatchObject({
      name: 'sourceTenantId',
      in: 'path',
      required: true,
      schema: { format: 'uuid' },
    });
    expect(
      operation?.requestBody &&
        'content' in operation.requestBody &&
        operation.requestBody.content?.['application/json']?.schema,
    ).toEqual({ $ref: '#/components/schemas/CloneTenantConfigurationDto' });
    expect(
      operation?.responses?.['201'] &&
        'content' in operation.responses['201'] &&
        operation.responses['201'].content?.['application/json']?.schema,
    ).toEqual({
      $ref: '#/components/schemas/CloneTenantConfigurationResponseDto',
    });
    expect(Object.keys(operation?.responses ?? {}).sort()).toEqual([
      '201',
      '400',
      '401',
      '403',
      '404',
      '409',
    ]);
  });

  it('documents clone selector defaults and response DTO structure', () => {
    const requestSchema = document.components?.schemas?.[
      'CloneTenantConfigurationDto'
    ] as {
      required: string[];
      properties: Record<string, { default?: unknown }>;
    };
    expect(requestSchema.required.sort()).toEqual(['name', 'slug']);
    expect(requestSchema.properties.copyMetadata.default).toBe(true);
    expect(requestSchema.properties.copyFeatureFlagOverrides.default).toBe(
      true,
    );

    const responseSchema = document.components?.schemas?.[
      'CloneTenantConfigurationResponseDto'
    ] as { required: string[] };
    expect(responseSchema.required.sort()).toEqual([
      'cloned',
      'clonedFromTenantId',
      'tenant',
    ]);
  });
});
