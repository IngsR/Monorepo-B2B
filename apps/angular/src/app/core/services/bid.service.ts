import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiSuccess, Bid, BidQuery, Paginated, PlaceBidPayload } from '../domain/models';

function toParams(query: Record<string, unknown>): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    params = params.set(key, String(value));
  }
  return params;
}

/**
 * Bid resource service.
 *
 * `placeBid` sends only the amount. The bidder is resolved by the backend from
 * the authenticated JWT — the client must never supply a bidderId.
 */
@Injectable({ providedIn: 'root' })
export class BidService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  /** Places a bid on an auction. Conflicts (409) carry the server's reason. */
  placeBid(auctionId: string, payload: PlaceBidPayload): Observable<Bid> {
    return this.http
      .post<ApiSuccess<Bid>>(`${this.api}/auctions/${auctionId}/bids`, payload)
      .pipe(map((res) => res.data));
  }

  /** Every bid placed by the signed-in bidder, with auction context attached. */
  listMine(query: BidQuery = {}): Observable<Paginated<Bid>> {
    return this.http
      .get<ApiSuccess<Paginated<Bid>>>(`${this.api}/bids/mine`, {
        params: toParams(query as Record<string, unknown>),
      })
      .pipe(map((res) => res.data));
  }

  getById(id: string): Observable<Bid> {
    return this.http.get<ApiSuccess<Bid>>(`${this.api}/bids/${id}`).pipe(map((res) => res.data));
  }
}
