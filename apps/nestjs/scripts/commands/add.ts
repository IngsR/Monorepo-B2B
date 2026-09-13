/**
 * `add` — input user + password ke database (upsert) + profil role terkait.
 *
 * Contoh:
 *   npm run role -- add --email=budi@scrapbid.test --password=Rahasia123 --role=VENDOR --name="Budi"
 */
import type { Db } from '../lib/db.js';
import { emailArg, type CliArgs } from '../lib/args.js';
import { color, fail, heading, ok, step } from '../lib/output.js';
import {
  DEFAULT_PASSWORD,
  ensureRoleProfile,
  isValidEmail,
  nameFromEmail,
  parseRole,
  upsertUser,
} from '../lib/user.js';

export async function addCommand(db: Db, args: CliArgs): Promise<void> {
  heading('INPUT USER & PASSWORD KE DATABASE');

  const email = emailArg(args);
  if (!email) {
    fail(
      'Email wajib. Contoh:\n' +
        '  npm run role -- add --email=baru@scrapbid.test --password=Secret123 --role=VENDOR',
    );
  }
  if (!isValidEmail(email)) fail(`Format email tidak valid: "${email}"`);

  const password = args.password ?? DEFAULT_PASSWORD;
  const role = args.role ? parseRole(args.role) : 'BIDDER';
  const name = args.name ?? nameFromEmail(email);

  step(`Upsert user: ${color.bold}${email}${color.reset} (${role})`);
  const user = await upsertUser(db, { email, password, name, role });
  ok(`User tersimpan — id: ${user.id}`);

  step('Menyiapkan profil role terkait…');
  ok(await ensureRoleProfile(db, user));

  console.log(
    `\n${color.green}${color.bold}Berhasil!${color.reset} Login dengan:\n` +
      `   email    : ${color.bold}${email}${color.reset}\n` +
      `   password : ${color.bold}${password}${color.reset}\n` +
      `   role     : ${color.bold}${role}${color.reset}\n`,
  );
}
