import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ErrorCode } from '../common/constants/error-codes.js';
import { AppException } from '../common/exceptions/app.exception.js';

@Injectable()
export class HealthService {
  constructor(
    @Inject(DataSource)
    private readonly dataSource: DataSource,
  ) {}

  async assertDatabase(): Promise<void> {
    try {
      await this.dataSource.query('SELECT 1');
    } catch {
      throw new AppException(
        'Database connection is unavailable',
        ErrorCode.DATABASE_UNAVAILABLE,
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
}
