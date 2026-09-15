# BidForge — Frontend

Frontend BidForge adalah aplikasi Angular yang menjadi client untuk API backend. Area yang dilayani mencakup autentikasi dan reset password, marketplace lelang, detail lelang dan proses bid, halaman bidder (`my bids`), workspace vendor (produk dan lelang), dashboard admin (users, vendors, bidders, categories), serta halaman profil.

Aplikasi memakai standalone component dan signal-based state, dengan HTTP interceptor sebagai tempat menangani kebutuhan lintas fitur: penempelan token, normalisasi bentuk response, dan korelasi log.

## Problem Solving

### 1. Pengembangan UI sebelum backend selalu siap

Saat backend belum stabil, mengembangkan fitur UI bisa berakhir dengan cabang kode `mock mode` vs `real API mode` yang tersebar di service dan komponen.

Project ini memilih pendekatan lain. Seluruh aplikasi berbicara lewat `HttpClient` dengan request dan response yang mengikuti kontrak API sebenarnya. Untuk pengembangan tanpa backend, tersedia `mockApiInterceptor`: sebuah transport in-memory yang menjawab request HTTP terhadap implementasi API dengan routing per method dan path, dan mengembalikan bentuk envelope yang sama.

Karena kontraknya mengikuti API asli dan bukan data hardcoded yang menempel di komponen, fitur UI dapat dikembangkan tanpa menambahkan percabangan mode di dalam komponen. Perlu dicatat bahwa pada konfigurasi aplikasi saat ini, interceptor yang aktif untuk request adalah `requestIdInterceptor`, `authInterceptor`, dan `apiShapeInterceptor` (lihat `app.config.ts`); mock transport tidak berada di jalur tersebut dan berfungsi sebagai aset pengembangan.

### 2. Bentuk API tidak selalu sama dengan view model

Model di UI tidak identik dengan response API. Backend mengirim satu field `name`, sementara UI membacanya sebagai `firstName` dan `lastName`. Backend memakai `startAt`/`endAt`, sementara UI memakai `startTime`/`endTime`. Daftar dikirim sebagai `{ data, meta }`, sementara UI membacanya sebagai `{ items, meta }`.

Menyebarkan penyesuaian ini ke setiap service dan template berarti setiap perubahan kontrak backend berpotensi menyentuh banyak tempat. Karena itu normalisasi dipusatkan di `apiShapeInterceptor`. Interceptor ini menerjemahkan query dari UI ke parameter yang diterima API (termasuk pemetaan `orderBy`/`sort` ke `sortBy`/`sortOrder`), dan menerjemahkan response kembali ke bentuk yang dibaca UI.

Setiap mapper bersifat defensif: bentuk yang tidak dikenali dilewatkan apa adanya, bukan ditebak. Konsekuensinya, perubahan kontrak backend cenderung menampilkan kekosongan yang terlihat alih-alih error yang tersebar.

### 3. Async state

Setiap layar yang mengambil data dari server memiliki beberapa kondisi yang harus ditangani: loading, success, empty, dan error, plus kemampuan memuat ulang. Bila wiring ini ditulis ulang di tiap komponen, ada risiko satu kondisi terlewat dan layar tampil kosong tanpa penjelasan.

Penanganannya dipusatkan pada `AsyncResource`, sebuah container berbasis signal yang menyimpan state (`idle`, `loading`, `success`, `error`), data, dan error, serta menyediakan `load`, `set`, `update`, dan `reset`.

Satu perilaku yang disengaja ada pada `load`: request yang masih berjalan dibatalkan sebelum request baru dimulai. Tanpa ini, request beruntun (misalnya perubahan filter/folder cepat) bisa membuat response lama datang belakangan dan menimpa hasil yang lebih baru. Opsi `keepData` juga menjaga data lama tetap tampil selama refresh, sehingga tabel tidak berkedip kosong.

### 4. Route protection dan role-based UX

Aplikasi melayani tiga role dengan kebutuhan layar yang berbeda, sehingga routing dibagi per area dan di-lazy-load. Dua mekanisme dipakai berdampingan:

- `canMatch` dengan `roleMatchGuard` mencegah chunk area tertentu diunduh oleh role yang tidak berhak. Karena route bersifat lazy, role yang tidak cocok tidak perlu menarik bundle area tersebut.
- `roleGuard` mengarahkan akses ke URL yang tidak diizinkan kembali ke halaman yang sesuai untuk role tersebut, alih-alih membiarkan user berhenti pada layar yang tidak dapat digunakan.

