/**
 * Role untuk seluruh sistem.
 *
 * Single source of truth ada di Prisma enum (`prisma/schema.prisma`).
 * File ini hanya me-re-export agar feature code punya satu import path yang
 * stabil dan tidak ada dua definisi role yang bisa saling menyimpang.
 */
export { UserRole } from '../../../generated/prisma/client.js';
