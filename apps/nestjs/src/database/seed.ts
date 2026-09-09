/**
 * Seed script - creates default users for local development.
 * Run: npx tsx --env-file=.env src/database/seed.ts
 */
import pg from 'pg';
import * as bcrypt from 'bcrypt';

const { Client } = pg;

const client = new Client({
  host: process.env.DATABASE_HOST ?? 'localhost',
  port: Number(process.env.DATABASE_PORT ?? 5432),
  user: process.env.DATABASE_USER ?? 'postgres',
  password: process.env.DATABASE_PASSWORD ?? '',
  database: process.env.DATABASE_NAME ?? 'scrapbid',
});

async function seed() {
  await client.connect();
  console.log('✅ Connected to database');

  const hash = await bcrypt.hash('Password123', 10);

  // Insert company
  await client.query(`
    INSERT INTO companies (id, name, code, status, "createdAt", "updatedAt")
    VALUES (gen_random_uuid(), 'ScrapBid HQ', 'SCRAPBID', 'ACTIVE', NOW(), NOW())
    ON CONFLICT DO NOTHING
  `);

  const res = await client.query(
    `SELECT id FROM companies WHERE code = 'SCRAPBID' LIMIT 1`,
  );
  const companyId = res.rows[0]?.id ?? null;

  const users = [
    { email: 'admin@scrapbid.test', firstName: 'Admin', lastName: 'User', role: 'ADMIN', companyId: null },
    { email: 'seller@scrapbid.test', firstName: 'Seller', lastName: 'User', role: 'SELLER', companyId },
    { email: 'vendor@scrapbid.test', firstName: 'Vendor', lastName: 'User', role: 'VENDOR', companyId },
  ];

  for (const u of users) {
    await client.query(
      `INSERT INTO users (id, email, "passwordHash", "firstName", "lastName", role, status, "companyId", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'ACTIVE', $6, NOW(), NOW())
       ON CONFLICT (email) DO UPDATE SET "passwordHash" = EXCLUDED."passwordHash"`,
      [u.email, hash, u.firstName, u.lastName, u.role, u.companyId],
    );
    console.log(`  ✅ Seeded: ${u.email} (${u.role}) — password: Password123`);
  }

  await client.end();
  console.log('\n🎉 Seed complete!');
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
