import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserRole } from '../../common/enums/user-role.enum.js';
import type { JwtPayload } from '../interfaces/jwt-payload.interface.js';
import { RolesGuard } from './roles.guard.js';

function makeContext(user: Partial<JwtPayload>, roles: UserRole[] | undefined): ExecutionContext {
  const reflector = new Reflector();
  vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(roles);

  const request = { user };

  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  it('allows access when no roles are required', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const ctx = makeContext({ role: UserRole.SELLER }, undefined);

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows access when user has required role', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.ADMIN]);
    const ctx = makeContext({ role: UserRole.ADMIN }, [UserRole.ADMIN]);

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('throws ForbiddenException when user does not have required role', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.ADMIN]);
    const ctx = makeContext({ role: UserRole.SELLER }, [UserRole.ADMIN]);

    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('allows access when user has one of multiple required roles', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue([
      UserRole.ADMIN,
      UserRole.VENDOR,
    ]);
    const ctx = makeContext({ role: UserRole.VENDOR }, [UserRole.ADMIN, UserRole.VENDOR]);

    expect(guard.canActivate(ctx)).toBe(true);
  });
});
