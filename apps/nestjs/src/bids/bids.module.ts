import { Module } from '@nestjs/common';
import { BidsController } from './bids.controller.js';
import { BidsService } from './bids.service.js';

@Module({
  controllers: [BidsController],
  providers: [BidsService],
  exports: [BidsService],
})
export class BidsModule {}
