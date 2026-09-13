/**
 * `list` — tampilkan semua user beserta role, profil, dan tanggal dibuat.
 */
import type { Db } from '../lib/db.js';
import { color, fmtDate, heading, printTable, warn } from '../lib/output.js';
import { VALID_ROLES } from '../lib/user.js';

export async function listCommand(db: Db): Promise<void> {
  heading('DAFTAR USER');

  const users = await db.user.findMany({
    orderBy: { createdAt: 'asc' },
    include: { vendor: true, bidder: true },
  });

  if (users.length === 0) {
    warn('Belum ada user. Jalankan `add` atau `seed`.');
    return;
  }

  printTable(
    ['Email', 'Nama', 'Role', 'Profil', 'Dibuat'],
    users.map((user: (typeof users)[number]) => [
      user.email,
      user.name,
      user.role,
      user.vendor ? 'VENDOR' : user.bidder ? 'BIDDER' : '-',
      fmtDate(user.createdAt),
    ]),
  );

  console.log(`\n  Total: ${color.bold}${users.length}${color.reset} user`);
  for (const role of VALID_ROLES) {
    const total = users.filter((user: (typeof users)[number]) => user.role === role).length;
    console.log(`    ${role.padEnd(7)} : ${total}`);
  }
}
