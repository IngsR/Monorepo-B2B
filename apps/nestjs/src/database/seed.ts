/**
 * Seed script - creates default users for local development.
 *
 * Run: npx tsx --env-file=.env src/database/seed.ts
 *
 * Uses Prisma so the data matches the final domain model
 * (ADMIN / VENDOR / BIDDER, `name`, hashed `password`).
 */
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import { PrismaClient } from '../../generated/prisma/client.js';

const connectionString =
  process.env.DATABASE_URL ??
  `postgresql://${process.env.DATABASE_USER ?? 'postgres'}:${process.env.DATABASE_PASSWORD ?? ''}@${process.env.DATABASE_HOST ?? 'localhost'}:${process.env.DATABASE_PORT ?? 5432}/${process.env.DATABASE_NAME ?? 'scrapbid'}`;

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const SEED_PASSWORD = 'Password123';

/**
 * Example auction categories.
 *
 * Categories are a flat, admin-managed list — the admin can add, rename and
 * remove them at runtime through the API. These are only a starting set so the
 * marketplace has something to filter by on a fresh database.
 */
const CATEGORIES = [
  'Surat Berharga',
  'Kendaraan',
  'Rumah & Properti',
  'Elektronik',
  'Mesin & Peralatan Industri',
  'Tanah & Bangunan',
];

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

  const categoryIdByName = new Map<string, string>();
  for (const name of CATEGORIES) {
    const category = await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    categoryIdByName.set(name, category.id);
    console.log(`  ✅ Seeded category: ${name}`);
  }

  // Role profiles: a vendor and a bidder need a profile row so the UI can
  // resolve ownership (the marketplace and "my …" screens depend on it).
  const vendorUser = await prisma.user.findUniqueOrThrow({
    where: { email: 'vendor@scrapbid.test' },
  });
  const bidderUser = await prisma.user.findUniqueOrThrow({
    where: { email: 'bidder@scrapbid.test' },
  });

  const vendor = await prisma.vendor.upsert({
    where: { userId: vendorUser.id },
    update: {},
    create: {
      userId: vendorUser.id,
      companyName: 'Nusantara Asset Auctioneers',
      companyAddress: 'Jl. Jenderal Sudirman No. 45, Jakarta',
      phone: '+62 21 5550 1234',
    },
  });
  console.log(`  ✅ Seeded vendor profile: ${vendor.companyName}`);

  await prisma.bidder.upsert({
    where: { userId: bidderUser.id },
    update: {},
    create: {
      userId: bidderUser.id,
      phone: '+62 812 3456 7890',
      address: 'Jl. Gatot Subroto No. 12, Bandung',
    },
  });
  console.log('  ✅ Seeded bidder profile');

  // Sample lots so the marketplace is not empty on a fresh database.
  const now = Date.now();
  const HOUR = 3_600_000;
  const DAY = 24 * HOUR;

  const products: {
    code: string;
    name: string;
    description: string;
    category: string;
    startingPrice: string;
    increment: string;
    startOffset: number;
    endOffset: number;
    status: 'ACTIVE' | 'SCHEDULED' | 'ENDED';
  }[] = [
    {
      code: 'PRD-SBN-001',
      name: 'Obligasi Negara Ritel SR021',
      description:
        'Surat berharga negara ritel seri SR021 dengan kupon tetap. Instrumen investasi pemerintah yang aman dan likuid.',
      category: 'Surat Berharga',
      startingPrice: '10000000.00',
      increment: '250000.00',
      startOffset: -2 * DAY,
      endOffset: 2 * DAY,
      status: 'ACTIVE',
    },
    {
      code: 'PRD-KND-002',
      name: 'Toyota Land Cruiser 2020 — Unit Dinas',
      description:
        'Kendaraan dinas roda 4, kondisi terawat, kilometer rendah. Dijual sesuai kondisi (as is).',
      category: 'Kendaraan',
      startingPrice: '675000.00',
      increment: '5000000.00',
      startOffset: -1 * DAY,
      endOffset: 3 * DAY,
      status: 'ACTIVE',
    },
    {
      code: 'PRD-RMH-003',
      name: 'Rumah Tinggal 2 Lantai — Kebayoran',
      description:
        'Rumah tinggal dua lantai dengan luas tanah 180 m², lokasi strategis dekat pusat bisnis.',
      category: 'Rumah & Properti',
      startingPrice: '2450000.00',
      increment: '25000000.00',
      startOffset: 2 * HOUR,
      endOffset: 4 * DAY,
      status: 'SCHEDULED',
    },
    {
      code: 'PRD-ELK-004',
      name: 'Server Rack & Network Switch — Batch 12 Unit',
      description:
        'Peralatan jaringan bekas pakai data center: rack server dan switch managed, dijual per batch.',
      category: 'Elektronik',
      startingPrice: '85000000.00',
      increment: '2000000.00',
      startOffset: -5 * DAY,
      endOffset: -1 * DAY,
      status: 'ENDED',
    },
  ];

  let auctionSeq = 1;
  for (const p of products) {
    const categoryId = categoryIdByName.get(p.category) ?? null;

    const product = await prisma.product.upsert({
      where: { code: p.code },
      update: { name: p.name, description: p.description, categoryId },
      create: {
        code: p.code,
        name: p.name,
        description: p.description,
        categoryId,
        vendorId: vendor.id,
      },
    });

    const startAt = new Date(now + p.startOffset);
    const endAt = new Date(now + p.endOffset);
    const auctionCode = `AUC-SEED-${String(auctionSeq++).padStart(3, '0')}`;

    await prisma.auction.upsert({
      where: { code: auctionCode },
      update: {
        startingPrice: p.startingPrice,
        currentPrice: p.startingPrice,
        bidIncrement: p.increment,
        startAt,
        endAt,
        status: p.status,
      },
      create: {
        code: auctionCode,
        productId: product.id,
        startingPrice: p.startingPrice,
        currentPrice: p.startingPrice,
        bidIncrement: p.increment,
        startAt,
        endAt,
        status: p.status,
      },
    });
    console.log(`  ✅ Seeded lot: ${p.name} (${p.status})`);
  }

  console.log('\n🎉 Seed complete!');
}

seed()
  .catch((err) => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
