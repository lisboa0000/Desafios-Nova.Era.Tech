import { ExecutionContext, SetMetadata, createParamDecorator } from '@nestjs/common';
import { Role } from '../database/entities';

export interface AuthUser {
  id: number;
  role: Role;
}

export const IS_PUBLIC = 'isPublic';
export const ROLES_KEY = 'roles';

export const Public = () => SetMetadata(IS_PUBLIC, true);
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthUser => ctx.switchToHttp().getRequest().user,
);
