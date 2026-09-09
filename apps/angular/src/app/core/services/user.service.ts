import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse, User } from '../models/auth.model';
import { PaginatedResult } from '../models/company.model';

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/users`;

  readonly users = signal<User[]>([]);
  readonly currentUserProfile = signal<User | null>(null);
  readonly isLoading = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  getMyProfile(): Observable<ApiResponse<User>> {
    return this.http.get<ApiResponse<User>>(`${this.baseUrl}/me`).pipe(
      tap({
        next: (res) => this.currentUserProfile.set(res.data),
        error: (err) => this.error.set(err?.error?.message || 'Failed to fetch user profile'),
      })
    );
  }

  changeMyPassword(payload: ChangePasswordPayload): Observable<ApiResponse<{ message: string }>> {
    return this.http.patch<ApiResponse<{ message: string }>>(`${this.baseUrl}/me/password`, payload);
  }

  getUsers(page = 1, limit = 10, role?: string): Observable<ApiResponse<PaginatedResult<User>>> {
    this.isLoading.set(true);
    let params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString());

    if (role) params = params.set('role', role);

    return this.http.get<ApiResponse<PaginatedResult<User>>>(this.baseUrl, { params }).pipe(
      tap({
        next: (res) => {
          this.isLoading.set(false);
          if (res?.data) {
            this.users.set(res.data.data);
          }
        },
        error: (err) => {
          this.isLoading.set(false);
          this.error.set(err?.error?.message || 'Failed to fetch users');
        },
      })
    );
  }
}
