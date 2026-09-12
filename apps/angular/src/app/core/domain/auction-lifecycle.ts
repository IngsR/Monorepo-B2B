import { AuctionStatus, UserRole } from './enums';
import { Auction } from './models';

/**
 * Auction lifecycle — the authoritative transition table.
 *
 *   DRAFT     → SCHEDULED | CANCELLED
 *   SCHEDULED → ACTIVE    | CANCELLED
 *   ACTIVE    → ENDED     | CANCELLED
 *   ENDED     → (terminal, no transitions)
 *   CANCELLED → (terminal, no transitions)
 *
 * There is deliberately no DRAFT → ACTIVE and no SCHEDULED → ENDED edge:
 * a draft must be scheduled before it can run, and an auction can only be
 * ended once it is actually active.
 */
export interface LifecycleTransition {
  to: AuctionStatus;
  label: string;
  /** Human explanation surfaced in confirmation dialogs. */
  description: string;
  /** Danger styling for destructive transitions. */
  destructive: boolean;
}

const TRANSITIONS: Record<AuctionStatus, LifecycleTransition[]> = {
  [AuctionStatus.DRAFT]: [
    {
      to: AuctionStatus.SCHEDULED,
      label: 'Schedule',
      description:
        'The auction becomes scheduled and will activate automatically at its start time.',
      destructive: false,
    },
    {
      to: AuctionStatus.CANCELLED,
      label: 'Cancel',
      description: 'The auction is cancelled permanently. This cannot be undone.',
      destructive: true,
    },
  ],
  [AuctionStatus.SCHEDULED]: [
    {
      to: AuctionStatus.ACTIVE,
      label: 'Activate',
      description:
        'The auction opens for bidding immediately. Bidding closes at the recorded end time.',
      destructive: false,
    },
    {
      to: AuctionStatus.CANCELLED,
      label: 'Cancel',
      description: 'The auction is cancelled permanently. This cannot be undone.',
      destructive: true,
    },
  ],
  [AuctionStatus.ACTIVE]: [
    {
      to: AuctionStatus.ENDED,
      label: 'End auction',
      description:
        'Bidding closes. The winner is derived from the highest valid bid — no winner record is created.',
      destructive: false,
    },
    {
      to: AuctionStatus.CANCELLED,
      label: 'Cancel',
      description: 'The auction is cancelled permanently. This cannot be undone.',
      destructive: true,
    },
  ],
  [AuctionStatus.ENDED]: [],
  [AuctionStatus.CANCELLED]: [],
};

/** The ordered path an auction follows when it is not cancelled. */
export const LIFECYCLE_PATH: AuctionStatus[] = [
  AuctionStatus.DRAFT,
  AuctionStatus.SCHEDULED,
  AuctionStatus.ACTIVE,
  AuctionStatus.ENDED,
];

/** Terminal states accept no further transitions. */
export const TERMINAL_STATUSES: AuctionStatus[] = [AuctionStatus.ENDED, AuctionStatus.CANCELLED];

export function isTerminal(status: AuctionStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

export function isBiddable(status: AuctionStatus): boolean {
  return status === AuctionStatus.ACTIVE;
}

/** Transitions available from the current status — drives which buttons render. */
export function transitionsFrom(status: AuctionStatus): LifecycleTransition[] {
  return TRANSITIONS[status] ?? [];
}

export function canTransition(from: AuctionStatus, to: AuctionStatus): boolean {
  return transitionsFrom(from).some((t) => t.to === to);
}

export function getTransition(
  from: AuctionStatus,
  to: AuctionStatus,
): LifecycleTransition | undefined {
  return transitionsFrom(from).find((t) => t.to === to);
}

/* --------------------------------------------------------------------------
   EFFECTIVE STATE
   The recorded status is authoritative for lifecycle transitions, but the
   time window is authoritative for bidding. These helpers keep the two
   concepts distinct instead of collapsing them into one flag.
   -------------------------------------------------------------------------- */

export interface AuctionTiming {
  /** Recorded status as stored by the server. */
  status: AuctionStatus;
  /** ms since epoch; negative when the window has not opened yet. */
  msToStart: number;
  /** ms since epoch; negative when the window has closed. */
  msToEnd: number;
  /** Now is inside [startTime, endTime). */
  inWindow: boolean;
  /** Status is ACTIVE but the clock has already passed endTime. */
  clockExpired: boolean;
  /** Status is ACTIVE and the clock is still running. */
  acceptingBids: boolean;
  /** Under 30 minutes remaining and still accepting bids. */
  endingSoon: boolean;
}

export const ENDING_SOON_MS = 30 * 60 * 1000;

/**
 * A neutral timing shape representing "not open for bidding".
 *
 * Used as the initial value before an auction has loaded, so a template can
 * read `timing().acceptingBids` without a null check and without implying that
 * bidding is open by default.
 */
export const CLOSED_TIMING: AuctionTiming = {
  status: AuctionStatus.DRAFT,
  msToStart: 0,
  msToEnd: 0,
  inWindow: false,
  clockExpired: false,
  acceptingBids: false,
  endingSoon: false,
};

export function resolveTiming(auction: Auction, now: number = Date.now()): AuctionTiming {
  const start = new Date(auction.startTime).getTime();
  const end = new Date(auction.endTime).getTime();
  const msToStart = start - now;
  const msToEnd = end - now;
  const inWindow = msToStart <= 0 && msToEnd > 0;
  const clockExpired = msToEnd <= 0;

  return {
    status: auction.status,
    msToStart,
    msToEnd,
    inWindow,
    clockExpired,
    acceptingBids: auction.status === AuctionStatus.ACTIVE && !clockExpired,
    endingSoon:
      auction.status === AuctionStatus.ACTIVE && !clockExpired && msToEnd <= ENDING_SOON_MS,
  };
}

/**
 * The only correct source for "the minimum amount this bidder may submit":
 * current price + bid increment. currentPrice already equals startingPrice
 * while the auction has no valid bids, so this holds for the first bid too.
 */
export function minimumNextBid(auction: Pick<Auction, 'currentPrice' | 'bidIncrement'>): number {
  return roundCurrency(auction.currentPrice + auction.bidIncrement);
}

/** Guard against floating point drift on currency arithmetic. */
export function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * True when the signed-in user may manage this auction's lifecycle.
 * ADMIN manages any auction; VENDOR only the auctions they own.
 * This is a UI affordance check — the server remains authoritative.
 */
export function canManageAuction(
  auction: Pick<Auction, 'vendorId'>,
  role: UserRole | null,
  userId: string | null,
  vendorId: string | null,
): boolean {
  if (role === UserRole.ADMIN) return true;
  if (role !== UserRole.VENDOR) return false;
  if (vendorId && vendorId === auction.vendorId) return true;
  return !!userId && auction.vendorId === userId;
}

/**
 * True when the signed-in user owns the product/auction in the vendor sense.
 * Admins are intentionally excluded here: they may inspect vendor resources
 * through the admin APIs, but the vendor workspace only ever shows their own.
 */
export function isOwnedByVendor(
  resourceVendorId: string,
  role: UserRole | null,
  vendorId: string | null,
): boolean {
  return role === UserRole.VENDOR && !!vendorId && resourceVendorId === vendorId;
}
