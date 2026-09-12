import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, map, of, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AccountStatus, UserRole } from '../domain/enums';
import {
  ApiSuccess,
  Bidder,
  ChangePasswordPayload,
  LoginPayload,
  LoginResult,
  UpdateProfilePayload,
  User,
  Vendor,
} from '../domain/models';

const TOKEN_KEY = 'bidforge.access_token';

/**
 * Authentication and session identity.
 *
 * Responsibilities:
 *  - login / logout / password recovery
 *  - persisting the access token so a reload keeps the session
 *  - resolving `GET /auth/me` plus the role-specific profile (`/vendors/me`,
 *    `/bidders/me`) so the UI knows *who* the user is and *what they own*
 *
 * Only the token is persisted. The role and ownership identifiers are always
 * re-read from the server on boot — the client never trusts a cached role.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly api = environment.apiUrl;

  private readonly _token = signal<string | null>(localStorage.getItem(TOKEN_KEY));
  private readonly _user = signal<User | null>(null);
  private readonly _vendor = signal<Vendor | null>(null);
  private readonly _bidder = signal<Bidder | null>(null);
  private readonly _identityLoading = signal(false);
  private readonly _identityResolved = signal(false);

  readonly token = this._token.asReadonly();
  readonly user = this._user.asReadonly();
  readonly vendor = this._vendor.asReadonly();
  readonly bidder = this._bidder.asReadonly();
  readonly identityLoading = this._identityLoading.asReadonly();
  /** False until the first identity lookup completes — guards wait on this. */
  readonly identityResolved = this._identityResolved.asReadonly();

  readonly isAuthenticated = computed(() => !!this._token() && !!this._user());
  readonly role = computed<UserRole | null>(() => this._user()?.role ?? null);
  readonly userId = computed<string | null>(() => this._user()?.id ?? null);

  /**
   * The identifier by which the signed-in user owns resources: the vendor
   * profile id for vendors, the bidder profile id for bidders. Ownership checks
   * in the UI compare against this value.
   */
  readonly ownerId = computed<string | null>(() => {
    const role = this.role();
    if (role === UserRole.VENDOR) return this._vendor()?.id ?? null;
    if (role === UserRole.BIDDER) return this._bidder()?.id ?? null;
    return null;
  });

  readonly isAdmin = computed(() => this.role() === UserRole.ADMIN);
  readonly isVendor = computed(() => this.role() === UserRole.VENDOR);
  readonly isBidder = computed(() => this.role() === UserRole.BIDDER);

  /** True when the bidder account is permitted to place bids. */
  readonly canBid = computed(
    () => this.role() === UserRole.BIDDER && this._bidder()?.status === AccountStatus.ACTIVE,
  );

  readonly displayName = computed(() => {
    const u = this._user();
    if (!u) return '';
    const name = `${u.firstName} ${u.lastName}`.trim();
    return name && name !== '—' ? name : u.email;
  });

  /** Authenticates and resolves identity before the caller navigates. */
  login(payload: LoginPayload): Observable<User | null> {
    return this.http.post<ApiSuccess<LoginResult>>(`${this.api}/auth/login`, payload).pipe(
      map((res) => res.data),
      tap(({ accessToken }) => this.setToken(accessToken)),
      // Identity must be resolved before navigation so guards see a full session.
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      map(() => undefined),
      tap({
        next: () => this.loadIdentity(),
      }),
      map(() => this._user()),
    );
  }

  /**
   * Loads the authenticated identity and its role profile.
   * Returns an observable that emits once the session is fully resolved.
   */
  loadIdentity(): Observable<User | null> {
    const token = this._token();
    if (!token) {
      this._identityResolved.set(true);
      return of(null);
    }

    this._identityLoading.set(true);
    return this.http.get<ApiSuccess<User>>(`${this.api}/auth/me`).pipe(
      map((res) => res.data),
      tap({
        next: (user) => {
          this._user.set(user);
          this.loadRoleProfile(user);
        },
        error: () => {
          this._identityLoading.set(false);
          this._identityResolved.set(true);
          // A failed identity lookup means the stored token is unusable.
          this.clearSession();
        },
      }),
      catchError(() => of(null)),
    );
  }

  /** Fetches the vendor or bidder profile that belongs to the signed-in user. */
  private loadRoleProfile(user: User): void {
    if (user.role === UserRole.ADMIN) {
      this._loadingDone();
      return;
    }

    const endpoint = user.role === UserRole.VENDOR ? 'vendors' : 'bidders';

    this.http.get<ApiSuccess<Vendor | Bidder>>(`${this.api}/${endpoint}/me`).subscribe({
      next: (res) => {
        if (user.role === UserRole.VENDOR) this._vendor.set(res.data as Vendor);
        else this._bidder.set(res.data as Bidder);
        this._loadingDone();
      },
      error: () => {
        // A user without a role profile is a legitimate state, not a failure.
        if (user.role === UserRole.VENDOR) this._vendor.set(null);
        else this._bidder.set(null);
        this._loadingDone();
      },
    });
  }

  private _loadingDone(): void {
    this._identityLoading.set(false);
    this._identityResolved.set(true);
  }

  /** Re-reads the role profile after it has been edited in place. */
  refreshRoleProfile(): void {
    const user = this._user();
    if (user) this.loadRoleProfile(user);
  }

  updateProfile(payload: UpdateProfilePayload): Observable<User> {
    return this.http
      .patch<ApiSuccess<User>>(`${this.api}/users/me`, payload)
      .pipe(map((res) => res.data));
  }

  /** Applies a profile update to local state after a successful PATCH. */
  applyUser(user: User): void {
    this._user.set(user);
  }

  applyVendor(vendor: Vendor): void {
    this._vendor.set(vendor);
  }

  applyBidder(bidder: Bidder): void {
    this._bidder.set(bidder);
  }

  changePassword(payload: ChangePasswordPayload): Observable<string> {
    return this.http
      .patch<ApiSuccess<{ message: string }>>(`${this.api}/users/me/password`, payload)
      .pipe(map((res) => res.data.message));
  }

  forgotPassword(email: string): Observable<string> {
    return this.http
      .post<ApiSuccess<{ message: string }>>(`${this.api}/auth/forgot-password`, { email })
      .pipe(map((res) => res.data.message));
  }

  resetPassword(token: string, newPassword: string): Observable<string> {
    return this.http
      .post<ApiSuccess<{ message: string }>>(`${this.api}/auth/reset-password`, {
        token,
        newPassword,
      })
      .pipe(map((res) => res.data.message));
  }

  /** Clears session state without navigating (used by the 401 interceptor). */
  clearSession(): void {
    localStorage.removeItem(TOKEN_KEY);
    this._token.set(null);
    this._user.set(null);
    this._vendor.set(null);
    this._bidder.set(null);
    this._identityLoading.set(false);
    this._identityResolved.set(true);
  }

  logout(redirect = true): void {
    this.clearSession();
    if (redirect) void this.router.navigate(['/login']);
  }

  private setToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
    this._token.set(token);
  }
}
