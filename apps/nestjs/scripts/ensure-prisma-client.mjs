/**
 * Ensures Prisma CLI can resolve @prisma/client from this workspace.
 *
 * In an npm workspaces monorepo, @prisma/client is hoisted to the root
 * node_modules while the `prisma` CLI lives in apps/nestjs/node_modules.
 * Prisma 7 resolves @prisma/client relative to its own install location and
 * fails with "Could not resolve @prisma/client" when it only exists at root.
 *
 * This script creates a local copy inside apps/nestjs/node_modules/@prisma/client
 * so `prisma generate` works regardless of hoisting. It is idempotent.
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

if (existsSync(localTarget)) {
  console.log('[prisma] @prisma/client already local — nothing to do');
  process.exit(0);
}

if (!existsSync(rootSource)) {
  console.log(
    '[prisma] @prisma/client not found at root — skipping local copy',
  );
  process.exit(0);
}

mkdirSync(dirname(localTarget), { recursive: true });
cpSync(rootSource, localTarget, { recursive: true });
console.log('[prisma] copied @prisma/client into apps/nestjs/node_modules');
