import {
  HttpErrorResponse,
  HttpEvent,
  HttpInterceptorFn,
  HttpRequest,
  HttpResponse,
} from '@angular/common/http';
import { Observable, delay, of, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiErrorCode, AuctionStatus } from '../domain/enums';
import {
  CategoryPayload,
  ChangePasswordPayload,
  CreateAuctionPayload,
  CreateBidderPayload,
  CreateProductPayload,
  CreateUserPayload,
  CreateVendorPayload,
  ForgotPasswordPayload,
  LoginPayload,
  PlaceBidPayload,
  ResetPasswordPayload,
  UpdateAuctionPayload,
  UpdateBidderPayload,
  UpdateProductPayload,
  UpdateProfilePayload,
  UpdateUserPayload,
  UpdateVendorPayload,
  UserQuery,
  AuctionQuery,
  ProductQuery,
  BidQuery,
} from '../domain/models';
import { MockApiError, mockApi } from '../mock/mock-api';

/**
 * Mock REST transport.
 *
 * The application is written against a real `HttpClient` contract: every service
 * issues genuine HTTP calls with query parameters and JSON bodies. This
 * interceptor terminates those requests against an in-memory implementation of
 * the documented NestJS API, so replacing it with the real backend is a matter
 * of deleting this interceptor from `provideHttpClient(withInterceptors([...]))`.
 *
 * Responsibilities:
 *  - routing by method + path, including path parameters
 *  - unwrapping into the `{ success, data, message }` envelope
 *  - converting domain errors into realistic HTTP error responses
 *  - simulating network latency so loading states are exercised
 */

const LATENCY_MS = 220;

/** Reads the raw bearer token off the request (the auth interceptor adds it). */
function bearer(req: HttpRequest<unknown>): string | null {
  const header = req.headers.get('Authorization');
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length).trim() || null;
}

function ok<T>(body: T, message?: string): { success: true; data: T; message?: string } {
  return message === undefined
    ? { success: true, data: body }
    : { success: true, data: body, message };
}

/** Maps a thrown domain error onto an HttpErrorResponse with the API error envelope. */
function toHttpError(req: HttpRequest<unknown>, error: unknown): HttpErrorResponse {
  if (error instanceof MockApiError) {
    return new HttpErrorResponse({
      url: req.url,
      status: error.status,
      statusText: error.code,
      error: {
        success: false,
        message: error.message,
        code: error.code,
        ...(error.fieldErrors ? { fieldErrors: error.fieldErrors } : {}),
      },
    });
  }

  return new HttpErrorResponse({
    url: req.url,
    status: 500,
    statusText: ApiErrorCode.INTERNAL_ERROR,
    error: {
      success: false,
      message: 'The request could not be completed.',
      code: ApiErrorCode.INTERNAL_ERROR,
    },
  });
}

/** Path helpers: turn `/auctions/auc_01/bids` into ['auc_01']. */
function segments(url: string): string[] {
  const path = url.split('?')[0].replace(/^https?:\/\/[^/]+/, '');
  return path.split('/').filter(Boolean);
}

interface Route {
  body?: unknown;
  params: Record<string, string>;
  query: URLSearchParams;
  token: string | null;
}

