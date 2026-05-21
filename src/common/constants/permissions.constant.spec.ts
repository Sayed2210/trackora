import { UserRole } from '@prisma/client';
import {
  getPermissionsForRole,
  isPlatformRole,
  PERMISSIONS,
} from './permissions.constant';

describe('platform permissions', () => {
  it('maps PLATFORM_OWNER to all platform permissions', () => {
    expect(getPermissionsForRole(UserRole.PLATFORM_OWNER)).toEqual([
      PERMISSIONS.MANAGE_TENANTS,
      PERMISSIONS.MANAGE_PLANS,
      PERMISSIONS.MANAGE_SUBSCRIPTIONS,
      PERMISSIONS.VIEW_PLATFORM_ANALYTICS,
      PERMISSIONS.MANAGE_FEATURE_FLAGS,
      PERMISSIONS.VIEW_AUDIT_LOGS,
      PERMISSIONS.IMPERSONATE_TENANT_ADMIN,
      PERMISSIONS.VIEW_BILLING,
      PERMISSIONS.SUSPEND_TENANTS,
    ]);
  });

  it('maps platform support to read and impersonation permissions only', () => {
    expect(getPermissionsForRole(UserRole.PLATFORM_SUPPORT)).toEqual([
      PERMISSIONS.VIEW_PLATFORM_ANALYTICS,
      PERMISSIONS.VIEW_AUDIT_LOGS,
      PERMISSIONS.IMPERSONATE_TENANT_ADMIN,
    ]);
  });

  it('does not treat tenant roles as platform roles', () => {
    expect(isPlatformRole(UserRole.MERCHANT)).toBe(false);
    expect(getPermissionsForRole(UserRole.MERCHANT)).toEqual([]);
  });
});
