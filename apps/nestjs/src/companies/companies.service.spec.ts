import { ConflictException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { CompaniesService } from './companies.service.js';
import { Company, CompanyStatus } from './entities/company.entity.js';

describe('CompaniesService', () => {
  let service: CompaniesService;
  let repo: Partial<Record<keyof Repository<Company>, any>>;

  beforeEach(() => {
    repo = {
      findAndCount: vi.fn(),
      findOne: vi.fn(),
      create: vi.fn().mockImplementation((dto) => dto),
      save: vi.fn().mockImplementation((entity) => Promise.resolve({ id: 'comp-1', ...entity })),
    };
    service = new CompaniesService(repo as unknown as Repository<Company>);
  });

  describe('findAll', () => {
    it('returns paginated companies', async () => {
      const mockList = [{ id: '1', name: 'PT Maju' }];
      repo.findAndCount!.mockResolvedValue([mockList, 1]);

      const result = await service.findAll({ page: 1, limit: 10, skip: 0 });

      expect(result.data).toEqual(mockList);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
    });
  });

  describe('findOne', () => {
    it('returns company when found', async () => {
      const mockCompany = { id: '1', name: 'PT Maju' };
      repo.findOne!.mockResolvedValue(mockCompany);

      const result = await service.findOne('1');
      expect(result).toEqual(mockCompany);
    });

    it('throws NotFoundException when not found', async () => {
      repo.findOne!.mockResolvedValue(null);

      await expect(service.findOne('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('creates a new company if code is unique', async () => {
      repo.findOne!.mockResolvedValue(null);

      const result = await service.create({
        name: 'PT ABC',
        code: 'ABC',
      });

      expect(result).toHaveProperty('id', 'comp-1');
      expect(repo.save).toHaveBeenCalled();
    });

    it('throws ConflictException if code already exists', async () => {
      repo.findOne!.mockResolvedValue({ id: '2', code: 'ABC' });

      await expect(
        service.create({
          name: 'PT ABC',
          code: 'ABC',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('deactivate (soft delete)', () => {
    it('marks status as INACTIVE', async () => {
      const existing = { id: '1', status: CompanyStatus.ACTIVE };
      repo.findOne!.mockResolvedValue(existing);

      await service.deactivate('1');
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: CompanyStatus.INACTIVE }),
      );
    });
  });
});
