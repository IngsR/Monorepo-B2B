import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { UserRole } from '../../core/domain/enums';
import { AuthService } from '../../core/services/session.service';
import { BidderHeaderComponent } from './bidder-header.component';
import { SellerHeaderComponent } from './seller-header.component';
import { SidebarComponent } from './sidebar.component';
import { TopbarComponent } from './topbar.component';
import { ToastHostComponent } from '../ui/toast.component';

/**
 * Authenticated application shell.
 *
 * For Bidder role: renders a full-width Tokopedia/Shopee-style top header navbar (no sidebar).
 * For Vendor/Seller: renders a dedicated horizontal business application header (app-seller-header, no sidebar).
 * For Administrator: retains the operational sidebar + topbar layout.
 *
 * The toast host lives here so notifications survive route changes and are
 * announced from a single, stable place in the accessibility tree.
 */
@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    RouterOutlet,
    SidebarComponent,
    TopbarComponent,
    BidderHeaderComponent,
    SellerHeaderComponent,
    ToastHostComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (isBidder()) {
      <div class="bidder-shell">
        <app-bidder-header />
        <main class="bidder-shell-content" id="main-content">
          <router-outlet />
        </main>
        <app-toast-host />
      </div>
    } @else if (isVendor()) {
      <div class="seller-shell">
        <app-seller-header />
        <main class="seller-shell-content" id="main-content">
          <router-outlet />
        </main>
        <app-toast-host />
      </div>
    } @else {
      <div class="shell" [class.admin-shell]="isAdmin()">
        <app-sidebar [open]="drawerOpen()" (navigated)="closeDrawer()" />

        @if (drawerOpen()) {
          <div class="shell-scrim" (click)="closeDrawer()" aria-hidden="true"></div>
        }

        <div class="shell-main">
          <app-topbar (toggleMenu)="toggleDrawer()" />
          <main class="shell-content" id="main-content">
            <router-outlet />
          </main>
        </div>

        <app-toast-host />
      </div>
    }
  `,
  styles: [
    `
      .admin-shell {
        background-color: #f5f3ef;

        .shell-main {
          background-color: #f5f3ef;
        }

        .shell-content {
          background-color: #f5f3ef;
          color: #172033;
        }
      }

      .bidder-shell {
        display: flex;
        flex-direction: column;
        min-height: 100vh;
        background-color: var(--c-canvas);
      }

      .bidder-shell-content {
        flex: 1;
        width: 100%;
        max-width: 1280px;
        margin: 0 auto;
        padding: var(--sp-6) var(--sp-4) var(--sp-10);
      }

      .seller-shell {
        display: flex;
        flex-direction: column;
        min-height: 100vh;
        background-color: var(--c-canvas);
      }

      .seller-shell-content {
        flex: 1;
        width: 100%;
        max-width: 1360px;
        margin: 0 auto;
        padding: var(--sp-6) var(--sp-6) var(--sp-10);
      }

      @media (max-width: 640px) {
        .seller-shell-content {
          padding: var(--sp-4) var(--sp-3) var(--sp-8);
        }
      }
    `,
  ],
})
export class ShellComponent {
  private readonly auth = inject(AuthService);

  readonly drawerOpen = signal(false);

  readonly isBidder = computed(() => {
    const role = this.auth.role();
    return role === UserRole.BIDDER || role === null;
  });

  readonly isVendor = computed(() => {
    return this.auth.role() === UserRole.VENDOR;
  });

  readonly isAdmin = computed(() => {
    return this.auth.role() === UserRole.ADMIN;
  });

  toggleDrawer(): void {
    this.drawerOpen.update((open) => !open);
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
  }
}

