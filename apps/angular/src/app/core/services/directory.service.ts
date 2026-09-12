import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ApiSuccess,
  Bidder,
  CreateBidderPayload,
  CreateUserPayload,
  CreateVendorPayload,
  Paginated,
  UpdateBidderPayload,
  UpdateUserPayload,
  UpdateVendorPayload,
  User,
  UserQuery,
  Vendor,
} from '../domain/models';

function toParams(query: Record<string, unknown>): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '' || value === 'ALL') continue;
    params = params.set(key, String(value));
  }
  return params;
}

/** User administration and self-service profile endpoints. */
@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/users`;

  list(query: UserQuery = {}): Observable<Paginated<User>> {
    return this.http
      .get<ApiSuccess<Paginated<User>>>(this.api, {
        params: toParams(query as Record<string, unknown>),
      })
      .pipe(map((res) => res.data));
  }

  getById(id: string): Observable<User> {
    return this.http.get<ApiSuccess<User>>(`${this.api}/${id}`).pipe(map((res) => res.data));
  }

  create(payload: CreateUserPayload): Observable<User> {
    return this.http.post<ApiSuccess<User>>(this.api, payload).pipe(map((res) => res.data));
  }

  update(id: string, payload: UpdateUserPayload): Observable<User> {
    return this.http
      .patch<ApiSuccess<User>>(`${this.api}/${id}`, payload)
      .pipe(map((res) => res.data));
  }
}

/** Vendor profiles: administrative management plus the vendor's own profile. */
@Injectable({ providedIn: 'root' })
export class VendorService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/vendors`;

  list(
    query: { page?: number; limit?: number; search?: string } = {},
  ): Observable<Paginated<Vendor>> {
    return this.http
      .get<ApiSuccess<Paginated<Vendor>>>(this.api, {
        params: toParams(query as Record<string, unknown>),
      })
      .pipe(map((res) => res.data));
  }

  getById(id: string): Observable<Vendor> {
    return this.http.get<ApiSuccess<Vendor>>(`${this.api}/${id}`).pipe(map((res) => res.data));
  }

  /** The profile linked to the signed-in vendor user. */
  getMine(): Observable<Vendor> {
    return this.http.get<ApiSuccess<Vendor>>(`${this.api}/me`).pipe(map((res) => res.data));
  }

  create(payload: CreateVendorPayload): Observable<Vendor> {
    return this.http.post<ApiSuccess<Vendor>>(this.api, payload).pipe(map((res) => res.data));
  }

  update(id: string, payload: UpdateVendorPayload): Observable<Vendor> {
    return this.http
      .patch<ApiSuccess<Vendor>>(`${this.api}/${id}`, payload)
      .pipe(map((res) => res.data));
  }

  updateMine(payload: UpdateVendorPayload): Observable<Vendor> {
    return this.http
      .patch<ApiSuccess<Vendor>>(`${this.api}/me`, payload)
      .pipe(map((res) => res.data));
  }
}

/** Bidder profiles: administrative management plus the bidder's own profile. */
@Injectable({ providedIn: 'root' })
export class BidderService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/bidders`;

  list(
    query: { page?: number; limit?: number; search?: string } = {},
  ): Observable<Paginated<Bidder>> {
    return this.http
      .get<ApiSuccess<Paginated<Bidder>>>(this.api, {
        params: toParams(query as Record<string, unknown>),
      })
      .pipe(map((res) => res.data));
  }

  getById(id: string): Observable<Bidder> {
    return this.http.get<ApiSuccess<Bidder>>(`${this.api}/${id}`).pipe(map((res) => res.data));
  }

  getMine(): Observable<Bidder> {
    return this.http.get<ApiSuccess<Bidder>>(`${this.api}/me`).pipe(map((res) => res.data));
  }

  create(payload: CreateBidderPayload): Observable<Bidder> {
    return this.http.post<ApiSuccess<Bidder>>(this.api, payload).pipe(map((res) => res.data));
  }

  update(id: string, payload: UpdateBidderPayload): Observable<Bidder> {
    return this.http
      .patch<ApiSuccess<Bidder>>(`${this.api}/${id}`, payload)
      .pipe(map((res) => res.data));
  }

  updateMine(payload: UpdateBidderPayload): Observable<Bidder> {
    return this.http
      .patch<ApiSuccess<Bidder>>(`${this.api}/me`, payload)
      .pipe(map((res) => res.data));
  }
}
