import { INestApplication, Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { CommonModule } from '../src/common/common.module.js';
import { UserRole } from '../src/common/enums/user-role.enum.js';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../src/auth/guards/roles.guard.js';
import { JwtStrategy } from '../src/auth/strategies/jwt.strategy.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { ProductsController } from '../src/products/products.controller.js';
import { ProductsService } from '../src/products/products.service.js';

/**
 * Ownership e2e — the core security rule:
 * a Vendor must NOT be able to mutate another Vendor's product.
 *
 * No live database: `PrismaService` is replaced by an in-memory mock.
 */

const VENDOR_A = { id: 'v-a', userId: 'user-a' };
const VENDOR_B = { id: 'v-b', userId: 'user-b' };

// Real UUIDs — the controller uses ParseUUIDPipe on :id.
const PRODUCT_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PRODUCT_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const products = [
  { id: PRODUCT_A, code: 'PA', name: 'Product A', vendorId: 'v-a' },
  { id: PRODUCT_B, code: 'PB', name: 'Product B', vendorId: 'v-b' },
];

const vendorsByUser: Record<string, { id: string; userId: string }> = {
  'user-a': VENDOR_A,
  'user-b': VENDOR_B,
};

class MockPrismaService {
  vendor = {
    findUnique: async ({
      where,
    }: {
      where: { userId?: string };
    }): Promise<{ id: string; userId: string } | null> =>
      where.userId ? (vendorsByUser[where.userId] ?? null) : null,
  };

  category = { findUnique: async (): Promise<null> => null };

  product = {
    findUnique: async ({
      where,
    }: {
      where: { id: string };
    }): Promise<unknown> => products.find((p) => p.id === where.id) ?? null,
    findMany: async (): Promise<unknown[]> => products,
    count: async (): Promise<number> => products.length,
    create: async ({ data }: { data: unknown }): Promise<unknown> => data,
    update: async ({
      where,
      data,
    }: {
      where: { id: string };
      data: unknown;
    }): Promise<unknown> => ({ ...where, ...(data as object) }),
    delete: async (): Promise<unknown> => undefined,
  };

  $transaction = async (ops: Promise<unknown>[]): Promise<unknown[]> =>
    Promise.all(ops);
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET', 'test-secret'),
        signOptions: { expiresIn: '1d' },
      }),
    }),
    CommonModule,
  ],
  controllers: [ProductsController],
  providers: [
    ProductsService,
    JwtStrategy,
    { provide: PrismaService, useClass: MockPrismaService },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
class ProductsTestModule {}

describe('Products ownership (e2e)', () => {
  let app: INestApplication;
  let jwt: JwtService;

  function tokenFor(userId: string, role: UserRole): string {
    return jwt.sign({ sub: userId, userId, email: `${userId}@t.com`, role });
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ProductsTestModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    jwt = moduleFixture.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('Vendor A cannot update Vendor B product (403)', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/products/${PRODUCT_B}`)
      .set('Authorization', `Bearer ${tokenFor('user-a', UserRole.VENDOR)}`)
      .send({ name: 'Hacked' });

    expect(res.status).toBe(403);
  });

  it('Vendor A cannot delete Vendor B product (403)', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/products/${PRODUCT_B}`)
      .set('Authorization', `Bearer ${tokenFor('user-a', UserRole.VENDOR)}`);

    expect(res.status).toBe(403);
  });

  it('Vendor A can update its own product (200)', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/products/${PRODUCT_A}`)
      .set('Authorization', `Bearer ${tokenFor('user-a', UserRole.VENDOR)}`)
      .send({ name: 'Renamed' });

    expect(res.status).toBe(200);
  });

  it('BIDDER cannot create a product (403)', async () => {
    const res = await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${tokenFor('user-x', UserRole.BIDDER)}`)
      .send({ code: 'NEW', name: 'New' });

    expect(res.status).toBe(403);
  });

  it('unauthenticated request is rejected (401)', async () => {
    const res = await request(app.getHttpServer()).get('/products');
    expect(res.status).toBe(401);
  });
});
