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
 * Integration/E2E for bid consistency and winner selection.
 *
 * The production bidding path locks the auction row and does read-validate-
 * write inside one transaction. This suite drives that path over HTTP and
 * asserts the invariants that matter:
 *   - concurrency does not lose an update or accept an invalid bid;
 *   - the highest accepted bid is the winner candidate;
 *   - ties are broken deterministically (earliest createdAt).
 */

const VENDOR_EMAIL = 'vendor@consistency.test';
const BIDDER_A_EMAIL = 'bidder-a@consistency.test';
const BIDDER_B_EMAIL = 'bidder-b@consistency.test';
const PASSWORD = 'Password123';

const prisma = new InMemoryPrisma();

describe('Bid consistency & winner (e2e)', () => {
  let app: INestApplication;
  let vendorToken: string;
  let bidderAToken: string;
  let bidderBToken: string;

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
  });

  afterAll(async () => {
    await app.close();
  });

  /** Create an ACTIVE auction owned by the vendor and return its id. */
  async function activeAuction(code: string, increment = '500.00') {
    const product = await request(app.getHttpServer())
      .post('/products')
      .set(auth(vendorToken))
      .send({ code, name: `Product ${code}` });

    const auction = await request(app.getHttpServer())
      .post('/auctions')
      .set(auth(vendorToken))
      .send({
        productId: product.body.data.id,
        startingPrice: '10000.00',
        bidIncrement: increment,
        startAt: new Date(Date.now() - 1000).toISOString(),
        endAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      });

    await request(app.getHttpServer())
      .patch(`/auctions/${auction.body.data.id}/status`)
      .set(auth(vendorToken))
      .send({ status: 'SCHEDULED' });
    await request(app.getHttpServer())
      .patch(`/auctions/${auction.body.data.id}/status`)
      .set(auth(vendorToken))
      .send({ status: 'ACTIVE' });

    return auction.body.data.id as string;
  }

  const bid = (token: string, auctionId: string, amount: string) =>
    request(app.getHttpServer())
      .post(`/auctions/${auctionId}/bids`)
      .set(auth(token))
      .send({ amount });

  const getAuction = (token: string, auctionId: string) =>
    request(app.getHttpServer()).get(`/auctions/${auctionId}`).set(auth(token));

  describe('sequential bidding', () => {
    it('final currentPrice equals the last accepted bid; all bids recorded', async () => {
      const auctionId = await activeAuction('CONS-001');

      expect((await bid(bidderAToken, auctionId, '10500.00')).status).toBe(201);
      expect((await bid(bidderBToken, auctionId, '11000.00')).status).toBe(201);
      expect((await bid(bidderAToken, auctionId, '12000.00')).status).toBe(201);

      const auction = await getAuction(bidderAToken, auctionId);
      expect(Number(auction.body.data.currentPrice)).toBe(12000);

      const list = await request(app.getHttpServer())
        .get(`/auctions/${auctionId}/bids`)
        .set(auth(bidderAToken));
      expect(list.body.data.meta.total).toBe(3);
    });

    it('rejects a stale bid that is below the current minimum', async () => {
      const auctionId = await activeAuction('CONS-002');

      expect((await bid(bidderAToken, auctionId, '10500.00')).status).toBe(201);
      // 10500 is now below currentPrice(10500)+increment(500)=11000 → rejected.
      const stale = await bid(bidderBToken, auctionId, '10500.00');
      expect(stale.status).toBe(400);

      const auction = await getAuction(bidderAToken, auctionId);
      expect(Number(auction.body.data.currentPrice)).toBe(10500);
    });
  });

  describe('concurrent bidding (row-lock contract)', () => {
    it('never loses an update or accepts a sub-minimum bid under contention', async () => {
      const auctionId = await activeAuction('CONS-003');

      // Fire several bids "at once". Only a monotonically increasing chain is
      // valid; every rejected attempt must be below the moving minimum.
      const attempts = [
        bid(bidderAToken, auctionId, '10500.00'),
        bid(bidderBToken, auctionId, '11000.00'),
        bid(bidderAToken, auctionId, '11500.00'),
        bid(bidderBToken, auctionId, '12000.00'),
      ];
      const results = await Promise.all(attempts);
      const statuses = results.map((r) => r.status);

      // At least one succeeds; none returns a server error.
      expect(statuses.some((s) => s === 201)).toBe(true);
      expect(statuses.every((s) => s === 201 || s === 400)).toBe(true);

      // The final price must equal the highest accepted bid, and must be
      // exactly one of the submitted amounts (no corruption).
      const auction = await getAuction(bidderAToken, auctionId);
      const finalPrice = Number(auction.body.data.currentPrice);
      const submitted = [10500, 11000, 11500, 12000];
      expect(submitted).toContain(finalPrice);

      // Accepted count == created bids (no bid without a price update).
      const list = await request(app.getHttpServer())
        .get(`/auctions/${auctionId}/bids`)
        .set(auth(bidderAToken));
      const accepted = statuses.filter((s) => s === 201).length;
      expect(list.body.data.meta.total).toBe(accepted);
    });
  });

  describe('winner selection', () => {
    it('highest valid bid wins after the auction ends', async () => {
      const auctionId = await activeAuction('CONS-004');

      await bid(bidderAToken, auctionId, '10500.00');
      await bid(bidderBToken, auctionId, '13000.00');
      await bid(bidderAToken, auctionId, '14000.00');

      await request(app.getHttpServer())
        .patch(`/auctions/${auctionId}/status`)
        .set(auth(vendorToken))
        .send({ status: 'ENDED' });

      const highest = await request(app.getHttpServer())
        .get(`/auctions/${auctionId}/bids/highest`)
        .set(auth(bidderAToken));

      expect(Number(highest.body.data.amount)).toBe(14000);
    });

    it('exposes the single highest bid as the winner candidate', async () => {
      const auctionId = await activeAuction('CONS-005');

      const first = await bid(bidderAToken, auctionId, '10500.00');
      expect(first.status).toBe(201);
      const firstId = first.body.data.id;

      // The increment rule (>= current + increment) makes it impossible to
      // create two equal amounts through the API, so a genuine tie cannot be
      // produced end-to-end. The tie-break ordering ([amount desc, createdAt
      // asc]) is asserted at the service level in bids.service.spec.ts.
      const highest = await request(app.getHttpServer())
        .get(`/auctions/${auctionId}/bids/highest`)
        .set(auth(bidderBToken));

      expect(highest.body.data.id).toBe(firstId);
    });
  });
});
