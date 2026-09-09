import { HttpStatus } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ErrorCode } from '../common/constants/error-codes.js';
import { AppException } from '../common/exceptions/app.exception.js';
import { HealthService } from './health.service.js';

describe('HealthService', () => {
  it('resolves when the database query succeeds', async () => {
    const dataSource = {
      query: vi.fn().mockResolvedValue([{ ok: 1 }]),
    } as unknown as DataSource;

    const service = new HealthService(dataSource);

    await expect(service.assertDatabase()).resolves.toBeUndefined();
    expect(dataSource.query).toHaveBeenCalledWith('SELECT 1');
  });

  it('throws a public database error when the query fails', async () => {
    const dataSource = {
      query: vi.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    } as unknown as DataSource;

    const service = new HealthService(dataSource);

    await expect(service.assertDatabase()).rejects.toMatchObject({
      status: HttpStatus.SERVICE_UNAVAILABLE,
      code: ErrorCode.DATABASE_UNAVAILABLE,
    } as Partial<AppException>);
  });
});
