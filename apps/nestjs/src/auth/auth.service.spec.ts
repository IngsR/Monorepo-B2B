import { BadRequestException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserRole } from '../common/enums/user-role.enum.js';
import { UserStatus } from '../common/enums/user-status.enum.js';
import { PasswordResetToken } from '../users/entities/password-reset-token.entity.js';
import { User } from '../users/entities/user.entity.js';
import { UsersService } from '../users/users.service.js';
import { AuthService } from './auth.service.js';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'admin@test.com',
    passwordHash: '',
    firstName: 'Admin',
    lastName: 'User',
    role: UserRole.ADMIN,
    status: UserStatus.ACTIVE,
    companyId: null,
    company: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as User;
}

function makeResetToken(overrides: Partial<PasswordResetToken> = {}): PasswordResetToken {
  return {
    id: 'token-1',
    userId: 'user-1',
    user: makeUser(),
    tokenHash: '',
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    usedAt: null,
    createdAt: new Date(),
    ...overrides,
  } as PasswordResetToken;
}

describe('AuthService', () => {
  let authService: AuthService;
  let usersService: { findByEmail: ReturnType<typeof vi.fn>; findById: ReturnType<typeof vi.fn> };
  let jwtService: { sign: ReturnType<typeof vi.fn> };
  let resetTokenRepo: {
    findOne: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    manager: { getRepository: ReturnType<typeof vi.fn> };
  };

  beforeEach(async () => {
    usersService = {
      findByEmail: vi.fn(),
      findById: vi.fn(),
    };

    jwtService = {
      sign: vi.fn().mockReturnValue('mock-jwt-token'),
    };

    const userRepoMock = {
      update: vi.fn(),
    };

    resetTokenRepo = {
      findOne: vi.fn(),
      save: vi.fn(),
      create: vi.fn((data) => data),
      update: vi.fn(),
      manager: {
        getRepository: vi.fn().mockReturnValue(userRepoMock),
      },
    };

    authService = new AuthService(
      usersService as unknown as UsersService,
      jwtService as unknown as JwtService,
      resetTokenRepo as never,
    );
  });

  describe('validateUser', () => {
    it('returns null when user is not found', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      const result = await authService.validateUser('x@y.com', 'pass');

      expect(result).toBeNull();
    });

    it('returns null when password is wrong', async () => {
      const user = makeUser({ passwordHash: await bcrypt.hash('correct', 10) });
      usersService.findByEmail.mockResolvedValue(user);

      const result = await authService.validateUser(user.email, 'wrong');

      expect(result).toBeNull();
    });

    it('returns user when credentials are correct', async () => {
      const user = makeUser({ passwordHash: await bcrypt.hash('secret', 10) });
      usersService.findByEmail.mockResolvedValue(user);

      const result = await authService.validateUser(user.email, 'secret');

      expect(result).toEqual(user);
    });
  });

  describe('login', () => {
    it('returns a signed access token', () => {
      const user = makeUser();
      const result = authService.login(user);

      expect(result).toEqual({ accessToken: 'mock-jwt-token' });
      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: user.id,
        userId: user.id,
        email: user.email,
        role: user.role,
      });
    });
  });

  describe('getProfile', () => {
    it('returns user without passwordHash', async () => {
      const user = makeUser({ passwordHash: 'secret-hash' });
      usersService.findById.mockResolvedValue(user);

      const result = await authService.getProfile(user.id);

      expect(result).not.toHaveProperty('passwordHash');
      expect(result).toHaveProperty('email', user.email);
    });

    it('throws NotFoundException when user not found', async () => {
      usersService.findById.mockResolvedValue(null);

      await expect(authService.getProfile('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('forgotPassword', () => {
    it('silently returns when user not found', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(authService.forgotPassword('x@y.com')).resolves.toBeUndefined();
      expect(resetTokenRepo.save).not.toHaveBeenCalled();
    });

    it('silently returns when user is INACTIVE', async () => {
      usersService.findByEmail.mockResolvedValue(makeUser({ status: UserStatus.INACTIVE }));

      await expect(authService.forgotPassword('x@y.com')).resolves.toBeUndefined();
      expect(resetTokenRepo.save).not.toHaveBeenCalled();
    });

    it('creates and saves a hashed reset token', async () => {
      const user = makeUser();
      usersService.findByEmail.mockResolvedValue(user);
      resetTokenRepo.save.mockResolvedValue(undefined);

      await authService.forgotPassword(user.email);

      expect(resetTokenRepo.save).toHaveBeenCalledOnce();
      const savedArg = resetTokenRepo.save.mock.calls[0][0];
      expect(savedArg).toMatchObject({ userId: user.id });
      expect(savedArg.tokenHash).toHaveLength(64); // SHA-256 hex
    });
  });

  describe('resetPassword', () => {
    it('throws BadRequestException when token not found', async () => {
      resetTokenRepo.findOne.mockResolvedValue(null);

      await expect(
        authService.resetPassword('bad-token', 'newpassword'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when token already used', async () => {
      resetTokenRepo.findOne.mockResolvedValue(
        makeResetToken({ usedAt: new Date() }),
      );

      await expect(
        authService.resetPassword('token', 'newpassword'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when token expired', async () => {
      resetTokenRepo.findOne.mockResolvedValue(
        makeResetToken({ expiresAt: new Date(Date.now() - 1000) }),
      );

      await expect(
        authService.resetPassword('token', 'newpassword'),
      ).rejects.toThrow(BadRequestException);
    });

    it('updates password and marks token as used on success', async () => {
      const rawToken = 'valid-raw-token';
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const record = makeResetToken({ tokenHash });
      resetTokenRepo.findOne.mockResolvedValue(record);
      resetTokenRepo.update.mockResolvedValue(undefined);

      await authService.resetPassword(rawToken, 'newpassword123');

      expect(resetTokenRepo.update).toHaveBeenCalledWith(
        record.id,
        expect.objectContaining({ usedAt: expect.any(Date) }),
      );
    });
  });
});
