import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { AuctionLot } from '../auctions/entities/auction-lot.entity.js';
import { AuctionStatus } from '../auctions/enums/auction-status.enum.js';
import { BidsService } from './bids.service.js';
import { Bid } from './entities/bid.entity.js';

describe('BidsService', () => {
  let service: BidsService;
  let bidRepo: Partial<Record<keyof Repository<Bid>, any>>;
  let lotRepo: Partial<Record<keyof Repository<AuctionLot>, any>>;
  let dataSource: Partial<DataSource>;
  let mockManager: any;

  beforeEach(() => {
    bidRepo = {
      find: vi.fn(),
    };
    lotRepo = {};

    mockManager = {
      findOne: vi.fn(),
      create: vi.fn().mockImplementation((_entity, dto) => dto),
      save: vi.fn().mockImplementation((entity) => Promise.resolve({ id: 'bid-1', ...entity })),
    };

    dataSource = {
      transaction: vi.fn().mockImplementation((cb) => cb(mockManager)),
    };

    service = new BidsService(
      bidRepo as unknown as Repository<Bid>,
      lotRepo as unknown as Repository<AuctionLot>,
      dataSource as unknown as DataSource,
    );
  });

  describe('findByLot', () => {
    it('returns bid history for lot', async () => {
      const mockBids = [{ id: 'bid-1', amount: 50000000 }];
      bidRepo.find!.mockResolvedValue(mockBids);

      const result = await service.findByLot('lot-1');
      expect(result).toEqual(mockBids);
    });
  });

  describe('placeBid', () => {
    it('successfully places higher bid on active lot', async () => {
      const mockLot = {
        id: 'lot-1',
        sellerId: 'seller-1',
        status: AuctionStatus.ACTIVE,
        currentPrice: 50000000,
        totalBids: 1,
        expiresAt: new Date(Date.now() + 3600000),
      };
      mockManager.findOne.mockResolvedValue(mockLot);

      const result = await service.placeBid('lot-1', 'vendor-1', {
        amount: 55000000,
      });

      expect(result).toHaveProperty('amount', 55000000);
      expect(result).toHaveProperty('vendorId', 'vendor-1');
      expect(mockLot.currentPrice).toBe(55000000);
      expect(mockLot.totalBids).toBe(2);
    });

    it('throws NotFoundException when lot does not exist', async () => {
      mockManager.findOne.mockResolvedValue(null);

      await expect(
        service.placeBid('lot-invalid', 'vendor-1', { amount: 60000000 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when lot is not ACTIVE', async () => {
      const mockLot = {
        id: 'lot-1',
        sellerId: 'seller-1',
        status: AuctionStatus.PENDING_REVIEW,
        currentPrice: 50000000,
      };
      mockManager.findOne.mockResolvedValue(mockLot);

      await expect(
        service.placeBid('lot-1', 'vendor-1', { amount: 60000000 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when seller bids on their own lot', async () => {
      const mockLot = {
        id: 'lot-1',
        sellerId: 'seller-1',
        status: AuctionStatus.ACTIVE,
        currentPrice: 50000000,
      };
      mockManager.findOne.mockResolvedValue(mockLot);

      await expect(
        service.placeBid('lot-1', 'seller-1', { amount: 60000000 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when bid amount is less than or equal to current price', async () => {
      const mockLot = {
        id: 'lot-1',
        sellerId: 'seller-1',
        status: AuctionStatus.ACTIVE,
        currentPrice: 50000000,
      };
      mockManager.findOne.mockResolvedValue(mockLot);

      await expect(
        service.placeBid('lot-1', 'vendor-1', { amount: 50000000 }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
