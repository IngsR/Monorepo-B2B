import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/session.service';
import { IconComponent } from '../ui/icon.component';

/**
 * Seller / Vendor Top Navigation Bar.
 *
 * Dedicated horizontal navigation for the B2B Auction Seller Portal.
 * Permanently replaces the traditional dashboard sidebar with a streamlined,
 * modern business application header.
 */
@Component({
  selector: 'app-seller-header',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="seller-header">
      <div class="seller-header-inner">
        <!-- Brand & Context -->
        <div class="seller-header-brand-wrap">
          <a routerLink="/vendor" class="seller-brand" aria-label="BidForge Portal Penjual">
            <span class="brand-badge-icon">
              <app-icon name="hammer" [size]="17" />
            </span>
            <div class="brand-text-block">
              <span class="brand-name">BidForge</span>
              <span class="brand-portal-label">Portal Penjual</span>
            </div>
          </a>
        </div>

        <!-- Desktop Navigation Items -->
        <nav class="seller-nav" aria-label="Navigasi Utama Penjual">
          <a
            routerLink="/vendor"
            routerLinkActive="is-active"
            [routerLinkActiveOptions]="{ exact: true }"
            class="seller-nav-link"
          >
            <app-icon name="dashboard" [size]="16" />
            <span>Dashboard</span>
          </a>

          <a
            routerLink="/vendor/products"
            routerLinkActive="is-active"
            class="seller-nav-link"
          >
            <app-icon name="package" [size]="16" />
            <span>Produk / Lot</span>
          </a>

          <a
            routerLink="/vendor/auctions"
            routerLinkActive="is-active"
            class="seller-nav-link"
          >
            <app-icon name="hammer" [size]="16" />
            <span>Lelang Saya</span>
          </a>

          <a
            routerLink="/marketplace"
            class="seller-nav-link seller-nav-link--subtle"
            title="Lihat Pasar Lelang Publik"
          >
            <app-icon name="external" [size]="15" />
            <span>Pasar Lelang</span>
          </a>
        </nav>

        <!-- Right Side: Actions & Single Profile Experience -->
        <div class="seller-header-actions">
          <a routerLink="/vendor/auctions/new" class="seller-cta-btn">
            <app-icon name="plus" [size]="14" />
            <span>Buat Lelang</span>
          </a>

          <!-- Single Unified Profile & Account Menu -->
          <div class="seller-user-dropdown-container">
            <button
              type="button"
              class="seller-user-btn"
              [class.is-open]="menuOpen()"
              (click)="toggleMenu()"
              aria-haspopup="menu"
              [attr.aria-expanded]="menuOpen()"
            >
              <span class="seller-user-avatar">{{ initials() }}</span>
              <span class="seller-user-meta hide-sm">
                <span class="seller-user-company">{{ companyName() }}</span>
                <span class="seller-user-role">Penjual Terverifikasi</span>
              </span>
              <app-icon name="chevron-down" [size]="14" />
            </button>

            @if (menuOpen()) {
              <div class="seller-dropdown-menu" role="menu">
                <div class="dropdown-header">
                  <span class="dropdown-company">{{ companyName() }}</span>
                  <span class="dropdown-email">{{ email() }}</span>
                </div>

                <div class="dropdown-divider"></div>

                <!-- Single entry point for both business details & user account -->
                <a
                  routerLink="/profile"
                  class="dropdown-item"
                  role="menuitem"
                  (click)="closeMenu()"
                >
                  <app-icon name="building" [size]="15" />
                  <div>
                    <span class="dropdown-item-title">Profil & Akun</span>
                    <span class="dropdown-item-desc">Data perusahaan, kontak, dan keamanan</span>
                  </div>
                </a>

                <a
                  routerLink="/vendor/products/new"
                  class="dropdown-item"
                  role="menuitem"
                  (click)="closeMenu()"
                >
                  <app-icon name="plus" [size]="15" />
                  <div>
                    <span class="dropdown-item-title">Tambah Produk / Lot</span>
                    <span class="dropdown-item-desc">Daftarkan inventaris baru</span>
                  </div>
                </a>

                <div class="dropdown-divider"></div>

                <button
                  type="button"
                  class="dropdown-item dropdown-item--danger"
                  role="menuitem"
                  (click)="logout()"
                >
                  <app-icon name="log-out" [size]="15" />
                  <span>Keluar dari Akun</span>
                </button>
              </div>
            }
          </div>

          <!-- Mobile Hamburger Toggle -->
          <button
            type="button"
            class="seller-mobile-toggle"
            [attr.aria-expanded]="mobileNavOpen()"
            aria-label="Toggle navigation menu"
            (click)="toggleMobileNav()"
          >
            <app-icon [name]="mobileNavOpen() ? 'close' : 'menu'" [size]="20" />
          </button>
        </div>
      </div>

      <!-- Mobile Dropdown Navigation -->
      @if (mobileNavOpen()) {
        <nav class="seller-mobile-nav" aria-label="Mobile Navigation">
          <a
            routerLink="/vendor"
            routerLinkActive="is-active"
            [routerLinkActiveOptions]="{ exact: true }"
            class="mobile-nav-link"
            (click)="closeMobileNav()"
          >
            <app-icon name="dashboard" [size]="18" />
            <span>Dashboard</span>
          </a>

          <a
            routerLink="/vendor/products"
            routerLinkActive="is-active"
            class="mobile-nav-link"
            (click)="closeMobileNav()"
          >
            <app-icon name="package" [size]="18" />
            <span>Produk / Lot</span>
          </a>

          <a
            routerLink="/vendor/auctions"
            routerLinkActive="is-active"
            class="mobile-nav-link"
            (click)="closeMobileNav()"
          >
            <app-icon name="hammer" [size]="18" />
            <span>Lelang Saya</span>
          </a>

          <a
            routerLink="/profile"
            routerLinkActive="is-active"
            class="mobile-nav-link"
            (click)="closeMobileNav()"
          >
            <app-icon name="building" [size]="18" />
            <span>Profil & Akun Penjual</span>
          </a>

          <a
            routerLink="/marketplace"
            class="mobile-nav-link mobile-nav-link--muted"
            (click)="closeMobileNav()"
          >
            <app-icon name="external" [size]="18" />
            <span>Pasar Lelang Publik</span>
          </a>

          <div class="mobile-nav-divider"></div>

          <button
            type="button"
            class="mobile-nav-link mobile-nav-link--danger"
            (click)="logout()"
          >
            <app-icon name="log-out" [size]="18" />
            <span>Keluar dari Akun</span>
          </button>
        </nav>
      }
    </header>
  `,
  styles: [
    `
      :host {
        display: block;
        position: sticky;
        top: 0;
        z-index: 100;
        width: 100%;
      }

      .seller-header {
        background-color: var(--c-surface);
        border-bottom: 1px solid var(--c-border);
        box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
      }

      .seller-header-inner {
        max-width: 1360px;
        margin: 0 auto;
        padding: 0 var(--sp-4);
        height: 58px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--sp-4);
      }

      /* Brand */
      .seller-header-brand-wrap {
        display: flex;
        align-items: center;
        flex-shrink: 0;
      }

      .seller-brand {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        text-decoration: none;
        color: var(--c-text);
      }

      .brand-badge-icon {
        width: 32px;
        height: 32px;
        border-radius: var(--r-sm);
        background: var(--c-seller);
        color: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 1px 2px rgba(55, 48, 163, 0.2);
      }

      .brand-text-block {
        display: flex;
        flex-direction: column;
        line-height: 1.15;
      }

      .brand-name {
        font-size: var(--fs-md);
        font-weight: var(--fw-bold);
        letter-spacing: var(--tracking-tight);
        color: var(--c-text);
      }

      .brand-portal-label {
        font-size: 0.65rem;
        font-weight: var(--fw-semibold);
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--c-seller-muted);
      }

      /* Horizontal Nav */
      .seller-nav {
        display: flex;
        align-items: center;
        gap: var(--sp-1);
        height: 100%;
      }

      .seller-nav-link {
        display: inline-flex;
        align-items: center;
        gap: var(--sp-2);
        padding: var(--sp-2) var(--sp-3);
        height: 38px;
        font-size: var(--fs-sm);
        font-weight: var(--fw-medium);
        color: var(--c-text-secondary);
        text-decoration: none;
        border-radius: var(--r-sm);
        transition: color var(--dur-fast), background-color var(--dur-fast);

        &:hover {
          color: var(--c-text);
          background-color: var(--c-surface-sunken);
        }

        &.is-active {
          color: var(--c-seller);
          font-weight: var(--fw-semibold);
          background-color: var(--c-seller-soft);
        }
      }

      .seller-nav-link--subtle {
        color: var(--c-text-muted);
        &:hover {
          color: var(--c-text-secondary);
        }
      }

      /* Header Actions */
      .seller-header-actions {
        display: flex;
        align-items: center;
        gap: var(--sp-3);
        flex-shrink: 0;
      }

      .seller-cta-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 7px 14px;
        font-size: var(--fs-sm);
        font-weight: var(--fw-medium);
        color: #ffffff;
        background-color: var(--c-seller);
        border: 1px solid transparent;
        border-radius: var(--r-sm);
        text-decoration: none;
        transition: background-color var(--dur-fast), box-shadow var(--dur-fast);
        white-space: nowrap;

        &:hover {
          background-color: var(--c-seller-hover);
        }
      }

      /* User Button & Dropdown */
      .seller-user-dropdown-container {
        position: relative;
      }

      .seller-user-btn {
        display: inline-flex;
        align-items: center;
        gap: var(--sp-2);
        padding: 4px 8px 4px 4px;
        background: transparent;
        border: 1px solid var(--c-border);
        border-radius: var(--r-md);
        cursor: pointer;
        color: var(--c-text);
        font-family: inherit;
        transition: border-color var(--dur-fast), background-color var(--dur-fast);

        &:hover,
        &.is-open {
          background-color: var(--c-surface-sunken);
          border-color: var(--c-border-strong);
        }
      }

      .seller-user-avatar {
        width: 28px;
        height: 28px;
        border-radius: var(--r-sm);
        background: var(--c-seller-soft);
        color: var(--c-seller);
        font-size: var(--fs-xs);
        font-weight: var(--fw-bold);
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .seller-user-meta {
        display: flex;
        flex-direction: column;
        text-align: left;
        line-height: 1.15;
      }

      .seller-user-company {
        font-size: var(--fs-xs);
        font-weight: var(--fw-semibold);
        color: var(--c-text);
        max-width: 130px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .seller-user-role {
        font-size: 0.65rem;
        color: var(--c-text-muted);
      }

      .seller-dropdown-menu {
        position: absolute;
        top: calc(100% + 6px);
        right: 0;
        width: 280px;
        background: var(--c-surface);
        border: 1px solid var(--c-border);
        border-radius: var(--r-md);
        box-shadow: var(--sh-md);
        padding: var(--sp-2);
        z-index: 200;
        animation: fadeIn 120ms ease-out;
      }

      .dropdown-header {
        padding: var(--sp-2) var(--sp-3);
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .dropdown-company {
        font-size: var(--fs-sm);
        font-weight: var(--fw-semibold);
        color: var(--c-text);
      }

      .dropdown-email {
        font-size: var(--fs-xs);
        color: var(--c-text-muted);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .dropdown-divider {
        height: 1px;
        background: var(--c-border);
        margin: var(--sp-1) 0;
      }

      .dropdown-item {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        width: 100%;
        padding: var(--sp-2) var(--sp-3);
        border-radius: var(--r-sm);
        border: none;
        background: transparent;
        color: var(--c-text);
        text-decoration: none;
        font-family: inherit;
        font-size: var(--fs-sm);
        cursor: pointer;
        text-align: left;
        transition: background-color var(--dur-fast);

        &:hover {
          background-color: var(--c-surface-sunken);
        }

        app-icon {
          margin-top: 2px;
          color: var(--c-text-secondary);
        }
      }

      .dropdown-item-title {
        display: block;
        font-weight: var(--fw-medium);
        color: var(--c-text);
      }

      .dropdown-item-desc {
        display: block;
        font-size: var(--fs-xs);
        color: var(--c-text-muted);
      }

      .dropdown-item--danger {
        color: var(--c-danger);
        align-items: center;

        app-icon {
          margin-top: 0;
          color: var(--c-danger);
        }

        &:hover {
          background-color: var(--c-danger-soft);
        }
      }

      /* Mobile Toggle */
      .seller-mobile-toggle {
        display: none;
        background: transparent;
        border: 1px solid var(--c-border);
        border-radius: var(--r-sm);
        padding: 6px;
        color: var(--c-text);
        cursor: pointer;
      }

      .seller-mobile-nav {
        display: none;
        background: var(--c-surface);
        border-top: 1px solid var(--c-border);
        padding: var(--sp-3) var(--sp-4);
        flex-direction: column;
        gap: var(--sp-1);
      }

      .mobile-nav-link {
        display: flex;
        align-items: center;
        gap: var(--sp-3);
        padding: 10px var(--sp-3);
        font-size: var(--fs-sm);
        font-weight: var(--fw-medium);
        color: var(--c-text);
        text-decoration: none;
        border-radius: var(--r-sm);
        border: none;
        background: transparent;
        width: 100%;
        text-align: left;
        font-family: inherit;

        &.is-active {
          color: var(--c-seller);
          font-weight: var(--fw-semibold);
          background-color: var(--c-seller-soft);
        }

        &:hover {
          background-color: var(--c-surface-sunken);
        }
      }

      .mobile-nav-link--muted {
        color: var(--c-text-muted);
      }

      .mobile-nav-link--danger {
        color: var(--c-danger);
        &:hover {
          background-color: var(--c-danger-soft);
        }
      }

      .mobile-nav-divider {
        height: 1px;
        background: var(--c-border);
        margin: var(--sp-2) 0;
      }

      @keyframes fadeIn {
        from {
          opacity: 0;
          transform: translateY(-4px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @media (max-width: 900px) {
        .seller-nav {
          display: none;
        }

        .seller-mobile-toggle {
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .seller-mobile-nav {
          display: flex;
        }

        .hide-sm {
          display: none;
        }
      }
    `,
  ],
})
export class SellerHeaderComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly menuOpen = signal(false);
  readonly mobileNavOpen = signal(false);

  readonly companyName = computed(() => this.auth.vendor()?.companyName ?? this.auth.displayName());
  readonly email = computed(() => this.auth.user()?.email ?? '');
  readonly initials = computed(() => {
    const name = this.companyName().trim();
    if (!name) return 'V';
    const parts = name.split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  });

  toggleMenu(): void {
    this.menuOpen.update((v) => !v);
  }

  closeMenu(): void {
    this.menuOpen.set(false);
  }

  toggleMobileNav(): void {
    this.mobileNavOpen.update((v) => !v);
  }

  closeMobileNav(): void {
    this.mobileNavOpen.set(false);
  }

  logout(): void {
    this.closeMenu();
    this.closeMobileNav();
    this.auth.logout();
    void this.router.navigate(['/login']);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    if (!target.closest('.seller-user-dropdown-container')) {
      this.closeMenu();
    }
  }
}
