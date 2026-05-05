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
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
