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
import { MatIconComponent } from '../ui/mat-icon.component';

/**
 * Bidder Institutional Navigation & Header.
 *
 * Designed as an enterprise B2B procurement & auction platform:
 *  - Top enterprise utility bar with platform verification & role identity
 *  - Main header with dignified BidForge branding, structured search, and bidder activity links
 *  - Five official navigation shortcuts with verified Material Symbols:
 *      1. Semua Lot Lelang (/marketplace?status=ALL&categoryId=ALL)
 *      2. Lelang Sedang Berlangsung (/marketplace?status=ACTIVE)
 *      3. Segera Berakhir (/marketplace?orderBy=closingSoonest&status=ACTIVE)
 *      4. Tawaran Memimpin (/my-bids?filter=winning)
 *      5. Tawaran Terlampaui (/my-bids?filter=outbid)
 *  - Deterministic router & query-parameter active state highlighting
 */
@Component({
  selector: 'app-bidder-header',
  standalone: true,
  imports: [RouterLink, FormsModule, MatIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="bidder-header" role="banner">
      <!-- 1. Top Enterprise Ribbon -->
      <div class="bidder-top-ribbon">
        <div class="bidder-header-container ribbon-content">
          <div class="ribbon-badges">
            <span class="ribbon-item">
              <mat-icon fontIcon="verified_user" [size]="14" />
              <span>Platform Pengadaan & Lelang B2B Resmi</span>
            </span>
            <span class="ribbon-sep" aria-hidden="true">|</span>
            <span class="ribbon-item hide-mobile">
              <mat-icon fontIcon="domain" [size]="14" />
              <span>Vendor & Aset Terverifikasi</span>
            </span>
          </div>

          <div class="ribbon-links">
            <a routerLink="/panduan-lelang" class="ribbon-link">
              <mat-icon fontIcon="help_outline" [size]="14" />
              <span>Tata Cara & Panduan Lelang</span>
            </a>
            <span class="ribbon-sep" aria-hidden="true">|</span>
            <span class="ribbon-role-badge">
              <mat-icon fontIcon="badge" [size]="13" />
              <span>Akun Penawar Resmi</span>
            </span>
          </div>
        </div>
      </div>

      <!-- 2. Main B2B Navigation Bar -->
      <div class="bidder-main-nav">
        <div class="bidder-header-container main-nav-content">
          <!-- Brand Identity -->
          <a routerLink="/marketplace" class="bidder-brand" aria-label="BidForge - Beranda Pasar Lelang">
            <span class="brand-logo-mark" aria-hidden="true">
              <mat-icon fontIcon="gavel" [size]="20" />
            </span>
            <div class="brand-logo-text">
              <span class="brand-title">BidForge</span>
              <span class="brand-badge">B2B Auction Exchange</span>
            </div>
          </a>

          <!-- Enterprise Search Bar -->
          <form class="bidder-search-bar" (ngSubmit)="performSearch()" role="search">
            <div class="search-input-wrap">
              <span class="search-icon-slot" aria-hidden="true">
                <mat-icon fontIcon="search" [size]="18" />
              </span>
              <input
                type="search"
                class="header-search-input"
                placeholder="Cari berdasarkan nama lot, kode lot, nomor spesifikasi, vendor..."
                [ngModel]="searchQuery()"
                (ngModelChange)="searchQuery.set($event)"
                name="search"
                aria-label="Cari lot lelang B2B"
                autocomplete="off"
              />
              @if (searchQuery()) {
                <button
                  type="button"
                  class="search-clear-btn"
                  (click)="clearSearch()"
                  aria-label="Hapus kata kunci pencarian"
                >
                  <mat-icon fontIcon="close" [size]="15" />
                </button>
              }
            </div>
            <button type="submit" class="search-submit-btn" aria-label="Jalankan pencarian lot">
              <mat-icon fontIcon="search" [size]="16" />
              <span class="search-submit-text">Cari Lot</span>
            </button>
          </form>

          <!-- Right Action Items -->
          <div class="bidder-actions">
            <!-- Marketplace Floor Link -->
            <a
              routerLink="/marketplace"
              class="action-item-link"
              [class.is-active]="isMarketplaceRoute()"
              title="Lantai Lelang Industri"
            >
              <mat-icon fontIcon="storefront" [size]="18" />
              <span class="action-label">Lantai Lelang</span>
            </a>

            <!-- My Bids Link -->
            <a
              routerLink="/my-bids"
              class="action-item-link my-bids-link"
              [class.is-active]="isMyBidsRoute()"
              title="Tawaran Saya"
            >
              <mat-icon fontIcon="gavel" [size]="18" />
              <div class="action-label-group">
                <span class="action-label">Tawaran Saya</span>
                <span class="action-sublabel">Aktivitas Penawaran</span>
              </div>
            </a>

            <div class="action-divider" aria-hidden="true"></div>

            <!-- User Account Profile Menu -->
            <div class="user-menu-wrap">
              <button
                type="button"
                class="user-profile-trigger"
                [attr.aria-expanded]="userMenuOpen()"
                aria-haspopup="menu"
                (click)="toggleUserMenu()"
                aria-label="Menu akun penawar"
              >
                <span class="user-avatar" aria-hidden="true">{{ initials() }}</span>
                <div class="user-info-text hide-mobile">
                  <span class="user-info-name">{{ displayName() }}</span>
                  <span class="user-info-status">
                    <span class="status-indicator-dot"></span>
                    <span>Bidder Terdaftar</span>
                  </span>
                </div>
                <mat-icon fontIcon="arrow_drop_down" [size]="18" />
              </button>

              @if (userMenuOpen()) {
                <div class="user-dropdown-panel" role="menu">
                  <div class="dropdown-header">
                    <p class="dropdown-user-name">{{ displayName() }}</p>
                    <p class="dropdown-user-email">{{ email() }}</p>
                    <span class="dropdown-verified-chip">
                      <mat-icon fontIcon="check_circle" [size]="13" />
                      <span>Terverifikasi B2B</span>
                    </span>
                  </div>

                  <div class="dropdown-menu-list">
                    <a
                      routerLink="/profile/bidder"
                      class="dropdown-item"
                      role="menuitem"
                      (click)="closeUserMenu()"
                    >
                      <mat-icon fontIcon="business" [size]="16" />
                      <span>Profil Perusahaan Penawar</span>
                    </a>

                    <a
                      routerLink="/my-bids"
                      class="dropdown-item"
                      role="menuitem"
                      (click)="closeUserMenu()"
                    >
                      <mat-icon fontIcon="history" [size]="16" />
                      <span>Riwayat Penawaran Saya</span>
                    </a>

                    <a
                      routerLink="/profile/security"
                      class="dropdown-item"
                      role="menuitem"
                      (click)="closeUserMenu()"
                    >
                      <mat-icon fontIcon="lock" [size]="16" />
                      <span>Keamanan & Sandi</span>
                    </a>

                    <div class="dropdown-separator" role="separator"></div>

                    <button
                      type="button"
                      class="dropdown-item is-danger"
                      role="menuitem"
                      (click)="signOut()"
                    >
                      <mat-icon fontIcon="logout" [size]="16" />
                      <span>Keluar dari Akun</span>
                    </button>
                  </div>
                </div>
              }
            </div>
          </div>
        </div>
      </div>

      <!-- 3. Sub-Nav Ribbon: 5 Official Bidder Shortcuts -->
      <nav class="bidder-sub-nav" aria-label="Navigasi Akses Cepat Lot Lelang">
        <div class="bidder-header-container sub-nav-content">
          <div class="quick-shortcuts-list" role="tablist">
            <!-- 1. Semua Lot Lelang -->
            <a
              routerLink="/marketplace"
              [queryParams]="{ status: 'ALL', categoryId: 'ALL' }"
              [class.is-shortcut-active]="activePill() === 'all'"
              class="shortcut-pill"
              role="tab"
              [attr.aria-selected]="activePill() === 'all'"
            >
              <mat-icon fontIcon="layers" [size]="16" />
              <span>Semua Lot Lelang</span>
            </a>

            <!-- 2. Lelang Sedang Berlangsung -->
            <a
              routerLink="/marketplace"
              [queryParams]="{ status: 'ACTIVE' }"
              [class.is-shortcut-active]="activePill() === 'live'"
              class="shortcut-pill live-shortcut"
              role="tab"
              [attr.aria-selected]="activePill() === 'live'"
            >
              <span class="pulse-live-marker" aria-hidden="true"></span>
              <mat-icon fontIcon="gavel" [size]="16" />
              <span>Lelang Sedang Berlangsung</span>
            </a>

            <!-- 3. Segera Berakhir -->
            <a
              routerLink="/marketplace"
              [queryParams]="{ orderBy: 'closingSoonest', status: 'ACTIVE' }"
              [class.is-shortcut-active]="activePill() === 'closingSoon'"
              class="shortcut-pill urgent-shortcut"
              role="tab"
              [attr.aria-selected]="activePill() === 'closingSoon'"
            >
              <mat-icon fontIcon="schedule" [size]="16" />
              <span>Segera Berakhir</span>
            </a>

            <!-- 4. Tawaran Memimpin -->
            <a
              routerLink="/my-bids"
              [queryParams]="{ filter: 'winning' }"
              [class.is-shortcut-active]="activePill() === 'winning'"
              class="shortcut-pill winning-shortcut"
              role="tab"
              [attr.aria-selected]="activePill() === 'winning'"
            >
              <mat-icon fontIcon="trending_up" [size]="16" />
              <span>Tawaran Memimpin</span>
            </a>

            <!-- 5. Tawaran Terlampaui -->
            <a
              routerLink="/my-bids"
              [queryParams]="{ filter: 'outbid' }"
              [class.is-shortcut-active]="activePill() === 'outbid'"
              class="shortcut-pill outbid-shortcut"
              role="tab"
              [attr.aria-selected]="activePill() === 'outbid'"
            >
              <mat-icon fontIcon="trending_down" [size]="16" />
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
        border-bottom: 1px solid var(--c-border);
        box-shadow: 0 1px 3px rgba(22, 31, 48, 0.05);
      }

      .bidder-header-container {
        max-width: 1280px;
        margin: 0 auto;
        padding: 0 var(--sp-4);
      }

      /* 1. Top Enterprise Ribbon */
      .bidder-top-ribbon {
        background-color: var(--c-canvas);
        border-bottom: 1px solid var(--c-border);
        font-size: var(--fs-xs);
        color: var(--c-text-muted);
        padding: 2px 0;
      }

      .ribbon-content {
        display: flex;
        justify-content: space-between;
        align-items: center;
        height: 28px;
      }

      .ribbon-badges,
      .ribbon-links {
        display: flex;
        align-items: center;
        gap: var(--sp-3);
      }

      .ribbon-item {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        color: var(--c-text-secondary);
        font-weight: var(--fw-medium);
      }

      .ribbon-item mat-icon {
        color: var(--c-brand);
      }

      .ribbon-link {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        color: var(--c-text-muted);
        text-decoration: none;
        transition: color var(--dur-fast) var(--ease);

        &:hover {
          color: var(--c-text);
        }
      }

      .ribbon-sep {
        color: var(--c-border-strong);
        opacity: 0.6;
      }

      .ribbon-role-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        background-color: var(--c-brand-soft);
        color: var(--c-brand);
        font-weight: var(--fw-semibold);
        padding: 1px 8px;
        border-radius: var(--r-sm);
        border: 1px solid var(--c-brand-border);
      }

      /* 2. Main B2B Navbar */
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
        gap: var(--sp-3);
        text-decoration: none;
        flex-shrink: 0;
      }

      .brand-logo-mark {
        width: 36px;
        height: 36px;
        border-radius: var(--r-sm);
        background-color: var(--c-brand);
        color: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 1px solid rgba(255, 255, 255, 0.15);
        box-shadow: 0 1px 3px rgba(27, 77, 62, 0.25);
      }

      .brand-logo-text {
        display: flex;
        flex-direction: column;
        line-height: 1.15;
      }

      .brand-title {
        font-size: var(--fs-lg);
        font-weight: var(--fw-bold);
        color: var(--c-text);
        letter-spacing: -0.025em;
      }

      .brand-badge {
        font-size: 0.65rem;
        font-weight: var(--fw-semibold);
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--c-text-muted);
      }

      /* Search Bar */
      .bidder-search-bar {
        flex: 1;
        display: flex;
        align-items: center;
        border: 1px solid var(--c-border-strong);
        border-radius: var(--r-sm);
        background-color: var(--c-canvas);
        transition: border-color var(--dur-fast) var(--ease), box-shadow var(--dur-fast) var(--ease);

        &:focus-within {
          border-color: var(--c-brand);
          background-color: var(--c-surface);
          box-shadow: 0 0 0 2px rgba(27, 77, 62, 0.12);
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
        left: 12px;
        color: var(--c-text-muted);
        pointer-events: none;
        display: flex;
        align-items: center;
      }

      .header-search-input {
        width: 100%;
        height: 38px;
        border: none;
        outline: none;
        background: transparent;
        padding-left: 38px;
        padding-right: 32px;
        font-size: var(--fs-sm);
        font-family: inherit;
        color: var(--c-text);

        &::placeholder {
          color: var(--c-text-muted);
        }
      }

      .search-clear-btn {
        position: absolute;
        right: 8px;
        border: none;
        background: transparent;
        color: var(--c-text-muted);
        cursor: pointer;
        padding: 4px;
        display: flex;
        align-items: center;
        border-radius: var(--r-sm);

        &:hover {
          color: var(--c-text);
          background-color: var(--c-surface-sunken);
        }
      }

      .search-submit-btn {
        height: 38px;
        padding: 0 var(--sp-4);
        background-color: var(--c-brand);
        color: #ffffff;
        border: none;
        border-top-right-radius: calc(var(--r-sm) - 1px);
        border-bottom-right-radius: calc(var(--r-sm) - 1px);
        font-size: var(--fs-xs);
        font-weight: var(--fw-semibold);
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        transition: background-color var(--dur-fast) var(--ease);

        &:hover {
          background-color: var(--c-brand-hover);
        }
      }

      /* Right Actions */
      .bidder-actions {
        display: flex;
        align-items: center;
        gap: var(--sp-2);
        flex-shrink: 0;
      }

      .action-item-link {
        display: flex;
        align-items: center;
        gap: var(--sp-2);
        padding: var(--sp-2) var(--sp-3);
        border-radius: var(--r-sm);
        color: var(--c-text-secondary);
        text-decoration: none;
        font-size: var(--fs-sm);
        font-weight: var(--fw-medium);
        transition: background-color var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease);

        &:hover {
          background-color: var(--c-canvas);
          color: var(--c-text);
        }

        &.is-active {
          background-color: var(--c-brand-soft);
          color: var(--c-brand);
          font-weight: var(--fw-semibold);
        }
      }

      .my-bids-link {
        border: 1px solid var(--c-border);

        &.is-active {
          border-color: var(--c-brand-border);
        }
      }

      .action-label-group {
        display: flex;
        flex-direction: column;
        line-height: 1.15;
      }

      .action-sublabel {
        font-size: 0.65rem;
        color: var(--c-text-muted);
      }

      .action-divider {
        width: 1px;
        height: 24px;
        background-color: var(--c-border);
        margin: 0 4px;
      }

      /* User Menu */
      .user-menu-wrap {
        position: relative;
      }

      .user-profile-trigger {
        display: flex;
        align-items: center;
        gap: var(--sp-2);
        padding: 3px 8px 3px 4px;
        border: 1px solid var(--c-border);
        border-radius: var(--r-sm);
        background-color: var(--c-surface);
        cursor: pointer;
        transition: border-color var(--dur-fast) var(--ease), background-color var(--dur-fast) var(--ease);

        &:hover {
          border-color: var(--c-border-strong);
          background-color: var(--c-canvas);
        }
      }

      .user-avatar {
        width: 28px;
        height: 28px;
        border-radius: var(--r-sm);
        background-color: var(--c-brand);
        color: #ffffff;
        font-size: var(--fs-xs);
        font-weight: var(--fw-bold);
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .user-info-text {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        line-height: 1.15;
      }

      .user-info-name {
        font-size: var(--fs-xs);
        font-weight: var(--fw-semibold);
        color: var(--c-text);
        max-width: 130px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .user-info-status {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 0.65rem;
        color: var(--c-brand);
        font-weight: var(--fw-medium);
      }

      .status-indicator-dot {
        width: 5px;
        height: 5px;
        border-radius: var(--r-full);
        background-color: var(--c-brand);
      }

      .user-dropdown-panel {
        position: absolute;
        top: calc(100% + 6px);
        right: 0;
        width: 260px;
        background-color: var(--c-surface);
        border: 1px solid var(--c-border);
        border-radius: var(--r-md);
        box-shadow: var(--sh-md);
        padding: var(--sp-2);
        z-index: 200;
        animation: panelFade 120ms ease-out;
      }

      @keyframes panelFade {
        from {
          opacity: 0;
          transform: translateY(-4px);
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

      .dropdown-verified-chip {
        font-size: 0.7rem;
        font-weight: var(--fw-medium);
        display: inline-flex;
        align-items: center;
        gap: 4px;
        color: var(--c-brand);
        background: var(--c-brand-soft);
        padding: 2px 8px;
        border-radius: var(--r-sm);
        border: 1px solid var(--c-brand-border);
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
        border-radius: var(--r-sm);
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
          background-color: var(--c-canvas);
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

      /* 3. Sub-Nav Ribbon: 5 Official Shortcuts */
      .bidder-sub-nav {
        background-color: var(--c-canvas);
        border-top: 1px solid var(--c-border);
        padding: 6px 0;
      }

      .sub-nav-content {
        display: flex;
        align-items: center;
      }

      .quick-shortcuts-list {
        display: flex;
        align-items: center;
        gap: var(--sp-2);
        overflow-x: auto;
        scrollbar-width: none;

        &::-webkit-scrollbar {
          display: none;
        }
      }

      .shortcut-pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 5px 12px;
        border-radius: var(--r-sm);
        background-color: var(--c-surface);
        color: var(--c-text-secondary);
        font-size: var(--fs-xs);
        font-weight: var(--fw-medium);
        text-decoration: none;
        white-space: nowrap;
        border: 1px solid var(--c-border);
        transition: all var(--dur-fast) var(--ease);

        &:hover {
          background-color: var(--c-surface-hover);
          color: var(--c-text);
          border-color: var(--c-border-strong);
        }

        &.is-shortcut-active {
          background-color: var(--c-brand);
          color: #ffffff;
          font-weight: var(--fw-semibold);
          border-color: var(--c-brand);

          mat-icon {
            color: #ffffff;
          }
        }
      }

      .live-shortcut {
        &.is-shortcut-active {
          background-color: var(--c-brand);
          color: #ffffff;
        }
      }

      .urgent-shortcut {
        &.is-shortcut-active {
          background-color: var(--c-brand);
          color: #ffffff;
        }
      }

      .winning-shortcut {
        &.is-shortcut-active {
          background-color: var(--c-brand);
          color: #ffffff;
        }
      }

      .outbid-shortcut {
        &.is-shortcut-active {
          background-color: var(--c-warning);
          color: #ffffff;
          border-color: var(--c-warning);
        }
      }

      .pulse-live-marker {
        width: 6px;
        height: 6px;
        border-radius: var(--r-full);
        background-color: #10b981;
        flex-shrink: 0;
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

  readonly displayName = computed(() => this.auth.displayName() || 'Penawar Terdaftar');
  readonly email = computed(() => this.auth.user()?.email ?? '');

  readonly initials = computed(() => {
    const user = this.auth.user();
    if (!user) return 'B';
    const first = user.firstName?.trim()[0] ?? '';
    const last = user.lastName?.trim()[0] ?? '';
    return `${first}${last}`.toUpperCase() || user.email[0]?.toUpperCase() || 'B';
  });

  readonly currentUrl = signal(this.router.url);

  /**
   * Evaluates active state deterministically from Angular Router URL and Query Params.
   * Direct URL entries and parameter changes accurately highlight the matching shortcut.
   */
  readonly activePill = computed<'all' | 'live' | 'closingSoon' | 'winning' | 'outbid' | null>(() => {
    const url = this.currentUrl();
    if (url.startsWith('/marketplace')) {
      // Exclude item detail routes like /marketplace/:uuid
      if (/^\/marketplace\/[a-f0-9-]+/.test(url)) return null;

      if (url.includes('orderBy=closingSoonest')) {
        return 'closingSoon';
      }
      if (url.includes('status=ACTIVE')) {
        return 'live';
      }
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
