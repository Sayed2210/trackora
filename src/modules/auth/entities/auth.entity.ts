import { UserRole } from '@modules/users/entities/user.entity';

export type { User } from '@modules/users/entities/user.entity';
export { UserRole };

export interface TokenPayload {
  sub: string;
  role: UserRole;
  type: string;
}

export interface RefreshTokenPayload {
  sub: string;
  type: string;
}

export interface JwtPayload {
  sub: string;
  role: UserRole;
}
