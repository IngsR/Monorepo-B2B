import { Routes } from '@angular/router';
import { UserRole } from './core/enums/user-role.enum';
import { authGuard, guestGuard, roleGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'dashboard',
  },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'forgot-password',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/forgot-password/forgot-password.component').then(
        (m) => m.ForgotPasswordComponent,
      ),
  },
  {
    path: 'reset-password',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/reset-password/reset-password.component').then(
        (m) => m.ResetPasswordComponent,
      ),
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/dashboard/dashboard.component').then(
        (m) => m.DashboardComponent,
      ),
  },
  {
    path: 'admin',
    canActivate: [authGuard, roleGuard],
    data: { roles: [UserRole.ADMIN] },
    loadComponent: () =>
      import('./features/admin/admin.component').then((m) => m.AdminComponent),
  },
  {
    path: 'seller',
    canActivate: [authGuard, roleGuard],
    data: { roles: [UserRole.SELLER, UserRole.ADMIN] },
    loadComponent: () =>
      import('./features/seller/seller.component').then((m) => m.SellerComponent),
  },
  {
    path: 'vendor',
    canActivate: [authGuard, roleGuard],
    data: { roles: [UserRole.VENDOR, UserRole.ADMIN] },
    loadComponent: () =>
      import('./features/vendor/vendor.component').then((m) => m.VendorComponent),
  },
  {
    path: '**',
    redirectTo: 'dashboard',
  },
];
