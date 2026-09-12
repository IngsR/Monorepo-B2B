import { HttpEvent, HttpInterceptorFn, HttpParams, HttpResponse } from '@angular/common/http';
import { map } from 'rxjs';

/**
 * Backend response adapter.
 *
 * The Angular domain models were written against a richer contract than the
 * current NestJS API returns. Rather than rewrite every feature service and
 * template, this interceptor normalises the real responses into the shapes the
 * UI already consumes. It is the single place that knows about the mapping, so
 * the rest of the app stays backend-agnostic.
 *
 * Three differences it reconciles:
 *
 *  1. Pagination key — the API returns `{ data, meta }`, the UI reads
 *     `{ items, meta }`.
 *  2. Entity field names — the API stores a single `name` on User (the UI splits
 *     it into first/last), and Vendor/Bidder carry fewer fields than the models
 *     declare.
 *  3. Auction timing — the API uses `startAt` / `endAt`; the UI uses
 *     `startTime` / `endTime`.
 *
 * Every mapper is defensive: an unexpected shape is passed through untouched
 * rather than corrupted, so a future backend change degrades to a visible gap
 * instead of a crash.
 */

type Dict = Record<string, unknown>;

const isObject = (value: unknown): value is Dict =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Splits "Jane Doe" into first/last, preserving a single-token name. */
function splitName(name: unknown): { firstName: string; lastName: string } {
  const value = typeof name === 'string' ? name.trim() : '';
  if (!value) return { firstName: '', lastName: '' };
  const [first, ...rest] = value.split(/\s+/);
  return { firstName: first, lastName: rest.join(' ') };
}

/** Converts a Decimal-as-string field into a number where the UI expects one. */
function toNumber(value: unknown): unknown {
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return value;
}

/** /auth/me and /users rows: `name` → firstName/lastName, keep the raw `name`. */
function mapUser(raw: unknown): unknown {
  if (!isObject(raw)) return raw;
  return { ...raw, ...splitName(raw['name']) };
}

function mapVendor(raw: unknown): unknown {
  if (!isObject(raw)) return raw;
  return {
    ...raw,
    // The API has no contact person; surface the company name so no UI cell is blank.
    contactPerson: raw['contactPerson'] ?? raw['companyName'] ?? '—',
    user: raw['user'],
    productCount: raw['productCount'] ?? 0,
  };
}

function mapBidder(raw: unknown): unknown {
  if (!isObject(raw)) return raw;
  return {
    ...raw,
    contactPerson: raw['contactPerson'] ?? '—',
    user: raw['user'],
    bidCount: raw['bidCount'] ?? 0,
  };
}

function mapCategory(raw: unknown): unknown {
  if (!isObject(raw)) return raw;
  return {
    ...raw,
    // The API stores only a name; derive the slug the UI shows and keep it stable.
    slug: raw['slug'] ?? slugify(raw['name']),
    description: raw['description'] ?? '',
    productCount: raw['productCount'] ?? 0,
  };
}

function slugify(value: unknown): string {
  return typeof value === 'string'
    ? value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
    : '';
}

function mapProduct(raw: unknown): unknown {
  if (!isObject(raw)) return raw;
  return { ...raw, category: raw['category'], vendor: raw['vendor'] };
}

function mapAuction(raw: unknown): unknown {
  if (!isObject(raw)) return raw;
  return {
    ...raw,
    // Timing field renames.
    startTime: raw['startTime'] ?? raw['startAt'],
    endTime: raw['endTime'] ?? raw['endAt'],
    // Decimal-as-string → number for the price columns.
    startingPrice: toNumber(raw['startingPrice']),
    currentPrice: toNumber(raw['currentPrice']),
    bidIncrement: toNumber(raw['bidIncrement']),
    highestBidAmount: toNumber(raw['highestBidAmount']),
  };
}

function mapBid(raw: unknown): unknown {
  if (!isObject(raw)) return raw;
  return {
    ...raw,
    amount: toNumber(raw['amount']),
    auction: raw['auction'] ? mapAuction(raw['auction']) : undefined,
  };
}

/**
 * Chooses a mapper from the resource segment in the URL. The last matching
 * segment wins so `/auctions/:id/bids` maps bids, not auctions.
 */
