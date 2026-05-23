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

  it('maps PLATFORM_ADMIN to admin permissions without impersonation', () => {
    expect(getPermissionsForRole(UserRole.PLATFORM_ADMIN)).toEqual([
      PERMISSIONS.MANAGE_TENANTS,
      PERMISSIONS.MANAGE_PLANS,
      PERMISSIONS.MANAGE_SUBSCRIPTIONS,
      PERMISSIONS.VIEW_PLATFORM_ANALYTICS,
      PERMISSIONS.MANAGE_FEATURE_FLAGS,
      PERMISSIONS.VIEW_AUDIT_LOGS,
      PERMISSIONS.VIEW_BILLING,
      PERMISSIONS.SUSPEND_TENANTS,
    ]);
    expect(getPermissionsForRole(UserRole.PLATFORM_ADMIN)).not.toContain(
      PERMISSIONS.IMPERSONATE_TENANT_ADMIN,
    );
  });

  it('maps PLATFORM_FINANCE to finance read permissions only', () => {
    const permissions = getPermissionsForRole(UserRole.PLATFORM_FINANCE);

    expect(permissions).toEqual([
      PERMISSIONS.VIEW_BILLING,
      PERMISSIONS.VIEW_PLATFORM_ANALYTICS,
      PERMISSIONS.VIEW_AUDIT_LOGS,
    ]);
    expect(permissions).not.toContain(PERMISSIONS.MANAGE_TENANTS);
    expect(permissions).not.toContain(PERMISSIONS.MANAGE_PLANS);
    expect(permissions).not.toContain(PERMISSIONS.MANAGE_SUBSCRIPTIONS);
  });

  it('does not treat tenant roles as platform roles', () => {
    expect(isPlatformRole(UserRole.MERCHANT)).toBe(false);
    expect(isPlatformRole(UserRole.COURIER)).toBe(false);
    expect(isPlatformRole(UserRole.SUPER_ADMIN)).toBe(false);
    expect(isPlatformRole(UserRole.OPERATIONS_MANAGER)).toBe(false);
    expect(isPlatformRole(UserRole.FINANCE_ADMIN)).toBe(false);
    expect(getPermissionsForRole(UserRole.MERCHANT)).toEqual([]);
  });
});
