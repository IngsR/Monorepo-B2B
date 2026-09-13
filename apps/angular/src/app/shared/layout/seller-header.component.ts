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
import { MatIconComponent } from '../ui/mat-icon.component';

/**
 * Seller / Vendor Top Navigation Bar — Auction Operations Desk.
 *
 * Dedicated horizontal navigation for the B2B Auction Seller Portal.
 * Designed with a 60/30/10 palette (warm light canvas, charcoal structure,
 * and muted copper accents) and fully responsive mobile navigation.
 */
@Component({
  selector: 'app-seller-header',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, MatIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="seller-header">
      <div class="seller-header-inner">
        <!-- Brand & Operations Desk Identity -->
        <div class="seller-header-brand-wrap">
          <a routerLink="/vendor" class="seller-brand" aria-label="BidForge Auction Operations Desk">
            <span class="brand-badge-icon">
              <mat-icon fontIcon="gavel" [size]="18" />
            </span>
            <div class="brand-text-block">
              <span class="brand-name">BidForge</span>
              <span class="brand-portal-label">Auction Operations Desk</span>
            </div>
          </a>
        </div>

        <!-- Desktop Operational Navigation -->
        <nav class="seller-nav" aria-label="Navigasi Operasional Penjual">
          <a
            routerLink="/vendor"
            routerLinkActive="is-active"
            [routerLinkActiveOptions]="{ exact: true }"
            class="seller-nav-link"
          >
            <mat-icon fontIcon="dashboard" [size]="16" />
            <span>Ringkasan</span>
          </a>

          <a
            routerLink="/vendor/products"
            routerLinkActive="is-active"
            class="seller-nav-link"
          >
            <mat-icon fontIcon="inventory_2" [size]="16" />
            <span>Barang Saya</span>
          </a>

          <a
            routerLink="/vendor/auctions"
            routerLinkActive="is-active"
            class="seller-nav-link"
          >
            <mat-icon fontIcon="gavel" [size]="16" />
            <span>Lelang Saya</span>
          </a>

          <a
            routerLink="/vendor/guide"
            routerLinkActive="is-active"
            class="seller-nav-link"
          >
            <mat-icon fontIcon="menu_book" [size]="16" />
            <span>Panduan Penjualan</span>
          </a>

          <a
            routerLink="/marketplace"
            class="seller-nav-link seller-nav-link--subtle"
            title="Lihat Pasar Lelang Publik"
          >
            <mat-icon fontIcon="open_in_new" [size]="15" />
            <span>Pasar Lelang</span>
          </a>
        </nav>

        <!-- Right Side: Operational Actions & User Profile -->
        <div class="seller-header-actions">
          <a routerLink="/vendor/auctions/new" class="seller-cta-btn">
            <mat-icon fontIcon="add" [size]="16" />
            <span>Buat Lelang</span>
          </a>

          <!-- User Account Menu -->
          <div class="seller-user-dropdown-container">
            <button
              type="button"
              class="seller-user-btn"
              [class.is-open]="menuOpen()"
              (click)="toggleMenu()"
              aria-haspopup="menu"
              [attr.aria-expanded]="menuOpen()"
              aria-label="Menu Akun Penjual"
            >
              <span class="seller-user-avatar">{{ initials() }}</span>
              <span class="seller-user-meta hide-sm">
                <span class="seller-user-company">{{ companyName() }}</span>
                <span class="seller-user-role">Penjual Terverifikasi</span>
              </span>
              <mat-icon fontIcon="expand_more" [size]="16" />
            </button>

            @if (menuOpen()) {
              <div class="seller-dropdown-menu" role="menu">
                <div class="dropdown-header">
                  <span class="dropdown-company">{{ companyName() }}</span>
                  <span class="dropdown-email">{{ email() }}</span>
                </div>

                <div class="dropdown-divider"></div>

                <a
                  routerLink="/profile"
                  class="dropdown-item"
                  role="menuitem"
                  (click)="closeMenu()"
                >
                  <mat-icon fontIcon="account_circle" [size]="16" />
                  <div>
                    <span class="dropdown-item-title">Profil & Akun</span>
                    <span class="dropdown-item-desc">Data perusahaan dan akun</span>
                  </div>
                </a>

                <a
                  routerLink="/vendor/products/new"
                  class="dropdown-item"
                  role="menuitem"
                  (click)="closeMenu()"
                >
                  <mat-icon fontIcon="add_box" [size]="16" />
                  <div>
                    <span class="dropdown-item-title">Daftarkan Barang Baru</span>
                    <span class="dropdown-item-desc">Inventaris lot katalog</span>
                  </div>
                </a>

                <a
                  routerLink="/vendor/guide"
                  class="dropdown-item"
                  role="menuitem"
                  (click)="closeMenu()"
                >
                  <mat-icon fontIcon="menu_book" [size]="16" />
                  <div>
                    <span class="dropdown-item-title">Panduan Penjualan</span>
                    <span class="dropdown-item-desc">SOP dan tata cara lelang</span>
                  </div>
                </a>

                <div class="dropdown-divider"></div>

                <button
                  type="button"
                  class="dropdown-item dropdown-item--danger"
                  role="menuitem"
                  (click)="logout()"
                >
                  <mat-icon fontIcon="logout" [size]="16" />
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
            aria-label="Toggle navigasi penjual"
            (click)="toggleMobileNav()"
          >
            <mat-icon [fontIcon]="mobileNavOpen() ? 'close' : 'menu'" [size]="20" />
          </button>
        </div>
      </div>

      <!-- Mobile Dedicated Operational Navigation Drawer -->
      @if (mobileNavOpen()) {
        <nav class="seller-mobile-nav" aria-label="Mobile Navigasi Penjual">
          <div class="mobile-nav-user-header">
            <span class="seller-user-avatar">{{ initials() }}</span>
            <div class="mobile-nav-user-meta">
              <span class="mobile-user-name">{{ companyName() }}</span>
              <span class="mobile-user-email">{{ email() }}</span>
            </div>
          </div>

          <div class="mobile-nav-divider"></div>

          <a
            routerLink="/vendor"
            routerLinkActive="is-active"
            [routerLinkActiveOptions]="{ exact: true }"
            class="mobile-nav-link"
            (click)="closeMobileNav()"
          >
            <mat-icon fontIcon="dashboard" [size]="18" />
            <span>Ringkasan Operasional</span>
          </a>

          <a
            routerLink="/vendor/products"
            routerLinkActive="is-active"
            class="mobile-nav-link"
            (click)="closeMobileNav()"
          >
            <mat-icon fontIcon="inventory_2" [size]="18" />
            <span>Barang Saya (Katalog)</span>
          </a>

          <a
            routerLink="/vendor/auctions"
            routerLinkActive="is-active"
            class="mobile-nav-link"
            (click)="closeMobileNav()"
          >
            <mat-icon fontIcon="gavel" [size]="18" />
            <span>Lelang Saya (Lot)</span>
          </a>

          <a
            routerLink="/vendor/guide"
            routerLinkActive="is-active"
            class="mobile-nav-link"
            (click)="closeMobileNav()"
          >
            <mat-icon fontIcon="menu_book" [size]="18" />
            <span>Panduan Penjualan</span>
          </a>

          <a
            routerLink="/profile"
            routerLinkActive="is-active"
            class="mobile-nav-link"
            (click)="closeMobileNav()"
          >
            <mat-icon fontIcon="account_circle" [size]="18" />
            <span>Profil & Akun Penjual</span>
          </a>

          <a
            routerLink="/marketplace"
            class="mobile-nav-link mobile-nav-link--muted"
            (click)="closeMobileNav()"
          >
            <mat-icon fontIcon="open_in_new" [size]="18" />
            <span>Pasar Lelang Publik</span>
          </a>

          <div class="mobile-nav-divider"></div>

          <div class="mobile-nav-actions">
            <a
              routerLink="/vendor/auctions/new"
              class="mobile-cta-btn"
              (click)="closeMobileNav()"
            >
              <mat-icon fontIcon="add" [size]="18" />
              <span>Buat Lelang Baru</span>
            </a>

            <button
              type="button"
              class="mobile-nav-link mobile-nav-link--danger"
              (click)="logout()"
            >
              <mat-icon fontIcon="logout" [size]="18" />
              <span>Keluar dari Akun</span>
            </button>
          </div>
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
        background-color: #ffffff;
      }

      .seller-header {
        background-color: #ffffff;
        border-bottom: 1px solid #d9ddd8;
        box-shadow: 0 1px 3px rgba(23, 32, 30, 0.04);
        font-family: var(--font-sans);
      }

      .seller-header-inner {
        max-width: 1360px;
        margin: 0 auto;
        padding: 0 var(--sp-4);
        height: 60px;
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
        color: #17201e;
      }

      .brand-badge-icon {
        width: 32px;
        height: 32px;
        border-radius: var(--r-sm);
        background: #a86445;
        color: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
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
        color: #17201e;
      }

      .brand-portal-label {
        font-size: 0.625rem;
        font-weight: var(--fw-bold);
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: #a86445;
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
        gap: 6px;
        padding: var(--sp-2) var(--sp-3);
        height: 38px;
        font-size: var(--fs-sm);
        font-weight: var(--fw-medium);
        color: #3e4a45;
        text-decoration: none;
        border-radius: var(--r-sm);
        transition: color var(--dur-fast), background-color var(--dur-fast);

        &:hover {
          color: #17201e;
          background-color: #f5f3ee;
        }

        &.is-active {
          color: #a86445;
          font-weight: var(--fw-semibold);
          background-color: #f6efea;
        }
      }

      .seller-nav-link--subtle {
        color: #64706b;
        font-size: var(--fs-xs);
        &:hover {
          color: #26332f;
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
        font-weight: var(--fw-semibold);
        color: #ffffff;
        background-color: #a86445;
        border: 1px solid transparent;
        border-radius: var(--r-sm);
        text-decoration: none;
        transition: background-color var(--dur-fast);
        white-space: nowrap;

        &:hover {
          background-color: #8f5138;
          color: #ffffff;
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
        border: 1px solid #d9ddd8;
        border-radius: var(--r-md);
        cursor: pointer;
        color: #17201e;
        font-family: inherit;
        transition: border-color var(--dur-fast), background-color var(--dur-fast);

        &:hover,
        &.is-open {
          background-color: #f5f3ee;
          border-color: #a86445;
        }
      }

      .seller-user-avatar {
        width: 28px;
        height: 28px;
        border-radius: var(--r-sm);
        background: #f6efea;
        color: #a86445;
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
        color: #17201e;
        max-width: 140px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .seller-user-role {
        font-size: 0.625rem;
        color: #64706b;
      }

      .seller-dropdown-menu {
        position: absolute;
        top: calc(100% + 6px);
        right: 0;
        width: 280px;
        background: #ffffff;
        border: 1px solid #d9ddd8;
        border-radius: var(--r-md);
        box-shadow: 0 4px 16px rgba(23, 32, 30, 0.1);
        padding: var(--sp-2);
        z-index: 200;
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
        color: #17201e;
      }

      .dropdown-email {
        font-size: var(--fs-xs);
        color: #64706b;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .dropdown-divider {
        height: 1px;
        background: #d9ddd8;
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
        color: #17201e;
        text-decoration: none;
        font-family: inherit;
        font-size: var(--fs-sm);
        cursor: pointer;
        text-align: left;
        transition: background-color var(--dur-fast);

        &:hover {
          background-color: #f5f3ee;
        }

        mat-icon {
          margin-top: 2px;
          color: #64706b;
        }
      }

      .dropdown-item-title {
        display: block;
        font-weight: var(--fw-medium);
        color: #17201e;
      }

      .dropdown-item-desc {
        display: block;
        font-size: var(--fs-xs);
        color: #64706b;
      }

      .dropdown-item--danger {
        color: var(--c-danger);
        align-items: center;

        mat-icon {
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
        border: 1px solid #d9ddd8;
        border-radius: var(--r-sm);
        padding: 6px;
        color: #17201e;
        cursor: pointer;
      }

      .seller-mobile-nav {
        display: none;
        background: #ffffff;
        border-top: 1px solid #d9ddd8;
        padding: var(--sp-3) var(--sp-4);
        flex-direction: column;
        gap: var(--sp-1);
      }

      .mobile-nav-user-header {
        display: flex;
        align-items: center;
        gap: var(--sp-3);
        padding: var(--sp-2) 0;
      }

      .mobile-nav-user-meta {
        display: flex;
        flex-direction: column;
      }

      .mobile-user-name {
        font-size: var(--fs-sm);
        font-weight: var(--fw-bold);
        color: #17201e;
      }

      .mobile-user-email {
        font-size: var(--fs-xs);
        color: #64706b;
      }

      .mobile-nav-link {
        display: flex;
        align-items: center;
        gap: var(--sp-3);
        padding: 10px var(--sp-3);
        font-size: var(--fs-sm);
        font-weight: var(--fw-medium);
        color: #17201e;
        text-decoration: none;
        border-radius: var(--r-sm);
        border: none;
        background: transparent;
        width: 100%;
        text-align: left;
        font-family: inherit;

        &.is-active {
          color: #a86445;
          font-weight: var(--fw-semibold);
          background-color: #f6efea;
        }

        &:hover {
          background-color: #f5f3ee;
        }
      }

      .mobile-nav-link--muted {
        color: #64706b;
      }

      .mobile-nav-link--danger {
        color: var(--c-danger);
        &:hover {
          background-color: var(--c-danger-soft);
        }
      }

      .mobile-nav-divider {
        height: 1px;
        background: #d9ddd8;
        margin: var(--sp-2) 0;
      }

      .mobile-nav-actions {
        display: flex;
        flex-direction: column;
        gap: var(--sp-2);
        margin-top: var(--sp-2);
      }

      .mobile-cta-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: var(--sp-2);
        padding: 10px;
        font-size: var(--fs-sm);
        font-weight: var(--fw-semibold);
        color: #ffffff;
        background-color: #a86445;
        border-radius: var(--r-sm);
        text-decoration: none;

        &:hover {
          background-color: #8f5138;
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
