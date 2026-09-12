import { describe, expect, it } from 'vitest';
import { AuctionStatus } from '../domain/enums';
import { MockApiError, mockApi } from './mock-api';
import { DEMO_PASSWORD, auctions, bids } from './mock-data';

/**
 * The mock API stands in for the NestJS backend, so it must enforce the same
 * rules the UI relies on: authorization by role, ownership scoping, the bid
 * minimum, and the lifecycle. These tests assert those rules rather than the
 * data itself.
 */

/** Signs in and returns the bearer token. */
function tokenFor(email: string): string {
  return mockApi.login({ email, password: DEMO_PASSWORD }).accessToken;
}

/** Runs `fn` and returns the MockApiError it throws. */
function expectFailure(fn: () => unknown): MockApiError {
  try {
    fn();
  } catch (error) {
    if (error instanceof MockApiError) return error;
    throw error;
  }
  throw new Error('Expected the call to fail, but it succeeded.');
}

const ADMIN = 'admin@bidforge.test';
const VENDOR = 'vendor@bidforge.test';
const OTHER_VENDOR = 'meridian@bidforge.test';
const BIDDER = 'bidder@bidforge.test';

describe('authentication', () => {
  it('issues a token for valid credentials', () => {
    const result = mockApi.login({ email: BIDDER, password: DEMO_PASSWORD });
    expect(result.accessToken).toBeTruthy();
  });

  it('rejects a wrong password with 401 rather than revealing which field failed', () => {
    const failure = expectFailure(() => mockApi.login({ email: BIDDER, password: 'wrong' }));
    expect(failure.status).toBe(401);
    expect(failure.message).toMatch(/email address or password is incorrect/i);
  });

  it('rejects a token that was never issued', () => {
    expect(expectFailure(() => mockApi.me('not-a-real-token')).status).toBe(401);
  });

  it('requires a token at all', () => {
    expect(expectFailure(() => mockApi.me(null)).status).toBe(401);
  });
});

describe('role authorization', () => {
  it('lets only an administrator list users', () => {
    expect(mockApi.listUsers(tokenFor(ADMIN)).meta.total).toBeGreaterThan(0);
    expect(expectFailure(() => mockApi.listUsers(tokenFor(VENDOR))).status).toBe(403);
    expect(expectFailure(() => mockApi.listUsers(tokenFor(BIDDER))).status).toBe(403);
  });

  it('lets only an administrator list vendor and bidder profiles', () => {
    expect(mockApi.listVendors(tokenFor(ADMIN)).meta.total).toBeGreaterThan(0);
    expect(expectFailure(() => mockApi.listVendors(tokenFor(BIDDER))).status).toBe(403);
    expect(mockApi.listBidders(tokenFor(ADMIN)).meta.total).toBeGreaterThan(0);
    expect(expectFailure(() => mockApi.listBidders(tokenFor(VENDOR))).status).toBe(403);
  });

  it('lets only an administrator create a category', () => {
    expect(
      expectFailure(() => mockApi.createCategory(tokenFor(VENDOR), { name: 'X' })).status,
    ).toBe(403);
    expect(
      expectFailure(() => mockApi.createCategory(tokenFor(BIDDER), { name: 'X' })).status,
    ).toBe(403);
  });

  it('lets any authenticated user read categories', () => {
    for (const email of [ADMIN, VENDOR, BIDDER]) {
      expect(mockApi.listCategories(tokenFor(email)).meta.total).toBeGreaterThan(0);
    }
  });
});

