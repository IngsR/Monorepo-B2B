/**
 * `reset-password` — ganti password user yang sudah ada.
 */
import type { Db } from '../lib/db.js';
import { requireEmail, type CliArgs } from '../lib/args.js';
import { color, fail, heading, ok } from '../lib/output.js';
import { updatePassword } from '../lib/user.js';

export async function resetPasswordCommand(
  db: Db,
  args: CliArgs,
): Promise<void> {
  const email = requireEmail(args);
  const password = args.password;
  if (!password) fail('Butuh --password=<password baru>.');

  heading(`RESET PASSWORD: ${email}`);

  const updated = await updatePassword(db, email, password);
  if (!updated) fail(`User "${email}" tidak ditemukan.`);

  ok(`Password ${email} berhasil diubah.`);
  console.log(`   password baru: ${color.bold}${password}${color.reset}\n`);
}