function handle(req: HttpRequest<unknown>): unknown {
  const parts = segments(req.url);
  const query = new URLSearchParams(req.url.split('?')[1] ?? '');
  const ctx: Route = {
    body: req.body,
    params: {},
    query,
    token: bearer(req),
  };

  // Strip the leading `api` / `v1` prefix when the base URL includes it.
  const path = parts[0] === 'api' && parts[1] === 'v1' ? parts.slice(2) : parts;
  const method = req.method.toUpperCase();

  const num = (key: string): number | undefined => {
    const v = query.get(key);
    if (v === null || v === '') return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };
  const str = (key: string): string | undefined => query.get(key) ?? undefined;

  /* ------------------------------------------------------------- health */
  if (method === 'GET' && path[0] === 'health') {
    return mockApi.health();
  }

  /* --------------------------------------------------------------- auth */
  if (path[0] === 'auth') {
    if (method === 'POST' && path[1] === 'login') {
      return mockApi.login(ctx.body as LoginPayload);
    }
    if (method === 'GET' && path[1] === 'me') {
      return mockApi.me(ctx.token);
    }
    if (method === 'POST' && path[1] === 'forgot-password') {
      const { email } = ctx.body as ForgotPasswordPayload;
      return mockApi.forgotPassword(email);
    }
    if (method === 'POST' && path[1] === 'reset-password') {
      const { token, newPassword } = ctx.body as ResetPasswordPayload;
      return mockApi.resetPassword(token, newPassword);
    }
  }

  /* -------------------------------------------------------------- users */
  if (path[0] === 'users') {
    if (method === 'GET' && !path[1]) {
      return mockApi.listUsers(ctx.token, {
        page: num('page'),
        limit: num('limit'),
        search: str('search'),
        sort: str('sort'),
        role: str('role') as UserQuery['role'],
        status: str('status') as UserQuery['status'],
      });
    }
    if (method === 'GET' && path[1] === 'me') {
      return mockApi.me(ctx.token);
    }
    if (method === 'PATCH' && path[1] === 'me' && path[2] === 'password') {
      return mockApi.changeMyPassword(ctx.token, ctx.body as ChangePasswordPayload);
    }
    if (method === 'PATCH' && path[1] === 'me') {
      return mockApi.updateMyProfile(ctx.token, ctx.body as UpdateProfilePayload);
    }
    if (method === 'GET' && path[1]) return mockApi.getUser(ctx.token, path[1]);
    if (method === 'POST' && !path[1])
      return mockApi.createUser(ctx.token, ctx.body as CreateUserPayload);
    if (method === 'PATCH' && path[1]) {
      return mockApi.updateUser(ctx.token, path[1], ctx.body as UpdateUserPayload);
    }
  }

  /* ------------------------------------------------------------ vendors */
  if (path[0] === 'vendors') {
    if (method === 'GET' && path[1] === 'me') return mockApi.getMyVendorProfile(ctx.token);
    if (method === 'PATCH' && path[1] === 'me') {
      return mockApi.updateMyVendorProfile(ctx.token, ctx.body as UpdateVendorPayload);
    }
    if (method === 'GET' && !path[1]) {
      return mockApi.listVendors(ctx.token, {
        page: num('page'),
        limit: num('limit'),
        search: str('search'),
      });
    }
    if (method === 'POST' && !path[1])
      return mockApi.createVendor(ctx.token, ctx.body as CreateVendorPayload);
    if (method === 'GET' && path[1]) return mockApi.getVendor(ctx.token, path[1]);
    if (method === 'PATCH' && path[1]) {
      return mockApi.updateVendor(ctx.token, path[1], ctx.body as UpdateVendorPayload);
    }
  }

  /* ------------------------------------------------------------ bidders */
  if (path[0] === 'bidders') {
    if (method === 'GET' && path[1] === 'me') return mockApi.getMyBidderProfile(ctx.token);
    if (method === 'PATCH' && path[1] === 'me') {
      return mockApi.updateMyBidderProfile(ctx.token, ctx.body as UpdateBidderPayload);
    }
    if (method === 'GET' && !path[1]) {
      return mockApi.listBidders(ctx.token, {
        page: num('page'),
        limit: num('limit'),
        search: str('search'),
      });
    }
    if (method === 'POST' && !path[1])
      return mockApi.createBidder(ctx.token, ctx.body as CreateBidderPayload);
    if (method === 'GET' && path[1]) return mockApi.getBidder(ctx.token, path[1]);
    if (method === 'PATCH' && path[1]) {
      return mockApi.updateBidder(ctx.token, path[1], ctx.body as UpdateBidderPayload);
    }
  }

  /* --------------------------------------------------------- categories */
  if (path[0] === 'categories') {
    if (method === 'GET' && !path[1]) {
      return mockApi.listCategories(ctx.token, {
        page: num('page'),
        limit: num('limit'),
        search: str('search'),
      });
    }
    if (method === 'POST' && !path[1])
      return mockApi.createCategory(ctx.token, ctx.body as CategoryPayload);
    if (method === 'GET' && path[1]) return mockApi.getCategory(ctx.token, path[1]);
    if (method === 'PATCH' && path[1]) {
      return mockApi.updateCategory(ctx.token, path[1], ctx.body as CategoryPayload);
    }
    if (method === 'DELETE' && path[1]) return mockApi.deleteCategory(ctx.token, path[1]);
  }

  /* ----------------------------------------------------------- products */
  if (path[0] === 'products') {
    if (method === 'GET' && path[1] === 'mine') {
      return mockApi.listMyProducts(ctx.token, {
        page: num('page'),
        limit: num('limit'),
        search: str('search'),
        sort: str('sort'),
        categoryId: str('categoryId'),
      });
    }
    if (method === 'GET' && !path[1]) {
      return mockApi.listProducts(ctx.token, {
        page: num('page'),
        limit: num('limit'),
        search: str('search'),
        categoryId: str('categoryId'),
      } satisfies ProductQuery);
    }
    if (method === 'POST' && !path[1]) {
      return mockApi.createProduct(ctx.token, ctx.body as CreateProductPayload);
    }
    if (method === 'GET' && path[1]) return mockApi.getProduct(ctx.token, path[1]);
    if (method === 'PATCH' && path[1]) {
      return mockApi.updateProduct(ctx.token, path[1], ctx.body as UpdateProductPayload);
    }
    if (method === 'DELETE' && path[1]) return mockApi.deleteProduct(ctx.token, path[1]);
  }

  /* ----------------------------------------------------------- auctions */
  if (path[0] === 'auctions') {
    const auctionQuery = (): AuctionQuery => ({
      page: num('page'),
      limit: num('limit'),
      search: str('search'),
      sort: str('sort'),
      status: str('status') as AuctionQuery['status'],
      categoryId: str('categoryId'),
      vendorId: str('vendorId'),
      minPrice: num('minPrice'),
      maxPrice: num('maxPrice'),
      endingSoonMinutes: num('endingSoonMinutes'),
      orderBy: str('orderBy') as AuctionQuery['orderBy'],
    });

    if (method === 'GET' && path[1] === 'mine')
      return mockApi.listMyAuctions(ctx.token, auctionQuery());
    if (method === 'GET' && !path[1]) return mockApi.listAuctions(ctx.token, auctionQuery());
    if (method === 'POST' && !path[1]) {
      return mockApi.createAuction(ctx.token, ctx.body as CreateAuctionPayload);
    }
    if (method === 'GET' && path[2] === 'bids' && path[3] === 'highest') {
      return mockApi.highestBid(ctx.token, path[1]);
    }
    if (method === 'GET' && path[2] === 'bids') {
      return mockApi.listAuctionBids(ctx.token, path[1], {
        page: num('page'),
        limit: num('limit'),
        sort: str('sort'),
      } satisfies BidQuery);
    }
    if (method === 'POST' && path[2] === 'bids') {
      return mockApi.placeBid(ctx.token, path[1], ctx.body as PlaceBidPayload);
    }
    if (method === 'PATCH' && path[2] === 'status') {
      const status = (ctx.body as { status?: AuctionStatus })?.status;
      if (!status) {
        throw new MockApiError(400, ApiErrorCode.VALIDATION_ERROR, 'A target status is required.');
      }
      return mockApi.updateAuctionStatus(ctx.token, path[1], status);
    }
    if (method === 'GET' && path[1]) return mockApi.getAuction(ctx.token, path[1]);
    if (method === 'PATCH' && path[1]) {
      return mockApi.updateAuction(ctx.token, path[1], ctx.body as UpdateAuctionPayload);
    }
  }

  /* --------------------------------------------------------------- bids */
  if (path[0] === 'bids') {
    if (method === 'GET' && path[1] === 'mine') {
      return mockApi.listMyBids(ctx.token, {
        page: num('page'),
        limit: num('limit'),
        sort: str('sort'),
        auctionId: str('auctionId'),
      } satisfies BidQuery);
    }
    if (method === 'GET' && path[1]) return mockApi.getBid(ctx.token, path[1]);
  }

  throw new MockApiError(404, ApiErrorCode.NOT_FOUND, `No handler for ${method} ${req.url}.`);
}

export const mockApiInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next,
): Observable<HttpEvent<unknown>> => {
  // Handle exactly the requests aimed at the configured API origin, and pass
  // everything else through untouched (assets, fonts, third-party URLs).
  const apiOrigin = environment.apiUrl.replace(/\/$/, '');
  const targetsApi = req.url.startsWith(apiOrigin) || req.url.startsWith('/api/');
  if (!targetsApi) {
    return next(req);
  }

  try {
    const data = handle(req);
    const isDelete = req.method.toUpperCase() === 'DELETE';
    const payload = ok(data, isDelete ? (data as { message?: string })?.message : undefined);

    return of(new HttpResponse({ status: 200, body: payload })).pipe(delay(LATENCY_MS));
  } catch (error) {
    return throwError(() => toHttpError(req, error)).pipe(delay(LATENCY_MS));
  }
};
