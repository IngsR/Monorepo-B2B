import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AuctionLot } from '../auctions/entities/auction-lot.entity.js';
import { AuctionStatus } from '../auctions/enums/auction-status.enum.js';
import { PlaceBidDto } from './dto/place-bid.dto.js';
import { Bid } from './entities/bid.entity.js';

@Injectable()
export class BidsService {
  constructor(
    @InjectRepository(Bid)
    private readonly bidRepo: Repository<Bid>,
    @InjectRepository(AuctionLot)
    private readonly lotRepo: Repository<AuctionLot>,
    private readonly dataSource: DataSource,
  ) {}

  async findByLot(lotId: string): Promise<Bid[]> {
    return this.bidRepo.find({
      where: { lotId },
      relations: { vendor: true },
      order: { createdAt: 'DESC' },
    });
  }

  async placeBid(
    lotId: string,
    vendorId: string,
    dto: PlaceBidDto,
  ): Promise<Bid> {
    return this.dataSource.transaction(async (manager) => {
      const lot = await manager.findOne(AuctionLot, {
        where: { id: lotId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!lot) {
        throw new NotFoundException(`Auction lot with id "${lotId}" not found`);
      }

      if (lot.status !== AuctionStatus.ACTIVE) {
        throw new BadRequestException(
          `Auction lot is not active for bidding, current status: ${lot.status}`,
        );
      }

      if (lot.expiresAt && new Date() > new Date(lot.expiresAt)) {
        throw new BadRequestException('Auction has expired');
      }

      if (lot.sellerId === vendorId) {
        throw new BadRequestException('Seller cannot bid on their own lot');
      }

      if (Number(dto.amount) <= Number(lot.currentPrice)) {
        throw new BadRequestException(
          `Bid amount (Rp ${dto.amount}) must be greater than current price (Rp ${lot.currentPrice})`,
        );
      }

      const bid = manager.create(Bid, {
        lotId,
        vendorId,
        amount: dto.amount,
      });
      const savedBid = await manager.save(bid);

      lot.currentPrice = dto.amount;
      lot.highestBidderId = vendorId;
      lot.totalBids = (lot.totalBids || 0) + 1;
      await manager.save(lot);

      return savedBid;
    });
  }
}
