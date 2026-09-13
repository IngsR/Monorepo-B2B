import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuctionStatus } from '../domain/enums';
import {
  ApiSuccess,
  Auction,
  AuctionQuery,
  Bid,
  BidQuery,
  CreateAuctionPayload,
  Paginated,
} from '../domain/models';

/** Serialises a query object into HttpParams, skipping empty values. */
function toParams(query: Record<string, unknown>): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '' || value === 'ALL') continue;
    params = params.set(key, String(value));
  }
  return params;
}

/**
 * Auction resource service.
 *
 * `create` deliberately omits vendorId and currentPrice: both are derived
 * server-side from the authenticated identity and the bid history.
 */
@Injectable({ providedIn: 'root' })
export class AuctionService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/auctions`;

  /** Public marketplace catalogue, with filters, sorting and pagination. */
  list(query: AuctionQuery = {}): Observable<Paginated<Auction>> {
    return this.http
      .get<ApiSuccess<Paginated<Auction>>>(this.api, {
        params: toParams(query as Record<string, unknown>),
      })
      .pipe(map((res) => res.data));
  }

  /** Auctions owned by the signed-in vendor. */
  listMine(query: AuctionQuery = {}): Observable<Paginated<Auction>> {
    return this.http
      .get<ApiSuccess<Paginated<Auction>>>(`${this.api}/mine`, {
        params: toParams(query as Record<string, unknown>),
      })
      .pipe(map((res) => res.data));
  }

  getById(id: string): Observable<Auction> {
    return this.http.get<ApiSuccess<Auction>>(`${this.api}/${id}`).pipe(map((res) => res.data));
  }

  create(payload: CreateAuctionPayload): Observable<Auction> {
    const startAt = payload.startAt ?? payload.startTime;
    const endAt = payload.endAt ?? payload.endTime;
    const body: Record<string, unknown> = {
      productId: payload.productId,
      startingPrice: String(payload.startingPrice),
      bidIncrement: String(payload.bidIncrement),
      startAt: startAt ? new Date(startAt).toISOString() : '',
      endAt: endAt ? new Date(endAt).toISOString() : '',
    };
    return this.http.post<ApiSuccess<Auction>>(this.api, body).pipe(map((res) => res.data));
  }

  update(id: string, payload: Partial<CreateAuctionPayload>): Observable<Auction> {
    const body: Record<string, unknown> = {};
    if (payload.startingPrice !== undefined) {
      body['startingPrice'] = String(payload.startingPrice);
    }
    if (payload.bidIncrement !== undefined) {
      body['bidIncrement'] = String(payload.bidIncrement);
    }
    return this.http
      .patch<ApiSuccess<Auction>>(`${this.api}/${id}`, body)
      .pipe(map((res) => res.data));
  }

  /** Drives the lifecycle state machine. Only valid targets are ever sent. */
  changeStatus(id: string, status: AuctionStatus): Observable<Auction> {
    return this.http
      .patch<ApiSuccess<Auction>>(`${this.api}/${id}/status`, { status })
      .pipe(map((res) => res.data));
  }

  /** Bid history for one auction. `sort` follows the API: highest | newest | oldest. */
  listBids(auctionId: string, query: BidQuery = {}): Observable<Paginated<Bid>> {
    return this.http
      .get<ApiSuccess<Paginated<Bid>>>(`${this.api}/${auctionId}/bids`, {
        params: toParams(query as Record<string, unknown>),
      })
      .pipe(map((res) => res.data));
  }

  /** Highest valid bid, or null when the auction has no bids yet. */
  highestBid(auctionId: string): Observable<Bid | null> {
    return this.http
      .get<ApiSuccess<Bid | null>>(`${this.api}/${auctionId}/bids/highest`)
      .pipe(map((res) => res.data));
  }
}
