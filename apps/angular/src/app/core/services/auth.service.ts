import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ApiResponse,
  ForgotPasswordRequest,
  JwtPayload,
  LoginRequest,
  LoginResponse,
  ResetPasswordRequest,
  User,
} from '../models/auth.model';

const TOKEN_KEY = 'scrapbid_token';
const USER_KEY = 'scrapbid_user';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly _token = signal<string | null>(this.getStoredToken());
  private readonly _currentUser = signal<User | null>(this.getStoredUser());

  readonly token = this._token.asReadonly();
  readonly currentUser = this._currentUser.asReadonly();
  readonly isAuthenticated = computed(() => !!this._token());
  readonly userRole = computed(() => this._currentUser()?.role ?? null);

  constructor() {
    // Jika token ada di storage tetapi user belum dimuat, ambil profil
    if (this._token() && !this._currentUser()) {
      this.getProfile().subscribe({
        error: () => this.logout(),
      });
    }
  }

  login(credentials: LoginRequest): Observable<ApiResponse<LoginResponse>> {
    return this.http
      .post<ApiResponse<LoginResponse>>(`${environment.apiUrl}/auth/login`, credentials)
      .pipe(
        tap((res) => {
          const token = res.data?.accessToken;
          if (token) {
            this.setSession(token);
            // Ambil profile langsung setelah login berhasil
            this.getProfile().subscribe();
          }
        }),
      );
  }

  getProfile(): Observable<ApiResponse<User>> {
    return this.http.get<ApiResponse<User>>(`${environment.apiUrl}/auth/me`).pipe(
      tap((res) => {
        if (res.data) {
          this._currentUser.set(res.data);
          localStorage.setItem(USER_KEY, JSON.stringify(res.data));
        }
      }),
    );
  }

  forgotPassword(email: string): Observable<ApiResponse<{ message: string }>> {
    const payload: ForgotPasswordRequest = { email };
    return this.http.post<ApiResponse<{ message: string }>>(
      `${environment.apiUrl}/auth/forgot-password`,
      payload,
    );
  }

  resetPassword(
    token: string,
    newPassword: string,
  ): Observable<ApiResponse<{ message: string }>> {
    const payload: ResetPasswordRequest = { token, newPassword };
    return this.http.post<ApiResponse<{ message: string }>>(
      `${environment.apiUrl}/auth/reset-password`,
      payload,
    );
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this._token.set(null);
    this._currentUser.set(null);
    this.router.navigate(['/login']);
  }

  private setSession(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
    this._token.set(token);

    // Coba decode payload JWT untuk inisialisasi awal user cepat
    try {
      const payloadBase64 = token.split('.')[1];
      if (payloadBase64) {
        const decoded = JSON.parse(atob(payloadBase64)) as JwtPayload;
        const initialUser: User = {
          id: decoded.userId,
          email: decoded.email,
          firstName: '',
          lastName: '',
          role: decoded.role,
          status: 'ACTIVE',
        };
        this._currentUser.set(initialUser);
        localStorage.setItem(USER_KEY, JSON.stringify(initialUser));
      }
    } catch {
      // Abaikan jika token tidak bisa di-decode lokal
    }
  }

  private getStoredToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  private getStoredUser(): User | null {
    const stored = localStorage.getItem(USER_KEY);
    if (!stored) return null;
    try {
      return JSON.parse(stored) as User;
    } catch {
      return null;
    }
  }
}
