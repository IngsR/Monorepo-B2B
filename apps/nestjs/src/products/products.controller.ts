import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { UserRole } from '../common/enums/user-role.enum.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { ProductQueryDto } from './dto/product-query.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { ProductsService } from './products.service.js';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  /** Produk milik vendor yang sedang login. */
  @Get('mine')
  @Roles(UserRole.VENDOR)
  findMine(@CurrentUser() user: JwtPayload, @Query() query: ProductQueryDto) {
    return this.productsService.findMine(user, query);
  }

  /** Katalog produk — dapat dibaca semua user yang login. */
  @Get()
  findAll(@Query() query: ProductQueryDto) {
    return this.productsService.findAll(query);
  }

  /** Detail produk — dapat dibaca semua user yang login. */
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.findOne(id);
  }

  /** VENDOR membuat produk untuk dirinya sendiri. */
  @Post()
  @Roles(UserRole.VENDOR)
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateProductDto) {
    return this.productsService.create(user, dto);
  }

  /** VENDOR (miliknya) atau ADMIN mengubah produk. */
  @Patch(':id')
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.productsService.update(user, id, dto);
  }

  /** VENDOR (miliknya) atau ADMIN menghapus produk. */
  @Delete(':id')
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.productsService.remove(user, id);
  }
}
