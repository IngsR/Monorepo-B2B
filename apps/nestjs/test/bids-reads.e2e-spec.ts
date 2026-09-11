import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { UserRole } from '../src/common/enums/user-role.enum.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { InMemoryPrisma } from './support/in-memory-prisma.js';

process.env.NODE_ENV = 'test';
process.env.PORT = process.env.PORT ?? '0';
process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://test:test@localhost:5432/test';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret';
process.env.CORS_ORIGIN = process.env.CORS_ORIGIN ?? '*';

/**
 * Integration/E2E for the read surfaces around bids and the bid endpoints
 * themselves: access control, pagination contract, and identity isolation.
 */

const VENDOR_EMAIL = 'vendor@bid-reads.test';
const BIDDER_A_EMAIL = 'bidder-a@bid-reads.test';
const BIDDER_B_EMAIL = 'bidder-b@bid-reads.test';
const PASSWORD = 'Password123';

const prisma = new InMemoryPrisma();

describe('Bids read surfaces (e2e)', () => {
  let app: INestApplication;
  let vendorToken: string;
  let bidderAToken: string;
  let bidderBToken: string;
  let auctionId: string;
  let bidAId: string;

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    await prisma.seed({
      users: [
        { email: VENDOR_EMAIL, name: 'Vendor', role: UserRole.VENDOR },
        { email: BIDDER_A_EMAIL, name: 'Bidder A', role: UserRole.BIDDER },
        { email: BIDDER_B_EMAIL, name: 'Bidder B', role: UserRole.BIDDER },
      ],
      password: PASSWORD,
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    const login = async (email: string): Promise<string> => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password: PASSWORD });
      return res.body.data.accessToken as string;
    };

    vendorToken = await login(VENDOR_EMAIL);
    bidderAToken = await login(BIDDER_A_EMAIL);
    bidderBToken = await login(BIDDER_B_EMAIL);

    // Vendor sets up an ACTIVE auction.
    const product = await request(app.getHttpServer())
      .post('/products')
      .set(auth(vendorToken))
      .send({ code: 'READS-001', name: 'Reads Product' });

    const auction = await request(app.getHttpServer())
      .post('/auctions')
      .set(auth(vendorToken))
      .send({
        productId: product.body.data.id,
        startingPrice: '10000.00',
        bidIncrement: '500.00',
        startAt: new Date(Date.now() - 1000).toISOString(),
        endAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      });
    auctionId = auction.body.data.id;

    await request(app.getHttpServer())
      .patch(`/auctions/${auctionId}/status`)
      .set(auth(vendorToken))
      .send({ status: 'SCHEDULED' });
    await request(app.getHttpServer())
      .patch(`/auctions/${auctionId}/status`)
      .set(auth(vendorToken))
      .send({ status: 'ACTIVE' });

    // Bidder A places a bid.
    const bid = await request(app.getHttpServer())
      .post(`/auctions/${auctionId}/bids`)
      .set(auth(bidderAToken))
      .send({ amount: '10500.00' });
    bidAId = bid.body.data.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /auctions/:auctionId/bids', () => {
    it('requires authentication (401)', async () => {
      const res = await request(app.getHttpServer()).get(
        `/auctions/${auctionId}/bids`,
      );
      expect(res.status).toBe(401);
    });

    it('lists bids for the auction with a paginated envelope', async () => {
      const res = await request(app.getHttpServer())
        .get(`/auctions/${auctionId}/bids`)
        .set(auth(bidderAToken));

      expect(res.status).toBe(200);
      // Paginated results are wrapped: { success, data: { data, meta }, ... }.
      const page = res.body.data;
      expect(Array.isArray(page.data)).toBe(true);
      expect(page.data.length).toBe(1);
      expect(page.meta).toMatchObject({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      });
    });

    it('rejects an invalid limit above the max (400)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/auctions/${auctionId}/bids?limit=1000`)
        .set(auth(bidderAToken));
      expect(res.status).toBe(400);
    });

    it('rejects an unknown sort field (400)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/auctions/${auctionId}/bids?sortBy=password`)
        .set(auth(bidderAToken));
      expect(res.status).toBe(400);
    });

    it('rejects a non-UUID auctionId (400)', async () => {
      const res = await request(app.getHttpServer())
        .get('/auctions/not-a-uuid/bids')
        .set(auth(bidderAToken));
      expect(res.status).toBe(400);
    });
  });

  describe('GET /bids/mine', () => {
    it('is BIDDER-only (vendor gets 403)', async () => {
      const res = await request(app.getHttpServer())
        .get('/bids/mine')
        .set(auth(vendorToken));
      expect(res.status).toBe(403);
    });

    it('returns only the authenticated bidder’s bids', async () => {
      const mineA = await request(app.getHttpServer())
        .get('/bids/mine')
        .set(auth(bidderAToken));
      expect(mineA.status).toBe(200);
      expect(mineA.body.data.data.length).toBe(1);
      expect(Number(mineA.body.data.data[0].amount)).toBe(10500);

      // Bidder B has placed none.
      const mineB = await request(app.getHttpServer())
        .get('/bids/mine')
        .set(auth(bidderBToken));
      expect(mineB.status).toBe(200);
      expect(mineB.body.data.data.length).toBe(0);
    });
  });

  describe('GET /bids/:id', () => {
    it('returns a bid detail for an authenticated user', async () => {
      const res = await request(app.getHttpServer())
        .get(`/bids/${bidAId}`)
        .set(auth(bidderBToken));
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(bidAId);
    });

    it('returns 404 for a well-formed but unknown bid id', async () => {
      const res = await request(app.getHttpServer())
        .get('/bids/75000000-0000-4000-8000-aaaaaaaaaaaa')
        .set(auth(bidderAToken));
      expect(res.status).toBe(404);
    });

    it('rejects a malformed bid id (400)', async () => {
      const res = await request(app.getHttpServer())
        .get('/bids/not-a-uuid')
        .set(auth(bidderAToken));
      expect(res.status).toBe(400);
    });
  });

  describe('GET /auctions/:auctionId/bids/highest', () => {
    it('returns the highest bid as the winner candidate', async () => {
      const res = await request(app.getHttpServer())
        .get(`/auctions/${auctionId}/bids/highest`)
        .set(auth(bidderBToken));
      expect(res.status).toBe(200);
      expect(Number(res.body.data.amount)).toBe(10500);
    });

    it('returns null (empty) when there are no bids', async () => {
      const product = await request(app.getHttpServer())
        .post('/products')
        .set(auth(vendorToken))
        .send({ code: 'READS-002', name: 'No Bids Product' });
      const auction = await request(app.getHttpServer())
        .post('/auctions')
        .set(auth(vendorToken))
        .send({
          productId: product.body.data.id,
          startingPrice: '1000.00',
          bidIncrement: '100.00',
          startAt: new Date(Date.now() - 1000).toISOString(),
          endAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        });

      const res = await request(app.getHttpServer())
        .get(`/auctions/${auction.body.data.id}/bids/highest`)
        .set(auth(bidderAToken));
      expect(res.status).toBe(200);
      // TransformInterceptor wraps; no bid → data is null.
      expect(res.body.data).toBeNull();
    });
  });
});
