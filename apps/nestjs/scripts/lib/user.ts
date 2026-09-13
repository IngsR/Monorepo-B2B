/**
 * Operasi user & profil role. Semua query Prisma untuk user ada di sini.
 */
import * as bcrypt from 'bcrypt';
import type { Db } from './db.js';
import { fail } from './output.js';

/** Putaran bcrypt. AuthService & UsersService memakai 12 — samakan. */
export const BCRYPT_ROUNDS = 12;

/** Password default saat tidak diberikan lewat argumen. */
export const DEFAULT_PASSWORD = 'Password123';

/** Role yang valid (mengikuti enum UserRole di schema.prisma). */
export const VALID_ROLES = ['ADMIN', 'VENDOR', 'BIDDER'] as const;

export type Role = (typeof VALID_ROLES)[number];

export function parseRole(value: string): Role {
  const role = value.toUpperCase() as Role;

  if (!VALID_ROLES.includes(role)) {
    fail(`Role "${value}" tidak valid. Pilihan: ${VALID_ROLES.join(', ')}`);
  }

  return role;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** 'budi.santoso@mail.test' -> 'Budi Santoso'. */
export function nameFromEmail(email: string): string {
  return email
    .split('@')[0]
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export interface UserInput {
  email: string;
  password: string;
  name: string;
  role: Role;
}

async function hashPassword(plain: string): Promise<string> {
  if (plain.length < 6) fail('Password minimal 6 karakter.');
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

/** Buat / perbarui user. Pakai upsert agar aman dijalankan berulang. */
export async function upsertUser(db: Db, input: UserInput) {
  const password = await hashPassword(input.password);

  return db.user.upsert({
    where: { email: input.email },
    update: { password, name: input.name, role: input.role },
    create: {
      email: input.email,
      password,
      name: input.name,
      role: input.role,
    },
  });
}

/** Ganti password user yang sudah ada. Kembalikan false kalau user tidak ada. */
export async function updatePassword(
  db: Db,
  email: string,
  plain: string,
): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (!user) return false;

  await db.user.update({
    where: { id: user.id },
    data: { password: await hashPassword(plain) },
  });

  return true;
}

/**
 * Pastikan user VENDOR / BIDDER punya baris profil.
 * Tanpa profil, UI marketplace & "my ..." screen tidak bisa resolve owner.
 */
export async function ensureRoleProfile(
  db: Db,
  user: { id: string; name: string; role: string },
): Promise<string> {
  if (user.role === 'VENDOR') {
    const vendor = await db.vendor.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        companyName: `${user.name} Co.`,
        companyAddress: '-',
      },
    });
    return `profil Vendor (${vendor.companyName})`;
  }

  if (user.role === 'BIDDER') {
    await db.bidder.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id },
    });
    return 'profil Bidder';
  }

  return 'tidak perlu profil tambahan (ADMIN)';
}
