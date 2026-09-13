/**
 * `help` — daftar perintah & opsi.
 */
import { color, heading } from '../lib/output.js';
import { DEFAULT_PASSWORD } from '../lib/user.js';

export function helpCommand(): void {
  heading('role — Bantuan');

  console.log(`${color.bold}Perintah:${color.reset}

  ${color.cyan}check${color.reset}            Cek lengkap database: koneksi, semua tabel, jumlah
                   baris, konsistensi relasi, admin & akun demo.
  ${color.cyan}add${color.reset}              Input user + password (upsert) & profil role terkait.
  ${color.cyan}list${color.reset}             Tampilkan semua user + role + profil.
  ${color.cyan}roles${color.reset}            Ringkasan jumlah user per role & profil.
  ${color.cyan}inspect${color.reset}          Detail 1 user beserta relasi (produk, bid, token).
  ${color.cyan}reset-password${color.reset}   Ubah password user yang sudah ada.
  ${color.cyan}delete${color.reset}           Hapus user + profilnya (dengan pengaman FK).
  ${color.cyan}seed${color.reset}             Seed 3 user dasar + kategori.
  ${color.cyan}help${color.reset}             Tampilkan pesan ini.

${color.bold}Opsi:${color.reset}
  --email=<email>       Email user (wajib untuk add/reset-password/delete/inspect)
  --password=<pass>     Password plaintext (default: ${DEFAULT_PASSWORD})
  --name="<nama>"       Nama tampilan (default: diturunkan dari email)
  --role=<ROLE>         ADMIN | VENDOR | BIDDER (default: BIDDER)

${color.bold}Contoh:${color.reset}
  npm run role -- check
  npm run role -- add --email=budi@scrapbid.test --password=Rahasia123 --role=VENDOR
  npm run role -- list
  npm run role -- inspect --email=admin@scrapbid.test
  npm run role -- reset-password --email=admin@scrapbid.test --password=Baru123

${color.dim}Catatan: jalankan dari root repo. File .env dibaca dari apps/nestjs/.env.${color.reset}
`);
}
