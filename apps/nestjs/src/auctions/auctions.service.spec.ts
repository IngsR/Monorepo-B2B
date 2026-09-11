import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface.js';
import { UserRole } from '../common/enums/user-role.enum.js';
import type { PrismaService } from '../database/prisma.service.js';
import { AuctionStatus, type Auction } from '../database/prisma.types.js';
import { AuctionsService } from './auctions.service.js';

type PrismaMock = {
  vendor: { findUnique: ReturnType<typeof vi.fn> };
  product: { findUnique: ReturnType<typeof vi.fn> };
  auction: {
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
    vendor: { findUnique: vi.fn() },
    product: { findUnique: vi.fn() },
    auction: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  };
}

const vendorA: JwtPayload = {
  sub: 'u-a',
  userId: 'u-a',
  email: 'a@t.com',
  role: UserRole.VENDOR,
};
const admin: JwtPayload = {
  sub: 'admin',
  userId: 'admin',
  email: 'admin@t.com',
  role: UserRole.ADMIN,
};

function auctionOf(overrides: Partial<Auction> = {}): Auction {
  return {
    id: 'auc-1',
    code: 'AUC-1',
    productId: 'p-a',
    startingPrice: '100000.00' as never,
    currentPrice: '100000.00' as never,
    bidIncrement: '1000.00' as never,
    startAt: new Date('2026-01-01T00:00:00Z'),
    endAt: new Date('2026-01-02T00:00:00Z'),
    status: AuctionStatus.DRAFT,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Auction;
}

describe('AuctionsService', () => {
  let service: AuctionsService;
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = makePrisma();
    service = new AuctionsService(prisma as unknown as PrismaService);
  });

  describe('create', () => {
    const dto = {
      productId: 'p-a',
      startingPrice: '100000.00',
      bidIncrement: '1000.00',
      startAt: '2026-01-01T00:00:00Z',
      endAt: '2026-01-02T00:00:00Z',
    };

    it('rejects a non-vendor', async () => {
      await expect(service.create(admin, dto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('rejects when product does not exist', async () => {
      prisma.vendor.findUnique.mockResolvedValue({ id: 'v-a' });
      prisma.product.findUnique.mockResolvedValue(null);

      await expect(service.create(vendorA, dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("forbids a vendor from creating an auction on another vendor's product", async () => {
      prisma.vendor.findUnique.mockResolvedValue({ id: 'v-a' });
      prisma.product.findUnique.mockResolvedValue({ id: 'p-a', vendorId: 'v-b' });

      await expect(service.create(vendorA, dto)).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.auction.create).not.toHaveBeenCalled();
    });

    it('rejects startAt that is not before endAt', async () => {
      prisma.vendor.findUnique.mockResolvedValue({ id: 'v-a' });
      prisma.product.findUnique.mockResolvedValue({ id: 'p-a', vendorId: 'v-a' });

      await expect(
        service.create(vendorA, {
          ...dto,
          startAt: '2026-01-03T00:00:00Z',
          endAt: '2026-01-02T00:00:00Z',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('initializes currentPrice = startingPrice and status DRAFT', async () => {
      prisma.vendor.findUnique.mockResolvedValue({ id: 'v-a' });
      prisma.product.findUnique.mockResolvedValue({ id: 'p-a', vendorId: 'v-a' });
      prisma.auction.findUnique.mockResolvedValue(null);
      prisma.auction.create.mockResolvedValue(auctionOf());

      await service.create(vendorA, dto);

      const arg = prisma.auction.create.mock.calls[0][0];
      expect(arg.data.currentPrice).toBe(dto.startingPrice);
      expect(arg.data.startingPrice).toBe(dto.startingPrice);
      expect(arg.data.status).toBe(AuctionStatus.DRAFT);
    });
  });

  describe('update (DRAFT only)', () => {
    it('allows editing a DRAFT auction and keeps currentPrice aligned', async () => {
      prisma.auction.findUnique.mockResolvedValue(auctionOf());
      prisma.product.findUnique.mockResolvedValue({ id: 'p-a', vendorId: 'v-a' });
      prisma.vendor.findUnique.mockResolvedValue({ id: 'v-a' });
      prisma.auction.update.mockResolvedValue(auctionOf());

      await service.update(vendorA, 'auc-1', { startingPrice: '200000.00' });

      const arg = prisma.auction.update.mock.calls[0][0];
      expect(arg.data.startingPrice).toBe('200000.00');
      expect(arg.data.currentPrice).toBe('200000.00');
    });

    it('rejects editing an ACTIVE auction', async () => {
      prisma.auction.findUnique.mockResolvedValue(
        auctionOf({ status: AuctionStatus.ACTIVE }),
      );
      prisma.product.findUnique.mockResolvedValue({ id: 'p-a', vendorId: 'v-a' });
      prisma.vendor.findUnique.mockResolvedValue({ id: 'v-a' });

      await expect(
        service.update(vendorA, 'auc-1', { startingPrice: '200000.00' }),
      ).rejects.toThrow(ConflictException);
    });

    it("forbids a vendor from editing another vendor's auction", async () => {
      prisma.auction.findUnique.mockResolvedValue(auctionOf({ productId: 'p-b' }));
      prisma.product.findUnique.mockResolvedValue({ id: 'p-b', vendorId: 'v-b' });
      prisma.vendor.findUnique.mockResolvedValue({ id: 'v-a' });

      await expect(
        service.update(vendorA, 'auc-1', { startingPrice: '1.00' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('updateStatus — lifecycle', () => {
    it('allows DRAFT → SCHEDULED', async () => {
      prisma.auction.findUnique.mockResolvedValue(auctionOf());
      prisma.product.findUnique.mockResolvedValue({ id: 'p-a', vendorId: 'v-a' });
      prisma.vendor.findUnique.mockResolvedValue({ id: 'v-a' });
      prisma.auction.update.mockResolvedValue(auctionOf());

      await service.updateStatus(vendorA, 'auc-1', {
        status: AuctionStatus.SCHEDULED,
      });

      expect(prisma.auction.update).toHaveBeenCalledWith({
        where: { id: 'auc-1' },
        data: { status: AuctionStatus.SCHEDULED },
      });
    });

    it('rejects an invalid transition DRAFT → ACTIVE', async () => {
      prisma.auction.findUnique.mockResolvedValue(auctionOf());
      prisma.product.findUnique.mockResolvedValue({ id: 'p-a', vendorId: 'v-a' });
      prisma.vendor.findUnique.mockResolvedValue({ id: 'v-a' });

      await expect(
        service.updateStatus(vendorA, 'auc-1', { status: AuctionStatus.ACTIVE }),
      ).rejects.toThrow(ConflictException);
    });

    it('allows ACTIVE → ENDED to close a finished auction', async () => {
      prisma.auction.findUnique.mockResolvedValue(
        auctionOf({ status: AuctionStatus.ACTIVE }),
      );
      prisma.product.findUnique.mockResolvedValue({ id: 'p-a', vendorId: 'v-a' });
      prisma.vendor.findUnique.mockResolvedValue({ id: 'v-a' });
      prisma.auction.update.mockResolvedValue(
        auctionOf({ status: AuctionStatus.ENDED }),
      );

      await service.updateStatus(vendorA, 'auc-1', {
        status: AuctionStatus.ENDED,
      });

      expect(prisma.auction.update).toHaveBeenCalledWith({
        where: { id: 'auc-1' },
        data: { status: AuctionStatus.ENDED },
      });
    });

    it('rejects SCHEDULED → ENDED (must be ACTIVE first)', async () => {
      prisma.auction.findUnique.mockResolvedValue(
        auctionOf({ status: AuctionStatus.SCHEDULED }),
      );
      prisma.product.findUnique.mockResolvedValue({ id: 'p-a', vendorId: 'v-a' });
      prisma.vendor.findUnique.mockResolvedValue({ id: 'v-a' });

      await expect(
        service.updateStatus(vendorA, 'auc-1', { status: AuctionStatus.ENDED }),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects transitioning out of a terminal state (ENDED)', async () => {
      prisma.auction.findUnique.mockResolvedValue(
        auctionOf({ status: AuctionStatus.ENDED }),
      );
      prisma.product.findUnique.mockResolvedValue({ id: 'p-a', vendorId: 'v-a' });
      prisma.vendor.findUnique.mockResolvedValue({ id: 'v-a' });

      await expect(
        service.updateStatus(vendorA, 'auc-1', {
          status: AuctionStatus.SCHEDULED,
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('filters by vendor through the product relation', async () => {
      prisma.auction.findMany.mockResolvedValue([]);
      prisma.auction.count.mockResolvedValue(0);

      await service.findAll({
        page: 1,
        limit: 10,
        skip: 0,
        vendorId: 'v-a',
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      const call = prisma.auction.findMany.mock.calls[0][0];
      expect(call.where).toEqual({ product: { vendorId: 'v-a' } });
    });
  });
});
