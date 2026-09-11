import { BadRequestException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserRole } from '../common/enums/user-role.enum.js';
import type { PrismaService } from '../database/prisma.service.js';
import type { User } from '../database/prisma.types.js';
import type { UsersService } from '../users/users.service.js';
import { AuthService } from './auth.service.js';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'admin@test.com',
    password: '',
    name: 'Admin User',
    role: UserRole.ADMIN,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as User;
}

type PrismaMock = {
  passwordResetToken: {
    create: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  user: { update: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
};

describe('AuthService', () => {
  let authService: AuthService;
  let usersService: {
    findByEmail: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
  };
  let jwtService: { sign: ReturnType<typeof vi.fn> };
  let prisma: PrismaMock;

  beforeEach(() => {
    usersService = { findByEmail: vi.fn(), findById: vi.fn() };
    jwtService = { sign: vi.fn().mockReturnValue('mock-jwt-token') };
    prisma = {
      passwordResetToken: {
        create: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
      },
      user: { update: vi.fn() },
      $transaction: vi.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };

    authService = new AuthService(
      usersService as unknown as UsersService,
      jwtService as unknown as JwtService,
      prisma as unknown as PrismaService,
    );
  });

  describe('validateUser', () => {
    it('returns null when user is not found', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      const result = await authService.validateUser('x@y.com', 'pass');

      expect(result).toBeNull();
    });

    it('returns null when password is wrong', async () => {
      const user = makeUser({ password: await bcrypt.hash('correct', 10) });
      usersService.findByEmail.mockResolvedValue(user);

      const result = await authService.validateUser(user.email, 'wrong');

      expect(result).toBeNull();
    });

    it('returns user when credentials are correct', async () => {
      const user = makeUser({ password: await bcrypt.hash('secret', 10) });
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
    it('returns user without password', async () => {
      const user = makeUser({ password: 'secret-hash' });
      usersService.findById.mockResolvedValue(user);

      const result = await authService.getProfile(user.id);

      expect(result).not.toHaveProperty('password');
      expect(result).toHaveProperty('email', user.email);
    });

    it('throws NotFoundException when user not found', async () => {
      usersService.findById.mockResolvedValue(null);

      await expect(authService.getProfile('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('forgotPassword', () => {
    it('silently returns when user not found', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(
        authService.forgotPassword('x@y.com'),
      ).resolves.toBeUndefined();
      expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
    });

    it('creates a hashed reset token', async () => {
      const user = makeUser();
      usersService.findByEmail.mockResolvedValue(user);
      prisma.passwordResetToken.create.mockResolvedValue({ id: 'prt-1' });

      await authService.forgotPassword(user.email);

      expect(prisma.passwordResetToken.create).toHaveBeenCalledOnce();
      const arg = prisma.passwordResetToken.create.mock.calls[0][0];
      expect(arg.data).toMatchObject({ userId: user.id });
      expect(arg.data.tokenHash).toHaveLength(64); // SHA-256 hex
    });
  });

  describe('resetPassword', () => {
    it('throws BadRequestException when token not found', async () => {
      prisma.passwordResetToken.findFirst.mockResolvedValue(null);

      await expect(
        authService.resetPassword('bad-token', 'newpassword'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when token already used', async () => {
      prisma.passwordResetToken.findFirst.mockResolvedValue({
        id: 'prt-1',
        userId: 'user-1',
        tokenHash: '',
        expiresAt: new Date(Date.now() + 1000),
        usedAt: new Date(),
      });

      await expect(
        authService.resetPassword('token', 'newpassword'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when token expired', async () => {
      prisma.passwordResetToken.findFirst.mockResolvedValue({
        id: 'prt-1',
        userId: 'user-1',
        tokenHash: '',
        expiresAt: new Date(Date.now() - 1000),
        usedAt: null,
      });

      await expect(
        authService.resetPassword('token', 'newpassword'),
      ).rejects.toThrow(BadRequestException);
    });

    it('updates password and marks token as used on success', async () => {
      const rawToken = 'valid-raw-token';
      const tokenHash = crypto
        .createHash('sha256')
        .update(rawToken)
        .digest('hex');
      prisma.passwordResetToken.findFirst.mockResolvedValue({
        id: 'prt-1',
        userId: 'user-1',
        tokenHash,
        expiresAt: new Date(Date.now() + 60_000),
        usedAt: null,
      });

      await authService.resetPassword(rawToken, 'newpassword123');

      expect(prisma.user.update).toHaveBeenCalledOnce();
      expect(prisma.passwordResetToken.update).toHaveBeenCalledWith({
        where: { id: 'prt-1' },
        data: { usedAt: expect.any(Date) },
      });
    });
  });
});
