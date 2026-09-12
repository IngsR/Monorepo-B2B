import { describe, expect, it } from 'vitest';
import {
  canManageAuction,
  canTransition,
  ENDING_SOON_MS,
  getTransition,
  isBiddable,
  isTerminal,
  isOwnedByVendor,
  minimumNextBid,
  resolveTiming,
  roundCurrency,
  transitionsFrom,
} from './auction-lifecycle';
import { AuctionStatus, UserRole } from './enums';
import { Auction } from './models';

/**
 * The lifecycle transition table is the domain rule the whole product depends
 * on: the UI offers actions from these same functions, so a regression here
 * would surface as an illegal transition offered to a user.
 */

const NOW = Date.parse('2026-01-15T12:00:00Z');
const HOUR = 3_600_000;

function auction(overrides: Partial<Auction> = {}): Auction {
  return {
    id: 'auc_test',
    productId: 'prd_test',
    vendorId: 'vnd_test',
    startingPrice: 100,
    currentPrice: 100,
    bidIncrement: 10,
    startTime: new Date(NOW - HOUR).toISOString(),
    endTime: new Date(NOW + HOUR).toISOString(),
    status: AuctionStatus.ACTIVE,
    bidCount: 0,
    createdAt: new Date(NOW - 24 * HOUR).toISOString(),
    updatedAt: new Date(NOW).toISOString(),
    ...overrides,
  };
}

describe('auction lifecycle transitions', () => {
  it('allows DRAFT → SCHEDULED and DRAFT → CANCELLED only', () => {
    const targets = transitionsFrom(AuctionStatus.DRAFT).map((t) => t.to);
    expect(targets).toEqual([AuctionStatus.SCHEDULED, AuctionStatus.CANCELLED]);
  });

  it('allows SCHEDULED → ACTIVE and SCHEDULED → CANCELLED only', () => {
    const targets = transitionsFrom(AuctionStatus.SCHEDULED).map((t) => t.to);
    expect(targets).toEqual([AuctionStatus.ACTIVE, AuctionStatus.CANCELLED]);
  });

  it('allows ACTIVE → ENDED and ACTIVE → CANCELLED only', () => {
    const targets = transitionsFrom(AuctionStatus.ACTIVE).map((t) => t.to);
    expect(targets).toEqual([AuctionStatus.ENDED, AuctionStatus.CANCELLED]);
  });

  it('never allows DRAFT to jump directly to ACTIVE', () => {
    expect(canTransition(AuctionStatus.DRAFT, AuctionStatus.ACTIVE)).toBe(false);
  });

  it('never allows SCHEDULED to jump directly to ENDED', () => {
    expect(canTransition(AuctionStatus.SCHEDULED, AuctionStatus.ENDED)).toBe(false);
  });

  it('treats ENDED and CANCELLED as terminal', () => {
    expect(transitionsFrom(AuctionStatus.ENDED)).toEqual([]);
    expect(transitionsFrom(AuctionStatus.CANCELLED)).toEqual([]);
    expect(isTerminal(AuctionStatus.ENDED)).toBe(true);
    expect(isTerminal(AuctionStatus.CANCELLED)).toBe(true);
    expect(isTerminal(AuctionStatus.ACTIVE)).toBe(false);
  });

  it('rejects a transition back to the current status', () => {
    for (const status of Object.values(AuctionStatus)) {
      expect(canTransition(status, status)).toBe(false);
    }
  });

  it('exposes the description and destructive flag of each transition', () => {
    const schedule = getTransition(AuctionStatus.DRAFT, AuctionStatus.SCHEDULED);
    expect(schedule?.label).toBe('Schedule');
    expect(schedule?.destructive).toBe(false);

    const cancel = getTransition(AuctionStatus.ACTIVE, AuctionStatus.CANCELLED);
    expect(cancel?.destructive).toBe(true);
  });

  it('only treats ACTIVE as biddable', () => {
    expect(isBiddable(AuctionStatus.ACTIVE)).toBe(true);
    for (const status of [
      AuctionStatus.DRAFT,
      AuctionStatus.SCHEDULED,
      AuctionStatus.ENDED,
      AuctionStatus.CANCELLED,
    ]) {
      expect(isBiddable(status)).toBe(false);
    }
  });
});

describe('minimum next bid', () => {
  it('is the current price plus the increment', () => {
    expect(minimumNextBid({ currentPrice: 100, bidIncrement: 10 })).toBe(110);
  });

  it('works for the first bid, where current price equals the starting price', () => {
    // A brand-new auction has currentPrice === startingPrice.
    expect(minimumNextBid({ currentPrice: 92_000, bidIncrement: 2_500 })).toBe(94_500);
  });

  it('avoids floating point drift', () => {
    // 0.1 + 0.2 === 0.30000004 in IEEE 754.
    expect(minimumNextBid({ currentPrice: 0.1, bidIncrement: 0.2 })).toBe(0.3);
  });
});

