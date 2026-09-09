import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { paginate, PaginatedResponse } from '../common/dto/paginated-response.dto.js';
import { AuctionQueryDto } from './dto/auction-query.dto.js';
import { CreateAuctionDto } from './dto/create-auction.dto.js';
import { AuctionLot } from './entities/auction-lot.entity.js';
import { AuctionStatus } from './enums/auction-status.enum.js';

@Injectable()
export class AuctionsService {
  constructor(
    @InjectRepository(AuctionLot)
    private readonly lotRepo: Repository<AuctionLot>,
  ) {}

  async findAll(query: AuctionQueryDto): Promise<PaginatedResponse<AuctionLot>> {
    const where: Record<string, unknown> = {};

    if (query.status) {
      where['status'] = query.status;
    }

    if (query.category) {
      where['category'] = query.category;
    }

    if (query.sellerId) {
      where['sellerId'] = query.sellerId;
    }

    if (query.search) {
      where['title'] = ILike(`%${query.search}%`);
    }

    const [data, total] = await this.lotRepo.findAndCount({
      where,
      relations: { seller: true, highestBidder: true },
      order: { createdAt: 'DESC' },
      skip: query.skip,
      take: query.limit,
    });

    return paginate(data, total, query.page, query.limit);
  }

  async findOne(id: string): Promise<AuctionLot> {
    const lot = await this.lotRepo.findOne({
      where: { id },
      relations: { seller: true, highestBidder: true },
    });

    if (!lot) {
      throw new NotFoundException(`Auction lot with id "${id}" not found`);
    }

    return lot;
  }

  async create(dto: CreateAuctionDto, sellerId: string): Promise<AuctionLot> {
    const lot = this.lotRepo.create({
      ...dto,
      sellerId,
      status: AuctionStatus.PENDING_REVIEW,
      currentPrice: dto.basePrice,
      totalBids: 0,
    });

    return this.lotRepo.save(lot);
  }

  async approve(id: string, durationHours = 72): Promise<AuctionLot> {
    const lot = await this.findOne(id);

    if (lot.status !== AuctionStatus.PENDING_REVIEW) {
      throw new BadRequestException(
        `Lot status must be PENDING_REVIEW to approve, current status: ${lot.status}`,
      );
    }

    lot.status = AuctionStatus.ACTIVE;
    lot.expiresAt = new Date(Date.now() + durationHours * 3600 * 1000);

    return this.lotRepo.save(lot);
  }

  async cancel(id: string, _reason?: string): Promise<AuctionLot> {
    const lot = await this.findOne(id);

    if (lot.status === AuctionStatus.CLOSED || lot.status === AuctionStatus.CANCELLED) {
      throw new BadRequestException(
        `Cannot cancel lot that is already ${lot.status}`,
      );
    }

    lot.status = AuctionStatus.CANCELLED;
    return this.lotRepo.save(lot);
  }
}
