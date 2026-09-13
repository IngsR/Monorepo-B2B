# Rencana Selanjutnya — BidForge B2B Auction Platform

> Status proyek, cakupan halaman per role, dan roadmap. Diperbarui setelah
> audit + integrasi Angular <-> NestJS.

## 1. Ringkasan Status

| Area | Kondisi | Catatan |
| --- | --- | --- |
| Halaman per role (UI) | OK | Admin, Vendor, Bidder, + halaman bersama |
| Routing & guard | OK | canMatch + canActivate per role, lazy-loaded |
| Backend REST API | OK | Users, Vendors, Bidders, Categories, Products, Auctions, Bids, Auth, Health |
| Tabel kategori di DB | OK | Model Prisma + migrasi + seed contoh kategori |
| CRUD kategori admin | OK | Create/Update/Delete (ADMIN only) teruji via API |
| UI Marketplace & Detail | OK | Hero, rail kategori, filter chip, galeri, spec, seller card |
| Konflik merge | OK | apps/nestjs/src/app.module.ts bersih |
| Build & test | OK | Angular 97 tes, NestJS 117 tes, build keduanya lolos |
| Integrasi FE <-> BE | OK | Frontend menembak NestJS di :8000/api/v1, mock dinonaktifkan |

## 2. Port & Cara Jalan

- Angular dev server: 3000
- NestJS API: 8000 (prefix /api/v1)
- Swagger: 8000/api/docs
- environment.apiUrl = http://localhost:8000/api/v1
- CORS backend: http://localhost:3000

Langkah:
1. cd apps/nestjs && npm run prisma:migrate && npm run seed
2. cd apps/nestjs && npm run start   (port 8000)
3. cd apps/angular && npm run dev    (port 3000)

Akun demo (Password123): admin@scrapbid.test, vendor@scrapbid.test, bidder@scrapbid.test.

## 3. Integrasi (ringkasan teknis)

- mockApiInterceptor dilepas dari app.config.ts, diganti apiShapeInterceptor.
- apiShapeInterceptor menormalkan bentuk respons NestJS ke model UI:
  - paginasi { data, meta } -> { items, meta }
  - User.name -> firstName/lastName
  - Auction.startAt/endAt -> startTime/endTime; Decimal string -> number
  - Category -> tambah slug/description; Vendor/Bidder -> contactPerson default
  - query: orderBy/sort -> sortBy+sortOrder; drop filter yang tak didukung API
- Backend auctions.service: findAll/findOne menyertakan product(+category,vendor)
  dan _count.bids -> bidCount.

## 4. Rencana Selanjutnya

Fase 1 — Integrasi lanjutan:
- Selaraskan model Vendor/Bidder UI dengan schema (mis. companyAddress vs contactPerson).
- Sinkronisasi real-time bid (WebSocket/SSE).
- Tangani relasi product/category saat vendor membuat produk di UI.

Fase 2 — Kelengkapan fitur:
- Upload gambar produk (galeri saat ini placeholder).
- Alur pemenang lelang: invoice & status pembayaran.
- Analitik admin.

Fase 3 — Kualitas & operasional:
- E2E test (Playwright) per alur role.
- Audit log, soft delete, rate limiting.
- CI pipeline (lint + test + build) di Turborepo.
