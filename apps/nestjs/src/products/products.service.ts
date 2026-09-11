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
import type { Prisma, Product } from '../database/prisma.types.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { ProductQueryDto } from './dto/product-query.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ProductQueryDto): Promise<PaginatedResponse<Product>> {
    const where: Prisma.ProductWhereInput = {};

    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.vendorId) where.vendorId = query.vendorId;
    if (query.status) where.status = query.status;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { code: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const orderBy = { [query.sortBy]: query.sortOrder };

    const [products, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        orderBy,
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.product.count({ where }),
    ]);

    return paginate(products, total, query.page, query.limit);
  }

  /** Produk milik vendor yang sedang login. */
  async findMine(
    user: JwtPayload,
    query: ProductQueryDto,
  ): Promise<PaginatedResponse<Product>> {
    const vendor = await this.requireVendorProfile(user);
    query.vendorId = vendor.id;
    return this.findAll(query);
  }

  async findOne(id: string): Promise<Product> {
    const product = await this.prisma.product.findUnique({ where: { id } });

    if (!product) {
      throw new NotFoundException(`Product with id "${id}" not found`);
    }

    return product;
  }

  /** VENDOR membuat produk untuk dirinya sendiri (ownership dari JWT). */
  async create(user: JwtPayload, dto: CreateProductDto): Promise<Product> {
    const vendor = await this.requireVendorProfile(user);

    const codeExists = await this.prisma.product.findUnique({
      where: { code: dto.code },
    });

    if (codeExists) {
      throw new ConflictException(`Product code "${dto.code}" already exists`);
    }

    if (dto.categoryId) {
      await this.assertCategoryExists(dto.categoryId);
    }

    return this.prisma.product.create({
      data: {
        code: dto.code,
        name: dto.name,
        description: dto.description ?? null,
        categoryId: dto.categoryId ?? null,
        status: dto.status,
        vendorId: vendor.id,
      },
    });
  }

  /** VENDOR mengubah produk miliknya; ADMIN dapat mengubah mana pun. */
  async update(
    user: JwtPayload,
    id: string,
    dto: UpdateProductDto,
  ): Promise<Product> {
    const product = await this.findOne(id);
    await this.assertCanManage(user, product);

    if (dto.categoryId) {
      await this.assertCategoryExists(dto.categoryId);
    }

    return this.prisma.product.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        categoryId: dto.categoryId,
        status: dto.status,
      },
    });
  }

  /** VENDOR menghapus produk miliknya; ADMIN dapat menghapus mana pun. */
  async remove(user: JwtPayload, id: string): Promise<void> {
    const product = await this.findOne(id);
    await this.assertCanManage(user, product);

    await this.prisma.product.delete({ where: { id } });
  }

  // ─── Helpers ─────────────────────────────

  private async requireVendorProfile(
    user: JwtPayload,
  ): Promise<{ id: string }> {
    if (user.role !== UserRole.VENDOR) {
      throw new ForbiddenException('Only vendors can manage products');
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
    product: Product,
  ): Promise<void> {
    if (user.role === UserRole.ADMIN) {
      return;
    }

    if (user.role !== UserRole.VENDOR) {
      throw new ForbiddenException('You cannot manage this product');
    }

    const vendor = await this.prisma.vendor.findUnique({
      where: { userId: user.userId },
      select: { id: true },
    });

    if (!vendor || vendor.id !== product.vendorId) {
      throw new ForbiddenException('You can only manage your own products');
    }
  }

  private async assertCategoryExists(categoryId: string): Promise<void> {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
    });

    if (!category) {
      throw new NotFoundException(`Category with id "${categoryId}" not found`);
    }
  }
}
