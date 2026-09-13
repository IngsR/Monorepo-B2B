/**
 * Utilitas output terminal: warna, heading, tanda ok/warn, tabel, format nilai.
 * Semua fungsi di sini bebas dari Prisma — murni presentasi.
 */

const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

export const color = C;

/** Hentikan script dengan pesan error. */
export function fail(message: string): never {
  console.error(`\n❌ ${message}\n`);
  process.exit(1);
}

export function heading(text: string): void {
  const line = '═'.repeat(Math.max(text.length + 4, 46));
  console.log(`\n${C.cyan}${line}${C.reset}`);
  console.log(`${C.cyan}${C.bold}  ${text}${C.reset}`);
  console.log(`${C.cyan}${line}${C.reset}`);
}

export function step(text: string): void {
  console.log(`${C.magenta}▶${C.reset} ${text}`);
}

export function ok(text: string): void {
  console.log(`  ${C.green}✅${C.reset} ${text}`);
}

export function warn(text: string): void {
  console.log(`  ${C.yellow}⚠️ ${C.reset} ${text}`);
}

type Cell = string | number | null | undefined;

/** Cetak tabel teks sederhana (tanpa dependensi eksternal). */
export function printTable(headers: string[], rows: Cell[][]): void {
  const cells = [headers, ...rows].map((row) =>
    row.map((value) =>
      value === null || value === undefined ? '-' : String(value),
    ),
  );

  const widths = headers.map((_, column) =>
    Math.max(...cells.map((row) => stripAnsi(row[column] ?? '').length)),
  );

  const pad = (value: string, width: number): string =>
    value + ' '.repeat(Math.max(0, width - stripAnsi(value).length));

  console.log(
    '  ' + headers.map((header, i) => pad(header, widths[i])).join('  '),
  );
  console.log('  ' + widths.map((width) => '─'.repeat(width + 2)).join('┼'));

  for (const row of rows) {
    console.log(
      '  ' +
        row.map((value, i) => pad(String(value ?? '-'), widths[i])).join('  '),
    );
  }
}

/** Hitung panjang teks tanpa kode warna ANSI. */
function stripAnsi(value: string): string {
  return value.replace(/\x1b\[[0-9;]*m/g, '');
}

/** Date -> '2024-05-01 08:30:00'. */
export function fmtDate(value: Date | null | undefined): string {
  if (!value) return '-';
  return new Date(value).toISOString().slice(0, 19).replace('T', ' ');
}

/** Angka -> '1.250.000'. */
export function fmtNumber(value: number): string {
  return value.toLocaleString('id-ID');
}
