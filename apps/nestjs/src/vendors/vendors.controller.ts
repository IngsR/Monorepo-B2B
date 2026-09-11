import {
  Body,
  Controller,
  Get,
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
import { CreateVendorDto } from './dto/create-vendor.dto.js';
import { UpdateVendorDto } from './dto/update-vendor.dto.js';
import { VendorQueryDto } from './dto/vendor-query.dto.js';
import { VendorsService } from './vendors.service.js';

@Controller('vendors')
export class VendorsController {
  constructor(private readonly vendorsService: VendorsService) {}

  /** Profil vendor milik user yang sedang login. */
  @Get('me')
  @Roles(UserRole.VENDOR)
  getMine(@CurrentUser() user: JwtPayload) {
    return this.vendorsService.findMine(user);
  }

  /** VENDOR mengubah profil miliknya sendiri. */
  @Patch('me')
  @Roles(UserRole.VENDOR)
  updateMine(@CurrentUser() user: JwtPayload, @Body() dto: UpdateVendorDto) {
    return this.vendorsService.updateMine(user, dto);
  }

  /** ADMIN melihat semua vendor. */
  @Get()
  @Roles(UserRole.ADMIN)
  findAll(@Query() query: VendorQueryDto) {
    return this.vendorsService.findAll(query);
  }

  /** ADMIN membuat profil vendor untuk sebuah user. */
  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreateVendorDto) {
    return this.vendorsService.create(dto);
  }

  /** ADMIN melihat detail satu vendor. */
  @Get(':id')
  @Roles(UserRole.ADMIN)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.vendorsService.findOne(id);
  }

  /** ADMIN mengubah vendor mana pun. */
  @Patch(':id')
  @Roles(UserRole.ADMIN)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateVendorDto) {
    return this.vendorsService.update(id, dto);
  }
}