function mapperFor(url: string): ((raw: unknown) => unknown) | null {
  const path = url.split('?')[0];
  if (/\/bids(\/|$)/.test(path) || /\/bids\/mine/.test(path)) return mapBid;
  if (/\/auctions(\/|$)/.test(path)) return mapAuction;
  if (/\/products(\/|$)/.test(path)) return mapProduct;
  if (/\/categories(\/|$)/.test(path)) return mapCategory;
  if (/\/vendors(\/|$)/.test(path)) return mapVendor;
  if (/\/bidders(\/|$)/.test(path)) return mapBidder;
  if (/\/users(\/|$)/.test(path) || /\/auth\//.test(path)) return mapUser;
  return null;
}

/** Rewrites `{ data, meta }` collections into `{ items, meta }`. */
function mapPaginated(raw: Dict, mapper: (value: unknown) => unknown): Dict {
  if (Array.isArray(raw['data']) && isObject(raw['meta'])) {
    return { items: raw['data'].map(mapper), meta: raw['meta'] };
  }
  return raw;
}

/**
 * Applies the mapper to a response body, handling three payload shapes:
 * a paginated collection, a single entity, or `null` (e.g. highest bid).
 */
function adaptBody(body: unknown, mapper: (value: unknown) => unknown): unknown {
  if (body === null || body === undefined) return body;

  // Envelope: { success, data, message }
  if (isObject(body) && 'data' in body && 'success' in body) {
    const inner = body['data'];
    if (isObject(inner) && Array.isArray(inner['data']) && isObject(inner['meta'])) {
      return { ...body, data: mapPaginated(inner, mapper) };
    }
    return { ...body, data: Array.isArray(inner) ? inner.map(mapper) : mapper(inner) };
  }

  return body;
}

/* --------------------------------------------------------------------------
   Request side: translate the UI's query vocabulary into the API's.
   -------------------------------------------------------------------------- */

/**
 * The marketplace sorts by `endingSoon | newest | priceAsc | priceDesc |
 * mostBids`. The API accepts only a whitelisted `sortBy` + `sortOrder` pair, so
 * map each UI value onto a concrete field and direction.
 */
const AUCTION_SORT: Record<string, { sortBy: string; sortOrder: 'asc' | 'desc' }> = {
  endingSoon: { sortBy: 'endAt', sortOrder: 'asc' },
  newest: { sortBy: 'createdAt', sortOrder: 'desc' },
  priceAsc: { sortBy: 'currentPrice', sortOrder: 'asc' },
  priceDesc: { sortBy: 'currentPrice', sortOrder: 'desc' },
  // `mostBids` has no backing column; newest is the closest supported ordering.
  mostBids: { sortBy: 'createdAt', sortOrder: 'desc' },
};

/** Query keys the UI sends that the API does not accept (would be rejected). */
const DROP_QUERY_KEYS = new Set([
  'orderBy',
  'minPrice',
  'maxPrice',
  'categoryId',
  'endingSoonMinutes',
  'vendorId',
  'role',
  'status',
  'sort',
]);

/** The bid history sorts by `highest | newest | oldest`; map onto the API pair. */
const BID_SORT: Record<string, { sortBy: string; sortOrder: 'asc' | 'desc' }> = {
  highest: { sortBy: 'amount', sortOrder: 'desc' },
  newest: { sortBy: 'createdAt', sortOrder: 'desc' },
  oldest: { sortBy: 'createdAt', sortOrder: 'asc' },
};

function isAuctionList(url: string): boolean {
  const path = url.split('?')[0];
  return /\/auctions\/?(\?|$)/.test(path) || path.endsWith('/auctions');
}

function isBidList(url: string): boolean {
  const path = url.split('?')[0];
  return /\/bids(\/|$)/.test(path);
}

function isProductList(url: string): boolean {
  const path = url.split('?')[0];
  return path.endsWith('/products') || path.endsWith('/products/mine');
}

function adaptParams(req: Parameters<HttpInterceptorFn>[0]): HttpParams | null {
  const isAuction = isAuctionList(req.url);
  const isProduct = isProductList(req.url);
  const isBid = isBidList(req.url);
  if (!isAuction && !isProduct && !isBid) return null;

  let out = new HttpParams();
  let changed = false;

  const orderBy = req.params.get('orderBy');
  const sort = req.params.get('sort');

  for (const key of req.params.keys()) {
    // `orderBy` and `sort` are translated into sortBy/sortOrder below.
    if (key === 'orderBy' || key === 'sort') continue;

    // `status` is a valid auction filter; every other dropped key is not.
    const keepStatus = key === 'status' && isAuction;
    // `categoryId` is a valid product filter, not an auction one.
    const keepCategory = key === 'categoryId' && isProduct;

    if (DROP_QUERY_KEYS.has(key) && !keepStatus && !keepCategory) {
      changed = true;
      continue;
    }

    out = out.set(key, req.params.get(key) ?? '');
  }

  if (isAuction && orderBy) {
    const mapped = AUCTION_SORT[orderBy] ?? AUCTION_SORT['endingSoon'];
    out = out.set('sortBy', mapped.sortBy);
    out = out.set('sortOrder', mapped.sortOrder);
    changed = true;
  }

  if (isBid && sort) {
    const mapped = BID_SORT[sort] ?? BID_SORT['highest'];
    out = out.set('sortBy', mapped.sortBy);
    out = out.set('sortOrder', mapped.sortOrder);
    changed = true;
  }

  if ((isProduct || isBid) && !out.has('sortBy')) {
    out = out.set('sortBy', 'createdAt');
    out = out.set('sortOrder', 'desc');
    changed = true;
  }

  return changed ? out : null;
}

export const apiShapeInterceptor: HttpInterceptorFn = (req, next) => {
  const mapper = mapperFor(req.url);

  // Rewrite the query string for list endpoints so the API accepts it.
  const params = adaptParams(req);
  const outgoing = params ? req.clone({ params }) : req;

  if (!mapper) return next(outgoing);

  return next(outgoing).pipe(
    map((event: HttpEvent<unknown>) => {
      if (!(event instanceof HttpResponse) || event.body === null) return event;
      // DELETE returns 204 with no body worth mapping.
      if (event.status === 204) return event;

      const adapted = adaptBody(event.body, mapper);
      return adapted === event.body ? event : event.clone({ body: adapted });
    }),
  );
};
