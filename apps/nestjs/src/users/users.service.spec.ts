import {
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import type { PrismaService } from '../database/prisma.service.js';
import { UserRole } from '../common/enums/user-role.enum.js';
import { UsersService } from './users.service.js';

type PrismaMock = {
  user: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
};

function makePrisma(): PrismaMock {
  return {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  };
}

describe('UsersService', () => {
  let service: UsersService;
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = makePrisma();
    service = new UsersService(prisma as unknown as PrismaService);
  });

  describe('findByEmail / findById', () => {
    it('finds a user by email', async () => {
      const mockUser = { id: 'u-1', email: 'test@example.com' };
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findByEmail('test@example.com');
      expect(result).toEqual(mockUser);
    });

    it('finds a user by id', async () => {
      const mockUser = { id: 'u-1', email: 'test@example.com' };
      prisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(service.findById('u-1')).resolves.toEqual(mockUser);
    });

    it('returns null when the user is missing', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.findById('nope')).resolves.toBeNull();
    });
  });

  describe('findAll', () => {
    it('returns paginated users without password', async () => {
      prisma.user.findMany.mockResolvedValue([
        { id: '1', email: 'a@test.com', name: 'A', role: UserRole.ADMIN },
      ]);
      prisma.user.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 10, skip: 0 });

      expect(result.data[0]).not.toHaveProperty('password');
      expect(result.data[0].email).toBe('a@test.com');
      expect(result.meta.total).toBe(1);
    });
  });

  describe('findOneOrFail', () => {
    it('throws NotFoundException when user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.findOneOrFail('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns the user for a known id', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u-1',
        email: 'a@test.com',
        name: 'A',
        role: UserRole.ADMIN,
      });

      await expect(service.findOneOrFail('u-1')).resolves.toMatchObject({
        id: 'u-1',
      });
    });
  });

  describe('create', () => {
    it('throws ConflictException if email is already taken', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(
        service.create({
          email: 'test@example.com',
          password: 'Password123!',
          name: 'Test',
          role: UserRole.BIDDER,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('hashes password and saves the user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 'u-2',
        email: 'new@example.com',
        name: 'New',
        role: UserRole.BIDDER,
      });

      const result = await service.create({
        email: 'new@example.com',
        password: 'Password123!',
        name: 'New',
        role: UserRole.BIDDER,
      });

      expect(result).not.toHaveProperty('password');
      expect(result.email).toBe('new@example.com');

      const createArg = prisma.user.create.mock.calls[0][0];
      expect(createArg.data.password).not.toBe('Password123!');
      expect(
        await bcrypt.compare('Password123!', createArg.data.password),
      ).toBe(true);
    });
  });

  describe('update', () => {
    it('throws NotFoundException when the user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.update('missing', { name: 'X' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('updates and returns the public user', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u-1' });
      prisma.user.update.mockResolvedValue({
        id: 'u-1',
        email: 'a@test.com',
        name: 'Renamed',
        role: UserRole.ADMIN,
      });

      const result = await service.update('u-1', { name: 'Renamed' });
      expect(result).not.toHaveProperty('password');
      expect(result.name).toBe('Renamed');
    });
  });

  describe('changePassword', () => {
    it('throws NotFoundException when the user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.changePassword('missing', {
          currentPassword: 'x',
          newPassword: 'BrandNewPassword123',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws UnauthorizedException when current password does not match', async () => {
      const hashed = await bcrypt.hash('CorrectPass123', 10);
      prisma.user.findUnique.mockResolvedValue({ id: 'u-1', password: hashed });

      await expect(
        service.changePassword('u-1', {
          currentPassword: 'WrongPassword',
          newPassword: 'BrandNewPassword123',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('hashes and stores the new password on success', async () => {
      const hashed = await bcrypt.hash('CorrectPass123', 10);
      prisma.user.findUnique.mockResolvedValue({ id: 'u-1', password: hashed });
      prisma.user.update.mockResolvedValue({ id: 'u-1' });

      await service.changePassword('u-1', {
        currentPassword: 'CorrectPass123',
        newPassword: 'BrandNewPassword123',
      });

      const arg = prisma.user.update.mock.calls[0][0];
      expect(arg.where).toEqual({ id: 'u-1' });
      expect(arg.data.password).not.toBe('BrandNewPassword123');
      expect(await bcrypt.compare('BrandNewPassword123', arg.data.password)).toBe(
        true,
      );
    });
  });
});
