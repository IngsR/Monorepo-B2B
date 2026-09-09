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
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { UserRole } from '../common/enums/user-role.enum.js';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface.js';
import { AuctionsService } from './auctions.service.js';
import { AuctionQueryDto } from './dto/auction-query.dto.js';
import { CreateAuctionDto } from './dto/create-auction.dto.js';

@Controller('auctions')
export class AuctionsController {
  constructor(private readonly auctionsService: AuctionsService) {}

  @Get()
  findAll(@Query() query: AuctionQueryDto) {
    return this.auctionsService.findAll(query);
  }

  @Get('my-lots')
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  findMyLots(
    @CurrentUser() user: JwtPayload,
    @Query() query: AuctionQueryDto,
  ) {
    query.sellerId = user.userId;
    return this.auctionsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.auctionsService.findOne(id);
  }

  @Post()
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateAuctionDto,
  ) {
    return this.auctionsService.create(dto, user.userId);
  }

  @Patch(':id/approve')
  @Roles(UserRole.ADMIN)
  approve(@Param('id', ParseUUIDPipe) id: string) {
    return this.auctionsService.approve(id);
  }

  @Patch(':id/cancel')
  @Roles(UserRole.ADMIN, UserRole.SELLER)
  cancel(@Param('id', ParseUUIDPipe) id: string) {
    return this.auctionsService.cancel(id);
  }
}
