import { HttpStatus } from '@nestjs/common';
import { ErrorCode } from '../common/constants/error-codes.js';
import type { AppException } from '../common/exceptions/app.exception.js';
import type { PrismaService } from '../database/prisma.service.js';
import { HealthService } from './health.service.js';

describe('HealthService', () => {
  function makeService(queryRaw: ReturnType<typeof vi.fn>): HealthService {
    const prisma = { $queryRaw: queryRaw } as unknown as PrismaService;
    return new HealthService(prisma);
  }

  it('resolves when the database query succeeds', async () => {
    const queryRaw = vi.fn().mockResolvedValue([{ ok: 1 }]);
    const service = makeService(queryRaw);

    await expect(service.assertDatabase()).resolves.toBeUndefined();
    expect(queryRaw).toHaveBeenCalledOnce();
  });

  it('throws a public database error when the query fails', async () => {
    const queryRaw = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    const service = makeService(queryRaw);

    await expect(service.assertDatabase()).rejects.toMatchObject({
      status: HttpStatus.SERVICE_UNAVAILABLE,
      code: ErrorCode.DATABASE_UNAVAILABLE,
    } as Partial<AppException>);
  });
});
