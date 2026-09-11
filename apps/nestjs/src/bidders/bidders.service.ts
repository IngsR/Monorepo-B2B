import {
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
import type { Bidder, Prisma } from '../database/prisma.types.js';
import { BidderQueryDto } from './dto/bidder-query.dto.js';
import { CreateBidderDto } from './dto/create-bidder.dto.js';
import { UpdateBidderDto } from './dto/update-bidder.dto.js';

@Injectable()
export class BiddersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: BidderQueryDto): Promise<PaginatedResponse<Bidder>> {
    const where: Prisma.BidderWhereInput = {};

    if (query.search) {
      where.phone = { contains: query.search, mode: 'insensitive' };
    }

    const [bidders, total] = await this.prisma.$transaction([
      this.prisma.bidder.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.bidder.count({ where }),
    ]);

    return paginate(bidders, total, query.page, query.limit);
  }

  async findOne(id: string): Promise<Bidder> {
    const bidder = await this.prisma.bidder.findUnique({ where: { id } });

    if (!bidder) {
      throw new NotFoundException(`Bidder with id "${id}" not found`);
    }

    return bidder;
  }

  /** Profil bidder milik user yang sedang login. */
  async findMine(user: JwtPayload): Promise<Bidder> {
    if (user.role !== UserRole.BIDDER) {
      throw new ForbiddenException('Only bidders have a bidder profile');
    }

    const bidder = await this.prisma.bidder.findUnique({
      where: { userId: user.userId },
    });

    if (!bidder) {
      throw new NotFoundException('Bidder profile not found for current user');
    }

    return bidder;
  }

  /** ADMIN membuat profil bidder untuk sebuah user (role BIDDER). */
  async create(dto: CreateBidderDto): Promise<Bidder> {
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
    });

    if (!user) {
      throw new NotFoundException(`User with id "${dto.userId}" not found`);
    }

    if (user.role !== UserRole.BIDDER) {
      throw new ConflictException('Target user must have the BIDDER role');
    }

    const existing = await this.prisma.bidder.findUnique({
      where: { userId: dto.userId },
    });

    if (existing) {
      throw new ConflictException(
        `User "${dto.userId}" already has a bidder profile`,
      );
    }

    return this.prisma.bidder.create({
      data: {
        userId: dto.userId,
        phone: dto.phone ?? null,
        address: dto.address ?? null,
      },
    });
  }

  /** BIDDER mengubah profil miliknya sendiri. */
  async updateMine(user: JwtPayload, dto: UpdateBidderDto): Promise<Bidder> {
    const bidder = await this.findMine(user);
    return this.applyUpdate(bidder.id, dto);
  }

  /** ADMIN mengubah profil bidder mana pun. */
  async update(id: string, dto: UpdateBidderDto): Promise<Bidder> {
    await this.findOne(id);
    return this.applyUpdate(id, dto);
  }

  private async applyUpdate(id: string, dto: UpdateBidderDto): Promise<Bidder> {
    return this.prisma.bidder.update({
      where: { id },
      data: { phone: dto.phone, address: dto.address },
    });
  }
}
