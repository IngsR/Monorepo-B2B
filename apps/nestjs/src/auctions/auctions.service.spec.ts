import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { AuctionsService } from './auctions.service.js';
import { AuctionLot } from './entities/auction-lot.entity.js';
import { AuctionStatus } from './enums/auction-status.enum.js';

describe('AuctionsService', () => {
  let service: AuctionsService;
  let repo: Partial<Record<keyof Repository<AuctionLot>, any>>;

  beforeEach(() => {
    repo = {
      findAndCount: vi.fn(),
      findOne: vi.fn(),
      create: vi.fn().mockImplementation((dto) => dto),
      save: vi.fn().mockImplementation((entity) => Promise.resolve({ id: 'lot-1', ...entity })),
    };
    service = new AuctionsService(repo as unknown as Repository<AuctionLot>);
  });

  describe('findAll', () => {
    it('returns paginated auction lots', async () => {
      const mockList = [{ id: 'lot-1', title: 'Scrap Besi Baja' }];
      repo.findAndCount!.mockResolvedValue([mockList, 1]);

      const result = await service.findAll({ page: 1, limit: 10, skip: 0 });

      expect(result.data).toEqual(mockList);
      expect(result.meta.total).toBe(1);
    });
  });

  describe('findOne', () => {
    it('returns lot when found', async () => {
      const mockLot = { id: 'lot-1', title: 'Scrap Besi Baja' };
      repo.findOne!.mockResolvedValue(mockLot);

      const result = await service.findOne('lot-1');
      expect(result).toEqual(mockLot);
    });

    it('throws NotFoundException when not found', async () => {
      repo.findOne!.mockResolvedValue(null);

      await expect(service.findOne('lot-999')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('creates a new lot with PENDING_REVIEW status', async () => {
      const dto = {
        title: 'Scrap Tembaga Pabrik',
        category: 'Scrap Logam',
        quantity: 10,
        unit: 'Ton',
        basePrice: 100000000,
        warehouseLocation: 'Gudang Cikarang',
      };

      const result = await service.create(dto, 'seller-1');

      expect(result).toHaveProperty('id', 'lot-1');
      expect(result).toHaveProperty('status', AuctionStatus.PENDING_REVIEW);
      expect(result).toHaveProperty('sellerId', 'seller-1');
    });
  });

  describe('approve', () => {
    it('approves lot and sets status to ACTIVE and sets expiresAt', async () => {
      const mockLot = {
        id: 'lot-1',
        title: 'Scrap Tembaga',
        status: AuctionStatus.PENDING_REVIEW,
      };
      repo.findOne!.mockResolvedValue(mockLot);

      const result = await service.approve('lot-1');
      expect(result.status).toBe(AuctionStatus.ACTIVE);
      expect(result.expiresAt).toBeDefined();
    });

    it('throws BadRequestException if lot is not PENDING_REVIEW', async () => {
      const mockLot = {
        id: 'lot-1',
        title: 'Scrap Tembaga',
        status: AuctionStatus.ACTIVE,
      };
      repo.findOne!.mockResolvedValue(mockLot);

      await expect(service.approve('lot-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('cancel', () => {
    it('cancels lot successfully', async () => {
      const mockLot = {
        id: 'lot-1',
        title: 'Scrap Tembaga',
        status: AuctionStatus.PENDING_REVIEW,
      };
      repo.findOne!.mockResolvedValue(mockLot);

      const result = await service.cancel('lot-1');
      expect(result.status).toBe(AuctionStatus.CANCELLED);
    });
  });
});
