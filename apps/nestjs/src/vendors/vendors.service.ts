import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  paginate,
  PaginatedResponse,
} from '../common/dto/paginated-response.dto.js';
import { UserRole } from '../common/enums/user-role.enum.js';
import { PrismaService } from '../database/prisma.service.js';
import type { Prisma, Vendor } from '../database/prisma.types.js';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface.js';
import { CreateVendorDto } from './dto/create-vendor.dto.js';
import { UpdateVendorDto } from './dto/update-vendor.dto.js';
import { VendorQueryDto } from './dto/vendor-query.dto.js';

@Injectable()
export class VendorsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: VendorQueryDto): Promise<PaginatedResponse<Vendor>> {
    const where: Prisma.VendorWhereInput = {};

    if (query.search) {
      where.companyName = { contains: query.search, mode: 'insensitive' };
    }

    const [vendors, total] = await this.prisma.$transaction([
      this.prisma.vendor.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.vendor.count({ where }),
    ]);

    return paginate(vendors, total, query.page, query.limit);
  }

  async findOne(id: string): Promise<Vendor> {
    const vendor = await this.prisma.vendor.findUnique({ where: { id } });

    if (!vendor) {
      throw new NotFoundException(`Vendor with id "${id}" not found`);
    }

    return vendor;
  }

  /** Profil vendor milik user yang sedang login. */
  async findMine(user: JwtPayload): Promise<Vendor> {
    if (user.role !== UserRole.VENDOR) {
      throw new ForbiddenException('Only vendors have a vendor profile');
    }

    const vendor = await this.prisma.vendor.findUnique({
      where: { userId: user.userId },
    });

    if (!vendor) {
      throw new NotFoundException('Vendor profile not found for current user');
    }

    return vendor;
  }

  /** ADMIN membuat profil vendor untuk sebuah user (role VENDOR). */
  async create(dto: CreateVendorDto): Promise<Vendor> {
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
    });

    if (!user) {
      throw new NotFoundException(`User with id "${dto.userId}" not found`);
    }

    if (user.role !== UserRole.VENDOR) {
      throw new ConflictException('Target user must have the VENDOR role');
    }

    const existing = await this.prisma.vendor.findUnique({
      where: { userId: dto.userId },
    });

    if (existing) {
      throw new ConflictException(
        `User "${dto.userId}" already has a vendor profile`,
      );
    }

    return this.prisma.vendor.create({
      data: {
        userId: dto.userId,
        companyName: dto.companyName,
        companyAddress: dto.companyAddress ?? null,
        phone: dto.phone ?? null,
      },
    });
  }

  /** VENDOR mengubah profil miliknya sendiri. */
  async updateMine(user: JwtPayload, dto: UpdateVendorDto): Promise<Vendor> {
    const vendor = await this.findMine(user);
    return this.applyUpdate(vendor.id, dto);
  }

  /** ADMIN mengubah profil vendor mana pun. */
  async update(id: string, dto: UpdateVendorDto): Promise<Vendor> {
    await this.findOne(id);
    return this.applyUpdate(id, dto);
  }

  private async applyUpdate(id: string, dto: UpdateVendorDto): Promise<Vendor> {
    return this.prisma.vendor.update({
      where: { id },
      data: {
        companyName: dto.companyName,
        companyAddress: dto.companyAddress,
        phone: dto.phone,
      },
    });
  }
}
