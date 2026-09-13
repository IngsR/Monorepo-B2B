/**
 * Loader .env sederhana tanpa dependensi: baca file .env di root apps/nestjs
 * lalu isi process.env untuk key yang belum ada.
 *
 * Hanya dipakai script CLI. Kalau nanti ganti ke `--env-file=.env`
 * (built-in Node), file ini bisa dihapus dan env.ts tinggal ambil dari process.env.
 */
import * as fs from 'node:fs';
import { fromRoot } from './paths.js';

export function loadEnvFile(fileName = '.env'): void {
  const file = fromRoot(fileName);
  if (!fs.existsSync(file)) return;

  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separator = trimmed.indexOf('=');
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();

    // Buang tanda kutip pembungkus.
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) process.env[key] = value;
  }
}
