import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface.js';
import { UserRole } from '../common/enums/user-role.enum.js';
import type { PrismaService } from '../database/prisma.service.js';
import { BiddersService } from './bidders.service.js';

type PrismaMock = {
  user: { findUnique: ReturnType<typeof vi.fn> };
  bidder: {
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
    user: { findUnique: vi.fn() },
    bidder: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  };
}

const BIDDER_USER: JwtPayload = {
  sub: 'user-2',
  userId: 'user-2',
  email: 'bidder@test.com',
  role: UserRole.BIDDER,
};

describe('BiddersService', () => {
  let service: BiddersService;
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = makePrisma();
    service = new BiddersService(prisma as unknown as PrismaService);
  });

  describe('findAll', () => {
    it('returns a paginated list', async () => {
      prisma.bidder.findMany.mockResolvedValue([
        { id: 'b-1', phone: '0812' },
      ]);
      prisma.bidder.count.mockResolvedValue(1);

      const result = await service.findAll({
        page: 1,
        limit: 10,
        skip: 0,
        search: '08',
      });

      expect(result.meta.total).toBe(1);
      expect(result.data[0].id).toBe('b-1');
    });
  });

  describe('findOne', () => {
    it('throws NotFound when the bidder does not exist', async () => {
      prisma.bidder.findUnique.mockResolvedValue(null);
      await expect(service.findOne('missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns the bidder', async () => {
      prisma.bidder.findUnique.mockResolvedValue({ id: 'b-1' });
      await expect(service.findOne('b-1')).resolves.toEqual({ id: 'b-1' });
    });
  });

  describe('findMine', () => {
    it('rejects non-BIDDER role', async () => {
      await expect(
        service.findMine({ ...BIDDER_USER, role: UserRole.VENDOR }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFound when the bidder profile is missing', async () => {
      prisma.bidder.findUnique.mockResolvedValue(null);

      await expect(service.findMine(BIDDER_USER)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns the bidder linked to the current user', async () => {
      const bidder = { id: 'b-1', userId: 'user-2' };
      prisma.bidder.findUnique.mockResolvedValue(bidder);

      await expect(service.findMine(BIDDER_USER)).resolves.toEqual(bidder);
    });
  });

  describe('create', () => {
    it('throws NotFound when the target user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.create({ userId: 'missing' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rejects a user without the BIDDER role', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u-1',
        role: UserRole.VENDOR,
      });

      await expect(service.create({ userId: 'u-1' })).rejects.toThrow(
        ConflictException,
      );
    });

    it('rejects a user who already has a bidder profile', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u-1',
        role: UserRole.BIDDER,
      });
      prisma.bidder.findUnique.mockResolvedValue({ id: 'b-1' });

      await expect(service.create({ userId: 'u-1' })).rejects.toThrow(
        ConflictException,
      );
    });

    it('creates a bidder profile for a BIDDER user', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u-1',
        role: UserRole.BIDDER,
      });
      prisma.bidder.findUnique.mockResolvedValue(null);
      prisma.bidder.create.mockResolvedValue({ id: 'b-1', userId: 'u-1' });

      await expect(service.create({ userId: 'u-1' })).resolves.toMatchObject({
        id: 'b-1',
      });
    });
  });

  describe('updateMine', () => {
    it('updates only the current user bidder', async () => {
      prisma.bidder.findUnique.mockResolvedValue({
        id: 'b-1',
        userId: 'user-2',
      });
      prisma.bidder.update.mockResolvedValue({ id: 'b-1' });

      await service.updateMine(BIDDER_USER, { phone: '0812' });

      expect(prisma.bidder.update).toHaveBeenCalledWith({
        where: { id: 'b-1' },
        data: expect.objectContaining({ phone: '0812' }),
      });
    });
  });

  describe('update (ADMIN)', () => {
    it('throws NotFound when the bidder does not exist', async () => {
      prisma.bidder.findUnique.mockResolvedValue(null);

      await expect(service.update('missing', { phone: '1' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
