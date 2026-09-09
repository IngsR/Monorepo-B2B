import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { UserRole } from '../enums/user-role.enum';
import { AuthService } from '../services/auth.service';

/** Guard untuk rute yang membutuhkan login */
export const authGuard: CanActivateFn = (_route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/login'], {
    queryParams: { returnUrl: state.url },
  });
};

/** Guard untuk rute tamu (login, forgot-password, reset-password) agar yang sudah login diarahkan ke dashboard */
export const guestGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/dashboard']);
};

/** Guard RBAC untuk rute yang membatasi akses peran tertentu */
export const roleGuard: CanActivateFn = (route) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    return router.createUrlTree(['/login']);
  }

  const expectedRoles = route.data?.['roles'] as UserRole[] | undefined;
  if (!expectedRoles || expectedRoles.length === 0) {
    return true;
  }

  const currentRole = authService.userRole();
  if (currentRole && expectedRoles.includes(currentRole)) {
    return true;
  }

  // Jika tidak punya akses role, arahkan ke dashboard
  return router.createUrlTree(['/dashboard']);
};