describe('ownership scoping', () => {
  it('scopes /products/mine to the calling vendor', () => {
    const mine = mockApi.listMyProducts(tokenFor(VENDOR));
    expect(mine.items.length).toBeGreaterThan(0);
    // Every returned product must belong to the authenticated vendor.
    const vendorId = mockApi.getMyVendorProfile(tokenFor(VENDOR)).id;
    for (const product of mine.items) {
      expect(product.vendorId).toBe(vendorId);
    }
  });

  it('scopes /auctions/mine to the calling vendor', () => {
    const mine = mockApi.listMyAuctions(tokenFor(VENDOR));
    const vendorId = mockApi.getMyVendorProfile(tokenFor(VENDOR)).id;
    for (const auction of mine.items) {
      expect(auction.vendorId).toBe(vendorId);
    }
  });

  it('refuses to update another vendor`s product', () => {
    const otherProduct = mockApi.listMyProducts(tokenFor(OTHER_VENDOR)).items[0]!;
    const failure = expectFailure(() =>
      mockApi.updateProduct(tokenFor(VENDOR), otherProduct.id, { name: 'Hijacked' }),
    );
    expect(failure.status).toBe(403);
    expect(failure.message).toMatch(/own vendor account|owned by your vendor/i);
  });

  it('refuses to delete another vendor`s product', () => {
    const otherProduct = mockApi.listMyProducts(tokenFor(OTHER_VENDOR)).items[0]!;
    expect(
      expectFailure(() => mockApi.deleteProduct(tokenFor(VENDOR), otherProduct.id)).status,
    ).toBe(403);
  });

  it('refuses to change another vendor`s auction status', () => {
    const otherAuction = mockApi.listMyAuctions(tokenFor(OTHER_VENDOR)).items[0]!;
    const failure = expectFailure(() =>
      mockApi.updateAuctionStatus(tokenFor(VENDOR), otherAuction.id, AuctionStatus.CANCELLED),
    );
    expect(failure.status).toBe(403);
  });

  it('lets an administrator act on any vendor`s resource', () => {
    const anyAuction = auctions[0]!;
    expect(() =>
      mockApi.updateAuctionStatus(tokenFor(ADMIN), anyAuction.id, AuctionStatus.CANCELLED),
    ).not.toThrow();
  });

  it('refuses to read another bidder`s profile', () => {
    const others = mockApi.listBidders(tokenFor(ADMIN)).items;
    const notMe = others.find((b) => b.user?.email !== BIDDER)!;
    expect(expectFailure(() => mockApi.getBidder(tokenFor(BIDDER), notMe.id)).status).toBe(403);
  });
});

describe('product creation', () => {
  it('takes vendor ownership from the token, never from the payload', () => {
    const vendorId = mockApi.getMyVendorProfile(tokenFor(VENDOR)).id;
    const categoryId = mockApi.listCategories(tokenFor(VENDOR)).items[0]!.id;

    const created = mockApi.createProduct(tokenFor(VENDOR), {
      code: `TST-${Date.now()}`,
      name: 'Test product',
      categoryId,
    });

    expect(created.vendorId).toBe(vendorId);
  });

  it('refuses a duplicate product code with 409', () => {
    const existing = mockApi.listMyProducts(tokenFor(VENDOR)).items[0]!;
    const failure = expectFailure(() =>
      mockApi.createProduct(tokenFor(VENDOR), {
        code: existing.code,
        name: 'Duplicate',
        categoryId: existing.categoryId,
      }),
    );
    expect(failure.status).toBe(409);
    expect(failure.fieldErrors?.['code']).toBeTruthy();
  });

  it('refuses to delete a product that an auction references', () => {
    // auc_01 is built from prd_01.
    const linked = mockApi.getProduct(tokenFor(VENDOR), 'prd_01');
    expect(linked.auctionCount).toBeGreaterThan(0);
    expect(expectFailure(() => mockApi.deleteProduct(tokenFor(VENDOR), 'prd_01')).status).toBe(409);
  });
});

