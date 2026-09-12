import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/session.service';

/**
 * Attaches the bearer token to every outgoing API request and reacts to 401s.
 *
 * A 401 means the stored token is no longer usable: session state is cleared and
 * the route guard sends the user to login with a returnUrl. The public auth
 * endpoints are excluded so a failed sign-in or reset surfaces its own message
 * instead of triggering a redirect loop.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.token();

  const isPublicAuth =
    req.url.includes('/auth/login') ||
    req.url.includes('/auth/forgot-password') ||
    req.url.includes('/auth/reset-password');

  const authorised =
    token && !isPublicAuth
      ? req.clone({
          setHeaders: { Authorization: `Bearer ${token}` },
        })
      : req;

  return next(authorised).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401 && !isPublicAuth) {
        auth.clearSession();
      }
      return throwError(() => error);
    }),
  );
};

/** Adds a correlation id so client logs can be matched to server logs. */
export const requestIdInterceptor: HttpInterceptorFn = (req, next) => {
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  return next(
    req.clone({
      setHeaders: { 'X-Request-Id': id },
    }),
  );
};
