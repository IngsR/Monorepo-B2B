/**
 * Ensures the Prisma CLI can resolve @prisma/client from this workspace.
 *
 * In an npm workspaces monorepo, @prisma/client is hoisted to the root
 * node_modules while the `prisma` CLI runs from apps/nestjs. Prisma 7 resolves
 * @prisma/client from apps/nestjs and fails with "Could not resolve
 * @prisma/client" when it only exists at the root.
 *
 * This script guarantees a real local copy exists at
 * apps/nestjs/node_modules/@prisma/client, replacing any hoisted symlink or
 * stale copy. It is idempotent and safe to run before every `prisma generate`.
 */
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const localTarget = resolve(here, '..', 'node_modules', '@prisma', 'client');
const rootSource = resolve(
  here,
  '..',
  '..',
  '..',
  'node_modules',
  '@prisma',
  'client',
);

try {
  if (!existsSync(rootSource)) {
    console.log('[prisma] @prisma/client not found at root — nothing to copy');
    process.exit(0);
  }

  // Always replace whatever is there (symlink, stale copy) with a real copy.
  rmSync(localTarget, { recursive: true, force: true });
  mkdirSync(dirname(localTarget), { recursive: true });
  cpSync(rootSource, localTarget, { recursive: true, dereference: true });
  console.log('[prisma] @prisma/client ready at apps/nestjs/node_modules');
} catch (error) {
  console.warn('[prisma] notice handling @prisma/client copy:', error?.message || error);
}
