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
  type Auction,
  type Prisma,
} from '../database/prisma.types.js';
import { AuctionQueryDto } from './dto/auction-query.dto.js';
import { CreateAuctionDto } from './dto/create-auction.dto.js';
import { UpdateAuctionStatusDto } from './dto/update-auction-status.dto.js';
import { UpdateAuctionDto } from './dto/update-auction.dto.js';

/** State asal yang mengizinkan sebuah transisi status. */
const TRANSITIONS: Record<AuctionStatus, AuctionStatus[]> = {
  DRAFT: [AuctionStatus.SCHEDULED, AuctionStatus.CANCELLED],
  SCHEDULED: [AuctionStatus.ACTIVE, AuctionStatus.CANCELLED],
  // ACTIVE → ENDED menutup auction yang sudah selesai (winner ditentukan dari
  // highest bid). Waktu `endAt` tetap menjadi sumber kebenaran untuk penolakan
  // bid; ENDED merekam bahwa auction sudah ditutup secara eksplisit.
  ACTIVE: [AuctionStatus.CANCELLED, AuctionStatus.ENDED],
  ENDED: [],
  CANCELLED: [],
};

@Injectable()
export class AuctionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: AuctionQueryDto): Promise<PaginatedResponse<Auction>> {
    const where: Prisma.AuctionWhereInput = {};

    if (query.productId) where.productId = query.productId;
    if (query.status) where.status = query.status;
    if (query.vendorId) where.product = { vendorId: query.vendorId };

    const orderBy = { [query.sortBy]: query.sortOrder };

    const [auctions, total] = await this.prisma.$transaction([
      this.prisma.auction.findMany({
        where,
        orderBy,
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.auction.count({ where }),
    ]);

    return paginate(auctions, total, query.page, query.limit);
  }

  /** Auction milik vendor yang sedang login (lewat produknya). */
  async findMine(
    user: JwtPayload,
    query: AuctionQueryDto,
  ): Promise<PaginatedResponse<Auction>> {
    const vendor = await this.requireVendorProfile(user);
    query.vendorId = vendor.id;
    return this.findAll(query);
  }

  async findOne(id: string): Promise<Auction> {
    const auction = await this.prisma.auction.findUnique({ where: { id } });

    if (!auction) {
      throw new NotFoundException(`Auction with id "${id}" not found`);
    }

    return auction;
  }

  /**
   * VENDOR membuat auction untuk produk miliknya.
   * `currentPrice` = `startingPrice` (initial state, §28).
   * Auction baru selalu berstatus DRAFT.
   */
  async create(user: JwtPayload, dto: CreateAuctionDto): Promise<Auction> {
    const vendor = await this.requireVendorProfile(user);

    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
    });

    if (!product) {
      throw new NotFoundException(
        `Product with id "${dto.productId}" not found`,
      );
    }

    if (product.vendorId !== vendor.id) {
      throw new ForbiddenException(
        'You can only create auctions for your own products',
      );
    }

    const startAt = new Date(dto.startAt);
    const endAt = new Date(dto.endAt);

    if (startAt.getTime() >= endAt.getTime()) {
      throw new BadRequestException('startAt must be before endAt');
    }

    const code = await this.generateAuctionCode();

    return this.prisma.auction.create({
      data: {
        code,
        productId: product.id,
        startingPrice: dto.startingPrice,
        currentPrice: dto.startingPrice, // §28 initial state
        bidIncrement: dto.bidIncrement,
        startAt,
        endAt,
        status: AuctionStatus.DRAFT,
      },
    });
  }

  /** Ubah harga pada auction yang masih DRAFT (belum ada bid). */
  async update(
    user: JwtPayload,
    id: string,
    dto: UpdateAuctionDto,
  ): Promise<Auction> {
    const auction = await this.findOne(id);
    await this.assertCanManage(user, auction);

    if (auction.status !== AuctionStatus.DRAFT) {
      throw new ConflictException(
        'Only DRAFT auctions can be modified',
      );
    }

    return this.prisma.auction.update({
      where: { id },
      data: {
        startingPrice: dto.startingPrice,
        // currentPrice tetap selaras dengan startingPrice selama DRAFT
        currentPrice: dto.startingPrice ?? undefined,
        bidIncrement: dto.bidIncrement,
      },
    });
  }

  /** Transisi status manual dengan validasi lifecycle. */
  async updateStatus(
    user: JwtPayload,
    id: string,
    dto: UpdateAuctionStatusDto,
  ): Promise<Auction> {
    const auction = await this.findOne(id);
    await this.assertCanManage(user, auction);

    const allowed = TRANSITIONS[auction.status] ?? [];

    if (!allowed.includes(dto.status)) {
      throw new ConflictException(
        `Cannot transition auction from ${auction.status} to ${dto.status}`,
      );
    }

    return this.prisma.auction.update({
      where: { id },
      data: { status: dto.status },
    });
  }

  // ─── Helpers ─────────────────────────────

  /** Generate kode auction unik sederhana berbasis waktu. */
  private async generateAuctionCode(): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = `AUC-${Date.now().toString(36).toUpperCase()}-${Math.random()
        .toString(36)
        .slice(2, 6)
        .toUpperCase()}`;

      const clash = await this.prisma.auction.findUnique({
        where: { code: candidate },
      });

      if (!clash) return candidate;
    }

    throw new ConflictException('Could not generate a unique auction code');
  }

  private async requireVendorProfile(
    user: JwtPayload,
  ): Promise<{ id: string }> {
    if (user.role !== UserRole.VENDOR) {
      throw new ForbiddenException('Only vendors can manage auctions');
    }

    const vendor = await this.prisma.vendor.findUnique({
      where: { userId: user.userId },
      select: { id: true },
    });

    if (!vendor) {
      throw new NotFoundException('Vendor profile not found for current user');
    }

    return vendor;
  }

  private async assertCanManage(
    user: JwtPayload,
    auction: Auction,
  ): Promise<void> {
    if (user.role === UserRole.ADMIN) {
      return;
    }

    if (user.role !== UserRole.VENDOR) {
      throw new ForbiddenException('You cannot manage this auction');
    }

    const product = await this.prisma.product.findUnique({
      where: { id: auction.productId },
      select: { vendorId: true },
    });

    const vendor = await this.prisma.vendor.findUnique({
      where: { userId: user.userId },
      select: { id: true },
    });

    if (!vendor || !product || product.vendorId !== vendor.id) {
      throw new ForbiddenException('You can only manage your own auctions');
    }
  }
}
