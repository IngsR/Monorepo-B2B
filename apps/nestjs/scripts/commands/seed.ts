/**
 * `seed` — 3 user dasar (admin/vendor/bidder) + profil role + kategori awal.
 *
 * Untuk data demo lengkap (produk & lelang) pakai: npm run seed
 * (src/database/seed.ts).
 */
import type { Db } from '../lib/db.js';
import { color, heading, ok } from '../lib/output.js';
import { DEFAULT_PASSWORD, ensureRoleProfile, upsertUser, type Role } from '../lib/user.js';

const USERS: { email: string; name: string; role: Role }[] = [
  { email: 'admin@bidforge.test', name: 'Admin User', role: 'ADMIN' },
  { email: 'vendor@bidforge.test', name: 'Vendor User', role: 'VENDOR' },
  { email: 'bidder@bidforge.test', name: 'Bidder User', role: 'BIDDER' },
  { email: 'admin@scrapbid.test', name: 'Admin User', role: 'ADMIN' },
  { email: 'vendor@scrapbid.test', name: 'Vendor User', role: 'VENDOR' },
  { email: 'bidder@scrapbid.test', name: 'Bidder User', role: 'BIDDER' },
];

/** Kategori awal; admin bisa menambah/mengubah lewat API kapan saja. */
const CATEGORIES = [
  'Surat Berharga',
  'Kendaraan',
  'Rumah & Properti',
  'Elektronik',
  'Mesin & Peralatan Industri',
  'Tanah & Bangunan',
];

export async function seedCommand(db: Db): Promise<void> {
  heading('SEED USER DASAR & KATEGORI');

  for (const user of USERS) {
    const saved = await upsertUser(db, { ...user, password: DEFAULT_PASSWORD });
    await ensureRoleProfile(db, saved);
    ok(`Seeded ${user.email} (${user.role}) — password: ${DEFAULT_PASSWORD}`);
  }

  for (const name of CATEGORIES) {
    await db.category.upsert({ where: { name }, update: {}, create: { name } });
    ok(`Seeded kategori: ${name}`);
  }

  console.log(
    `\n${color.green}${color.bold}Seed selesai.${color.reset} ` +
      'Untuk data demo lengkap (produk & lelang) jalankan: npm run seed\n',
  );
}
