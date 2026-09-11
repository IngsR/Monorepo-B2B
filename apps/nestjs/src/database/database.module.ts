import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';

/**
 * Global database module.
 *
 * Exposes a single `PrismaService` instance to the whole application so every
 * feature module can inject it without re-declaring the provider.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class DatabaseModule {}
