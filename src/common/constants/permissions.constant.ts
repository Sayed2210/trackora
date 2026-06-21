import { UserRole } from '@prisma/client';

export const PERMISSIONS = {
  SHIPMENTS_CREATE: 'shipments:create',
  SHIPMENTS_READ_ALL: 'shipments:read:all',
  SHIPMENTS_READ_OWN: 'shipments:read:own',
  SHIPMENTS_UPDATE_STATUS: 'shipments:update:status',
  SHIPMENTS_UPDATE_STATUS_OVERRIDE: 'shipments:update:status:override',
  COURIERS_READ: 'couriers:read',
  COURIERS_CREATE: 'couriers:create',
  MERCHANTS_READ: 'merchants:read',
  MERCHANTS_APPROVE: 'merchants:approve',
  WALLETS_READ_ALL: 'wallets:read:all',
  WALLETS_READ_OWN: 'wallets:read:own',
  PAYOUTS_REQUEST: 'payouts:request',
  PAYOUTS_APPROVE: 'payouts:approve',
  MANAGE_TENANTS: 'manage_tenants',
  MANAGE_PLANS: 'manage_plans',
  MANAGE_SUBSCRIPTIONS: 'manage_subscriptions',
  VIEW_PLATFORM_ANALYTICS: 'view_platform_analytics',
  MANAGE_FEATURE_FLAGS: 'manage_feature_flags',
  VIEW_AUDIT_LOGS: 'view_audit_logs',
  IMPERSONATE_TENANT_ADMIN: 'impersonate_tenant_admin',
  VIEW_BILLING: 'view_billing',
  SUSPEND_TENANTS: 'suspend_tenants',
  VIEW_DEMO_REQUESTS: 'view_demo_requests',
  MANAGE_DEMO_REQUESTS: 'manage_demo_requests',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const PLATFORM_ROLES = [
  UserRole.PLATFORM_OWNER,
  UserRole.PLATFORM_ADMIN,
  UserRole.PLATFORM_SUPPORT,
  UserRole.PLATFORM_FINANCE,
] as const;

export type PlatformRole = (typeof PLATFORM_ROLES)[number];

export const PLATFORM_PERMISSIONS = [
  PERMISSIONS.MANAGE_TENANTS,
  PERMISSIONS.MANAGE_PLANS,
  PERMISSIONS.MANAGE_SUBSCRIPTIONS,
  PERMISSIONS.VIEW_PLATFORM_ANALYTICS,
  PERMISSIONS.MANAGE_FEATURE_FLAGS,
  PERMISSIONS.VIEW_AUDIT_LOGS,
  PERMISSIONS.IMPERSONATE_TENANT_ADMIN,
  PERMISSIONS.VIEW_BILLING,
  PERMISSIONS.SUSPEND_TENANTS,
  PERMISSIONS.VIEW_DEMO_REQUESTS,
  PERMISSIONS.MANAGE_DEMO_REQUESTS,
] as const;

export const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  [UserRole.PLATFORM_OWNER]: PLATFORM_PERMISSIONS,
  [UserRole.PLATFORM_ADMIN]: [
    PERMISSIONS.MANAGE_TENANTS,
    PERMISSIONS.MANAGE_PLANS,
    PERMISSIONS.MANAGE_SUBSCRIPTIONS,
    PERMISSIONS.VIEW_PLATFORM_ANALYTICS,
    PERMISSIONS.MANAGE_FEATURE_FLAGS,
    PERMISSIONS.VIEW_AUDIT_LOGS,
    PERMISSIONS.VIEW_BILLING,
    PERMISSIONS.SUSPEND_TENANTS,
    PERMISSIONS.VIEW_DEMO_REQUESTS,
    PERMISSIONS.MANAGE_DEMO_REQUESTS,
  ],
  [UserRole.PLATFORM_SUPPORT]: [
    PERMISSIONS.VIEW_PLATFORM_ANALYTICS,
    PERMISSIONS.VIEW_AUDIT_LOGS,
    PERMISSIONS.IMPERSONATE_TENANT_ADMIN,
  ],
  [UserRole.PLATFORM_FINANCE]: [
    PERMISSIONS.VIEW_BILLING,
    PERMISSIONS.VIEW_PLATFORM_ANALYTICS,
    PERMISSIONS.VIEW_AUDIT_LOGS,
  ],
  [UserRole.SUPER_ADMIN]: [],
  [UserRole.OPERATIONS_MANAGER]: [],
  [UserRole.FINANCE_ADMIN]: [],
  [UserRole.MERCHANT]: [],
  [UserRole.COURIER]: [],
};

export const isPlatformRole = (role: UserRole): role is PlatformRole =>
  PLATFORM_ROLES.includes(role as PlatformRole);

export const getPermissionsForRole = (role: UserRole): Permission[] => [
  ...ROLE_PERMISSIONS[role],
];
