import { ConflictException, NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../database/prisma.service.js';
import { CategoriesService } from './categories.service.js';

type PrismaMock = {
  category: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
};

function makePrisma(): PrismaMock {
  return {
    category: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  };
}

describe('CategoriesService', () => {
  let service: CategoriesService;
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = makePrisma();
    service = new CategoriesService(prisma as unknown as PrismaService);
  });

  it('findAll returns paginated categories', async () => {
    prisma.category.findMany.mockResolvedValue([{ id: 'c-1', name: 'Metal' }]);
    prisma.category.count.mockResolvedValue(1);

    const result = await service.findAll({ page: 1, limit: 10, skip: 0 });

    expect(result.data).toHaveLength(1);
    expect(result.meta.total).toBe(1);
  });

  it('findOne throws NotFound for a missing category', async () => {
    prisma.category.findUnique.mockResolvedValue(null);

    await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
  });

  it('findOne returns the category when it exists', async () => {
    prisma.category.findUnique.mockResolvedValue({ id: 'c-1', name: 'Metal' });

    await expect(service.findOne('c-1')).resolves.toMatchObject({ id: 'c-1' });
  });

  it('create rejects a duplicate name', async () => {
    prisma.category.findUnique.mockResolvedValue({ id: 'c-1', name: 'Metal' });

    await expect(service.create({ name: 'Metal' })).rejects.toThrow(
      ConflictException,
    );
  });

  it('create persists a new category', async () => {
    prisma.category.findUnique.mockResolvedValue(null);
    prisma.category.create.mockResolvedValue({ id: 'c-2', name: 'Plastic' });

    await expect(service.create({ name: 'Plastic' })).resolves.toMatchObject({
      id: 'c-2',
    });
  });

  it('update rejects renaming to another existing name', async () => {
    prisma.category.findUnique
      .mockResolvedValueOnce({ id: 'c-1', name: 'Metal' }) // findOne
      .mockResolvedValueOnce({ id: 'c-2', name: 'Plastic' }); // clash

    await expect(service.update('c-1', { name: 'Plastic' })).rejects.toThrow(
      ConflictException,
    );
  });

  it('update succeeds when the new name is free', async () => {
    prisma.category.findUnique
      .mockResolvedValueOnce({ id: 'c-1', name: 'Metal' }) // findOne
      .mockResolvedValueOnce(null); // no clash
    prisma.category.update.mockResolvedValue({ id: 'c-1', name: 'Scrap' });

    await expect(service.update('c-1', { name: 'Scrap' })).resolves.toMatchObject(
      { name: 'Scrap' },
    );
  });

  it('remove deletes an existing category', async () => {
    prisma.category.findUnique.mockResolvedValue({ id: 'c-1' });

    await service.remove('c-1');

    expect(prisma.category.delete).toHaveBeenCalledWith({ where: { id: 'c-1' } });
  });
});
