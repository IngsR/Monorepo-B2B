import { Routes } from '@angular/router';
import { UserRole } from './core/domain/enums';
import { guestGuard, roleGuard, roleMatchGuard, sessionGuard } from './core/guards/auth.guard';

export { homeRouteFor } from './core/guards/auth.guard';

/**
 * Application routes.
 *
 * Structure:
 *  - public auth screens, guarded by `guestGuard` so a signed-in user is sent
 *    to their own home route instead of being shown a login form again
 *  - one shell route holding every authenticated screen, so the navigation
 *    chrome mounts once and toast feedback survives navigation
 *  - feature areas are lazy-loaded and gated twice: `canMatch` means the chunk
 *    is never downloaded for a role that cannot use it, and `roleGuard` sends a
 *    deep link to a forbidden URL back to the user's own home route
 *
 * Guards are navigation affordances only — the API authorises every request
 * independently, so a guard is never the thing protecting data.
 */
export const routes: Routes = [
  /* -------------------------------------------------------------- public */
  {
    path: 'login',
    canActivate: [guestGuard],
    title: 'Sign in · BidForge',
    loadComponent: () => import('./features/auth/login.component').then((m) => m.LoginComponent),
  },

  /*
   * Password recovery. Both screens are reachable while signed out, and both are
   * kept out of the authenticated shell.
   */
  {
    path: 'forgot-password',
    canActivate: [guestGuard],
    title: 'Reset your password · BidForge',
    loadComponent: () =>
      import('./features/auth/forgot-password/forgot-password.component').then(
        (m) => m.ForgotPasswordComponent,
      ),
  },
  {
    path: 'reset-password',
    canActivate: [guestGuard],
    title: 'Choose a new password · BidForge',
    loadComponent: () =>
      import('./features/auth/reset-password/reset-password.component').then(
        (m) => m.ResetPasswordComponent,
      ),
  },

  /* ------------------------------------------- authenticated app shell */
  {
    path: '',
    canActivate: [sessionGuard],
    loadComponent: () => import('./shared/layout/shell.component').then((m) => m.ShellComponent),
    children: [
      /* Landing: routes each role to the area it actually uses. */
      {
        path: '',
        pathMatch: 'full',
        title: 'BidForge · B2B Auction Platform',
        loadComponent: () =>
          import('./features/landing/landing.component').then((m) => m.LandingComponent),
      },

      /* ----------------------------------------- shared (every role) */
      {
        path: 'marketplace',
        title: 'Auction marketplace · BidForge',
        loadComponent: () =>
          import('./features/marketplace/marketplace.component').then(
            (m) => m.MarketplaceComponent,
          ),
      },
      {
        path: 'marketplace/:id',
        title: 'Auction · BidForge',
        loadComponent: () =>
          import('./features/marketplace/auction-detail.component').then(
            (m) => m.AuctionDetailComponent,
          ),
      },

      /* Profile: the account, the role profile and credentials in one place. */
      {
        path: 'profile',
        title: 'My profile · BidForge',
        loadComponent: () => import('./features/profile.component').then((m) => m.ProfileComponent),
      },
      {
        path: 'profile/security',
        title: 'Security · BidForge',
        loadComponent: () => import('./features/profile.component').then((m) => m.ProfileComponent),
      },
      {
        path: 'profile/vendor',
        canMatch: [roleMatchGuard(UserRole.VENDOR, UserRole.ADMIN)],
        canActivate: [roleGuard(UserRole.VENDOR, UserRole.ADMIN)],
        title: 'Vendor profile · BidForge',
        loadComponent: () => import('./features/profile.component').then((m) => m.ProfileComponent),
      },
      {
        path: 'profile/bidder',
        canMatch: [roleMatchGuard(UserRole.BIDDER, UserRole.ADMIN)],
        canActivate: [roleGuard(UserRole.BIDDER, UserRole.ADMIN)],
        title: 'Bidder profile · BidForge',
        loadComponent: () => import('./features/profile.component').then((m) => m.ProfileComponent),
      },

      /* ------------------------------------- bidder: own bid activity */
      {
        path: 'my-bids',
        canMatch: [roleMatchGuard(UserRole.BIDDER, UserRole.ADMIN)],
        canActivate: [roleGuard(UserRole.BIDDER, UserRole.ADMIN)],
        title: 'My bids · BidForge',
        loadComponent: () =>
          import('./features/bidder/my-bids.component').then((m) => m.MyBidsComponent),
      },

      /* -------------------------------- vendor: own products & auctions */
      {
        path: 'vendor',
        canMatch: [roleMatchGuard(UserRole.VENDOR, UserRole.ADMIN)],
        canActivate: [roleGuard(UserRole.VENDOR, UserRole.ADMIN)],
        title: 'Vendor workspace · BidForge',
        loadComponent: () =>
          import('./features/vendor/vendor-dashboard.component').then(
            (m) => m.VendorDashboardComponent,
          ),
      },
      {
        path: 'vendor/products',
        canMatch: [roleMatchGuard(UserRole.VENDOR, UserRole.ADMIN)],
        canActivate: [roleGuard(UserRole.VENDOR, UserRole.ADMIN)],
        title: 'My products · BidForge',
        loadComponent: () =>
          import('./features/vendor/products/product-list.component').then(
            (m) => m.ProductListComponent,
          ),
      },
      {
        path: 'vendor/products/new',
        canMatch: [roleMatchGuard(UserRole.VENDOR, UserRole.ADMIN)],
        canActivate: [roleGuard(UserRole.VENDOR, UserRole.ADMIN)],
        title: 'Create product · BidForge',
        loadComponent: () =>
          import('./features/vendor/products/product-form.component').then(
            (m) => m.ProductFormComponent,
          ),
      },
      {
        path: 'vendor/products/:id/edit',
        canMatch: [roleMatchGuard(UserRole.VENDOR, UserRole.ADMIN)],
        canActivate: [roleGuard(UserRole.VENDOR, UserRole.ADMIN)],
        title: 'Edit product · BidForge',
        loadComponent: () =>
          import('./features/vendor/products/product-form.component').then(
            (m) => m.ProductFormComponent,
          ),
      },
      {
        path: 'vendor/auctions',
        canMatch: [roleMatchGuard(UserRole.VENDOR, UserRole.ADMIN)],
        canActivate: [roleGuard(UserRole.VENDOR, UserRole.ADMIN)],
        title: 'My auctions · BidForge',
        loadComponent: () =>
          import('./features/vendor/auctions/vendor-auction-list.component').then(
            (m) => m.VendorAuctionListComponent,
          ),
      },
      {
        path: 'vendor/auctions/new',
        canMatch: [roleMatchGuard(UserRole.VENDOR, UserRole.ADMIN)],
        canActivate: [roleGuard(UserRole.VENDOR, UserRole.ADMIN)],
        title: 'Create auction · BidForge',
        loadComponent: () =>
          import('./features/vendor/auctions/auction-form.component').then(
            (m) => m.AuctionFormComponent,
          ),
      },
      {
        path: 'vendor/auctions/:id/edit',
        canMatch: [roleMatchGuard(UserRole.VENDOR, UserRole.ADMIN)],
        canActivate: [roleGuard(UserRole.VENDOR, UserRole.ADMIN)],
        title: 'Edit auction · BidForge',
        loadComponent: () =>
          import('./features/vendor/auctions/auction-form.component').then(
            (m) => m.AuctionFormComponent,
          ),
      },
      {
        path: 'vendor/auctions/:id',
        canMatch: [roleMatchGuard(UserRole.VENDOR, UserRole.ADMIN)],
        canActivate: [roleGuard(UserRole.VENDOR, UserRole.ADMIN)],
        title: 'Auction management · BidForge',
        loadComponent: () =>
          import('./features/vendor/auctions/auction-management.component').then(
            (m) => m.AuctionManagementComponent,
          ),
      },

      /* ------------------------------- admin: platform administration */
      {
        path: 'admin',
        canMatch: [roleMatchGuard(UserRole.ADMIN)],
        canActivate: [roleGuard(UserRole.ADMIN)],
        title: 'Admin dashboard · BidForge',
        loadComponent: () =>
          import('./features/admin-dashboard.component').then((m) => m.AdminDashboardComponent),
      },
      {
        path: 'admin/users',
        canMatch: [roleMatchGuard(UserRole.ADMIN)],
        canActivate: [roleGuard(UserRole.ADMIN)],
        title: 'Users · BidForge',
        loadComponent: () =>
          import('./features/admin/users/admin-users.component').then((m) => m.AdminUsersComponent),
      },
      {
        path: 'admin/vendors',
        canMatch: [roleMatchGuard(UserRole.ADMIN)],
        canActivate: [roleGuard(UserRole.ADMIN)],
        title: 'Vendors · BidForge',
        loadComponent: () =>
          import('./features/admin/vendors/admin-vendors.component').then(
            (m) => m.AdminVendorsComponent,
          ),
      },
      {
        path: 'admin/bidders',
        canMatch: [roleMatchGuard(UserRole.ADMIN)],
        canActivate: [roleGuard(UserRole.ADMIN)],
        title: 'Bidders · BidForge',
        loadComponent: () =>
          import('./features/admin/bidders/admin-bidders.component').then(
            (m) => m.AdminBiddersComponent,
          ),
      },
      {
        path: 'admin/categories',
        canMatch: [roleMatchGuard(UserRole.ADMIN)],
        canActivate: [roleGuard(UserRole.ADMIN)],
        title: 'Categories · BidForge',
        loadComponent: () =>
          import('./features/admin/categories/admin-categories.component').then(
            (m) => m.AdminCategoriesComponent,
          ),
      },

      /* An unknown path inside the shell renders a not-found screen rather
         than silently redirecting, so the URL stays honest. */
      {
        path: '**',
        title: 'Not found · BidForge',
        loadComponent: () =>
          import('./features/landing/not-found.component').then((m) => m.NotFoundComponent),
      },
    ],
  },
];
