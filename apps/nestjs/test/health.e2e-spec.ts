import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/database/prisma.service.js';

/**
 * Health e2e — does NOT require a live PostgreSQL.
 *
 * `PrismaService` is overridden so the suite focuses on the HTTP contract of
 * `/health` (200 when the DB probe succeeds, 503 when it fails).
 */
class HealthyPrismaMock {
  $queryRaw = async (): Promise<unknown[]> => [{ ok: 1 }];
}

class DownPrismaMock {
  $queryRaw = async (): Promise<unknown[]> => {
    throw new Error('ECONNREFUSED');
  };
}

async function buildApp(prisma: object): Promise<INestApplication> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(PrismaService)
    .useValue(prisma)
    .compile();

  const app = moduleFixture.createNestApplication();
  await app.init();
  return app;
}

describe('Health (e2e)', () => {
  describe('when the database is reachable', () => {
    let app: INestApplication;

    beforeAll(async () => {
      app = await buildApp(new HealthyPrismaMock());
    });

    afterAll(async () => {
      await app.close();
    });

    it('GET /health returns the service status', async () => {
      const response = await request(app.getHttpServer()).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        status: 'ok',
        service: 'scrapbid-api',
      });
    });
  });

  describe('when the database is unreachable', () => {
    let app: INestApplication;

    beforeAll(async () => {
      app = await buildApp(new DownPrismaMock());
    });

    afterAll(async () => {
      await app.close();
    });

    it('GET /health returns 503', async () => {
      const response = await request(app.getHttpServer()).get('/health');

      expect(response.status).toBe(503);
      expect(response.body).toMatchObject({
        success: false,
        code: 'DATABASE_UNAVAILABLE',
      });
    });
  });
});
