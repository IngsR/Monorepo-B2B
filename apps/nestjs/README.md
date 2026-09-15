# BidForge — Backend

Backend BidForge adalah REST API berbasis NestJS yang menangani autentikasi, manajemen produk dan lelang, serta proses bidding. Semua endpoint berada di bawah prefix `/api` dan di-version melalui URI (`/api/v1`), dengan dokumentasi Swagger di `/api/docs`.

Autentikasi memakai JWT. Setiap request yang masuk melewati role guard dan pengecekan kepemilikan resource sebelum menyentuh service, sehingga aturan otorisasi tidak tersebar di controller. Persistence memakai Prisma di atas PostgreSQL.

## Problem Solving

### 1. Concurrent bidding

Masalahnya muncul pada pola read-check-write. Dua bidder mengirim bid hampir bersamaan pada lelang yang sama. Keduanya bisa membaca `currentPrice` yang sama, keduanya lolos validasi terhadap nilai lama itu, lalu keduanya menulis. Hasilnya update yang hilang dan `currentPrice` yang tidak mencerminkan bid tertinggi.

Solusi yang dipakai ada di `BidsService.placeBid`. Seluruh operasi berjalan di dalam satu transaksi Prisma:

1. Baris auction diambil dengan `SELECT ... FOR UPDATE` sehingga baris tersebut terkunci untuk durasi transaksi.
2. Validasi status, time-window, dan batas minimum dijalankan terhadap nilai yang sudah terkunci — bukan terhadap nilai hasil baca sebelumnya.
3. `currentPrice` diperbarui dan record bid dibuat dalam transaksi yang sama.

Dengan row-level lock, request bid kedua menunggu sampai transaksi pertama commit, lalu membaca state terbaru. Tidak ada jeda antara baca dan tulis yang bisa disisipi request lain. Lock berada pada level baris, jadi bid pada lelang yang berbeda tetap berjalan tanpa saling memblokir.

Pendekatan ini dipilih karena seluruh komponennya berjalan di atas satu database, dan PostgreSQL sudah menyediakan jaminan yang diperlukan. Trade-off-nya jelas: solusi ini bergantung pada batas transaksi database tunggal. Jika sistem dipecah menjadi beberapa service atau beberapa database, jaminan ini perlu ditinjau ulang dan kemungkinan memerlukan mekanisme tambahan di luar transaksi database.

### 2. Monetary calculation

Kolom harga di schema memakai `Decimal(18,2)`. Nilai itu aman selama masih di database, tetapi begitu masuk ke JavaScript ia menjadi `number`, dan aritmetika float bisa menggeser nilai uang pada digit terakhir. Pada konteks lelang, selisih kecil seperti itu tetap bermasalah karena menentukan apakah sebuah bid sah.

Karena itu perhitungan uang di `BidsService` tidak dilakukan langsung pada `number`. Nilai decimal dikonversi ke representasi integer sen, dijumlahkan dan dibandingkan sebagai integer, lalu dikembalikan sebagai string decimal. Validasi batas minimum bid dan pembandingan nilai memakai jalur ini, sehingga perhitungan tidak bergantung pada floating point.

### 3. Auction lifecycle

Status lelang dan time-window sengaja diperlakukan sebagai dua hal terpisah. Status menunjukkan posisi bisnis lelang (`DRAFT`, `SCHEDULED`, `ACTIVE`, `ENDED`, `CANCELLED`), sedangkan waktu menentukan apakah bid masih dapat diterima.

Perpindahan status divalidasi oleh tabel transisi di `AuctionsService`. Transisi di luar tabel ditolak dengan `409 Conflict`. Sebagian state bersifat terminal: `ENDED` dan `CANCELLED` tidak memiliki transisi keluar. Tidak ada jalur langsung dari `DRAFT` ke `ACTIVE` — sebuah lelang harus dijadwalkan lebih dulu.

Untuk penerimaan bid, `BidsService` tidak hanya melihat status, tetapi juga memeriksa `startAt` dan `endAt` pada baris yang sudah terkunci. Bid ditolak bila lelang belum mulai atau sudah melewati waktu berakhir, terlepas dari status yang tercatat.

Nilai seperti `SOLD` atau `UNSOLD` tidak disimpan sebagai kolom. Pemenang diturunkan dari bid tertinggi (`amount` tertinggi, lalu `createdAt` paling awal sebagai tie-break), sehingga tidak ada dua sumber kebenaran untuk hasil lelang.

### 4. Error handling

Error dari database dan error internal tidak dikirim mentah ke klien, tetapi developer tetap membutuhkan detailnya untuk diagnosis. Keduanya diselesaikan pada satu titik: `HttpExceptionFilter` menangkap semua exception dan `toPublicError` menerjemahkannya menjadi response yang konsisten (`{ success: false, message, code }`).

