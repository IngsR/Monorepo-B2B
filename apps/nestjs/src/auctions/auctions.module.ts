import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuctionsController } from './auctions.controller.js';
import { AuctionsService } from './auctions.service.js';
import { AuctionLot } from './entities/auction-lot.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([AuctionLot])],
  controllers: [AuctionsController],
  providers: [AuctionsService],
  exports: [AuctionsService],
})
export class AuctionsModule {}
