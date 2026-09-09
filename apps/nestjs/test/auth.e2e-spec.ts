import {
  INestApplication,
  Module,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { CommonModule } from '../src/common/common.module.js';
import { UserRole } from '../src/common/enums/user-role.enum.js';
import { UserStatus } from '../src/common/enums/user-status.enum.js';
import { AuthController } from '../src/auth/auth.controller.js';
import { AuthService } from '../src/auth/auth.service.js';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../src/auth/guards/roles.guard.js';
import { JwtStrategy } from '../src/auth/strategies/jwt.strategy.js';
import { LocalStrategy } from '../src/auth/strategies/local.strategy.js';
import { PasswordResetToken } from '../src/users/entities/password-reset-token.entity.js';
import { User } from '../src/users/entities/user.entity.js';
import { UsersService } from '../src/users/users.service.js';
import * as crypto from 'crypto';

// ─── Stubs ────────────────────────────────────────────────────────────────────

const ACTIVE_USER: User = {
  id: 'user-active',
  email: 'admin@scrapbid.test',
  passwordHash: '',
  firstName: 'Admin',
  lastName: 'User',
  role: UserRole.ADMIN,
  status: UserStatus.ACTIVE,
  companyId: null,
  company: null,
  createdAt: new Date(),
  updatedAt: new Date(),
} as User;

const INACTIVE_USER: User = {
  ...ACTIVE_USER,
  id: 'user-inactive',
  email: 'inactive@scrapbid.test',
  status: UserStatus.INACTIVE,
};

const SELLER_USER: User = {
  ...ACTIVE_USER,
  id: 'user-seller',
  email: 'seller@scrapbid.test',
  role: UserRole.SELLER,
};

// Password stubs — set in beforeAll
let ACTIVE_USER_PASSWORD_HASH: string;
let INACTIVE_USER_PASSWORD_HASH: string;
let SELLER_USER_PASSWORD_HASH: string;

// ─── Mock UsersService ─────────────────────────────────────────────────────────

class MockUsersService {
  findByEmail(email: string): User | null {
    const map: Record<string, User> = {
      [ACTIVE_USER.email]: ACTIVE_USER,
      [INACTIVE_USER.email]: INACTIVE_USER,
      [SELLER_USER.email]: SELLER_USER,
    };
    return map[email] ?? null;
  }

  findById(id: string): User | null {
    const map: Record<string, User> = {
      [ACTIVE_USER.id]: ACTIVE_USER,
      [INACTIVE_USER.id]: INACTIVE_USER,
      [SELLER_USER.id]: SELLER_USER,
    };
    return map[id] ?? null;
  }
}

// ─── Mock PasswordResetToken Repository ───────────────────────────────────────

const tokenStore = new Map<string, PasswordResetToken>();

class MockResetTokenRepo {
  create(data: Partial<PasswordResetToken>): Partial<PasswordResetToken> {
    return data;
  }

  async save(token: Partial<PasswordResetToken>): Promise<void> {
    tokenStore.set(token.tokenHash!, token as PasswordResetToken);
  }

  async findOne({ where }: { where: { tokenHash: string }; relations?: string[] }): Promise<PasswordResetToken | null> {
    const found = tokenStore.get(where.tokenHash);
    if (!found) return null;
    // Attach user relation
    const user = new MockUsersService().findById(found.userId!);
    return { ...found, user: user! } as PasswordResetToken;
  }

  async update(id: string, data: Partial<PasswordResetToken>): Promise<void> {
    for (const [key, val] of tokenStore) {
      if (val.id === id) {
        tokenStore.set(key, { ...val, ...data });
        break;
      }
    }
  }

  manager = {
    getRepository: () => ({
      update: async () => undefined,
    }),
  };
}

// ─── Test Module ──────────────────────────────────────────────────────────────

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: true,
    }),
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
    { provide: UsersService, useClass: MockUsersService },
    { provide: 'PasswordResetTokenRepository', useClass: MockResetTokenRepo },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
class AuthTestModule {}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;

  beforeAll(async () => {
    // Hash password sebelum test berjalan
    [ACTIVE_USER_PASSWORD_HASH, INACTIVE_USER_PASSWORD_HASH, SELLER_USER_PASSWORD_HASH] =
      await Promise.all([
        bcrypt.hash('Password1!', 10),
        bcrypt.hash('Password1!', 10),
        bcrypt.hash('Password1!', 10),
      ]);

    ACTIVE_USER.passwordHash = ACTIVE_USER_PASSWORD_HASH;
    INACTIVE_USER.passwordHash = INACTIVE_USER_PASSWORD_HASH;
    SELLER_USER.passwordHash = SELLER_USER_PASSWORD_HASH;

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

  // ── POST /auth/login ────────────────────────────────────────────────────────

  describe('POST /auth/login', () => {
    it('returns 200 and accessToken on valid credentials', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: ACTIVE_USER.email, password: 'Password1!' });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('accessToken');
    });

    it('returns 401 on wrong password', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: ACTIVE_USER.email, password: 'wrongpass' });

      expect(res.status).toBe(401);
    });

    it('returns 401 for INACTIVE user', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: INACTIVE_USER.email, password: 'Password1!' });

      expect(res.status).toBe(401);
    });

    it('returns 400 on missing fields', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'bad-email' });

      expect(res.status).toBe(400);
    });
  });

  // ── GET /auth/me ────────────────────────────────────────────────────────────

  describe('GET /auth/me', () => {
    it('returns 401 without token', async () => {
      const res = await request(app.getHttpServer()).get('/auth/me');
      expect(res.status).toBe(401);
    });

    it('returns profile for authenticated user', async () => {
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
      expect(res.body.data).not.toHaveProperty('passwordHash');
    });
  });

  // ── POST /auth/forgot-password ──────────────────────────────────────────────

  describe('POST /auth/forgot-password', () => {
    it('always returns 200 regardless of email existence', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: 'nonexistent@test.com' });

      expect(res.status).toBe(200);
    });

    it('returns 200 for existing active user', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: ACTIVE_USER.email });

      expect(res.status).toBe(200);
      expect(res.body.data).not.toHaveProperty('token');
    });

    it('returns 400 for invalid email format', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: 'not-an-email' });

      expect(res.status).toBe(400);
    });
  });

  // ── POST /auth/reset-password ───────────────────────────────────────────────

  describe('POST /auth/reset-password', () => {
    it('resets password with a valid token', async () => {
      // 1. Generate token
      const rawToken = 'e2e-test-valid-token';
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      tokenStore.set(tokenHash, {
        id: 'prt-1',
        userId: ACTIVE_USER.id,
        user: ACTIVE_USER,
        tokenHash,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        usedAt: null,
        createdAt: new Date(),
      } as PasswordResetToken);

      // 2. Reset password
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

  // ── RBAC ────────────────────────────────────────────────────────────────────

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

    it('allows SELLER to access /auth/me (no role restriction on me)', async () => {
      const token = jwtService.sign({
        sub: SELLER_USER.id,
        userId: SELLER_USER.id,
        email: SELLER_USER.email,
        role: UserRole.SELLER,
      });

      const res = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
    });
  });
});
