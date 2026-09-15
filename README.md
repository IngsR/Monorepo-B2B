# BidForge

BidForge adalah platform lelang B2B yang dibangun sebagai satu monorepo: Angular sebagai frontend, NestJS sebagai backend, PostgreSQL dengan Prisma sebagai persistence layer, dan Turborepo untuk menjalankan kedua aplikasi dalam satu workflow.

Yang membedakan lelang dari CRUD biasa adalah aturan domainnya. Harga tidak boleh mundur, bid hanya sah dalam rentang waktu dan status tertentu, dan setiap perubahan `currentPrice` harus konsisten dengan bid yang diterima. Kesalahan sekecil apa pun pada logika ini menghasilkan data yang tidak bisa dipercaya, jadi sebagian besar keputusan desain di project ini berangkat dari sana.

Sisi aplikasinya terbagi untuk tiga peran: `ADMIN` mengelola platform, `VENDOR` memasang produk dan membuka lelang, dan `BIDDER` menawar. Lelang mengikuti lifecycle `DRAFT → SCHEDULED → ACTIVE → ENDED`, dengan `CANCELLED` sebagai jalan keluar di tengah. Pemenang tidak disimpan sebagai kolom terpisah, melainkan diturunkan dari bid tertinggi.

## Engineering Focus

1. **Concurrent bidding dan konsistensi `currentPrice`.** Pola read-check-write biasa bisa kehilangan update ketika dua bid masuk hampir bersamaan. Backend menempatkan validasi dan update di dalam satu transaksi, dengan row-level lock pada baris auction, sehingga request kedua membaca state setelah transaksi pertama selesai. Pendekatan ini bergantung pada batas transaksi satu database, bukan solusi untuk arsitektur terdistribusi.
2. **Perhitungan nilai uang.** Kolom harga memakai `Decimal(18,2)`, tetapi angka yang masuk ke JavaScript berisiko kehilangan presisi. Aritmetika uang di backend dihitung lewat representasi integer sen agar tidak bergantung pada floating point.
3. **Auction lifecycle dan validasi waktu.** Status dan time-window diperlakukan sebagai dua hal berbeda: status adalah lifecycle bisnis, waktu menentukan apakah bid masih diterima. Perpindahan status dibatasi tabel transisi dengan state terminal.
4. **Authentication dan authorization berbasis role.** Autentikasi memakai JWT, otorisasi memakai role guard, ditambah pengecekan kepemilikan resource pada operasi vendor dan bidder.
5. **Konsistensi kontrak frontend–backend.** Frontend dan backend mengikuti satu bentuk response envelope dan pagination. Perbedaan penamaan field diselesaikan pada satu adapter di frontend, bukan disebar ke setiap komponen.

## Architecture

```
Angular  ──▶  REST API /api/v1  ──▶  NestJS  ──▶  Prisma  ──▶  PostgreSQL
```

Peran pengguna:

- `ADMIN` — administrasi platform (users, vendors, bidders, categories).
- `VENDOR` — mengelola produk dan lelang miliknya.
- `BIDDER` — menawar pada lelang yang aktif.

Lifecycle lelang:

```
DRAFT ──▶ SCHEDULED ──▶ ACTIVE ──▶ ENDED
   │           │           │
   └───────────┴───────────┴──▶ CANCELLED
```

`ENDED` dan `CANCELLED` bersifat terminal. Bid hanya diterima pada lelang berstatus `ACTIVE` dan di dalam rentang `startAt`–`endAt`.

## What Has Been Validated

- **Unit test backend** — 13 file, 117 test lulus. Fokus pada aturan domain dan batas modul: guard role, siklus hidup lelang, pemetaan error, aritmetika decimal, dan service per domain.
- **Unit test frontend** — 3 file, 97 test lulus. Fokus pada aturan lelang (transisi, minimum bid), pemilihan pesan pada `ApiFailure`, dan perilaku mock API.
- **E2E test backend** — suite supertest yang menjalankan proses lelang end-to-end lewat HTTP (vendor membuat produk dan lelang, bidder menawar, lelang diakhiri, pemenang ditentukan), termasuk skenario bid bersamaan. E2E ini memakai `InMemoryPrisma` sebagai pengganti `PrismaService`, jadi yang divalidasi adalah perilaku wiring (guard, validasi DTO, controller, service) terhadap kontrak HTTP, bukan row lock pada PostgreSQL sungguhan.
- **Lint** — `oxlint` pada backend dan `ng build` sebagai bagian pipeline build.
- **Prisma** — validasi schema dan migrasi (`prisma validate`, `prisma migrate`).

## Run Locally

Prasyarat: Node.js dan PostgreSQL.

```bash
# root — install semua workspace
npm install

# backend — siapkan database dan data demo
cd apps/nestjs
npm run prisma:migrate
npm run seed

# kembali ke root dan jalankan kedua aplikasi
cd ../..
npm run dev
```

- API dan Swagger: `http://localhost:8000/api/v1` dan `http://localhost:8000/api/docs`
- Frontend: `http://localhost:3000`

Akun demo dari `prisma seed` (password `Password123`):

| Role | Email |
| --- | --- |
| Admin | `admin@bidforge.test` |
| Vendor | `vendor@bidforge.test` |
| Bidder | `bidder@bidforge.test` |

## Read More

- [`apps/nestjs/README.md`](./apps/nestjs/README.md) — masalah backend yang diselesaikan dan cara penanganannya: concurrent bidding, perhitungan uang, lifecycle, error handling, dan auth.
- [`apps/angular/README.md`](./apps/angular/README.md) — masalah frontend yang diselesaikan dan cara penanganannya: kontrak API, async state, route guard, dan error handling.