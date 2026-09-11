import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface.js';
import {
  paginate,
  PaginatedResponse,
} from '../common/dto/paginated-response.dto.js';
import { UserRole } from '../common/enums/user-role.enum.js';
import { PrismaService } from '../database/prisma.service.js';
import {
  AuctionStatus,
  type Bid,
  type Prisma,
} from '../database/prisma.types.js';
import { BidQueryDto } from './dto/bid-query.dto.js';
import { CreateBidDto } from './dto/create-bid.dto.js';

/** Status auction yang mengizinkan bid. */
const BIDDABLE_STATUS: AuctionStatus[] = [AuctionStatus.ACTIVE];

/**
 * Bentuk row auction hasil `SELECT ... FOR UPDATE` (kolom snake_case, Decimal
 * dikembalikan Prisma sebagai string/number tergantung driver). Sengaja tidak
 * memakai tipe generated karena query raw mengembalikan shape kolom DB apa
 * adanya, bukan model Prisma.
 */
type LockedAuction = {
  current_price: unknown;
  bid_increment: unknown;
  status: string;
  start_at: Date;
  end_at: Date;
};

@Injectable()
export class BidsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: BidQueryDto): Promise<PaginatedResponse<Bid>> {
    const where: Prisma.BidWhereInput = {};

    if (query.auctionId) where.auctionId = query.auctionId;
    if (query.bidderId) where.bidderId = query.bidderId;

    const orderBy = { [query.sortBy]: query.sortOrder };

    const [bids, total] = await this.prisma.$transaction([
      this.prisma.bid.findMany({
        where,
        orderBy,
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.bid.count({ where }),
    ]);

    return paginate(bids, total, query.page, query.limit);
  }

  async findOne(id: string): Promise<Bid> {
    const bid = await this.prisma.bid.findUnique({ where: { id } });

    if (!bid) {
      throw new NotFoundException(`Bid with id "${id}" not found`);
    }

    return bid;
  }

  /**
   * Tempatkan bid pada sebuah auction.
   *
   * Business-critical: validasi + update `currentPrice` + insert `Bid` harus
   * atomik dan aman terhadap concurrent request. Dua bidder yang bid nyaris
   * bersamaan tidak boleh menyebabkan lost update / currentPrice salah / bid
   * invalid diterima.
   *
   * Strategi (PostgreSQL-native, tanpa broker eksternal): di dalam satu
   * interactive transaction, ambil row auction dengan `SELECT ... FOR UPDATE`.
   * Row lock menserialisasi seluruh operasi bid pada auction yang sama:
   * request kedua menunggu lock sampai request pertama commit, lalu membaca
   * `current_price` terbaru. Validasi status/waktu/minimum dilakukan terhadap
   * nilai yang sudah ter-lock, sehingga tidak ada window race antara read dan
   * write. Semua operasi (lock, validate, update, insert) berada dalam satu
   * transaksi — jika salah satu gagal, semuanya di-rollback.
   */
  async placeBid(
    user: JwtPayload,
    auctionId: string,
    dto: CreateBidDto,
  ): Promise<Bid> {
    const bidder = await this.requireBidderProfile(user);
    const amount = dto.amount;

    return this.prisma.$transaction(async (tx) => {
      // Lock the auction row for the duration of the transaction. This is what
      // makes concurrent bids serialize instead of racing.
      const rows = await tx.$queryRaw<LockedAuction[]>`
        SELECT current_price, bid_increment, status, start_at, end_at
        FROM auctions
        WHERE id = ${auctionId}::uuid
        FOR UPDATE
      `;

      const locked = rows[0];

      if (!locked) {
        throw new NotFoundException(`Auction with id "${auctionId}" not found`);
      }

      this.assertBiddable(locked);
      this.assertMinimumAmount(locked, amount);

      await tx.auction.update({
        where: { id: auctionId },
        data: { currentPrice: amount },
      });

      return tx.bid.create({
        data: {
          auctionId,
          bidderId: bidder.id,
          amount,
        },
      });
    });
  }

  /**
   * Highest valid bid untuk sebuah auction (winner derivation).
   * Tie-break deterministik: amount tertinggi, lalu createdAt paling awal.
   */
  async findHighestBid(auctionId: string): Promise<Bid | null> {
    return this.prisma.bid.findFirst({
      where: { auctionId },
      orderBy: [{ amount: 'desc' }, { createdAt: 'asc' }],
    });
  }

  /** Bid milik bidder yang sedang login. */
  async findMine(
    user: JwtPayload,
    query: BidQueryDto,
  ): Promise<PaginatedResponse<Bid>> {
    const bidder = await this.requireBidderProfile(user);
    query.bidderId = bidder.id;
    return this.findAll(query);
  }

  // ─── Validation helpers ──────────────────

  /** Auction harus ACTIVE dan dalam rentang waktu yang valid (§26). */
  private assertBiddable(auction: LockedAuction): void {
    if (!BIDDABLE_STATUS.includes(auction.status as AuctionStatus)) {
      throw new ConflictException(
        `Auction is not open for bidding (status: ${auction.status})`,
      );
    }

    const now = Date.now();

    if (now < new Date(auction.start_at).getTime()) {
      throw new BadRequestException('Auction has not started yet');
    }

    if (now >= new Date(auction.end_at).getTime()) {
      throw new BadRequestException('Auction has already ended');
    }
  }

  /** bidAmount >= currentPrice + bidIncrement (§27). */
  private assertMinimumAmount(auction: LockedAuction, amount: string): void {
    const minimum = this.addDecimal(auction.current_price, auction.bid_increment);

    if (this.compareDecimal(amount, minimum) < 0) {
      throw new BadRequestException(
        `Bid amount must be at least ${minimum.toString()}`,
      );
    }
  }

  /**
   * Penjumlahan Decimal yang aman.
   * Nilai disimpan sebagai Decimal(18,2); kita hitung via integer sen (×100)
   * agar tidak kena floating-point error. Kembalikan sebagai string decimal.
   */
  private addDecimal(a: unknown, b: unknown): string {
    const sumCents = this.toCents(a) + this.toCents(b);
    return this.fromCents(sumCents);
  }

  /** Bandingkan dua decimal sebagai integer sen. -1 / 0 / 1. */
  private compareDecimal(a: unknown, b: unknown): number {
    const av = this.toCents(a);
    const bv = this.toCents(b);
    if (av < bv) return -1;
    if (av > bv) return 1;
    return 0;
  }

  private toCents(value: unknown): number {
    const str = typeof value === 'string' ? value : String(value);
    // Membulatkan ke 2 desimal tanpa Math.round pada float langsung.
    const [intPart, fracPart = ''] = str.split('.');
    const frac = (fracPart + '00').slice(0, 2);
    const sign = intPart.startsWith('-') ? -1 : 1;
    const digits = intPart.replace('-', '');
    return sign * (Number(digits) * 100 + Number(frac));
  }

  private fromCents(cents: number): string {
    const sign = cents < 0 ? '-' : '';
    const abs = Math.abs(cents);
    const intPart = Math.floor(abs / 100);
    const frac = String(abs % 100).padStart(2, '0');
    return `${sign}${intPart}.${frac}`;
  }

  private async requireBidderProfile(
    user: JwtPayload,
  ): Promise<{ id: string }> {
    if (user.role !== UserRole.BIDDER) {
      throw new ForbiddenException('Only bidders can place bids');
    }

    const bidder = await this.prisma.bidder.findUnique({
      where: { userId: user.userId },
      select: { id: true },
    });

    if (!bidder) {
      throw new NotFoundException('Bidder profile not found for current user');
    }

    return bidder;
  }
}
