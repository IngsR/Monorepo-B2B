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
 * Integration/E2E for the supporting domains: categories (flat, ADMIN-write),
 * and the "self" profile endpoints for vendors and bidders. These assert the
 * guard wiring and that `/me` never trusts a client-supplied id.
 */

const ADMIN_EMAIL = 'admin@support.test';
const VENDOR_EMAIL = 'vendor@support.test';
const BIDDER_EMAIL = 'bidder@support.test';
const PASSWORD = 'Password123';

const prisma = new InMemoryPrisma();

describe('Categories & profiles (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let vendorToken: string;
  let bidderToken: string;

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    await prisma.seed({
      users: [
        { email: ADMIN_EMAIL, name: 'Admin', role: UserRole.ADMIN },
        { email: VENDOR_EMAIL, name: 'Vendor', role: UserRole.VENDOR },
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

    adminToken = await login(ADMIN_EMAIL);
    vendorToken = await login(VENDOR_EMAIL);
    bidderToken = await login(BIDDER_EMAIL);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Categories', () => {
    let categoryId: string;

    it('lists categories for any authenticated user', async () => {
      const res = await request(app.getHttpServer())
        .get('/categories')
        .set(auth(bidderToken));
      expect(res.status).toBe(200);
      // Paginated envelope: { success, data: { data: [], meta }, message }.
      expect(Array.isArray(res.body.data.data)).toBe(true);
      expect(res.body.data.meta).toBeDefined();
    });

    it('rejects listing without a token (401)', async () => {
      const res = await request(app.getHttpServer()).get('/categories');
      expect(res.status).toBe(401);
    });

    it('rejects a non-admin create (403)', async () => {
      const res = await request(app.getHttpServer())
        .post('/categories')
        .set(auth(vendorToken))
        .send({ name: 'Metals' });
      expect(res.status).toBe(403);
    });

    it('rejects an empty name (400)', async () => {
      const res = await request(app.getHttpServer())
        .post('/categories')
        .set(auth(adminToken))
        .send({ name: '' });
      expect(res.status).toBe(400);
    });

    it('ADMIN creates a category', async () => {
      const res = await request(app.getHttpServer())
        .post('/categories')
        .set(auth(adminToken))
        .send({ name: 'Metals' });
      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('Metals');
      categoryId = res.body.data.id;
    });

    it('rejects a duplicate category name (409)', async () => {
      const res = await request(app.getHttpServer())
        .post('/categories')
        .set(auth(adminToken))
        .send({ name: 'Metals' });
      expect(res.status).toBe(409);
    });

    it('returns 404 for an unknown category', async () => {
      const res = await request(app.getHttpServer())
        .get('/categories/75000000-0000-4000-8000-aaaaaaaaaaaa')
        .set(auth(bidderToken));
      expect(res.status).toBe(404);
    });

    it('ADMIN updates and then deletes the category (204)', async () => {
      const update = await request(app.getHttpServer())
        .patch(`/categories/${categoryId}`)
        .set(auth(adminToken))
        .send({ name: 'Scrap Metals' });
      expect(update.status).toBe(200);
      expect(update.body.data.name).toBe('Scrap Metals');

      const del = await request(app.getHttpServer())
        .delete(`/categories/${categoryId}`)
        .set(auth(adminToken));
      expect(del.status).toBe(204);
    });
  });

  describe('Vendor profile (/vendors/me)', () => {
    it('VENDOR reads their own profile', async () => {
      const res = await request(app.getHttpServer())
        .get('/vendors/me')
        .set(auth(vendorToken));
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBeDefined();
    });

    it('rejects a BIDDER (403)', async () => {
      const res = await request(app.getHttpServer())
        .get('/vendors/me')
        .set(auth(bidderToken));
      expect(res.status).toBe(403);
    });

    it('VENDOR updates only their own profile', async () => {
      const res = await request(app.getHttpServer())
        .patch('/vendors/me')
        .set(auth(vendorToken))
        .send({ companyName: 'Renamed Co.' });
      expect(res.status).toBe(200);
      expect(res.body.data.companyName).toBe('Renamed Co.');
    });

    it('non-admin cannot list all vendors (403)', async () => {
      const res = await request(app.getHttpServer())
        .get('/vendors')
        .set(auth(vendorToken));
      expect(res.status).toBe(403);
    });
  });

  describe('Bidder profile (/bidders/me)', () => {
    it('BIDDER reads their own profile', async () => {
      const res = await request(app.getHttpServer())
        .get('/bidders/me')
        .set(auth(bidderToken));
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBeDefined();
    });

    it('rejects a VENDOR (403)', async () => {
      const res = await request(app.getHttpServer())
        .get('/bidders/me')
        .set(auth(vendorToken));
      expect(res.status).toBe(403);
    });

    it('BIDDER updates only their own profile', async () => {
      const res = await request(app.getHttpServer())
        .patch('/bidders/me')
        .set(auth(bidderToken))
        .send({ phone: '0812345' });
      expect(res.status).toBe(200);
      expect(res.body.data.phone).toBe('0812345');
    });

    it('non-admin cannot list all bidders (403)', async () => {
      const res = await request(app.getHttpServer())
        .get('/bidders')
        .set(auth(bidderToken));
      expect(res.status).toBe(403);
    });
  });
});
