import { UserRole } from '@prisma/client';
import { Permission } from '@common/constants/permissions.constant';

export interface ImpersonationContext {
  sessionId: string;
  actorUserId: string;
  targetUserId: string;
  tenantId: string;
}

export interface PlatformContext {
  userId: string;
  role: UserRole;
  permissions: Permission[];
}

export interface AuthenticatedRequestUser {
  userId: string;
  role: UserRole;
  permissions: Permission[];
  tenantId?: string | null;
  platformContext?: PlatformContext;
  impersonationContext?: ImpersonationContext;
}
