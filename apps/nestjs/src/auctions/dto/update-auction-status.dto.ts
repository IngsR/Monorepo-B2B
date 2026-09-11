import { IsIn } from 'class-validator';
import { AuctionStatus } from '../../database/prisma.types.js';

/**
 * Transisi status manual yang diizinkan lewat API.
 *
 * Lifecycle: DRAFT → SCHEDULED → ACTIVE → ENDED, plus CANCELLED dari state
 * yang sah. Validitas transisi per-state tetap ditegakkan di service
 * (`TRANSITIONS`), bukan hanya dari nilai status yang dikirim client.
 *
 * `ENDED` menutup auction (mis. setelah `endAt` lewat). Waktu `endAt` tetap
 * menjadi penentu penolakan bid; `ENDED` merekam penutupan secara eksplisit.
 */
export const MANUAL_STATUS_TRANSITIONS = [
  AuctionStatus.SCHEDULED,
  AuctionStatus.ACTIVE,
  AuctionStatus.ENDED,
  AuctionStatus.CANCELLED,
] as const;

export class UpdateAuctionStatusDto {
  @IsIn(MANUAL_STATUS_TRANSITIONS)
  status: (typeof MANUAL_STATUS_TRANSITIONS)[number];
}
