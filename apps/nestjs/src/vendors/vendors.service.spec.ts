import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface.js';
import { UserRole } from '../common/enums/user-role.enum.js';
import type { PrismaService } from '../database/prisma.service.js';
import { VendorsService } from './vendors.service.js';

type PrismaMock = {
  user: { findUnique: ReturnType<typeof vi.fn> };
  vendor: {
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
    vendor: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  };
}

const VENDOR_USER: JwtPayload = {
  sub: 'user-1',
  userId: 'user-1',
  email: 'vendor@test.com',
  role: UserRole.VENDOR,
};

describe('VendorsService', () => {
  let service: VendorsService;
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = makePrisma();
    service = new VendorsService(prisma as unknown as PrismaService);
  });

  describe('findAll', () => {
    it('returns a paginated list', async () => {
      prisma.vendor.findMany.mockResolvedValue([
        { id: 'v-1', companyName: 'Acme' },
      ]);
      prisma.vendor.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 10, skip: 0 });

      expect(result.meta.total).toBe(1);
      expect(result.data[0].id).toBe('v-1');
    });
  });

  describe('findOne', () => {
    it('throws NotFound when the vendor does not exist', async () => {
      prisma.vendor.findUnique.mockResolvedValue(null);
      await expect(service.findOne('missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns the vendor', async () => {
      prisma.vendor.findUnique.mockResolvedValue({ id: 'v-1' });
      await expect(service.findOne('v-1')).resolves.toEqual({ id: 'v-1' });
    });
  });

  describe('findMine', () => {
    it('rejects non-VENDOR role', async () => {
      await expect(
        service.findMine({ ...VENDOR_USER, role: UserRole.ADMIN }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFound when the vendor profile is missing', async () => {
      prisma.vendor.findUnique.mockResolvedValue(null);

      await expect(service.findMine(VENDOR_USER)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns the vendor linked to the current user', async () => {
      const vendor = { id: 'v-1', userId: 'user-1', companyName: 'Acme' };
      prisma.vendor.findUnique.mockResolvedValue(vendor);

      await expect(service.findMine(VENDOR_USER)).resolves.toEqual(vendor);
    });
  });

  describe('create', () => {
    it('throws NotFound when the target user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.create({ userId: 'missing', companyName: 'Acme' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects a user without the VENDOR role', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u-1',
        role: UserRole.BIDDER,
      });

      await expect(
        service.create({ userId: 'u-1', companyName: 'Acme' }),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects a user who already has a vendor profile', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u-1',
        role: UserRole.VENDOR,
      });
      prisma.vendor.findUnique.mockResolvedValue({ id: 'v-1' });

      await expect(
        service.create({ userId: 'u-1', companyName: 'Acme' }),
      ).rejects.toThrow(ConflictException);
    });

    it('creates a vendor profile for a VENDOR user', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u-1',
        role: UserRole.VENDOR,
      });
      prisma.vendor.findUnique.mockResolvedValue(null);
      prisma.vendor.create.mockResolvedValue({ id: 'v-1', userId: 'u-1' });

      await expect(
        service.create({ userId: 'u-1', companyName: 'Acme' }),
      ).resolves.toMatchObject({ id: 'v-1' });
    });
  });

  describe('updateMine', () => {
    it('updates only the current user vendor', async () => {
      prisma.vendor.findUnique.mockResolvedValue({
        id: 'v-1',
        userId: 'user-1',
      });
      prisma.vendor.update.mockResolvedValue({ id: 'v-1', companyName: 'New' });

      await service.updateMine(VENDOR_USER, { companyName: 'New' });

      expect(prisma.vendor.update).toHaveBeenCalledWith({
        where: { id: 'v-1' },
        data: expect.objectContaining({ companyName: 'New' }),
      });
    });
  });

  describe('update (ADMIN)', () => {
    it('throws NotFound when the vendor does not exist', async () => {
      prisma.vendor.findUnique.mockResolvedValue(null);

      await expect(
        service.update('missing', { companyName: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
