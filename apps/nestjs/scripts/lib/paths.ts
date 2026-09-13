/**
 * Resolusi path yang dipakai semua script di apps/nestjs/scripts.
 *
 * root = folder apps/nestjs, dihitung dari lokasi file ini
 * (scripts/lib/paths.ts -> naik 3 level).
 */
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);

/** Folder generated Prisma client. Dipakai lewat dynamic import. */
export const PRISMA_CLIENT_PATH = path.join(
  ROOT_DIR,
  'generated',
  'prisma',
  'client.js',
);

/** Path absolut ke sebuah file/folder di dalam apps/nestjs. */
export function fromRoot(...segments: string[]): string {
  return path.join(ROOT_DIR, ...segments);
}
