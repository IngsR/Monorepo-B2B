import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuctionLot } from '../auctions/entities/auction-lot.entity.js';
import { BidsController } from './bids.controller.js';
import { BidsService } from './bids.service.js';
import { Bid } from './entities/bid.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Bid, AuctionLot])],
  controllers: [BidsController],
  providers: [BidsService],
  exports: [BidsService],
})
export class BidsModule {}
