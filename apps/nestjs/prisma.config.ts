import { config } from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'prisma/config';

const here = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(here, '.env') });
config({ path: resolve(here, '../../.env') });

const dbUrl = process.env.PRISMA_DATABASE_URL || process.env.DATABASE_URL || '';

/**
 * Prisma 7 configuration.
 * The connection URL is declared here (not in schema.prisma).
 * Paths are resolved relative to this file.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: dbUrl,
  },
});