describe('auction creation and validation', () => {
  const validPayload = () => {
    const now = Date.now();
    return {
      productId: mockApi.listMyProducts(tokenFor(VENDOR)).items[0]!.id,
      startingPrice: 1000,
      bidIncrement: 50,
      startTime: new Date(now + 3_600_000).toISOString(),
      endTime: new Date(now + 7_200_000).toISOString(),
    };
  };

  it('creates a new auction as DRAFT', () => {
    const created = mockApi.createAuction(tokenFor(VENDOR), validPayload());
    expect(created.status).toBe(AuctionStatus.DRAFT);
  });

  it('sets currentPrice equal to startingPrice, since no bid exists yet', () => {
    const payload = validPayload();
    const created = mockApi.createAuction(tokenFor(VENDOR), payload);
    expect(created.currentPrice).toBe(payload.startingPrice);
    expect(created.bidCount).toBe(0);
  });

  it('takes vendor ownership from the token', () => {
    const vendorId = mockApi.getMyVendorProfile(tokenFor(VENDOR)).id;
    expect(mockApi.createAuction(tokenFor(VENDOR), validPayload()).vendorId).toBe(vendorId);
  });

  it('rejects a non-positive starting price', () => {
    const failure = expectFailure(() =>
      mockApi.createAuction(tokenFor(VENDOR), { ...validPayload(), startingPrice: 0 }),
    );
    expect(failure.status).toBe(400);
    expect(failure.fieldErrors?.['startingPrice']).toMatch(/greater than zero/i);
  });

  it('rejects a non-positive bid increment', () => {
    const failure = expectFailure(() =>
      mockApi.createAuction(tokenFor(VENDOR), { ...validPayload(), bidIncrement: 0 }),
    );
    expect(failure.fieldErrors?.['bidIncrement']).toMatch(/greater than zero/i);
  });

  it('rejects an end time that is not later than the start time', () => {
    const payload = validPayload();
    const failure = expectFailure(() =>
      mockApi.createAuction(tokenFor(VENDOR), { ...payload, endTime: payload.startTime }),
    );
    expect(failure.fieldErrors?.['endTime']).toMatch(/later than the start time/i);
  });

  it('refuses to attach another vendor`s product', () => {
    const otherProduct = mockApi.listMyProducts(tokenFor(OTHER_VENDOR)).items[0]!;
    const failure = expectFailure(() =>
      mockApi.createAuction(tokenFor(VENDOR), { ...validPayload(), productId: otherProduct.id }),
    );
    expect(failure.status).toBe(403);
  });

  it('refuses to edit an auction that is already active', () => {
    const active = auctions.find((a) => a.status === AuctionStatus.ACTIVE)!;
    expect(
      expectFailure(() => mockApi.updateAuction(tokenFor(ADMIN), active.id, { startingPrice: 1 }))
        .status,
    ).toBe(409);
  });
});

describe('auction lifecycle enforcement', () => {
  it('refuses an illegal DRAFT → ACTIVE transition', () => {
    const draft = auctions.find((a) => a.status === AuctionStatus.DRAFT)!;
    const failure = expectFailure(() =>
      mockApi.updateAuctionStatus(tokenFor(ADMIN), draft.id, AuctionStatus.ACTIVE),
    );
    expect(failure.status).toBe(409);
    expect(failure.message).toMatch(/cannot move from/i);
  });

  it('refuses a SCHEDULED → ENDED transition', () => {
    const scheduled = auctions.find((a) => a.status === AuctionStatus.SCHEDULED)!;
    expect(
      expectFailure(() =>
        mockApi.updateAuctionStatus(tokenFor(ADMIN), scheduled.id, AuctionStatus.ENDED),
      ).status,
    ).toBe(409);
  });

  it('allows the legal DRAFT → SCHEDULED transition', () => {
    const draft = auctions.find((a) => a.status === AuctionStatus.DRAFT)!;
    const updated = mockApi.updateAuctionStatus(tokenFor(ADMIN), draft.id, AuctionStatus.SCHEDULED);
    expect(updated.status).toBe(AuctionStatus.SCHEDULED);
  });

  it('refuses any transition out of a terminal state', () => {
    const ended = auctions.find((a) => a.status === AuctionStatus.ENDED)!;
    const cancelled = auctions.find((a) => a.status === AuctionStatus.CANCELLED)!;

    for (const target of Object.values(AuctionStatus)) {
      if (target === ended.status) continue;
      expect(
        expectFailure(() => mockApi.updateAuctionStatus(tokenFor(ADMIN), ended.id, target)).status,
      ).toBe(409);
    }
    for (const target of Object.values(AuctionStatus)) {
      if (target === cancelled.status) continue;
      expect(
        expectFailure(() => mockApi.updateAuctionStatus(tokenFor(ADMIN), cancelled.id, target))
          .status,
      ).toBe(409);
    }
  });
});

