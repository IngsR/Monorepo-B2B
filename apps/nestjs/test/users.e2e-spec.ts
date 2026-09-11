import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { UserRole } from '../src/common/enums/user-role.enum.js';
import { InMemoryPrisma } from './support/in-memory-prisma.js';

process.env.NODE_ENV = 'test';
process.env.PORT = process.env.PORT ?? '0';
process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://test:test@localhost:5432/test';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret';
process.env.CORS_ORIGIN = process.env.CORS_ORIGIN ?? '*';

/**
 * Integration/E2E for the user-management surface: role guards, the current
 * user's own endpoints, change-password, and — critically — that no sensitive
 * field (password hash) ever appears in a response body.
 */

const ADMIN_EMAIL = 'admin@users.test';
const VENDOR_EMAIL = 'vendor@users.test';
const BIDDER_EMAIL = 'bidder@users.test';
const PASSWORD = 'Password123';

const prisma = new InMemoryPrisma();

describe('Users surface (e2e)', () => {
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

    const login = async (
      email: string,
      password = PASSWORD,
    ): Promise<string> => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password });
      return res.body.data?.accessToken as string;
    };

    adminToken = await login(ADMIN_EMAIL);
    vendorToken = await login(VENDOR_EMAIL);
    bidderToken = await login(BIDDER_EMAIL);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /users (ADMIN only)', () => {
    it('requires authentication (401)', async () => {
      const res = await request(app.getHttpServer()).get('/users');
      expect(res.status).toBe(401);
    });

    it('rejects non-admin roles (403)', async () => {
      expect(
        (
          await request(app.getHttpServer())
            .get('/users')
            .set(auth(vendorToken))
        ).status,
      ).toBe(403);
      expect(
        (
          await request(app.getHttpServer())
            .get('/users')
            .set(auth(bidderToken))
        ).status,
      ).toBe(403);
    });

    it('ADMIN lists users in a paginated envelope without any password field', async () => {
      const res = await request(app.getHttpServer())
        .get('/users')
        .set(auth(adminToken));

      expect(res.status).toBe(200);
      const page = res.body.data;
      expect(Array.isArray(page.data)).toBe(true);
      expect(page.data.length).toBe(3);
      for (const u of page.data) {
        expect(u).not.toHaveProperty('password');
        expect(JSON.stringify(u)).not.toMatch(/password/i);
      }
    });
  });

  describe('GET /users/me', () => {
    it('returns the authenticated user without the password hash', async () => {
      const res = await request(app.getHttpServer())
        .get('/users/me')
        .set(auth(vendorToken));

      expect(res.status).toBe(200);
      expect(res.body.data.email).toBe(VENDOR_EMAIL);
      expect(res.body.data.role).toBe(UserRole.VENDOR);
      expect(res.body.data).not.toHaveProperty('password');
      expect(JSON.stringify(res.body)).not.toMatch(/password/i);
    });

    it('is not accessible without a token (401)', async () => {
      const res = await request(app.getHttpServer()).get('/users/me');
      expect(res.status).toBe(401);
    });
  });

  describe('PATCH /users/me/password', () => {
    it('rejects a wrong current password (401)', async () => {
      const res = await request(app.getHttpServer())
        .patch('/users/me/password')
        .set(auth(bidderToken))
        .send({
          currentPassword: 'wrong-password',
          newPassword: 'NewStrong123',
        });
      expect(res.status).toBe(401);
    });

    it('rejects a too-short new password (400)', async () => {
      const res = await request(app.getHttpServer())
        .patch('/users/me/password')
        .set(auth(bidderToken))
        .send({ currentPassword: PASSWORD, newPassword: 'short' });
      expect(res.status).toBe(400);
    });

    it('changes the password, then the old one stops working', async () => {
      const NEW = 'NewStrong123';

      const change = await request(app.getHttpServer())
        .patch('/users/me/password')
        .set(auth(bidderToken))
        .send({ currentPassword: PASSWORD, newPassword: NEW });
      expect(change.status).toBe(200);

      const oldLogin = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: BIDDER_EMAIL, password: PASSWORD });
      expect(oldLogin.status).toBe(401);

      const newLogin = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: BIDDER_EMAIL, password: NEW });
      expect(newLogin.status).toBe(200);
      expect(newLogin.body.data).toHaveProperty('accessToken');
    });
  });

  describe('POST /users (ADMIN only)', () => {
    it('rejects non-admin (403)', async () => {
      const res = await request(app.getHttpServer())
        .post('/users')
        .set(auth(vendorToken))
        .send({
          email: 'x@users.test',
          password: 'Password123',
          name: 'X',
          role: UserRole.BIDDER,
        });
      expect(res.status).toBe(403);
    });

    it('rejects a client-supplied id/createdAt (400, server-managed fields)', async () => {
      const res = await request(app.getHttpServer())
        .post('/users')
        .set(auth(adminToken))
        .send({
          id: '00000-0000-4000-8000-000',
          email: 'y@users.test',
          password: 'Password123',
          name: 'Y',
          role: UserRole.BIDDER,
        });
      expect(res.status).toBe(400);
    });

    it('ADMIN creates a user and the response excludes the password', async () => {
      const res = await request(app.getHttpServer())
        .post('/users')
        .set(auth(adminToken))
        .send({
          email: 'created@users.test',
          password: 'Password123',
          name: 'Created',
          role: UserRole.VENDOR,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.email).toBe('created@users.test');
      expect(res.body.data).not.toHaveProperty('password');
    });

    it('rejects a duplicate email (409)', async () => {
      const res = await request(app.getHttpServer())
        .post('/users')
        .set(auth(adminToken))
        .send({
          email: ADMIN_EMAIL,
          password: 'Password123',
          name: 'Dup',
          role: UserRole.ADMIN,
        });
      expect(res.status).toBe(409);
    });
  });
});
