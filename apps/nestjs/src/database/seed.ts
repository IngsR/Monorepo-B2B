/**
 * Seed script - creates default users for local development.
 *
 * Run: npx tsx --env-file=.env src/database/seed.ts
 *
 * Uses Prisma so the data matches the final domain model
 * (ADMIN / VENDOR / BIDDER, `name`, hashed `password`).
 */
import * as bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client.js';

const connectionString =
  process.env.DATABASE_URL ??
  `postgresql://${process.env.DATABASE_USER ?? 'postgres'}:${process.env.DATABASE_PASSWORD ?? ''}@${process.env.DATABASE_HOST ?? 'localhost'}:${process.env.DATABASE_PORT ?? 5432}/${process.env.DATABASE_NAME ?? 'scrapbid'}`;

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const SEED_PASSWORD = 'Password123';

async function seed(): Promise<void> {
  const password = await bcrypt.hash(SEED_PASSWORD, 10);

  const users = [
    {
      email: 'admin@scrapbid.test',
      name: 'Admin User',
      role: 'ADMIN' as const,
    },
    {
      email: 'vendor@scrapbid.test',
      name: 'Vendor User',
      role: 'VENDOR' as const,
    },
    {
      email: 'bidder@scrapbid.test',
      name: 'Bidder User',
      role: 'BIDDER' as const,
    },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { password, name: u.name, role: u.role },
      create: { email: u.email, password, name: u.name, role: u.role },
    });
    console.log(
      `  ✅ Seeded: ${u.email} (${u.role}) — password: ${SEED_PASSWORD}`,
    );
  }

  console.log('\n🎉 Seed complete!');
}

seed()
  .catch((err) => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
