import { ConflictException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { UserRole } from '../common/enums/user-role.enum.js';
import { User } from './entities/user.entity.js';
import { UsersService } from './users.service.js';

describe('UsersService', () => {
  let service: UsersService;
  let repo: Partial<Record<keyof Repository<User>, any>>;

  beforeEach(() => {
    repo = {
      findOne: vi.fn(),
      findAndCount: vi.fn(),
      create: vi.fn().mockImplementation((dto) => dto),
      save: vi.fn().mockImplementation((entity) => Promise.resolve({ id: 'u-1', ...entity })),
    };
    service = new UsersService(repo as unknown as Repository<User>);
  });

  describe('findByEmail and findById', () => {
    it('finds user by email', async () => {
      const mockUser = { id: 'u-1', email: 'test@example.com' };
      repo.findOne!.mockResolvedValue(mockUser);

      const result = await service.findByEmail('test@example.com');
      expect(result).toEqual(mockUser);
    });
  });

  describe('findAll', () => {
    it('strips passwordHash from output', async () => {
      const users = [
        { id: '1', email: 'a@test.com', passwordHash: 'secret' },
      ];
      repo.findAndCount!.mockResolvedValue([users, 1]);

      const result = await service.findAll({ page: 1, limit: 10, skip: 0 });
      expect(result.data[0]).not.toHaveProperty('passwordHash');
      expect(result.data[0].email).toBe('a@test.com');
    });
  });

  describe('findOneOrFail', () => {
    it('throws NotFoundException when user does not exist', async () => {
      repo.findOne!.mockResolvedValue(null);

      await expect(service.findOneOrFail('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('throws ConflictException if email is already taken', async () => {
      repo.findOne!.mockResolvedValue({ id: 'existing', email: 'test@example.com' });

      await expect(
        service.create({
          email: 'test@example.com',
          password: 'Password123!',
          role: UserRole.BUYER,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('hashes password and saves user without returning hash', async () => {
      repo.findOne!.mockResolvedValue(null);

      const result = await service.create({
        email: 'new@example.com',
        password: 'Password123!',
        role: UserRole.BUYER,
      });

      expect(result).not.toHaveProperty('passwordHash');
      expect(result.email).toBe('new@example.com');
      expect(repo.save).toHaveBeenCalled();
    });
  });

  describe('changePassword', () => {
    it('throws UnauthorizedException when current password does not match', async () => {
      const hashed = await bcrypt.hash('CorrectPass123', 10);
      repo.findOne!.mockResolvedValue({
        id: 'u-1',
        passwordHash: hashed,
      });

      await expect(
        service.changePassword('u-1', {
          currentPassword: 'WrongPassword',
          newPassword: 'BrandNewPassword123',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
