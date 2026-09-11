import { Module } from '@nestjs/common';
import { BiddersController } from './bidders.controller.js';
import { BiddersService } from './bidders.service.js';

@Module({
  controllers: [BiddersController],
  providers: [BiddersService],
  exports: [BiddersService],
})
export class BiddersModule {}
