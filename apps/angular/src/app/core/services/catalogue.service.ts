import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ApiSuccess,
  Category,
  CategoryPayload,
  CreateProductPayload,
  Paginated,
  Product,
  ProductQuery,
  UpdateProductPayload,
} from '../domain/models';

function toParams(query: Record<string, unknown>): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '' || value === 'ALL') continue;
    params = params.set(key, String(value));
  }
  return params;
}

/**
 * Product resource service.
 *
 * `create` omits vendorId: ownership is taken from the authenticated vendor
 * identity by the backend, so it must never be sent from the client.
 */
@Injectable({ providedIn: 'root' })
export class ProductService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/products`;

  /** Products owned by the signed-in vendor. */
  listMine(query: ProductQuery = {}): Observable<Paginated<Product>> {
    return this.http
      .get<ApiSuccess<Paginated<Product>>>(`${this.api}/mine`, {
        params: toParams(query as Record<string, unknown>),
      })
      .pipe(map((res) => res.data));
  }

  list(query: ProductQuery = {}): Observable<Paginated<Product>> {
    return this.http
      .get<ApiSuccess<Paginated<Product>>>(this.api, {
        params: toParams(query as Record<string, unknown>),
      })
      .pipe(map((res) => res.data));
  }

  getById(id: string): Observable<Product> {
    return this.http.get<ApiSuccess<Product>>(`${this.api}/${id}`).pipe(map((res) => res.data));
  }

  create(payload: CreateProductPayload): Observable<Product> {
    return this.http.post<ApiSuccess<Product>>(this.api, payload).pipe(map((res) => res.data));
  }

  update(id: string, payload: UpdateProductPayload): Observable<Product> {
    return this.http
      .patch<ApiSuccess<Product>>(`${this.api}/${id}`, payload)
      .pipe(map((res) => res.data));
  }

  delete(id: string): Observable<string> {
    return this.http
      .delete<ApiSuccess<{ message: string }>>(`${this.api}/${id}`)
      .pipe(map((res) => res.data.message));
  }
}

/**
 * Category resource service. Categories are shared reference data: every
 * authenticated user may read them, only administrators may change them.
 */
@Injectable({ providedIn: 'root' })
export class CategoryService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/categories`;

  list(
    query: { page?: number; limit?: number; search?: string } = {},
  ): Observable<Paginated<Category>> {
    return this.http
      .get<ApiSuccess<Paginated<Category>>>(this.api, {
        params: toParams(query as Record<string, unknown>),
      })
      .pipe(map((res) => res.data));
  }

  getById(id: string): Observable<Category> {
    return this.http.get<ApiSuccess<Category>>(`${this.api}/${id}`).pipe(map((res) => res.data));
  }

  create(payload: CategoryPayload): Observable<Category> {
    return this.http.post<ApiSuccess<Category>>(this.api, payload).pipe(map((res) => res.data));
  }

  update(id: string, payload: CategoryPayload): Observable<Category> {
    return this.http
      .patch<ApiSuccess<Category>>(`${this.api}/${id}`, payload)
      .pipe(map((res) => res.data));
  }

  delete(id: string): Observable<string> {
    return this.http
      .delete<ApiSuccess<{ message: string }>>(`${this.api}/${id}`)
      .pipe(map((res) => res.data.message));
  }
}
