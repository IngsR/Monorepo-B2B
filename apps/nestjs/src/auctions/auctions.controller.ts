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
import { AuctionsService } from './auctions.service.js';
import { AuctionQueryDto } from './dto/auction-query.dto.js';
import { CreateAuctionDto } from './dto/create-auction.dto.js';
import { UpdateAuctionStatusDto } from './dto/update-auction-status.dto.js';
import { UpdateAuctionDto } from './dto/update-auction.dto.js';

@Controller('auctions')
export class AuctionsController {
  constructor(private readonly auctionsService: AuctionsService) {}

  /** Auction milik vendor yang sedang login. */
  @Get('mine')
  @Roles(UserRole.VENDOR)
  findMine(@CurrentUser() user: JwtPayload, @Query() query: AuctionQueryDto) {
    return this.auctionsService.findMine(user, query);
  }

  /** Daftar auction — dapat dibaca semua user yang login. */
  @Get()
  findAll(@Query() query: AuctionQueryDto) {
    return this.auctionsService.findAll(query);
  }

  /** Detail auction — dapat dibaca semua user yang login. */
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.auctionsService.findOne(id);
  }

  /** VENDOR membuat auction untuk produk miliknya. */
  @Post()
  @Roles(UserRole.VENDOR)
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateAuctionDto) {
    return this.auctionsService.create(user, dto);
  }

  /** VENDOR (miliknya) atau ADMIN mengubah auction DRAFT. */
  @Patch(':id')
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAuctionDto,
  ) {
    return this.auctionsService.update(user, id, dto);
  }

  /** VENDOR (miliknya) atau ADMIN mengubah status auction. */
  @Patch(':id/status')
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  updateStatus(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAuctionStatusDto,
  ) {
    return this.auctionsService.updateStatus(user, id, dto);
  }
}