- Error Prisma yang dikenal dipetakan ke HTTP status yang bermakna (misalnya pelanggaran unique constraint ke `409`, record tidak ditemukan ke `404`). Deteksi dilakukan secara struktural terhadap nama dan code error, bukan lewat import path internal Prisma yang bisa berubah antar versi.
- Pesan yang mengandung indikator sensitif (`password`, `secret`, `token`, `sql`, dan sejenisnya) diganti dengan pesan generik sebelum keluar.
- Exception yang tidak dikenal hanya di-log di server lengkap dengan stack aslinya, sementara body yang dikirim ke klien tetap generik.

Hasilnya: response yang aman untuk user, dan jejak yang cukup untuk developer. Saat investigasi, titik mulai yang benar adalah log server, bukan response body.

### 5. Authentication dan authorization

Autentikasi memakai JWT melalui Passport. Token diverifikasi oleh `JwtStrategy`, dan payload-nya membawa identitas user beserta role.

Otorisasi berjalan di dua lapis:

- **Role guard** — endpoint dibatasi pada role tertentu (misalnya hanya `VENDOR` yang boleh membuat lelang).
- **Ownership check** — operasi vendor dan bidder diverifikasi terhadap resource miliknya. Vendor hanya dapat mengelola produk dan lelangnya sendiri, dan pemilikannya di-resolve lewat profil vendor/bidder yang tertaut ke user.

Alur reset password: permintaan reset selalu mengembalikan hasil yang sama, baik email terdaftar maupun tidak, untuk menghindari informasi tentang keberadaan akun. Token reset disimpan dalam bentuk hash, memiliki masa berlaku, dan hanya dapat dipakai sekali (ditandai `usedAt`). Perubahan password dan penandaan token berjalan dalam satu transaksi.

## API Contract

Response sukses dibungkus secara konsisten oleh `TransformInterceptor`:

```json
{
  "success": true,
  "data": {},
  "message": "Operation successful"
}
```

Endpoint yang memang perlu mengembalikan bentuk lain dapat menandai dirinya dengan `@SkipResponseWrap()`.

Daftar resource dikembalikan dengan bentuk pagination yang seragam:

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "limit": 12,
    "total": 0,
    "totalPages": 0
  }
}
```

API di-version melalui URI (`/api/v1`) dan didokumentasikan lewat Swagger di `/api/docs`, sehingga perubahan kontrak punya ruang untuk hidup berdampingan.

## Testing & Validation

- **Unit test** — 13 file, 117 test lulus (`npm run test`). Fokus pada aturan domain dan batas modul: guard role, siklus hidup lelang, pemetaan error, aritmetika decimal, serta service per domain (users, vendors, bidders, categories, products, auctions, bids).
- **E2E test** — suite supertest (`npm run test:e2e`) yang menjalankan alur lelang melalui HTTP: login vendor, membuat produk, membuat lelang, mengaktifkannya, bidder menawar, hingga penentuan pemenang. Termasuk kasus negatif untuk aturan bisnis dan otorisasi, serta skenario bid bersamaan.
- **Lint dan typecheck** — `oxlint` untuk lint dan `tsc --noEmit` untuk typecheck.
- **Prisma** — validasi schema (`prisma validate`) dan migrasi.

Catatan penting mengenai batasan validasi: E2E memakai `InMemoryPrisma` sebagai pengganti `PrismaService`. Implementasi ini meniru query yang dipakai alur lelang, termasuk pemanggilan `$queryRaw` untuk lock, tetapi bukan PostgreSQL sungguhan. Karena itu E2E memvalidasi perilaku wiring dan kontrak HTTP, sedangkan jaminan row lock yang sebenarnya bergantung pada PostgreSQL. Ini pembeda yang perlu diperhatikan antara keputusan implementasi dan bukti eksekusi pada database nyata.

## Project Structure

```
src/
├── main.ts          # bootstrap, prefix /api, versioning, CORS, Swagger
├── app.module.ts    # komposisi modul
├── auth/            # JWT, strategi Passport, guard role, reset password
├── bids/            # placeBid (transaksi + row lock), aritmetika decimal
├── auctions/        # tabel transisi status, penurunan pemenang
├── products/        # produk milik vendor
├── vendors/         # profil dan manajemen vendor
├── bidders/         # profil dan manajemen bidder
├── categories/      # kategori produk
├── users/           # akun dan profil pengguna
├── common/          # filter, interceptor, pipe, decorator, dto, error code
├── config/          # validasi environment
├── database/        # PrismaService dan seed
└── health/          # pengecekan koneksi database
```

## Run Locally

```bash
npm install
npm run prisma:migrate   # menyiapkan schema database
npm run seed             # mengisi data demo
npm run dev              # http://localhost:8000/api/v1, Swagger di /api/docs
npm run test             # unit test
npm run test:e2e         # e2e test
npm run lint
npm run typecheck
```

Environment divalidasi saat boot. Bila `DATABASE_URL`, `JWT_SECRET`, `PORT`, atau `CORS_ORIGIN` tidak valid, aplikasi gagal start daripada berjalan dengan konfigurasi yang salah.