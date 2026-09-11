import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  paginate,
  PaginatedResponse,
} from '../common/dto/paginated-response.dto.js';
import { PrismaService } from '../database/prisma.service.js';
import type { Category, Prisma } from '../database/prisma.types.js';
import { CategoryQueryDto } from './dto/category-query.dto.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: CategoryQueryDto): Promise<PaginatedResponse<Category>> {
    const where: Prisma.CategoryWhereInput = {};

    if (query.search) {
      where.name = { contains: query.search, mode: 'insensitive' };
    }

    const [categories, total] = await this.prisma.$transaction([
      this.prisma.category.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.category.count({ where }),
    ]);

    return paginate(categories, total, query.page, query.limit);
  }

  async findOne(id: string): Promise<Category> {
    const category = await this.prisma.category.findUnique({ where: { id } });

    if (!category) {
      throw new NotFoundException(`Category with id "${id}" not found`);
    }

    return category;
  }

  async create(dto: CreateCategoryDto): Promise<Category> {
    const existing = await this.prisma.category.findUnique({
      where: { name: dto.name },
    });

    if (existing) {
      throw new ConflictException(`Category "${dto.name}" already exists`);
    }

    return this.prisma.category.create({ data: { name: dto.name } });
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<Category> {
    await this.findOne(id);

    const clash = await this.prisma.category.findUnique({
      where: { name: dto.name },
    });

    if (clash && clash.id !== id) {
      throw new ConflictException(`Category "${dto.name}" already exists`);
    }

    return this.prisma.category.update({
      where: { id },
      data: { name: dto.name },
    });
  }

  /**
   * Hapus category. Produk yang memakainya akan kehilangan relasi
   * (schema: onDelete SetNull), sehingga produk tetap ada.
   */
  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.prisma.category.delete({ where: { id } });
  }
}
