import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../database/prisma.service.js';
import {
  toPublicUser,
  type PublicUser,
  type User,
} from '../database/prisma.types.js';
import { UsersService } from '../users/users.service.js';
import type { JwtPayload } from './interfaces/jwt-payload.interface.js';

const RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1 jam

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  /** Validasi email + password. Return null jika gagal (tidak throw). */
  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      return null;
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return null;
    }

    return user;
  }

  /** Buat JWT access token setelah login sukses. */
  login(user: User): { accessToken: string } {
    const payload: JwtPayload = {
      sub: user.id,
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    return { accessToken: this.jwtService.sign(payload) };
  }

  /** Ambil profil user saat ini (tanpa password). */
  async getProfile(userId: string): Promise<PublicUser> {
    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return toPublicUser(user);
  }

  /**
   * Buat token reset password.
   * Selalu return sukses — tidak reveal apakah email terdaftar.
   * Token di-log ke console (development). Tidak dikembalikan via API.
   */
  async forgotPassword(email: string): Promise<void> {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      // Diam-diam skip agar tidak reveal apakah email ada
      return;
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');

    const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MS);

    await this.prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    // Di production, kirim email. Untuk sekarang, log ke console.
    this.logger.log(`[DEV] Password reset token for ${email}: ${rawToken}`);
  }

  /** Reset password dengan token yang valid. */
  async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    const tokenHash = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');

    const record = await this.prisma.passwordResetToken.findFirst({
      where: { tokenHash },
    });

    if (!record) {
      throw new BadRequestException('Invalid or expired token');
    }

    if (record.usedAt) {
      throw new BadRequestException('Token has already been used');
    }

    if (record.expiresAt < new Date()) {
      throw new BadRequestException('Token has expired');
    }

    const password = await bcrypt.hash(newPassword, 12);

    // Update password dan mark token sebagai used — atomik.
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { password },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
    ]);
  }
}
