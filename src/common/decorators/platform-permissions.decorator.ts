import {
  AnyPermissions,
  Permissions,
} from '@common/decorators/permissions.decorator';
import { Permission } from '@common/constants/permissions.constant';

export const PlatformPermissions = (...permissions: Permission[]) =>
  Permissions(...permissions);

export const PlatformAnyPermissions = (...permissions: Permission[]) =>
  AnyPermissions(...permissions);
