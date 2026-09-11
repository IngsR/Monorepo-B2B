import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../enums/user-role.enum.js';

export const ROLES_KEY = 'roles';

/** Membatasi akses route hanya untuk role yang disebutkan. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
