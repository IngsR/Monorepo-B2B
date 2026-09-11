import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface.js';
import { UserRole } from '../common/enums/user-role.enum.js';
import type { PrismaService } from '../database/prisma.service.js';
import type { Bid } from '../database/prisma.types.js';
import { BidsService } from './bids.service.js';

type PrismaMock = {
  bidder: { findUnique: ReturnType<typeof vi.fn> };
  auction: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  bid: {
    findUnique: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
  $queryRaw: ReturnType<typeof vi.fn>;
  $transaction: ReturnType<typeof vi.fn>;
};

function makePrisma(): PrismaMock {
  const prisma: PrismaMock = {
    bidder: { findUnique: vi.fn() },
    auction: { findUnique: vi.fn(), update: vi.fn() },
    bid: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
  };
  // Interactive transaction: pass the same mock as `tx`.
  prisma.$transaction.mockImplementation((fn: unknown) =>
    typeof fn === 'function'
      ? (fn as (tx: PrismaMock) => unknown)(prisma)
      : Promise.all(fn as Promise<unknown>[]),
  );
  return prisma;
}

/** Baris hasil `SELECT ... FOR UPDATE` (kolom snake_case, Decimal = string). */
function lockedAuction(overrides: Record<string, unknown> = {}) {
  return {
    current_price: '100000.00',
    bid_increment: '1000.00',
    status: 'ACTIVE',
    start_at: new Date(Date.now() - 60_000),
    end_at: new Date(Date.now() + 60_000),
    ...overrides,
  };
}

const bidder: JwtPayload = {
  sub: 'u-b',
  userId: 'u-b',
  email: 'b@t.com',
  role: UserRole.BIDDER,
};
const vendor: JwtPayload = {
  sub: 'u-v',
  userId: 'u-v',
  email: 'v@t.com',
  role: UserRole.VENDOR,
};

function bidOf(amount: string): Bid {
  return {
    id: 'bid-1',
    auctionId: 'auc-1',
    bidderId: 'b-1',
    amount: amount as never,
    createdAt: new Date(),
  } as Bid;
}

describe('BidsService', () => {
  let service: BidsService;
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = makePrisma();
    service = new BidsService(prisma as unknown as PrismaService);
    prisma.bidder.findUnique.mockResolvedValue({ id: 'b-1' });
  });

  describe('placeBid — access', () => {
    it('rejects a non-bidder role', async () => {
      await expect(
        service.placeBid(vendor, 'auc-1', { amount: '200000.00' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects when the bidder profile is missing', async () => {
      prisma.bidder.findUnique.mockResolvedValue(null);

      await expect(
        service.placeBid(bidder, 'auc-1', { amount: '200000.00' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects when the auction does not exist', async () => {
      prisma.$queryRaw.mockResolvedValue([]); // SELECT ... FOR UPDATE → no row
      await expect(
        service.placeBid(bidder, 'missing', { amount: '200000.00' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('placeBid — auction state', () => {
    it('rejects bidding on a non-ACTIVE auction', async () => {
      prisma.$queryRaw.mockResolvedValue(
        [lockedAuction({ status: 'SCHEDULED' })],
      );

      await expect(
        service.placeBid(bidder, 'auc-1', { amount: '200000.00' }),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects bidding before startAt', async () => {
      prisma.$queryRaw.mockResolvedValue(
        [lockedAuction({ start_at: new Date(Date.now() + 60_000) })],
      );

      await expect(
        service.placeBid(bidder, 'auc-1', { amount: '200000.00' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects bidding after endAt', async () => {
      prisma.$queryRaw.mockResolvedValue(
        [lockedAuction({ end_at: new Date(Date.now() - 1000) })],
      );

      await expect(
        service.placeBid(bidder, 'auc-1', { amount: '200000.00' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('placeBid — minimum amount', () => {
    it('rejects a bid below currentPrice + bidIncrement', async () => {
      // currentPrice 100000 + increment 1000 = 101000 ; bid 100500 is too low.
      prisma.$queryRaw.mockResolvedValue([lockedAuction()]);

      await expect(
        service.placeBid(bidder, 'auc-1', { amount: '100500.00' }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.bid.create).not.toHaveBeenCalled();
    });

    it('accepts a bid exactly at currentPrice + bidIncrement', async () => {
      prisma.$queryRaw.mockResolvedValue([lockedAuction()]);
      prisma.bid.create.mockResolvedValue(bidOf('101000.00'));

      await expect(
        service.placeBid(bidder, 'auc-1', { amount: '101000.00' }),
      ).resolves.toMatchObject({ id: 'bid-1' });
    });

    it('accepts a bid above the minimum', async () => {
      prisma.$queryRaw.mockResolvedValue([lockedAuction()]);
      prisma.bid.create.mockResolvedValue(bidOf('150000.00'));

      await expect(
        service.placeBid(bidder, 'auc-1', { amount: '150000.00' }),
      ).resolves.toMatchObject({ id: 'bid-1' });
    });
  });

  describe('placeBid — atomicity', () => {
    it('locks the auction row, updates currentPrice, and inserts the bid in one transaction', async () => {
      prisma.$queryRaw.mockResolvedValue([lockedAuction()]);
      prisma.bid.create.mockResolvedValue(bidOf('101000.00'));

      await service.placeBid(bidder, 'auc-1', { amount: '101000.00' });

      // Everything happens inside a single interactive transaction.
      expect(prisma.$transaction).toHaveBeenCalledOnce();

      // The row is locked with SELECT ... FOR UPDATE before validating.
      const sqlParts = (prisma.$queryRaw.mock.calls[0][0] as string[]).join('');
      expect(sqlParts).toMatch(/FOR UPDATE/i);

      expect(prisma.auction.update).toHaveBeenCalledWith({
        where: { id: 'auc-1' },
        data: { currentPrice: '101000.00' },
      });
      expect(prisma.bid.create).toHaveBeenCalledWith({
        data: { auctionId: 'auc-1', bidderId: 'b-1', amount: '101000.00' },
      });
    });

    it('does not create a bid when validation fails under lock', async () => {
      prisma.$queryRaw.mockResolvedValue(
        [lockedAuction({ status: 'CANCELLED' })],
      );

      await expect(
        service.placeBid(bidder, 'auc-1', { amount: '200000.00' }),
      ).rejects.toThrow(ConflictException);

      expect(prisma.auction.update).not.toHaveBeenCalled();
      expect(prisma.bid.create).not.toHaveBeenCalled();
    });
  });

  describe('placeBid — concurrency', () => {
    it('validates against the locked (latest) currentPrice, not a stale read', async () => {
      // A concurrent bid already moved currentPrice to 101000; the locker reads
      // that latest value, so a minimum bid of 102000 is required.
      prisma.$queryRaw.mockResolvedValue(
        [lockedAuction({ current_price: '101000.00' })],
      );

      await expect(
        service.placeBid(bidder, 'auc-1', { amount: '101500.00' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('runs every concurrent bid through the row lock (serialized)', async () => {
      prisma.$queryRaw.mockResolvedValue([lockedAuction()]);
      prisma.bid.create.mockResolvedValue(bidOf('101000.00'));

      await Promise.all([
        service.placeBid(bidder, 'auc-1', { amount: '101000.00' }),
        service.placeBid(bidder, 'auc-1', { amount: '102000.00' }),
      ]);

      // Each request takes the lock exactly once → no retry loop, no lost update.
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
    });
  });

  describe('findAll', () => {
    it('applies auction/bidder filters and returns a paginated envelope', async () => {
      prisma.bid.findMany.mockResolvedValue([bidOf('101000.00')]);
      prisma.bid.count.mockResolvedValue(1);

      const result = await service.findAll({
        page: 1,
        limit: 10,
        skip: 0,
        auctionId: 'auc-1',
        bidderId: 'b-1',
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      expect(result.meta.total).toBe(1);
      expect(result.data).toHaveLength(1);
      expect(prisma.bid.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { auctionId: 'auc-1', bidderId: 'b-1' } }),
      );
    });
  });

  describe('findOne', () => {
    it('throws NotFound when the bid does not exist', async () => {
      prisma.bid.findUnique.mockResolvedValue(null);
      await expect(service.findOne('missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns the bid', async () => {
      prisma.bid.findUnique.mockResolvedValue(bidOf('101000.00'));
      await expect(service.findOne('bid-1')).resolves.toMatchObject({
        id: 'bid-1',
      });
    });
  });

  describe('findMine', () => {
    it('forces the bidder filter from the authenticated user', async () => {
      prisma.bid.findMany.mockResolvedValue([]);
      prisma.bid.count.mockResolvedValue(0);

      await service.findMine(bidder, {
        page: 1,
        limit: 10,
        skip: 0,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      expect(prisma.bid.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { bidderId: 'b-1' } }),
      );
    });

    it('rejects a non-bidder role', async () => {
      await expect(
        service.findMine(vendor, {
          page: 1,
          limit: 10,
          skip: 0,
          sortBy: 'createdAt',
          sortOrder: 'desc',
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findHighestBid (winner derivation)', () => {
    it('orders by amount desc, then createdAt asc', async () => {
      prisma.bid.findFirst.mockResolvedValue(bidOf('110000.00'));

      await service.findHighestBid('auc-1');

      expect(prisma.bid.findFirst).toHaveBeenCalledWith({
        where: { auctionId: 'auc-1' },
        orderBy: [{ amount: 'desc' }, { createdAt: 'asc' }],
      });
    });
  });
});
