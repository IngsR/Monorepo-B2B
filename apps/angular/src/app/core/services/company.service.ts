import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/auth.model';
import { Company, CreateCompanyPayload, PaginatedResult, UpdateCompanyPayload } from '../models/company.model';

@Injectable({
  providedIn: 'root',
})
export class CompanyService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/companies`;

  // Reactive State Signals
  readonly companies = signal<Company[]>([]);
  readonly currentCompany = signal<Company | null>(null);
  readonly isLoading = signal<boolean>(false);
  readonly error = signal<string | null>(null);
  readonly meta = signal<PaginatedResult<Company>['meta']>({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 1,
  });

  getCompanies(page = 1, limit = 10, search?: string, status?: string): Observable<ApiResponse<PaginatedResult<Company>>> {
    this.isLoading.set(true);
    this.error.set(null);

    let params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString());

    if (search) params = params.set('search', search);
    if (status) params = params.set('status', status);

    return this.http.get<ApiResponse<PaginatedResult<Company>>>(this.baseUrl, { params }).pipe(
      tap({
        next: (res) => {
          this.isLoading.set(false);
          if (res?.data) {
            this.companies.set(res.data.data);
            this.meta.set(res.data.meta);
          }
        },
        error: (err) => {
          this.isLoading.set(false);
          this.error.set(err?.error?.message || 'Failed to fetch companies');
        },
      })
    );
  }

  getCompanyById(id: string): Observable<ApiResponse<Company>> {
    return this.http.get<ApiResponse<Company>>(`${this.baseUrl}/${id}`).pipe(
      tap({
        next: (res) => this.currentCompany.set(res.data),
        error: (err) => this.error.set(err?.error?.message || 'Failed to fetch company details'),
      })
    );
  }

  createCompany(payload: CreateCompanyPayload): Observable<ApiResponse<Company>> {
    this.isLoading.set(true);
    return this.http.post<ApiResponse<Company>>(this.baseUrl, payload).pipe(
      tap({
        next: (res) => {
          this.isLoading.set(false);
          if (res?.data) {
            this.companies.update((prev) => [res.data, ...prev]);
          }
        },
        error: (err) => {
          this.isLoading.set(false);
          this.error.set(err?.error?.message || 'Failed to create company');
        },
      })
    );
  }

  updateCompany(id: string, payload: UpdateCompanyPayload): Observable<ApiResponse<Company>> {
    this.isLoading.set(true);
    return this.http.patch<ApiResponse<Company>>(`${this.baseUrl}/${id}`, payload).pipe(
      tap({
        next: (res) => {
          this.isLoading.set(false);
          if (res?.data) {
            this.companies.update((prev) =>
              prev.map((c) => (c.id === id ? res.data : c))
            );
          }
        },
        error: (err) => {
          this.isLoading.set(false);
          this.error.set(err?.error?.message || 'Failed to update company');
        },
      })
    );
  }

  deactivateCompany(id: string): Observable<ApiResponse<Company>> {
    return this.http.delete<ApiResponse<Company>>(`${this.baseUrl}/${id}`).pipe(
      tap({
        next: (res) => {
          if (res?.data) {
            this.companies.update((prev) =>
              prev.map((c) => (c.id === id ? { ...c, status: 'INACTIVE' } : c))
            );
          }
        },
      })
    );
  }
}