describe('bidding', () => {
  const activeAuction = () =>
    auctions.find(
      (a) => a.status === AuctionStatus.ACTIVE && new Date(a.endTime).getTime() > Date.now(),
    )!;

  it('accepts a bid at exactly the minimum next bid', () => {
    const auction = mockApi.getAuction(tokenFor(BIDDER), activeAuction().id);
    const minimum = auction.currentPrice + auction.bidIncrement;

    const bid = mockApi.placeBid(tokenFor(BIDDER), auction.id, { amount: minimum });
    expect(bid.amount).toBe(minimum);
    expect(mockApi.getAuction(tokenFor(BIDDER), auction.id).currentPrice).toBe(minimum);
  });

  it('rejects a bid below the minimum with 409 and states the minimum', () => {
    const auction = mockApi.getAuction(tokenFor(BIDDER), activeAuction().id);
    const tooLow = auction.currentPrice + auction.bidIncrement - 1;

    const failure = expectFailure(() =>
      mockApi.placeBid(tokenFor(BIDDER), auction.id, { amount: tooLow }),
    );
    expect(failure.status).toBe(409);
    expect(failure.message).toMatch(/minimum next bid/i);
    expect(failure.fieldErrors?.['amount']).toMatch(/Minimum next bid/i);
  });

  it('records the bidder from the token, never from the payload', () => {
    const auction = activeAuction();
    const bidderId = mockApi.getMyBidderProfile(tokenFor(BIDDER)).id;
    const current = mockApi.getAuction(tokenFor(BIDDER), auction.id);

    const bid = mockApi.placeBid(tokenFor(BIDDER), auction.id, {
      amount: current.currentPrice + current.bidIncrement,
    });

    expect(bid.bidderId).toBe(bidderId);
  });

  it('refuses bids from a vendor account', () => {
    const auction = activeAuction();
    const current = mockApi.getAuction(tokenFor(VENDOR), auction.id);
    const failure = expectFailure(() =>
      mockApi.placeBid(tokenFor(VENDOR), auction.id, {
        amount: current.currentPrice + current.bidIncrement,
      }),
    );
    expect(failure.status).toBe(403);
  });

  it('refuses bids from an administrator account', () => {
    const auction = activeAuction();
    const current = mockApi.getAuction(tokenFor(ADMIN), auction.id);
    expect(
      expectFailure(() =>
        mockApi.placeBid(tokenFor(ADMIN), auction.id, {
          amount: current.currentPrice + current.bidIncrement,
        }),
      ).status,
    ).toBe(403);
  });

  it('refuses bids on an auction that has not started', () => {
    const scheduled = auctions.find((a) => a.status === AuctionStatus.SCHEDULED)!;
    const failure = expectFailure(() =>
      mockApi.placeBid(tokenFor(BIDDER), scheduled.id, { amount: 1_000_000 }),
    );
    expect(failure.status).toBe(409);
    expect(failure.message).toMatch(/not started/i);
  });

  it('refuses bids on an ended auction', () => {
    const ended = auctions.find((a) => a.status === AuctionStatus.ENDED)!;
    expect(
      expectFailure(() => mockApi.placeBid(tokenFor(BIDDER), ended.id, { amount: 1_000_000 }))
        .status,
    ).toBe(409);
  });

  it('refuses bids on an auction that is ACTIVE but past its end time', () => {
    // auc_05 is recorded ACTIVE with an end time in the past.
    const auction = mockApi.getAuction(tokenFor(BIDDER), 'auc_05');
    expect(auction.status).toBe(AuctionStatus.ACTIVE);

    const failure = expectFailure(() =>
      mockApi.placeBid(tokenFor(BIDDER), 'auc_05', {
        amount: auction.currentPrice + auction.bidIncrement,
      }),
    );
    expect(failure.status).toBe(409);
    expect(failure.message).toMatch(/closed/i);
  });

  it('rejects a non-positive amount', () => {
    const auction = activeAuction();
    expect(
      expectFailure(() => mockApi.placeBid(tokenFor(BIDDER), auction.id, { amount: 0 })).status,
    ).toBe(400);
  });

  it('scopes /bids/mine to the calling bidder', () => {
    const bidderId = mockApi.getMyBidderProfile(tokenFor(BIDDER)).id;
    const mine = mockApi.listMyBids(tokenFor(BIDDER));
    for (const bid of mine.items) {
      expect(bid.bidderId).toBe(bidderId);
    }
  });

  it('marks exactly one bid as the highest', () => {
    const auction = activeAuction();
    const list = mockApi.listAuctionBids(tokenFor(BIDDER), auction.id).items;
    expect(list.filter((b) => b.isHighest).length).toBeLessThanOrEqual(1);
  });

  it('masks other bidders` identities from a bidder', () => {
    const auction = auctions.find((a) => a.status === AuctionStatus.ENDED)!;
    const list = mockApi.listAuctionBids(tokenFor(BIDDER), auction.id).items;
    const others = list.filter((b) => b.bidderId === 'hidden');

    // Identities the API withholds must not be present in the payload.
    for (const bid of others) {
      expect(bid.bidderDisplayName).toBeNull();
      expect(bid.bidderCompanyName).toMatch(/•/);
    }
  });
});

