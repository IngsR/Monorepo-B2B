/**
 * Satu-satunya tempat membuat PrismaClient untuk script CLI.
 *
 * CATATAN: client Prisma adalah generated code (apps/nestjs/generated/prisma),
 * jadi di-import pakai dynamic import supaya script tidak error saat file
 * generated belum ada. Semua import di file ini statis, jadi aman.
 */
import { pathToFileURL } from 'node:url';
import { PrismaPg } from '@prisma/adapter-pg';
import type { PrismaClient } from '../../generated/prisma/client.js';
import { loadEnvFile } from './env.js';
import { PRISMA_CLIENT_PATH } from './paths.js';

loadEnvFile();

/**
 * Tipe client Prisma untuk parameter fungsi.
 *
 * Import di atas hanya `import type` — tidak menghasilkan kode runtime, jadi
 * tetap aman walau file generated belum ada (client sebenarnya selalu dibuat
 * lewat dynamic import di createPrismaClient).
 */
export type Db = PrismaClient;

/**
 * Susun connection string dari DATABASE_URL, atau rakit dari komponen
 * DATABASE_* (sama seperti src/database/seed.ts).
 */
export function resolveConnectionString(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  const user = process.env.DATABASE_USER ?? 'postgres';
  const password = process.env.DATABASE_PASSWORD ?? '';
  const host = process.env.DATABASE_HOST ?? 'localhost';
  const port = process.env.DATABASE_PORT ?? '5432';
  const name = process.env.DATABASE_NAME ?? 'scrapbid';

  return `postgresql://${user}:${password}@${host}:${port}/${name}`;
}

export function prismaClientPath(): string {
  return PRISMA_CLIENT_PATH;
}

export async function createPrismaClient(clientPath: string) {
  const fileUrl = pathToFileURL(clientPath).href;
  const { PrismaClient } = await import(fileUrl);
  const connectionString = resolveConnectionString();

  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

/** Sembunyikan password saat menampilkan URL koneksi. */
export function maskConnectionString(url: string): string {
  return url.replace(/:\/\/([^:]+):[^@]*@/, '://$1:****@');
}
