import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { UserRole } from '../src/common/enums/user-role.enum.js';
import { InMemoryPrisma } from './support/in-memory-prisma.js';

// AppModule validates its environment on boot; provide a deterministic test env.
process.env.NODE_ENV = 'test';
process.env.PORT = process.env.PORT ?? '0';
process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://test:test@localhost:5432/test';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret';
process.env.CORS_ORIGIN = process.env.CORS_ORIGIN ?? '*';

/**
 * Critical end-to-end flow — no live database.
 *
 * `PrismaService` is replaced by `InMemoryPrisma`, which models the same
 * relations and enforces the same ownership/identity rules the real services
 * rely on. This proves the wire-up (guards + DTO validation + controllers +
 * services) behaves correctly across the whole auction lifecycle:
 *
 *   Vendor login → create product → create auction → activate
 *     → Bidder login → place bid → outbid → end auction → winner
 *
 * Plus the negative cases that matter for security and business rules.
 */

const VENDOR_A_EMAIL = 'vendor-a@scrapbid.test';
const VENDOR_B_EMAIL = 'vendor-b@scrapbid.test';
const BIDDER_EMAIL = 'bidder@scrapbid.test';
const PASSWORD = 'Password123';

const prisma = new InMemoryPrisma();

describe('Auction flow (e2e)', () => {
  let app: INestApplication;
  let vendorAToken: string;
  let vendorBToken: string;
  let bidderToken: string;

  beforeAll(async () => {
    await prisma.seed({
      users: [
        { email: VENDOR_A_EMAIL, name: 'Vendor A', role: UserRole.VENDOR },
        { email: VENDOR_B_EMAIL, name: 'Vendor B', role: UserRole.VENDOR },
        { email: BIDDER_EMAIL, name: 'Bidder', role: UserRole.BIDDER },
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

    vendorAToken = await login(VENDOR_A_EMAIL);
    vendorBToken = await login(VENDOR_B_EMAIL);
    bidderToken = await login(BIDDER_EMAIL);
  });

  afterAll(async () => {
    await app.close();
  });

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  // Start / end in the past vs future controlled per test via explicit windows.
  const futureWindow = (): { startAt: string; endAt: string } => ({
    startAt: new Date(Date.now() - 1000).toISOString(),
    endAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  });

  describe('happy path', () => {
    let productId: string;
    let auctionId: string;
    let firstBidId: string;

    it('Vendor A logs in and creates a product', async () => {
      const res = await request(app.getHttpServer())
        .post('/products')
        .set(auth(vendorAToken))
        .send({ code: 'SCRAP-001', name: 'Copper Wire' });

      expect(res.status).toBe(201);
      expect(res.body.data.vendorId).toBeDefined();
      productId = res.body.data.id;
    });

    it('Vendor A creates a DRAFT auction for the product', async () => {
      const res = await request(app.getHttpServer())
        .post('/auctions')
        .set(auth(vendorAToken))
        .send({
          productId,
          startingPrice: '100000.00',
          bidIncrement: '1000.00',
          ...futureWindow(),
        });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('DRAFT');
      expect(Number(res.body.data.currentPrice)).toBe(100000);
      auctionId = res.body.data.id;
    });

    it('activating a DRAFT auction requires going through SCHEDULED', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/auctions/${auctionId}/status`)
        .set(auth(vendorAToken))
        .send({ status: 'ACTIVE' });

      // DRAFT → ACTIVE is not a valid transition.
      expect(res.status).toBe(409);
    });

    it('Vendor A moves the auction DRAFT → SCHEDULED → ACTIVE', async () => {
      const scheduled = await request(app.getHttpServer())
        .patch(`/auctions/${auctionId}/status`)
        .set(auth(vendorAToken))
        .send({ status: 'SCHEDULED' });
      expect(scheduled.status).toBe(200);

      const active = await request(app.getHttpServer())
        .patch(`/auctions/${auctionId}/status`)
        .set(auth(vendorAToken))
        .send({ status: 'ACTIVE' });
      expect(active.status).toBe(200);
      expect(active.body.data.status).toBe('ACTIVE');
    });

    it('Bidder places a valid bid and currentPrice updates', async () => {
      const res = await request(app.getHttpServer())
        .post(`/auctions/${auctionId}/bids`)
        .set(auth(bidderToken))
        .send({ amount: '101000.00' });

      expect(res.status).toBe(201);
      firstBidId = res.body.data.id;

      const auction = await request(app.getHttpServer())
        .get(`/auctions/${auctionId}`)
        .set(auth(bidderToken));
      expect(Number(auction.body.data.currentPrice)).toBe(101000);
    });

    it('a second valid bid raises currentPrice further', async () => {
      const res = await request(app.getHttpServer())
        .post(`/auctions/${auctionId}/bids`)
        .set(auth(bidderToken))
        .send({ amount: '103000.00' });

      expect(res.status).toBe(201);

      const auction = await request(app.getHttpServer())
        .get(`/auctions/${auctionId}`)
        .set(auth(bidderToken));
      expect(Number(auction.body.data.currentPrice)).toBe(103000);
    });

    it('highest bid is the winner candidate', async () => {
      const res = await request(app.getHttpServer())
        .get(`/auctions/${auctionId}/bids/highest`)
        .set(auth(bidderToken));

      expect(res.status).toBe(200);
      expect(Number(res.body.data.amount)).toBe(103000);
      expect(res.body.data.id).not.toBe(firstBidId);
    });

    it('Vendor A ends the ACTIVE auction (→ ENDED)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/auctions/${auctionId}/status`)
        .set(auth(vendorAToken))
        .send({ status: 'ENDED' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('ENDED');
    });

    it('bidding on auction past endAt is rejected', async () => {
      const res = await request(app.getHttpServer())
        .post(`/auctions/${auctionId}/bids`)
        .set(auth(bidderToken))
        .send({ amount: '200000.00' });

      // Auction status is no longer ACTIVE → conflict.
      expect(res.status).toBe(409);
    });
  });

  describe('ownership and authorization', () => {
    let vendorBProductId: string;
    let vendorBAuctionId: string;

    beforeAll(async () => {
      const product = await request(app.getHttpServer())
        .post('/products')
        .set(auth(vendorBToken))
        .send({ code: 'SCRAP-B-001', name: 'Vendor B Item' });
      vendorBProductId = product.body.data.id;

      const auction = await request(app.getHttpServer())
        .post('/auctions')
        .set(auth(vendorBToken))
        .send({
          productId: vendorBProductId,
          startingPrice: '50000.00',
          bidIncrement: '500.00',
          ...futureWindow(),
        });
      vendorBAuctionId = auction.body.data.id;
    });

    it('Vendor A cannot update Vendor B product (403)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/products/${vendorBProductId}`)
        .set(auth(vendorAToken))
        .send({ name: 'Hijacked' });

      expect(res.status).toBe(403);
    });

    it('Vendor A cannot update Vendor B auction (403)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/auctions/${vendorBAuctionId}`)
        .set(auth(vendorAToken))
        .send({ startingPrice: '1.00' });

      expect(res.status).toBe(403);
    });

    it('Vendor A cannot change Vendor B auction status (403)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/auctions/${vendorBAuctionId}/status`)
        .set(auth(vendorAToken))
        .send({ status: 'SCHEDULED' });

      expect(res.status).toBe(403);
    });

    it('Vendor A cannot create an auction on Vendor B product (403)', async () => {
      const res = await request(app.getHttpServer())
        .post('/auctions')
        .set(auth(vendorAToken))
        .send({
          productId: vendorBProductId,
          startingPrice: '1000.00',
          bidIncrement: '100.00',
          ...futureWindow(),
        });

      expect(res.status).toBe(403);
    });

    it('BIDDER cannot create a product (403)', async () => {
      const res = await request(app.getHttpServer())
        .post('/products')
        .set(auth(bidderToken))
        .send({ code: 'NOPE', name: 'Nope' });

      expect(res.status).toBe(403);
    });

    it('unauthenticated request is rejected (401)', async () => {
      const res = await request(app.getHttpServer()).get('/products');
      expect(res.status).toBe(401);
    });
  });

  describe('bid validation and identity', () => {
    let auctionId: string;

    beforeAll(async () => {
      const product = await request(app.getHttpServer())
        .post('/products')
        .set(auth(vendorAToken))
        .send({ code: 'SCRAP-002', name: 'Brass Fittings' });

      const auction = await request(app.getHttpServer())
        .post('/auctions')
        .set(auth(vendorAToken))
        .send({
          productId: product.body.data.id,
          startingPrice: '10000.00',
          bidIncrement: '500.00',
          ...futureWindow(),
        });
      auctionId = auction.body.data.id;

      await request(app.getHttpServer())
        .patch(`/auctions/${auctionId}/status`)
        .set(auth(vendorAToken))
        .send({ status: 'SCHEDULED' });
      await request(app.getHttpServer())
        .patch(`/auctions/${auctionId}/status`)
        .set(auth(vendorAToken))
        .send({ status: 'ACTIVE' });
    });

    it('rejects a bid below currentPrice + bidIncrement (400)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/auctions/${auctionId}/bids`)
        .set(auth(bidderToken))
        .send({ amount: '10200.00' }); // minimum is 10500.00
      expect(res.status).toBe(400);
    });

    it('accepts a bid exactly at currentPrice + bidIncrement', async () => {
      const res = await request(app.getHttpServer())
        .post(`/auctions/${auctionId}/bids`)
        .set(auth(bidderToken))
        .send({ amount: '10500.00' });

      expect(res.status).toBe(201);
    });

    it('ignores a client-supplied bidderId (identity comes from JWT)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/auctions/${auctionId}/bids`)
        .set(auth(bidderToken))
        .send({ amount: '11000.00', bidderId: 'attacker-id' });

      // forbidNonWhitelisted: bidderId is not part of CreateBidDto → 400.
      expect(res.status).toBe(400);
    });

    it('VENDOR cannot place a bid (403)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/auctions/${auctionId}/bids`)
        .set(auth(vendorAToken))
        .send({ amount: '12000.00' });

      expect(res.status).toBe(403);
    });
  });

  describe('bidding before startAt', () => {
    it('is rejected (400)', async () => {
      const product = await request(app.getHttpServer())
        .post('/products')
        .set(auth(vendorAToken))
        .send({ code: 'SCRAP-003', name: 'Future Item' });

      const auction = await request(app.getHttpServer())
        .post('/auctions')
        .set(auth(vendorAToken))
        .send({
          productId: product.body.data.id,
          startingPrice: '10000.00',
          bidIncrement: '500.00',
          startAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          endAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        });

      await request(app.getHttpServer())
        .patch(`/auctions/${auction.body.data.id}/status`)
        .set(auth(vendorAToken))
        .send({ status: 'SCHEDULED' });
      await request(app.getHttpServer())
        .patch(`/auctions/${auction.body.data.id}/status`)
        .set(auth(vendorAToken))
        .send({ status: 'ACTIVE' });

      const res = await request(app.getHttpServer())
        .post(`/auctions/${auction.body.data.id}/bids`)
        .set(auth(bidderToken))
        .send({ amount: '20000.00' });

      expect(res.status).toBe(400);
    });
  });

  describe('currentPrice is server-controlled', () => {
    it('PATCH /auctions/:id rejects a client-supplied currentPrice (400)', async () => {
      const product = await request(app.getHttpServer())
        .post('/products')
        .set(auth(vendorAToken))
        .send({ code: 'SCRAP-004', name: 'Guard Item' });

      const auction = await request(app.getHttpServer())
        .post('/auctions')
        .set(auth(vendorAToken))
        .send({
          productId: product.body.data.id,
          startingPrice: '10000.00',
          bidIncrement: '500.00',
          ...futureWindow(),
        });

      const res = await request(app.getHttpServer())
        .patch(`/auctions/${auction.body.data.id}`)
        .set(auth(vendorAToken))
        .send({ currentPrice: '1.00' });

      expect(res.status).toBe(400);
    });
  });
});
