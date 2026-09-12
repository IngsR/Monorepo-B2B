import { inject } from '@angular/core';
import { CanActivateFn, CanMatchFn, Router, UrlTree } from '@angular/router';
import { map } from 'rxjs';
import { UserRole } from '../domain/enums';
import { AuthService } from '../services/session.service';

/**
 * Route guards.
 *
 * These are navigation affordances only — the API enforces authorization on
 * every request. A guard stops a user landing on a screen they cannot use; it
 * is never the mechanism that protects data.
 */

/** Requires a valid session. Redirects to login, preserving the intended URL. */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) return true;

  return router.createUrlTree(['/login'], {
    queryParams: { returnUrl: state.url },
  });
};

/**
 * Requires a session and resolves the identity before granting access.
 *
 * This matters for deep links and hard refreshes. On a reload the token is
 * restored from storage but the identity has not been fetched yet, so a naive
 * `isAuthenticated()` check fails and bounces the user to login — silently
 * discarding the URL they were on. Waiting on `loadIdentity()` ensures the role
 * and owner identifier are known before any role guard or the shell renders.
 */
export const sessionGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const toLogin = (): UrlTree =>
    router.createUrlTree(['/login'], {
      queryParams: { returnUrl: state.url },
    });

  if (!auth.token()) return toLogin();

  // Identity not resolved yet (a fresh load): resolve it, then decide.
  if (!auth.identityResolved()) {
    return auth.loadIdentity().pipe(map((user) => (user ? true : toLogin())));
  }

  return auth.isAuthenticated() ? true : toLogin();
};

/** Keeps signed-in users away from the public auth screens. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.token()) return true;
  if (auth.isAuthenticated()) return router.createUrlTree(['/']);

  // A token exists but identity is unresolved: resolve, then decide.
  return auth.loadIdentity().pipe(map((user) => (user ? router.createUrlTree(['/']) : true)));
};

/** Restricts a route to the listed roles. */
export function roleGuard(...allowed: UserRole[]): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    const role = auth.role();
    if (role && allowed.includes(role)) return true;

    // Send the user somewhere they can actually use rather than a dead end.
    return router.createUrlTree([homeRouteFor(role)]);
  };
}

/**
 * Lazy `canMatch` variant: an unauthorised user never downloads the feature
 * chunk at all, keeping vendor and admin code out of a bidder's bundle.
 *
 * IMPORTANT: `canMatch` returning `false` makes the router move on to the next
 * candidate route. For a signed-in user, falling through would land on the
 * `**` wildcard and show "page not found" for a route that does exist. So an
 * authenticated user with the wrong role is redirected to their own home route
 * instead, and only a genuinely unauthenticated request falls through (to be
 * handled by the login redirect).
 */
export function roleMatchGuard(...allowed: UserRole[]): CanMatchFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    if (!auth.token()) return false;

    /** Decides once the role is known, redirecting rather than falling through. */
    const decide = () => {
      const role = auth.role();
      if (role && allowed.includes(role)) return true;
      // Signed in but not permitted: send them somewhere usable. Returning
      // `false` here would let the `**` wildcard claim the URL and show
      // "page not found" for a route that genuinely exists.
      return role ? router.createUrlTree([homeRouteFor(role)]) : false;
    };

    // A role's `canMatch` is evaluated while the router is still resolving the
    // initial navigation — before `sessionGuard` on the parent has run. On a
    // hard load or deep link the role is therefore not yet known, so resolve
    // identity here first rather than rejecting a permitted user.
    if (!auth.identityResolved()) {
      return auth.loadIdentity().pipe(map(() => decide()));
    }

    return decide();
  };
}

/** The landing route for each role. */
export function homeRouteFor(role: UserRole | null): string {
  switch (role) {
    case UserRole.ADMIN:
      return '/admin';
    case UserRole.VENDOR:
      return '/vendor';
    default:
      return '/marketplace';
  }
}
