import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface.js';
import { UserRole } from '../common/enums/user-role.enum.js';
import type { PrismaService } from '../database/prisma.service.js';
import type { Product } from '../database/prisma.types.js';
import { ProductsService } from './products.service.js';

type PrismaMock = {
  vendor: { findUnique: ReturnType<typeof vi.fn> };
  category: { findUnique: ReturnType<typeof vi.fn> };
  product: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
};

function makePrisma(): PrismaMock {
  return {
    vendor: { findUnique: vi.fn() },
    category: { findUnique: vi.fn() },
    product: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  };
}

const vendorA: JwtPayload = {
  sub: 'user-a',
  userId: 'user-a',
  email: 'a@test.com',
  role: UserRole.VENDOR,
};
const admin: JwtPayload = {
  sub: 'admin',
  userId: 'admin',
  email: 'admin@test.com',
  role: UserRole.ADMIN,
};

function productOf(vendorId: string): Product {
  return {
    id: 'p-1',
    code: 'P-1',
    name: 'Steel',
    description: null,
    status: 'ACTIVE',
    vendorId,
    categoryId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Product;
}

describe('ProductsService', () => {
  let service: ProductsService;
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = makePrisma();
    service = new ProductsService(prisma as unknown as PrismaService);
  });

  describe('create', () => {
    it('rejects non-vendor role', async () => {
      await expect(
        service.create(admin, { code: 'X', name: 'X' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects when the vendor profile is missing', async () => {
      prisma.vendor.findUnique.mockResolvedValue(null);

      await expect(
        service.create(vendorA, { code: 'X', name: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects a duplicate product code', async () => {
      prisma.vendor.findUnique.mockResolvedValue({ id: 'v-a' });
      prisma.product.findUnique.mockResolvedValue({ id: 'p-1' });

      await expect(
        service.create(vendorA, { code: 'P-1', name: 'Steel' }),
      ).rejects.toThrow(ConflictException);
    });

    it('creates a product owned by the authenticated vendor', async () => {
      prisma.vendor.findUnique.mockResolvedValue({ id: 'v-a' });
      prisma.product.findUnique.mockResolvedValue(null);
      prisma.product.create.mockResolvedValue({ id: 'p-new' });

      await service.create(vendorA, { code: 'P-NEW', name: 'Steel' });

      expect(prisma.product.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ vendorId: 'v-a', code: 'P-NEW' }),
      });
    });
  });

  describe('update — ownership', () => {
    it('forbids Vendor A from updating Vendor B product', async () => {
      prisma.product.findUnique.mockResolvedValue(productOf('v-b'));
      prisma.vendor.findUnique.mockResolvedValue({ id: 'v-a' });

      await expect(
        service.update(vendorA, 'p-1', { name: 'Hacked' }),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.product.update).not.toHaveBeenCalled();
    });

    it('allows Vendor A to update its own product', async () => {
      prisma.product.findUnique.mockResolvedValue(productOf('v-a'));
      prisma.vendor.findUnique.mockResolvedValue({ id: 'v-a' });
      prisma.product.update.mockResolvedValue({ id: 'p-1' });

      await expect(
        service.update(vendorA, 'p-1', { name: 'Updated' }),
      ).resolves.toMatchObject({ id: 'p-1' });
    });

    it('allows ADMIN to update any product', async () => {
      prisma.product.findUnique.mockResolvedValue(productOf('v-b'));
      prisma.product.update.mockResolvedValue({ id: 'p-1' });

      await expect(
        service.update(admin, 'p-1', { name: 'Admin edit' }),
      ).resolves.toMatchObject({ id: 'p-1' });
    });

    it('throws NotFound when product does not exist', async () => {
      prisma.product.findUnique.mockResolvedValue(null);

      await expect(
        service.update(vendorA, 'missing', { name: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove — ownership', () => {
    it('forbids Vendor A from deleting Vendor B product', async () => {
      prisma.product.findUnique.mockResolvedValue(productOf('v-b'));
      prisma.vendor.findUnique.mockResolvedValue({ id: 'v-a' });

      await expect(service.remove(vendorA, 'p-1')).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.product.delete).not.toHaveBeenCalled();
    });

    it('allows ADMIN to delete any product', async () => {
      prisma.product.findUnique.mockResolvedValue(productOf('v-b'));

      await service.remove(admin, 'p-1');

      expect(prisma.product.delete).toHaveBeenCalledWith({ where: { id: 'p-1' } });
    });
  });

  describe('findAll', () => {
    it('applies the vendor filter from the query', async () => {
      prisma.product.findMany.mockResolvedValue([]);
      prisma.product.count.mockResolvedValue(0);

      await service.findAll({ page: 1, limit: 10, skip: 0, vendorId: 'v-a', sortBy: 'createdAt', sortOrder: 'desc' });

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { vendorId: 'v-a' } }),
      );
    });
  });
});
