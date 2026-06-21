import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { DemoRequestStatus, UserRole } from '@prisma/client';
import {
  PERMISSIONS,
  Permission,
} from '@common/constants/permissions.constant';
import { PERMISSIONS_KEY } from '@common/decorators/permissions.decorator';
import { PlatformOnlyGuard } from '@common/guards/platform-only.guard';
import { PermissionsGuard } from '@common/guards/permissions.guard';
import { AuthenticatedRequestUser } from '@common/interfaces/request-context.interface';
import { DemoRequestsController } from '../controllers/demo-requests.controller';
import { DemoRequestsService } from '../services/demo-requests.service';

const demoRequestId = '123e4567-e89b-42d3-a456-426614174000';

describe('DemoRequestsController', () => {
  let controller: DemoRequestsController;
  let service: jest.Mocked<DemoRequestsService>;
  let reflector: Reflector;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [DemoRequestsController],
      providers: [
        {
          provide: DemoRequestsService,
          useValue: {
            listDemoRequests: jest.fn(),
            getDemoRequestById: jest.fn(),
            updateDemoRequest: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = moduleRef.get(DemoRequestsController);
    service = moduleRef.get(DemoRequestsService);
    reflector = moduleRef.get(Reflector);
  });

  describe('delegation', () => {
    it('delegates list to service.listDemoRequests', async () => {
      const response = {
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      };
      service.listDemoRequests.mockResolvedValueOnce(response);

      const result = await controller.listDemoRequests({
        page: 1,
        limit: 20,
      });

      expect(service.listDemoRequests).toHaveBeenCalled();
      expect(result).toEqual(response);
    });

    it('delegates detail to service.getDemoRequestById', async () => {
      service.getDemoRequestById.mockResolvedValueOnce({
        id: demoRequestId,
      } as never);

      const result = await controller.getDemoRequest({ id: demoRequestId });

      expect(service.getDemoRequestById).toHaveBeenCalledWith(demoRequestId);
      expect(result).toEqual({ id: demoRequestId });
    });

    it('delegates update to service.updateDemoRequest with audit context', async () => {
      service.updateDemoRequest.mockResolvedValueOnce({
        id: demoRequestId,
        status: DemoRequestStatus.CONTACTED,
      } as never);

      const user: AuthenticatedRequestUser = {
        userId: 'actor-id',
        role: UserRole.PLATFORM_OWNER,
        permissions: [PERMISSIONS.MANAGE_DEMO_REQUESTS],
      };
      const request = {
        user,
        ip: '10.0.0.1',
        headers: { 'user-agent': 'test-agent' },
      };

      const result = await controller.updateDemoRequest(
        { id: demoRequestId },
        { status: DemoRequestStatus.CONTACTED },
        request,
      );

      expect(service.updateDemoRequest).toHaveBeenCalledWith(
        demoRequestId,
        { status: DemoRequestStatus.CONTACTED },
        {
          user,
          ipAddress: '10.0.0.1',
          userAgent: 'test-agent',
        },
      );
      expect(result).toEqual({
        id: demoRequestId,
        status: DemoRequestStatus.CONTACTED,
      });
    });
  });

  describe('permissions metadata', () => {
    it('requires view_demo_requests for list endpoint', () => {
      const perms = reflector.get<Permission[]>(
        PERMISSIONS_KEY,
        controller.listDemoRequests,
      );
      expect(perms).toEqual([PERMISSIONS.VIEW_DEMO_REQUESTS]);
    });

    it('requires view_demo_requests for detail endpoint', () => {
      const perms = reflector.get<Permission[]>(
        PERMISSIONS_KEY,
        controller.getDemoRequest,
      );
      expect(perms).toEqual([PERMISSIONS.VIEW_DEMO_REQUESTS]);
    });

    it('requires manage_demo_requests for update endpoint', () => {
      const perms = reflector.get<Permission[]>(
        PERMISSIONS_KEY,
        controller.updateDemoRequest,
      );
      expect(perms).toEqual([PERMISSIONS.MANAGE_DEMO_REQUESTS]);
    });
  });

  describe('forbidden access', () => {
    const makeContext = (
      user: { role: UserRole; permissions: string[] } | undefined,
      handler: () => unknown,
    ): ExecutionContext =>
      ({
        switchToHttp: () => ({
          getRequest: () => ({ user }),
        }),
        getHandler: () => handler,
        getClass: () => DemoRequestsController,
      }) as ExecutionContext;

    it('rejects non-platform users (MERCHANT) via PlatformOnlyGuard', () => {
      const guard = new PlatformOnlyGuard();
      const ctx = makeContext(
        { role: UserRole.MERCHANT, permissions: [] },
        controller.listDemoRequests,
      );

      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    });

    it('rejects unauthenticated requests via PlatformOnlyGuard', () => {
      const guard = new PlatformOnlyGuard();
      const ctx = makeContext(undefined, controller.listDemoRequests);

      expect(() => guard.canActivate(ctx)).toThrow();
    });

    it('rejects platform FINANCE (no demo-request perms) via PermissionsGuard on list', () => {
      const guard = new PermissionsGuard(reflector);
      const ctx = makeContext(
        {
          role: UserRole.PLATFORM_FINANCE,
          permissions: [PERMISSIONS.VIEW_BILLING, PERMISSIONS.VIEW_AUDIT_LOGS],
        },
        controller.listDemoRequests,
      );

      expect(guard.canActivate(ctx)).toBe(false);
    });

    it('rejects platform SUPPORT (no manage perm) via PermissionsGuard on update', () => {
      const guard = new PermissionsGuard(reflector);
      const ctx = makeContext(
        {
          role: UserRole.PLATFORM_SUPPORT,
          permissions: [
            PERMISSIONS.VIEW_PLATFORM_ANALYTICS,
            PERMISSIONS.VIEW_AUDIT_LOGS,
            PERMISSIONS.IMPERSONATE_TENANT_ADMIN,
          ],
        },
        controller.updateDemoRequest,
      );

      expect(guard.canActivate(ctx)).toBe(false);
    });

    it('allows platform OWNER (has all perms) on list', () => {
      const guard = new PermissionsGuard(reflector);
      const ctx = makeContext(
        {
          role: UserRole.PLATFORM_OWNER,
          permissions: [
            PERMISSIONS.VIEW_DEMO_REQUESTS,
            PERMISSIONS.MANAGE_DEMO_REQUESTS,
          ],
        },
        controller.listDemoRequests,
      );

      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('allows platform ADMIN on update', () => {
      const guard = new PermissionsGuard(reflector);
      const ctx = makeContext(
        {
          role: UserRole.PLATFORM_ADMIN,
          permissions: [
            PERMISSIONS.VIEW_DEMO_REQUESTS,
            PERMISSIONS.MANAGE_DEMO_REQUESTS,
          ],
        },
        controller.updateDemoRequest,
      );

      expect(guard.canActivate(ctx)).toBe(true);
    });
  });
});
