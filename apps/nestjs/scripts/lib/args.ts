/**
 * Parsing argumen CLI sederhana: `command --key=value --flag posisi`.
 */
import { fail } from './output.js';

export interface CliArgs {
  command: string;
  email?: string;
  password?: string;
  name?: string;
  /** Sudah uppercase, mis. 'ADMIN'. Validasi role ada di lib/user.ts. */
  role?: string;
  /** Flag tanpa nilai, mis. --force, --yes. */
  flags: Set<string>;
  /** Argumen posisi bebas (mis. email tanpa --email=). */
  positionals: string[];
}

export function parseArgs(argv: string[]): CliArgs {
  const [command = 'help', ...rest] = argv;
  const flags = new Set<string>();
  const positionals: string[] = [];
  const args: CliArgs = { command, flags, positionals };

  for (const token of rest) {
    if (!token.startsWith('--')) {
      positionals.push(token);
      continue;
    }

    const body = token.slice(2);
    const separator = body.indexOf('=');

    if (separator === -1) {
      flags.add(body.toLowerCase());
      continue;
    }

    const key = body.slice(0, separator).toLowerCase();
    const value = body.slice(separator + 1);

    switch (key) {
      case 'email':
      case 'password':
      case 'name':
      case 'role':
        args[key] = value;
        break;
      default:
        // Flag ber-nilai yang tidak dikenal tetap disimpan sebagai flag.
        flags.add(token.toLowerCase());
    }
  }

  return args;
}

/** Email dari --email=<x> atau argumen posisi pertama. */
export function emailArg(args: CliArgs): string | undefined {
  return args.email ?? args.positionals[0];
}

export function requireEmail(args: CliArgs): string {
  const email = emailArg(args);
  if (!email) fail('Butuh --email=<email>. Contoh: --email=budi@scrapbid.test');
  return email;
}
