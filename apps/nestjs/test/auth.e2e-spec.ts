import { INestApplication, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import request from 'supertest';
import { CommonModule } from '../src/common/common.module.js';
import { UserRole } from '../src/common/enums/user-role.enum.js';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../src/auth/guards/roles.guard.js';
import { JwtStrategy } from '../src/auth/strategies/jwt.strategy.js';
import { LocalStrategy } from '../src/auth/strategies/local.strategy.js';
import { AuthController } from '../src/auth/auth.controller.js';
import { AuthService } from '../src/auth/auth.service.js';
import { PrismaService } from '../src/database/prisma.service.js';
import type { User } from '../src/database/prisma.types.js';
import { UsersService } from '../src/users/users.service.js';

// ─── Fixtures ───────────────────────────────

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-active',
    email: 'admin@scrapbid.test',
    password: '',
    name: 'Admin User',
    role: UserRole.ADMIN,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as User;
}

const ACTIVE_USER = makeUser();
const BIDDER_USER = makeUser({
  id: 'user-bidder',
  email: 'bidder@scrapbid.test',
  name: 'Bidder User',
  role: UserRole.BIDDER,
});

// ─── Mocks ──────────────────

class MockUsersService {
  constructor(private readonly users: User[]) {}

  findByEmail(email: string): User | null {
    return this.users.find((u) => u.email === email) ?? null;
  }

  findById(id: string): User | null {
    return this.users.find((u) => u.id === id) ?? null;
  }
}

type ResetTokenRecord = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
};

const tokenStore = new Map<string, ResetTokenRecord>();

class MockPrismaService {
  passwordResetToken = {
    create: async ({ data }: { data: ResetTokenRecord }): Promise<unknown> => {
      tokenStore.set(data.tokenHash, { id: 'prt-1', ...data, usedAt: null });
      return data;
    },
    findFirst: async ({
      where,
    }: {
      where: { tokenHash: string };
    }): Promise<ResetTokenRecord | null> =>
      tokenStore.get(where.tokenHash) ?? null,
    update: async (): Promise<unknown> => undefined,
  };

  user = {
    update: async (): Promise<unknown> => undefined,
  };

  $transaction = async (ops: Promise<unknown>[]): Promise<unknown[]> =>
    Promise.all(ops);
}

// ─── Test module ────────────────────────────

const usersServiceInstance = new MockUsersService([ACTIVE_USER, BIDDER_USER]);

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
  controllers: [AuthController],
  providers: [
    AuthService,
    LocalStrategy,
    JwtStrategy,
    { provide: UsersService, useValue: usersServiceInstance },
    { provide: PrismaService, useClass: MockPrismaService },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
class AuthTestModule {}

// ─── Tests ──────────────────

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  beforeAll(async () => {
    const password = await bcrypt.hash('Password123', 10);
    ACTIVE_USER.password = password;
    BIDDER_USER.password = password;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AuthTestModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    jwtService = moduleFixture.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
    tokenStore.clear();
  });

  describe('POST /auth/login', () => {
    it('returns 200 and accessToken on valid credentials', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: ACTIVE_USER.email, password: 'Password123' });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('accessToken');
    });

    it('returns 401 on wrong password', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: ACTIVE_USER.email, password: 'wrongpass' });

      expect(res.status).toBe(401);
    });

    it('returns 400 on missing fields', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'bad-email' });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /auth/me', () => {
    it('returns 401 without token', async () => {
      const res = await request(app.getHttpServer()).get('/auth/me');
      expect(res.status).toBe(401);
    });

    it('returns profile without password for authenticated user', async () => {
      const token = jwtService.sign({
        sub: ACTIVE_USER.id,
        userId: ACTIVE_USER.id,
        email: ACTIVE_USER.email,
        role: ACTIVE_USER.role,
      });

      const res = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({
        email: ACTIVE_USER.email,
        role: UserRole.ADMIN,
      });
      expect(res.body.data).not.toHaveProperty('password');
    });
  });

  describe('POST /auth/forgot-password', () => {
    it('always returns 200 regardless of email existence', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: 'nonexistent@test.com' });

      expect(res.status).toBe(200);
    });

    it('returns 400 for invalid email format', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: 'not-an-email' });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /auth/reset-password', () => {
    it('resets password with a valid token', async () => {
      const rawToken = 'e2e-test-valid-token';
      const tokenHash = crypto
        .createHash('sha256')
        .update(rawToken)
        .digest('hex');

      tokenStore.set(tokenHash, {
        id: 'prt-1',
        userId: ACTIVE_USER.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        usedAt: null,
      });

      const res = await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token: rawToken, newPassword: 'NewSecure1!' });

      expect(res.status).toBe(200);
    });

    it('returns 400 for invalid token', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token: 'invalid-token', newPassword: 'NewSecure1!' });

      expect(res.status).toBe(400);
    });

    it('returns 400 for newPassword shorter than 8 chars', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token: 'any-token', newPassword: 'short' });

      expect(res.status).toBe(400);
    });
  });

  describe('RBAC', () => {
    it('allows ADMIN to access /auth/me', async () => {
      const token = jwtService.sign({
        sub: ACTIVE_USER.id,
        userId: ACTIVE_USER.id,
        email: ACTIVE_USER.email,
        role: UserRole.ADMIN,
      });

      const res = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
    });

    it('allows BIDDER to access /auth/me (no role restriction)', async () => {
      const token = jwtService.sign({
        sub: BIDDER_USER.id,
        userId: BIDDER_USER.id,
        email: BIDDER_USER.email,
        role: UserRole.BIDDER,
      });

      const res = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
    });
  });
});