Ada dua detail yang perlu ditangani pada `canMatch`. Pertama, pada hard load atau deep link, identitas belum tentu selesai dimuat saat guard dievaluasi, sehingga `roleMatchGuard` menunggu identitas selesai terlebih dahulu. Kedua, `canMatch` yang mengembalikan `false` membuat router jatuh ke route wildcard dan menampilkan "not found" untuk URL yang sebenarnya ada; karena itu user yang sudah login dengan role berbeda diarahkan, bukan dibiarkan jatuh.

Yang perlu ditegaskan: guard di sisi klien adalah pengatur navigasi, bukan batas keamanan. Otorisasi yang sebenarnya tetap ditegakkan oleh backend pada setiap request. Frontend hanya memakai role untuk menentukan kontrol apa yang ditampilkan.

### 5. Error handling

Error dari API tidak selalu dalam bentuk yang bisa langsung ditampilkan ke user. Server dapat mengirim pesan teknis (misalnya detail dari layer database) atau kode enumerasi seperti `FORBIDDEN`.

`toApiFailure` menormalkan kegagalan HTTP menjadi struktur `ApiFailure` yang berisi status, code, pesan, detail opsional, field errors, dan retry hint. Pesan dari server hanya dipakai bila memenuhi dua syarat: tidak terlihat sebagai detail internal, dan benar-benar berbentuk kalimat. Bila pesan gagal memenuhi syarat itu, dipakai pesan default yang sudah disusun untuk kondisi tersebut. Kegagalan koneksi yang tidak sampai ke server (status `0`) diperlakukan tersendiri sebagai `NETWORK_ERROR`.

Dengan cara ini, pesan yang tampil ke user tetap dapat dipahami, sementara detail teknis tidak ikut tersebar ke antarmuka.

## Frontend–Backend Contract

Tabel berikut merangkum beberapa perbedaan kontrak yang dijaga oleh `apiShapeInterceptor` di sisi frontend dan oleh lapisan response di backend.

| Aspek | Dari backend | Dibaca UI |
| --- | --- | --- |
| Success wrapper | `{ success, data, message }` | dibuka menjadi `data` lewat `ApiClient.unwrap()` |
| Pagination | `{ data, meta }` | `{ items, meta }` |
| Nama user | `name` | dipecah menjadi `firstName` dan `lastName` |
| Waktu lelang | `startAt` / `endAt` | `startTime` / `endTime` |
| Urutan | `sortBy` + `sortOrder` | dipetakan dari `orderBy` / `sort` |
| Harga (Decimal) | string | dikonversi ke `number` untuk kolom harga |

## Testing & Validation

- **Unit test** — 3 file, 97 test lulus (`npm run test`). Fokus pada logika yang berisiko: aturan siklus hidup lelang (transisi status dan minimum bid), pemilihan pesan pada `ApiFailure`, dan perilaku mock API dalam menegakkan aturan yang sama.
- **Lint/build** — build produksi melalui `ng build` dalam pipeline workspace.

Snapshot tampilan bukan pusat validasi di project ini. Verifikasi UI diarahkan pada perilaku yang memang diuji, sementara bagian presentasi bergantung pada build dan pemeriksaan alur secara langsung.

## Project Structure

```
src/app/
├── app.routes.ts    # definisi route per area, lazy-loaded, dengan guard peran
├── core/            # guard, interceptor, service, state, domain, dan mock API
│   ├── guards/          # sessionGuard, guestGuard, roleGuard, roleMatchGuard
│   ├── interceptors/    # api-shape (normalisasi kontrak), auth (token & 401), requestId
│   ├── services/        # session, auction, bid, catalogue, directory
│   ├── state/           # AsyncResource untuk loading/success/empty/error
│   ├── domain/          # model, siklus hidup lelang, ApiFailure, format
│   └── mock/            # transport in-memory yang mengikuti kontrak API
├── features/        # marketplace, bidder, vendor, admin, auth, profile
└── shared/          # komponen UI bersama dan layout (shell, topbar, sidebar)
```

## Run Locally

```bash
npm run dev     # http://localhost:3000
npm run test    # unit test
npm run build   # build produksi
```

Frontend mengarah ke backend melalui `environment.apiUrl`. Pastikan backend berjalan dan `CORS_ORIGIN` di backend mencakup origin frontend.