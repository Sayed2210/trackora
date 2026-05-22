import { SetMetadata } from '@nestjs/common';
import { Permission } from '@common/constants/permissions.constant';

export const PERMISSIONS_KEY = 'permissions';
export const ANY_PERMISSIONS_KEY = 'any_permissions';
export const Permissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
export const AnyPermissions = (...permissions: Permission[]) =>
  SetMetadata(ANY_PERMISSIONS_KEY, permissions);
