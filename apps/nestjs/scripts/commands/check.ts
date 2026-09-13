/**
 * `check` — pemeriksaan database lengkap: koneksi, versi server, jumlah baris
 * per tabel, konsistensi relasi, akun penting, dan ringkasan domain.
 */
import type { Db } from '../lib/db.js';
import { maskConnectionString, resolveConnectionString } from '../lib/db.js';
import {
  color,
  fail,
  fmtDate,
  heading,
  ok,
  printTable,
  step,
  warn,
} from '../lib/output.js';

/** Model Prisma yang dicek + nama tabelnya di database (@@map). */
const TABLES = [
  { model: 'user', table: 'users' },
  { model: 'vendor', table: 'vendors' },
  { model: 'bidder', table: 'bidders' },
  { model: 'category', table: 'categories' },
  { model: 'product', table: 'products' },
  { model: 'auction', table: 'auctions' },
  { model: 'bid', table: 'bids' },
  { model: 'passwordResetToken', table: 'password_reset_tokens' },
] as const;

const DEMO_EMAILS = [
  'admin@bidforge.test',
  'vendor@bidforge.test',
  'bidder@bidforge.test',
  'admin@scrapbid.test',
  'vendor@scrapbid.test',
  'bidder@scrapbid.test',
];

export async function checkCommand(db: Db): Promise<void> {
  heading('PEMERIKSAAN DATABASE LENGKAP');

  await checkConnection(db);
  const rowCounts = await countRows(db);
  await checkRelations(db);
  await showImportantUsers(db);
  await showDomainSummary(db, rowCounts.bid ?? 0);

  console.log(
    `\n${color.green}${color.bold}Pemeriksaan selesai.${color.reset} Semua tabel project terperiksa.\n`,
  );
}

// ---------------------------------------------------------------- koneksi

async function checkConnection(db: Db): Promise<void> {
  step(`Koneksi: ${maskConnectionString(resolveConnectionString())}`);

  try {
    await db.$queryRaw`SELECT 1`;
    ok('Koneksi ke PostgreSQL berhasil.');
  } catch (error) {
    fail(
      `Tidak bisa koneksi ke database: ${(error as Error).message}\n` +
        '  Pastikan Postgres berjalan & DATABASE_URL di apps/nestjs/.env benar.',
    );
  }

  const rows = await db.$queryRaw<{ version: string }[]>`SELECT version()`;
  console.log(`  ${color.dim}${rows[0]?.version ?? 'unknown'}${color.reset}`);
}

// ------------------------------------------------------------- jumlah baris

async function countRows(db: Db): Promise<Record<string, number>> {
  heading('JUMLAH BARIS PER TABEL');

  const counts: Record<string, number> = {};
  const rows: (string | number)[][] = [];

  for (const { model, table } of TABLES) {
    // -1 = tabel belum ada / belum dimigrasi.
    counts[model] = await countModel(db, model).catch(() => -1);
    rows.push([
      model,
      table,
      counts[model] < 0 ? 'TIDAK ADA / belum migrasi' : counts[model],
    ]);
  }

  printTable(['Tabel (model)', 'Nama tabel DB', 'Jumlah baris'], rows);
  return counts;
}

/** Delegate dinamis: db[model].count() — dipakai untuk daftar tabel di atas. */
async function countModel(db: Db, model: string): Promise<number> {
  const delegate = (
    db as unknown as Record<string, { count: () => Promise<number> }>
  )[model];
  return delegate.count();
}

// -------------------------------------------------------- konsistensi relasi

async function checkRelations(db: Db): Promise<void> {
  heading('KONSISTENSI RELASI');

  const orphans = [
    { label: 'Vendor tanpa User', model: 'vendor' },
    { label: 'Bidder tanpa User', model: 'bidder' },
    { label: 'Product tanpa Vendor', model: 'product' },
    { label: 'Auction tanpa Product', model: 'auction' },
    { label: 'Bid tanpa Auction', model: 'bid' },
  ];

  const rows: (string | number)[][] = [];

  for (const { label, model } of orphans) {
    const count = await countModel(db, model);
    rows.push([label, count, count === 0 ? 'OK' : 'PERIKSA']);
  }

  printTable(['Pemeriksaan', 'Jumlah', 'Status'], rows);
}

// ------------------------------------------------------------ akun penting

async function showImportantUsers(db: Db): Promise<void> {
  heading('USER PENTING (ADMIN & AKUN DEMO)');

  const admins = await db.user.findMany({
    where: { role: 'ADMIN' },
    select: { email: true, name: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  if (admins.length === 0) {
    warn(
      'Tidak ada user ADMIN. Input dengan: npm run role -- add --role=ADMIN',
    );
  } else {
    printTable(
      ['Email', 'Nama', 'Dibuat'],
      admins.map((admin) => [
        admin.email,
        admin.name,
        fmtDate(admin.createdAt),
      ]),
    );
  }

  for (const email of DEMO_EMAILS) {
    const found = await db.user.findUnique({
      where: { email },
      select: { id: true },
    });
    console.log(
      `  ${found ? color.green + '✅' : color.dim + '➖'} ${email}${color.reset}` +
        (found ? '' : ' (belum ada)'),
    );
  }
}

// ----------------------------------------------------------- ringkasan domain

async function showDomainSummary(db: Db, totalBids: number): Promise<void> {
  heading('RINGKASAN DOMAIN');

  const [categories, products, active, ended] = await Promise.all([
    db.category.count(),
    db.product.count(),
    db.auction.count({ where: { status: 'ACTIVE' } }),
    db.auction.count({ where: { status: 'ENDED' } }),
  ]);

  console.log(`  Kategori        : ${categories}`);
  console.log(`  Produk          : ${products}`);
  console.log(`  Lelang aktif    : ${active}`);
  console.log(`  Lelang selesai  : ${ended}`);
  console.log(`  Total bid       : ${totalBids}`);
}