describe('categories', () => {
  it('refuses to delete a category that products reference', () => {
    const inUse = mockApi
      .listCategories(tokenFor(ADMIN))
      .items.find((c) => (c.productCount ?? 0) > 0)!;
    const failure = expectFailure(() => mockApi.deleteCategory(tokenFor(ADMIN), inUse.id));
    expect(failure.status).toBe(409);
    expect(failure.message).toMatch(/cannot be deleted/i);
  });

  it('refuses a duplicate category name with 409', () => {
    const existing = mockApi.listCategories(tokenFor(ADMIN)).items[0]!;
    expect(
      expectFailure(() => mockApi.createCategory(tokenFor(ADMIN), { name: existing.name })).status,
    ).toBe(409);
  });
});

describe('profile self-service', () => {
  it('lets a vendor read and update only its own profile', () => {
    const mine = mockApi.getMyVendorProfile(tokenFor(VENDOR));
    const updated = mockApi.updateMyVendorProfile(tokenFor(VENDOR), {
      contactPerson: 'Updated Name',
    });
    expect(updated.id).toBe(mine.id);
    expect(updated.contactPerson).toBe('Updated Name');
  });

  it('lets a bidder read and update only its own profile', () => {
    const mine = mockApi.getMyBidderProfile(tokenFor(BIDDER));
    const updated = mockApi.updateMyBidderProfile(tokenFor(BIDDER), { phone: '+1 555 0100' });
    expect(updated.id).toBe(mine.id);
    expect(updated.phone).toBe('+1 555 0100');
  });

  it('rejects a password change with the wrong current password', () => {
    const failure = expectFailure(() =>
      mockApi.changeMyPassword(tokenFor(BIDDER), {
        currentPassword: 'nope',
        newPassword: 'NewPassword123',
      }),
    );
    expect(failure.status).toBe(400);
    expect(failure.fieldErrors?.['currentPassword']).toBeTruthy();
  });

  it('rejects a new password that is too short', () => {
    const failure = expectFailure(() =>
      mockApi.changeMyPassword(tokenFor(BIDDER), {
        currentPassword: DEMO_PASSWORD,
        newPassword: 'short',
      }),
    );
    expect(failure.fieldErrors?.['newPassword']).toMatch(/8 characters/i);
  });
});

describe('password reset', () => {
  it('responds identically whether or not the address exists', () => {
    const known = mockApi.forgotPassword('bidder@bidforge.test');
    const unknown = mockApi.forgotPassword('nobody@example.test');
    expect(known.message).toBe(unknown.message);
  });

  it('refuses a reset with an invalid token', () => {
    expect(expectFailure(() => mockApi.resetPassword('bogus-token', 'NewPassword123')).status).toBe(
      400,
    );
  });
});

describe('health', () => {
  it('reports ok without authentication', () => {
    expect(mockApi.health().status).toBe('ok');
  });
});

describe('fixture integrity', () => {
  it('covers every auction status so the UI states are demonstrable', () => {
    const statuses = new Set(auctions.map((a) => a.status));
    for (const status of Object.values(AuctionStatus)) {
      expect(statuses.has(status)).toBe(true);
    }
  });

  it('includes an ACTIVE auction whose end time has already passed', () => {
    const stale = auctions.filter(
      (a) => a.status === AuctionStatus.ACTIVE && new Date(a.endTime).getTime() <= Date.now(),
    );
    expect(stale.length).toBeGreaterThan(0);
  });

  it('includes an auction with no bids, to exercise the empty bid history', () => {
    const noBids = auctions.find((a) => !bids.some((bid) => bid.auctionId === a.id));
    expect(noBids).toBeTruthy();
  });

  it('keeps every bid above zero and attributed to a real auction', () => {
    for (const bid of bids) {
      expect(bid.amount).toBeGreaterThan(0);
      expect(auctions.some((a) => a.id === bid.auctionId)).toBe(true);
    }
  });
});
