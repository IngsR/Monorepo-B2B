/**
 * role.ts — entry point CLI user & password (ScrapBid / NestJS + Prisma).
 *
 * File ini HANYA memilih perintah. Isi tiap perintah ada di scripts/commands/,
 * helper bersama ada di scripts/lib/.
 *
 * Cara pakai (dari root repo):
 *   npm run role -- check
 *   npm run role -- add --email=a@b.c --password=Secret123 --role=ADMIN --name="Nama"
 *   npm run role -- list | roles | seed | help
 *   npm run role -- inspect --email=a@b.c
 *   npm run role -- reset-password --email=a@b.c --password=Baru123
 *   npm run role -- delete --email=a@b.c
 *
 * Seeding data demo lengkap (kategori, produk, lelang): npm run seed
 * (src/database/seed.ts).
 */
import type { Db } from './lib/db.js';
import { parseArgs } from './lib/args.js';
import { createPrismaClient, prismaClientPath } from './lib/db.js';
import { fail } from './lib/output.js';
import { addCommand } from './commands/add.js';
import { checkCommand } from './commands/check.js';
import { deleteCommand } from './commands/delete.js';
import { helpCommand } from './commands/help.js';
import { inspectCommand } from './commands/inspect.js';
import { listCommand } from './commands/list.js';
import { resetPasswordCommand } from './commands/reset-password.js';
import { rolesCommand } from './commands/roles.js';
import { seedCommand } from './commands/seed.js';

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  // help tidak butuh koneksi database.
  if (['help', '--help', '-h'].includes(args.command)) {
    helpCommand();
    return;
  }

  // Dynamic import supaya import statis di file ini tetap ringan & aman.
  const db: Db = await createPrismaClient(prismaClientPath());

  try {
    switch (args.command) {
      case 'check':
        await checkCommand(db);
        break;
      case 'add':
      case 'create':
        await addCommand(db, args);
        break;
      case 'list':
        await listCommand(db);
        break;
      case 'roles':
        await rolesCommand(db);
        break;
      case 'inspect':
      case 'get':
        await inspectCommand(db, args);
        break;
      case 'reset-password':
      case 'passwd':
        await resetPasswordCommand(db, args);
        break;
      case 'delete':
      case 'remove':
        await deleteCommand(db, args);
        break;
      case 'seed':
        await seedCommand(db);
        break;
      default:
        fail(`Perintah "${args.command}" tidak dikenal. Jalankan: npm run role -- help`);
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(`\n❌ Gagal: ${(error as Error).message}\n`);
  if (process.env.DEBUG) console.error(error);
  process.exitCode = 1;
});
