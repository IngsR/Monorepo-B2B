import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../../core/services/session.service';
import { IconComponent } from '../ui/icon.component';

/**
 * Bidder E-Commerce Top Header & Navigation Bar.
 *
 * Designed to mirror familiar e-commerce marketplace navigation (Tokopedia / Shopee style):
 *   - Top utility bar with trust assurance and guide links
 *   - Main header with marketplace branding, large search bar, My Bids link, and user profile
 *   - Sub-navigation bar with quick category chips and status shortcuts
 */
@Component({
  selector: 'app-bidder-header',
  standalone: true,
  imports: [RouterLink, FormsModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="bidder-header">
      <!-- 1. Top Utility Ribbon -->
      <div class="bidder-top-ribbon">
        <div class="bidder-header-container ribbon-content">
          <div class="ribbon-badges">
            <span class="ribbon-item">
              <app-icon name="shield" [size]="12" />
              <span>Platform Lelang Resmi & Terpercaya B2B</span>
            </span>
            <span class="ribbon-item hide-mobile">
              <app-icon name="check" [size]="12" />
              <span>Vendor Terverifikasi</span>
            </span>
          </div>

          <div class="ribbon-links">
            <a routerLink="/panduan-lelang" class="ribbon-link">
              <app-icon name="info" [size]="12" />
              <span>Panduan Lelang</span>
            </a>
            <span class="ribbon-sep" aria-hidden="true">|</span>
            <span class="ribbon-role-badge">
              <app-icon name="user" [size]="11" />
              <span>Akun Bidder</span>
            </span>
          </div>
        </div>
      </div>

      <!-- 2. Main E-Commerce Navbar -->
      <div class="bidder-main-nav">
        <div class="bidder-header-container main-nav-content">
          <!-- Brand Logo -->
          <a routerLink="/marketplace" class="bidder-brand" aria-label="BidForge Marketplace">
            <span class="brand-logo-mark">
              <app-icon name="gavel" [size]="18" />
            </span>
            <div class="brand-logo-text">
              <span class="brand-title">BidForge</span>
              <span class="brand-badge">Pasar Lelang</span>
            </div>
          </a>

          <!-- Big Marketplace Search Bar -->
          <form class="bidder-search-bar" (ngSubmit)="performSearch()" role="search">
            <div class="search-input-wrap">
              <span class="search-icon-slot">
                <app-icon name="search" [size]="17" />
              </span>
              <input
                type="search"
                class="header-search-input"
                placeholder="Cari mesin pabrik, peralatan industri, nomor lot, vendor..."
                [ngModel]="searchQuery()"
                (ngModelChange)="searchQuery.set($event)"
                name="search"
                aria-label="Cari lelang di BidForge"
                autocomplete="off"
              />
              @if (searchQuery()) {
                <button
                  type="button"
                  class="search-clear-btn"
                  (click)="clearSearch()"
                  aria-label="Hapus teks pencarian"
                >
                  <app-icon name="close" [size]="13" />
                </button>
              }
            </div>
            <button type="submit" class="search-submit-btn" aria-label="Cari">
              <app-icon name="search" [size]="15" />
              <span class="search-submit-text">Cari</span>
            </button>
          </form>

          <!-- Right Action Items -->
          <div class="bidder-actions">
            <!-- Explore Marketplace Link -->
            <a
              routerLink="/marketplace"
              class="action-item-link"
              [class.is-active]="isMarketplaceRoute()"
              title="Jelajahi Pasar Lelang"
            >
              <span class="action-icon-pill">
                <app-icon name="gavel" [size]="17" />
              </span>
              <span class="action-label">Pasar Lelang</span>
            </a>

            <!-- My Bids Button with Accent Badge -->
            <a
              routerLink="/my-bids"
              class="action-item-link my-bids-btn"
              [class.is-active]="isMyBidsRoute()"
              title="Tawaran Saya"
            >
              <span class="action-icon-pill">
                <app-icon name="trending-up" [size]="17" />
              </span>
              <div class="action-label-group">
                <span class="action-label">Tawaran Saya</span>
                <span class="action-sublabel">Aktivitas Lelang</span>
              </div>
            </a>

            <div class="action-divider" aria-hidden="true"></div>

            <!-- User Profile Dropdown -->
            <div class="user-menu-wrap">
              <button
                type="button"
                class="user-profile-trigger"
                [attr.aria-expanded]="userMenuOpen()"
                aria-haspopup="menu"
                (click)="toggleUserMenu()"
              >
                <span class="avatar avatar-sm user-avatar">{{ initials() }}</span>
                <div class="user-info-text hide-mobile">
                  <span class="user-info-name">{{ displayName() }}</span>
                  <span class="user-info-status">
                    <span class="status-dot"></span>
                    <span>Penawar Aktif</span>
                  </span>
                </div>
                <app-icon name="chevron-down" [size]="14" />
              </button>

              @if (userMenuOpen()) {
                <div class="user-dropdown-panel" role="menu">
                  <div class="dropdown-header">
                    <p class="dropdown-user-name">{{ displayName() }}</p>
                    <p class="dropdown-user-email">{{ email() }}</p>
                    <span class="badge badge-brand dropdown-badge">
                      <app-icon name="shield" [size]="11" />
                      <span>Akun Terverifikasi</span>
                    </span>
                  </div>

                  <div class="dropdown-menu-list">
                    <a
                      routerLink="/profile/bidder"
                      class="dropdown-item"
                      role="menuitem"
                      (click)="closeUserMenu()"
                    >
                      <app-icon name="user" [size]="16" />
                      <span>Profil Perusahaan & Penawar</span>
                    </a>

                    <a
                      routerLink="/my-bids"
                      class="dropdown-item"
                      role="menuitem"
                      (click)="closeUserMenu()"
                    >
                      <app-icon name="trending-up" [size]="16" />
                      <span>Riwayat Tawaran Saya</span>
                    </a>

                    <a
                      routerLink="/profile/security"
                      class="dropdown-item"
                      role="menuitem"
                      (click)="closeUserMenu()"
                    >
                      <app-icon name="key" [size]="16" />
                      <span>Keamanan & Kata Sandi</span>
                    </a>

                    <div class="dropdown-separator"></div>

                    <button
                      type="button"
                      class="dropdown-item is-danger"
                      role="menuitem"
                      (click)="signOut()"
                    >
                      <app-icon name="log-out" [size]="16" />
                      <span>Keluar dari Akun</span>
                    </button>
                  </div>
                </div>
              }
            </div>
          </div>
        </div>
      </div>

      <!-- 3. Sub-Nav Category Strip (Deterministic active states) -->
      <nav class="bidder-sub-nav" aria-label="Kategori Lelang Cepat">
        <div class="bidder-header-container sub-nav-content">
          <div class="quick-category-scroll">
            <a
              routerLink="/marketplace"
              [queryParams]="{ status: 'ALL', categoryId: 'ALL' }"
              [class.is-sub-active]="activePill() === 'all'"
              class="sub-nav-pill"
            >
              <app-icon name="layers" [size]="13" />
              <span>Semua Lot Lelang</span>
            </a>

            <a
              routerLink="/marketplace"
              [queryParams]="{ status: 'ACTIVE' }"
              [class.is-sub-active]="activePill() === 'live'"
              class="sub-nav-pill live-pill"
            >
              <span class="pulse-indicator"></span>
              <app-icon name="gavel" [size]="13" />
              <span>Lelang Sedang Berlangsung</span>
            </a>

            <a
              routerLink="/marketplace"
              [queryParams]="{ orderBy: 'closingSoonest', status: 'ACTIVE' }"
              [class.is-sub-active]="activePill() === 'closingSoon'"
              class="sub-nav-pill"
            >
              <app-icon name="clock" [size]="13" />
              <span>Segera Berakhir</span>
            </a>

            <a
              routerLink="/my-bids"
              [queryParams]="{ filter: 'winning' }"
              [class.is-sub-active]="activePill() === 'winning'"
              class="sub-nav-pill"
            >
              <app-icon name="trending-up" [size]="13" />
              <span>Tawaran Memimpin</span>
            </a>

            <a
              routerLink="/my-bids"
              [queryParams]="{ filter: 'outbid' }"
              [class.is-sub-active]="activePill() === 'outbid'"
              class="sub-nav-pill outbid-pill"
            >
              <app-icon name="alert" [size]="13" />
              <span>Tawaran Terlampaui</span>
            </a>
          </div>
        </div>
      </nav>
    </header>
  `,
  styles: [
    `
      .bidder-header {
        position: sticky;
        top: 0;
        z-index: 100;
        background-color: var(--c-surface);
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.06);
        border-bottom: 1px solid var(--c-border);
      }

      .bidder-header-container {
        max-width: 1280px;
        margin: 0 auto;
        padding: 0 var(--sp-4);
      }

      /* 1. Ribbon */
      .bidder-top-ribbon {
        background-color: var(--c-canvas);
        border-bottom: 1px solid var(--c-border);
        font-size: var(--fs-xs);
        color: var(--c-text-secondary);
        padding: var(--sp-1) 0;
      }

      .ribbon-content {
        display: flex;
        justify-content: space-between;
        align-items: center;
        height: 30px;
      }

      .ribbon-badges,
      .ribbon-links {
        display: flex;
        align-items: center;
        gap: var(--sp-4);
      }

      .ribbon-item {
        display: inline-flex;
        align-items: center;
        gap: var(--sp-1);
        color: var(--c-text-secondary);
        font-weight: var(--fw-medium);
      }

      .ribbon-item app-icon {
        color: var(--c-brand);
      }

      .ribbon-link {
        display: inline-flex;
        align-items: center;
        gap: var(--sp-1);
        color: var(--c-text-muted);
        transition: color var(--dur-fast) var(--ease);

        &:hover {
          color: var(--c-brand);
        }
      }

      .ribbon-sep {
        color: var(--c-border-strong);
      }

      .ribbon-role-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        background-color: var(--c-brand-soft);
        color: var(--c-brand);
        font-weight: var(--fw-semibold);
        padding: 2px 8px;
        border-radius: var(--r-full);
      }

      /* 2. Main Nav */
      .bidder-main-nav {
        padding: var(--sp-3) 0;
        background-color: var(--c-surface);
      }

      .main-nav-content {
        display: flex;
        align-items: center;
        gap: var(--sp-6);
      }

      /* Brand */
      .bidder-brand {
        display: flex;
        align-items: center;
        gap: var(--sp-2);
        text-decoration: none;
        flex-shrink: 0;
      }

      .brand-logo-mark {
        width: 36px;
        height: 36px;
        border-radius: var(--r-md);
        background: linear-gradient(135deg, var(--c-brand), #008f4c);
        color: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 6px rgba(0, 170, 91, 0.28);
      }

      .brand-logo-text {
        display: flex;
        flex-direction: column;
        line-height: 1.1;
      }

      .brand-title {
        font-size: var(--fs-lg);
        font-weight: var(--fw-bold);
        color: var(--c-text);
        letter-spacing: -0.02em;
      }

      .brand-badge {
        font-size: 0.65rem;
        font-weight: var(--fw-bold);
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--c-brand);
      }

      /* Search Bar (Tokopedia style) */
      .bidder-search-bar {
        flex: 1;
        display: flex;
        align-items: center;
        border: 2px solid var(--c-border-strong);
        border-radius: var(--r-md);
        background-color: var(--c-surface);
        transition: border-color var(--dur-fast) var(--ease), box-shadow var(--dur-fast) var(--ease);

        &:focus-within {
          border-color: var(--c-brand);
          box-shadow: 0 0 0 3px rgba(0, 170, 91, 0.15);
        }
      }

      .search-input-wrap {
        flex: 1;
        display: flex;
        align-items: center;
        position: relative;
      }

      .search-icon-slot {
        position: absolute;
        left: 14px;
        color: var(--c-text-muted);
        pointer-events: none;
        display: flex;
      }

      .header-search-input {
        width: 100%;
        height: 42px;
        border: none;
        outline: none;
        background: transparent;
        padding-left: 42px;
        padding-right: 32px;
        font-size: var(--fs-base);
        font-family: inherit;
        color: var(--c-text);

        &::placeholder {
          color: var(--c-text-muted);
        }
      }

      .search-clear-btn {
        position: absolute;
        right: 10px;
        border: none;
        background: transparent;
        color: var(--c-text-muted);
        cursor: pointer;
        padding: 4px;
        display: flex;
        border-radius: var(--r-full);

        &:hover {
          color: var(--c-text);
          background-color: var(--c-surface-sunken);
        }
      }

      .search-submit-btn {
        height: 42px;
        padding: 0 var(--sp-5);
        background-color: var(--c-brand);
        color: #ffffff;
        border: none;
        border-top-right-radius: calc(var(--r-md) - 2px);
        border-bottom-right-radius: calc(var(--r-md) - 2px);
        font-size: var(--fs-sm);
        font-weight: var(--fw-semibold);
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: var(--sp-2);
        transition: background-color var(--dur-fast) var(--ease);

        &:hover {
          background-color: var(--c-brand-hover);
        }
      }

      /* Right Actions */
      .bidder-actions {
        display: flex;
        align-items: center;
        gap: var(--sp-3);
        flex-shrink: 0;
      }

      .action-item-link {
        display: flex;
        align-items: center;
        gap: var(--sp-2);
        padding: var(--sp-2) var(--sp-3);
        border-radius: var(--r-md);
        color: var(--c-text);
        text-decoration: none;
        transition: background-color var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease);

        &:hover,
        &.is-active {
          background-color: var(--c-brand-soft);
          color: var(--c-brand);
        }
      }

      .action-icon-pill {
        display: flex;
        align-items: center;
        justify-content: center;
        color: inherit;
      }

      .action-label-group {
        display: flex;
        flex-direction: column;
        line-height: 1.2;
      }

      .action-label {
        font-size: var(--fs-sm);
        font-weight: var(--fw-semibold);
      }

      .action-sublabel {
        font-size: 0.7rem;
        color: var(--c-text-muted);
      }

      .my-bids-btn {
        border: 1px solid var(--c-border);

        &:hover,
        &.is-active {
          border-color: var(--c-brand-border);
        }
      }

      .action-divider {
        width: 1px;
        height: 28px;
        background-color: var(--c-border);
      }

      /* User Menu */
      .user-menu-wrap {
        position: relative;
      }

      .user-profile-trigger {
        display: flex;
        align-items: center;
        gap: var(--sp-2);
        padding: 4px 8px;
        border: 1px solid var(--c-border);
        border-radius: var(--r-full);
        background-color: var(--c-surface);
        cursor: pointer;
        transition: border-color var(--dur-fast) var(--ease), box-shadow var(--dur-fast) var(--ease);

        &:hover {
          border-color: var(--c-border-strong);
          background-color: var(--c-surface-hover);
        }
      }

      .user-avatar {
        background-color: var(--c-brand);
        color: #ffffff;
      }

      .user-info-text {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        line-height: 1.2;
        padding-right: var(--sp-1);
      }

      .user-info-name {
        font-size: var(--fs-xs);
        font-weight: var(--fw-semibold);
        color: var(--c-text);
        max-width: 120px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .user-info-status {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 0.65rem;
        color: var(--c-success);
        font-weight: var(--fw-medium);
      }

      .status-dot {
        width: 6px;
        height: 6px;
        border-radius: var(--r-full);
        background-color: var(--c-success);
      }

      .user-dropdown-panel {
        position: absolute;
        top: calc(100% + 8px);
        right: 0;
        width: 250px;
        background-color: var(--c-surface);
        border: 1px solid var(--c-border);
        border-radius: var(--r-lg);
        box-shadow: var(--sh-lg);
        padding: var(--sp-2);
        z-index: 200;
        animation: dropFadeIn 140ms ease-out;
      }

      @keyframes dropFadeIn {
        from {
          opacity: 0;
          transform: translateY(-6px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .dropdown-header {
        padding: var(--sp-3);
        border-bottom: 1px solid var(--c-border);
        margin-bottom: var(--sp-2);
      }

      .dropdown-user-name {
        font-size: var(--fs-sm);
        font-weight: var(--fw-bold);
        color: var(--c-text);
      }

      .dropdown-user-email {
        font-size: var(--fs-xs);
        color: var(--c-text-muted);
        margin-bottom: var(--sp-2);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .dropdown-badge {
        font-size: 0.7rem;
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }

      .dropdown-menu-list {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .dropdown-item {
        display: flex;
        align-items: center;
        gap: var(--sp-3);
        padding: var(--sp-2) var(--sp-3);
        border-radius: var(--r-md);
        font-size: var(--fs-sm);
        color: var(--c-text);
        text-decoration: none;
        border: none;
        background: transparent;
        width: 100%;
        text-align: left;
        cursor: pointer;
        transition: background-color var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease);

        &:hover {
          background-color: var(--c-surface-sunken);
          color: var(--c-brand);
        }

        &.is-danger {
          color: var(--c-danger);

          &:hover {
            background-color: var(--c-danger-soft);
          }
        }
      }

      .dropdown-separator {
        height: 1px;
        background-color: var(--c-border);
        margin: var(--sp-2) 0;
      }

      /* 3. Sub Nav Category Strip */
      .bidder-sub-nav {
        background-color: var(--c-surface);
        border-top: 1px solid var(--c-border);
        padding: var(--sp-2) 0;
      }

      .sub-nav-content {
        display: flex;
        align-items: center;
      }

      .quick-category-scroll {
        display: flex;
        align-items: center;
        gap: var(--sp-2);
        overflow-x: auto;
        scrollbar-width: none;
        padding-bottom: 2px;

        &::-webkit-scrollbar {
          display: none;
        }
      }

      .sub-nav-pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 5px 12px;
        border-radius: var(--r-full);
        background-color: var(--c-canvas);
        color: var(--c-text-secondary);
        font-size: var(--fs-xs);
        font-weight: var(--fw-medium);
        text-decoration: none;
        white-space: nowrap;
        border: 1px solid transparent;
        transition: all var(--dur-fast) var(--ease);

        &:hover {
          background-color: var(--c-brand-soft);
          color: var(--c-brand);
          border-color: var(--c-brand-border);
        }

        &.is-sub-active {
          background-color: var(--c-brand);
          color: #ffffff;
          font-weight: var(--fw-semibold);
        }
      }

      .live-pill {
        color: var(--c-success);
        background-color: var(--c-success-soft);
        border-color: var(--c-success-border);

        &.is-sub-active {
          background-color: var(--c-success);
          color: #ffffff;
        }
      }

      .outbid-pill {
        color: var(--c-warning);
        background-color: var(--c-warning-soft);
      }

      .pulse-indicator {
        width: 7px;
        height: 7px;
        border-radius: var(--r-full);
        background-color: var(--c-success);
        animation: pulseLive 1.5s infinite;
      }

      @keyframes pulseLive {
        0%,
        100% {
          opacity: 1;
          transform: scale(1);
        }
        50% {
          opacity: 0.4;
          transform: scale(1.3);
        }
      }

      /* Responsive */
      @media (max-width: 768px) {
        .hide-mobile {
          display: none !important;
        }

        .main-nav-content {
          gap: var(--sp-3);
        }

        .search-submit-text {
          display: none;
        }

        .search-submit-btn {
          padding: 0 var(--sp-3);
        }

        .action-label-group {
          display: none;
        }
      }
    `,
  ],
})
export class BidderHeaderComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly searchQuery = signal('');
  readonly userMenuOpen = signal(false);

  readonly displayName = computed(() => this.auth.displayName() || 'Signed in');
  readonly email = computed(() => this.auth.user()?.email ?? '');

  readonly initials = computed(() => {
    const user = this.auth.user();
    if (!user) return 'B';
    const first = user.firstName?.trim()[0] ?? '';
    const last = user.lastName?.trim()[0] ?? '';
    return `${first}${last}`.toUpperCase() || user.email[0]?.toUpperCase() || 'B';
  });

  readonly currentUrl = signal(this.router.url);

  readonly activePill = computed<'all' | 'live' | 'closingSoon' | 'winning' | 'outbid' | null>(() => {
    const url = this.currentUrl();
    if (url.startsWith('/marketplace')) {
      // If it's a detail page like /marketplace/abc, don't mark any category pill
      if (/^\/marketplace\/[^?]+/.test(url)) return null;
      if (url.includes('closingSoonest')) return 'closingSoon';
      if (url.includes('status=ACTIVE')) return 'live';
      if (url.includes('status=ALL') || url === '/marketplace' || !url.includes('status=')) {
        return 'all';
      }
      return null;
    }
    if (url.startsWith('/my-bids')) {
      if (url.includes('filter=winning')) return 'winning';
      if (url.includes('filter=outbid')) return 'outbid';
      return null;
    }
    return null;
  });

  readonly isMarketplaceRoute = computed(() => this.currentUrl().startsWith('/marketplace'));
  readonly isMyBidsRoute = computed(() => this.currentUrl().startsWith('/my-bids'));

  constructor() {
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => {
        this.userMenuOpen.set(false);
        this.currentUrl.set(event.urlAfterRedirects || event.url);
      });
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (this.userMenuOpen() && !target?.closest('.user-menu-wrap')) {
      this.userMenuOpen.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.userMenuOpen.set(false);
  }

  toggleUserMenu(): void {
    this.userMenuOpen.update((open) => !open);
  }

  closeUserMenu(): void {
    this.userMenuOpen.set(false);
  }

  clearSearch(): void {
    this.searchQuery.set('');
  }

  performSearch(): void {
    const query = this.searchQuery().trim();
    void this.router.navigate(['/marketplace'], {
      queryParams: query ? { search: query } : undefined,
    });
  }

  signOut(): void {
    this.closeUserMenu();
    this.auth.logout();
  }
}
