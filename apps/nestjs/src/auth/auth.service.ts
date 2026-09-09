import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { Repository } from 'typeorm';
import { UserStatus } from '../common/enums/user-status.enum.js';
import { PasswordResetToken } from '../users/entities/password-reset-token.entity.js';
import { User } from '../users/entities/user.entity.js';
import { UsersService } from '../users/users.service.js';
import type { JwtPayload } from './interfaces/jwt-payload.interface.js';

const RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1 jam

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    @InjectRepository(PasswordResetToken)
    private readonly resetTokenRepo: Repository<PasswordResetToken>,
  ) {}

  /** Validasi email + password. Return null jika gagal (tidak throw). */
  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      return null;
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);

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

  /** Ambil profil user saat ini. */
  async getProfile(userId: string): Promise<Omit<User, 'passwordHash'>> {
    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Hapus passwordHash dari response
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash: _, ...profile } = user;
    return profile as Omit<User, 'passwordHash'>;
  }

  /**
   * Buat token reset password.
   * Selalu return success — tidak reveal apakah email terdaftar.
   * Token di-log ke console (development). Tidak dikembalikan via API.
   */
  async forgotPassword(email: string): Promise<void> {
    const user = await this.usersService.findByEmail(email);

    if (!user || user.status !== UserStatus.ACTIVE) {
      // Diam-diam skip agar tidak reveal apakah email ada
      return;
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');

    const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MS);

    await this.resetTokenRepo.save(
      this.resetTokenRepo.create({ userId: user.id, tokenHash, expiresAt }),
    );

    // Di production, kirim email. Untuk sekarang, log ke console.
    this.logger.log(
      `[DEV] Password reset token for ${email}: ${rawToken}`,
    );
  }

  /** Reset password dengan token yang valid. */
  async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    const tokenHash = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');

    const record = await this.resetTokenRepo.findOne({
      where: { tokenHash },
      relations: { user: true },
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

    const passwordHash = await bcrypt.hash(newPassword, 12);

    // Update password dan mark token sebagai used
    await Promise.all([
      this.resetTokenRepo.manager
        .getRepository(User)
        .update(record.userId, { passwordHash }),
      this.resetTokenRepo.update(record.id, { usedAt: new Date() }),
    ]);
  }
}
