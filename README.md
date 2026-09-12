# BidForge — B2B Auction Platform Monorepo (NestJS + Angular)

Selamat datang di repository project **BidForge**, platform lelang B2B. Project ini dibangun dengan arsitektur **Monorepo** yang menggabungkan **NestJS** (Backend) dan **Angular** (Frontend) dalam satu workflow pengembangan.

Project ini dirancang sebagai demonstrasi kemampuan teknis dalam membangun aplikasi skala menengah-besar dengan praktik _Software Engineering_ yang baik.

## 🚀 Tech Stack

### Core

- **Monorepo Manager**: [Turborepo](https://turbo.build/) (High-performance build system)
- **Package Manager**: NPM Workspaces

### Backend (`apps/nestjs`)

- **Framework**: [NestJS](https://nestjs.com/) (Node.js framework yang modular & scalable)
- **Language**: TypeScript
- **Database**: PostgreSQL (via Prisma ORM)
 **API Documentation**: Swagger / OpenAPI (di `/api/docs`)
- **Authentication**: JWT (JSON Web Token) & Passport
### Frontend (`apps/angular`)

- **Framework**: [Angular 22](https://angular.dev/) (standalone components, zoneless)
- **Language**: TypeScript
- **Styling**: SCSS (design-token based)
- **Data Fetching**: `HttpClient` + interceptor-based API adapter

---

## 📂 Struktur Project

Struktur folder menggunakan konsep Monorepo untuk memisahkan tanggung jawab namun tetap memudahkan integrasi.

```text
.
├── apps/
│   ├── nestjs/        # Server-side logic, REST API, Prisma ORM
│   └── angular/       # Client-side UI, SPA
├── packages/          # Shared libraries (DTOs, configs, utilities) - *Coming Soon*
├── package.json       # Root configuration untuk Workspace
└── turbo.json         # Konfigurasi pipeline build Turborepo
```

---

## 🛠️ Cara Menjalankan (Getting Started)

Ikuti langkah-langkah ini untuk menjalankan project di komputer lokal Anda.

### Prasyarat

- [Node.js](https://nodejs.org/) (Versi 18 atau terbaru)
- [PostgreSQL](https://www.postgresql.org/) (Pastikan database sudah berjalan)

### 1. Instalasi Dependencies

Jalankan perintah ini di root folder untuk menginstall dependencies bagi Backend dan Frontend sekaligus.

```bash
npm install
```

### 2. Konfigurasi Environment

- **Backend**: Masuk ke `apps/backend`, copy `.env.example` (jika ada) atau buat `.env` baru sesuai konfigurasi database Anda.
- **Frontend**: Masuk ke `apps/frontend`, sesuaikan `.env.local` jika diperlukan.

### 3. Menjalankan Mode Development

Perintah ini akan menjalankan **kedua aplikasi** (Backend & Frontend) secara paralel menggunakan Turborepo.

```bash
npm run dev
```

- **Backend API**: Berjalan di [http://localhost:8000/api/v1](http://localhost:8000/api/v1)
- **Swagger Docs**: [http://localhost:8000/api/docs](http://localhost:8000/api/docs)
- **Frontend UI**: Berjalan di [http://localhost:3000](http://localhost:3000)

### Database & Seed
Pastikan PostgreSQL berjalan, lalu:

```bash
cd apps/nestjs
npm run prisma:migrate   # buat/selaraskan tabel
npm run seed             # isi user, kategori, dan contoh lelang
```

Akun demo (lihat `apps/nestjs/src/database/seed.ts`):

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@scrapbid.test` | `Password123` |
| Vendor | `vendor@scrapbid.test` | `Password123` |
| Bidder | `bidder@scrapbid.test` | `Password123` |

### 4. Build untuk Production

Untuk memastikan tidak ada error TypeScript dan membuat build production:

```bash
npm run build
```

---

## 📚 Dokumentasi Detail

- [**Backend Documentation**](./apps/backend/README.md): Penjelasan detail tentang API, Database, dan Auth.
- [**Frontend Documentation**](./apps/frontend/README.md): Penjelasan tentang struktur UI dan Routing.
- [**Architecture & Strategy**](./PROJECT_STRATEGY.md): Penjelasan mendalam tentang keputusan teknis dan desain sistem.

---

**Author**: Ings
_Project ini dibuat untuk tujuan pembelajaran dan portofolio._
