import { ConfigService } from '@nestjs/config';
import { describe, expect, it } from 'vitest';
import { UserRole } from '../../common/enums/user-role.enum.js';
import type { JwtPayload } from '../interfaces/jwt-payload.interface.js';
import { JwtStrategy } from './jwt.strategy.js';

describe('JwtStrategy', () => {
  function makeStrategy(): JwtStrategy {
    const config = {
      get: (key: string, fallback = '') =>
        key === 'JWT_SECRET' ? 'test-secret' : fallback,
    } as unknown as ConfigService;

    return new JwtStrategy(config);
  }

  it('validate returns the payload as JwtPayload', () => {
    const strategy = makeStrategy();
    const payload: JwtPayload = {
      sub: 'user-1',
      userId: 'user-1',
      email: 'admin@test.com',
      role: UserRole.ADMIN,
    };

    const result = strategy.validate(payload);

    expect(result).toEqual({
      sub: 'user-1',
      userId: 'user-1',
      email: 'admin@test.com',
      role: UserRole.ADMIN,
    });
  });
});
