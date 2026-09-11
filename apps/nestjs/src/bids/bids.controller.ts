import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { UserRole } from '../common/enums/user-role.enum.js';
import { BidsService } from './bids.service.js';
import { BidQueryDto } from './dto/bid-query.dto.js';
import { CreateBidDto } from './dto/create-bid.dto.js';

@Controller()
export class BidsController {
  constructor(private readonly bidsService: BidsService) {}

  /** BIDDER menempatkan bid pada sebuah auction. */
  @Post('auctions/:auctionId/bids')
  @Roles(UserRole.BIDDER)
  placeBid(
    @CurrentUser() user: JwtPayload,
    @Param('auctionId', ParseUUIDPipe) auctionId: string,
    @Body() dto: CreateBidDto,
  ) {
    return this.bidsService.placeBid(user, auctionId, dto);
  }

  /** Daftar bid pada sebuah auction — dapat dibaca semua user login. */
  @Get('auctions/:auctionId/bids')
  findByAuction(
    @Param('auctionId', ParseUUIDPipe) auctionId: string,
    @Query() query: BidQueryDto,
  ) {
    query.auctionId = auctionId;
    return this.bidsService.findAll(query);
  }

  /** Highest valid bid (derived winner saat auction berakhir). */
  @Get('auctions/:auctionId/bids/highest')
  findHighest(@Param('auctionId', ParseUUIDPipe) auctionId: string) {
    return this.bidsService.findHighestBid(auctionId);
  }

  /** Bid milik bidder yang sedang login. */
  @Get('bids/mine')
  @Roles(UserRole.BIDDER)
  findMine(@CurrentUser() user: JwtPayload, @Query() query: BidQueryDto) {
    return this.bidsService.findMine(user, query);
  }

  /** Detail satu bid. */
  @Get('bids/:id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.bidsService.findOne(id);
  }
}