describe('roundCurrency', () => {
  it('removes the drift that currency arithmetic introduces', () => {
    // The realistic failure mode: summing decimals produces 0.30000004.
    expect(roundCurrency(0.1 + 0.2)).toBe(0.3);
    expect(roundCurrency(1.1 * 3)).toBe(3.3);
  });

  it('rounds to two decimal places', () => {
    expect(roundCurrency(10.999)).toBe(11);
    expect(roundCurrency(2.5)).toBe(2.5);
    expect(roundCurrency(118_500 + 2_500.004)).toBe(121_000);
  });

  it('leaves already-clean values untouched', () => {
    for (const value of [0, 1, 99.99, 118_500, 2_500.5]) {
      expect(roundCurrency(value)).toBe(value);
    }
  });
});

describe('resolveTiming — the end time is authoritative for bidding', () => {
  it('accepts bids while ACTIVE and inside the window', () => {
    const timing = resolveTiming(auction(), NOW);
    expect(timing.acceptingBids).toBe(true);
    expect(timing.inWindow).toBe(true);
    expect(timing.clockExpired).toBe(false);
  });

  it('stops accepting bids once the end time has passed, even if still recorded ACTIVE', () => {
    const timing = resolveTiming(
      auction({ status: AuctionStatus.ACTIVE, endTime: new Date(NOW - HOUR).toISOString() }),
      NOW,
    );
    expect(timing.status).toBe(AuctionStatus.ACTIVE);
    expect(timing.clockExpired).toBe(true);
    expect(timing.acceptingBids).toBe(false);
  });

  it('does not accept bids before the window opens', () => {
    const timing = resolveTiming(
      auction({
        status: AuctionStatus.SCHEDULED,
        startTime: new Date(NOW + HOUR).toISOString(),
        endTime: new Date(NOW + 2 * HOUR).toISOString(),
      }),
      NOW,
    );
    expect(timing.inWindow).toBe(false);
    expect(timing.acceptingBids).toBe(false);
    expect(timing.msToStart).toBeGreaterThan(0);
  });

  it('flags ending soon only inside the threshold and while accepting bids', () => {
    const soon = resolveTiming(
      auction({ endTime: new Date(NOW + ENDING_SOON_MS - 1000).toISOString() }),
      NOW,
    );
    expect(soon.endingSoon).toBe(true);

    const later = resolveTiming(
      auction({ endTime: new Date(NOW + ENDING_SOON_MS + 60_000).toISOString() }),
      NOW,
    );
    expect(later.endingSoon).toBe(false);
  });

  it('reports negative time remaining once the clock has expired', () => {
    const timing = resolveTiming(auction({ endTime: new Date(NOW - 5000).toISOString() }), NOW);
    expect(timing.msToEnd).toBeLessThan(0);
  });
});

describe('ownership and authorization affordances', () => {
  const vendorAuction = { vendorId: 'vnd_01' };

  it('lets a vendor manage only its own auctions', () => {
    expect(canManageAuction(vendorAuction, UserRole.VENDOR, 'usr_1', 'vnd_01')).toBe(true);
    expect(canManageAuction(vendorAuction, UserRole.VENDOR, 'usr_1', 'vnd_02')).toBe(false);
  });

  it('lets an administrator manage any auction', () => {
    expect(canManageAuction(vendorAuction, UserRole.ADMIN, 'usr_9', null)).toBe(true);
  });

  it('never lets a bidder manage an auction', () => {
    expect(canManageAuction(vendorAuction, UserRole.BIDDER, 'usr_1', 'vnd_01')).toBe(false);
  });

  it('scopes vendor ownership by the vendor profile id, not the user id', () => {
    expect(isOwnedByVendor('vnd_01', UserRole.VENDOR, 'vnd_01')).toBe(true);
    expect(isOwnedByVendor('vnd_01', UserRole.VENDOR, 'vnd_02')).toBe(false);
    // An admin inspecting a vendor resource does not "own" it in the vendor sense.
    expect(isOwnedByVendor('vnd_01', UserRole.ADMIN, 'vnd_01')).toBe(false);
  });

  it('treats a missing vendor profile as no ownership', () => {
    expect(isOwnedByVendor('vnd_01', UserRole.VENDOR, null)).toBe(false);
  });
});
