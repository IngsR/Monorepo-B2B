import { CommonModule } from '@angular/common';
import { Component, Input, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

export type EnterpriseNavRole = 'ADMIN' | 'SELLER' | 'VENDOR' | 'DASHBOARD';

@Component({
  selector: 'app-enterprise-navbar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <header class="enterprise-nav-root">
      <div class="nav-container">
        <!-- 1. Brand Identity -->
        <div class="brand-section" (click)="navigate('/dashboard')">
          <div class="brand-badge-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
              <polyline points="2 17 12 22 22 17"></polyline>
              <polyline points="2 12 12 17 22 12"></polyline>
            </svg>
          </div>
          <div class="brand-meta">
            <div class="brand-title-row">
              <span class="brand-name">SCRAPCHAIN</span>
              <span class="brand-tag">B2B ENTERPRISE</span>
            </div>
            <span class="brand-subtitle">Platform Lelang Terbuka Scrap & Surplus Industri</span>
          </div>
        </div>

        <!-- 2. Role Navigation Tabs (Distinct Pill Hierarchy) -->
        <nav class="role-navigation" aria-label="Portal Navigation">
          <button
            type="button"
            class="nav-tab-btn"
            [class.active]="activeRole === 'DASHBOARD'"
            (click)="navigate('/dashboard')"
            title="Buka Ringkasan Dashboard Eksekutif"
          >
            <svg class="tab-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="7" height="7"></rect>
              <rect x="14" y="3" width="7" height="7"></rect>
              <rect x="14" y="14" width="7" height="7"></rect>
              <rect x="3" y="14" width="7" height="7"></rect>
            </svg>
            <span class="tab-label">Dashboard</span>
          </button>

          <button
            type="button"
            class="nav-tab-btn"
            [class.active]="activeRole === 'VENDOR'"
            (click)="navigate('/vendor')"
            title="Lantai Penawaran Lelang Terbuka Vendor"
          >
            <svg class="tab-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
            <span class="tab-label">Vendor Floor</span>
            <span class="nav-live-dot" *ngIf="activeRole === 'VENDOR'"></span>
          </button>

          <button
            type="button"
            class="nav-tab-btn"
            [class.active]="activeRole === 'SELLER'"
            (click)="navigate('/seller')"
            title="Workbench Pengajuan & Penjualan Scrap Pabrik"
          >
            <svg class="tab-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
              <line x1="12" y1="22.08" x2="12" y2="12"></line>
            </svg>
            <span class="tab-label">Seller Workbench</span>
          </button>

          <button
            type="button"
            class="nav-tab-btn"
            [class.active]="activeRole === 'ADMIN'"
            (click)="navigate('/admin')"
            title="Portal Governance & Verifikasi Approval Admin"
          >
            <svg class="tab-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            </svg>
            <span class="tab-label">Admin Governance</span>
          </button>
        </nav>

        <!-- 3. Telemetry & User Session -->
        <div class="user-session-section">
          <!-- Live Floor Pulse Ticker -->
          <div class="live-ticker-pill" title="Koneksi WebSocket & Server Lelang Aktif">
            <span class="pulse-emerald"></span>
            <span class="ticker-text">FLOOR LIVE</span>
          </div>

          <!-- Active User Profile Card -->
          <div class="user-profile-badge">
            <div class="user-avatar">
              {{ getUserInitials() }}
            </div>
            <div class="user-info">
              <span class="user-name">{{ getUserName() }}</span>
              <span class="user-company">{{ getUserCompany() }}</span>
            </div>
          </div>

          <!-- Logout Button -->
          <button
            type="button"
            class="btn-nav-logout"
            (click)="logout()"
            title="Keluar dari Sesi"
            aria-label="Logout"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
          </button>
        </div>
      </div>
    </header>
  `,
  styles: [
    `
      .enterprise-nav-root {
        position: sticky;
        top: 0;
        z-index: 1000;
        background: #ffffff;
        border-bottom: 1px solid #e2e8f0;
        box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04), 0 1px 2px rgba(15, 23, 42, 0.02);
      }

      .nav-container {
        max-width: 1440px;
        margin: 0 auto;
        padding: 0 1.5rem;
        height: 64px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1.5rem;
      }

      /* Brand */
      .brand-section {
        display: flex;
        align-items: center;
        gap: 0.875rem;
        cursor: pointer;
        user-select: none;
        flex-shrink: 0;
      }

      .brand-badge-icon {
        width: 40px;
        height: 40px;
        border-radius: 10px;
        background: linear-gradient(135deg, #4338ca 0%, #312e81 100%);
        color: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 10px rgba(67, 56, 202, 0.25);
        transition: transform 0.2s ease;
      }

      .brand-section:hover .brand-badge-icon {
        transform: scale(1.04);
      }

      .brand-meta {
        display: flex;
        flex-direction: column;
      }

      .brand-title-row {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      .brand-name {
        font-size: 1.05rem;
        font-weight: 800;
        letter-spacing: -0.02em;
        color: #0f172a;
      }

      .brand-tag {
        font-size: 0.65rem;
        font-weight: 700;
        letter-spacing: 0.06em;
        background: #eef2ff;
        color: #4338ca;
        padding: 0.15rem 0.45rem;
        border-radius: 4px;
        border: 1px solid #c7d2fe;
      }

      .brand-subtitle {
        font-size: 0.72rem;
        color: #64748b;
        font-weight: 500;
      }

      /* Navigation Tabs */
      .role-navigation {
        display: flex;
        align-items: center;
        gap: 0.35rem;
        background: #f8fafc;
        padding: 0.3rem 0.4rem;
        border-radius: 12px;
        border: 1px solid #e2e8f0;
      }

      .nav-tab-btn {
        position: relative;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.45rem 0.9rem;
        border-radius: 8px;
        border: none;
        background: transparent;
        color: #64748b;
        font-size: 0.83rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.18s ease;
        white-space: nowrap;
      }

      .nav-tab-btn:hover {
        color: #0f172a;
        background: rgba(226, 232, 240, 0.6);
      }

      .nav-tab-btn.active {
        background: #ffffff;
        color: #4338ca;
        box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08), 0 1px 2px rgba(15, 23, 42, 0.04);
        font-weight: 700;
      }

      .tab-icon {
        flex-shrink: 0;
      }

      .nav-live-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #059669;
        box-shadow: 0 0 6px #059669;
      }

      /* Telemetry & User Session */
      .user-session-section {
        display: flex;
        align-items: center;
        gap: 0.875rem;
        flex-shrink: 0;
      }

      .live-ticker-pill {
        display: flex;
        align-items: center;
        gap: 0.45rem;
        background: #ecfdf5;
        border: 1px solid #a7f3d0;
        color: #065f46;
        padding: 0.35rem 0.7rem;
        border-radius: 20px;
        font-size: 0.72rem;
        font-weight: 700;
        letter-spacing: 0.04em;
      }

      .pulse-emerald {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: #059669;
        box-shadow: 0 0 0 0 rgba(5, 150, 105, 0.7);
        animation: pulseAnimation 2s infinite;
      }

      @keyframes pulseAnimation {
        0% {
          transform: scale(0.95);
          box-shadow: 0 0 0 0 rgba(5, 150, 105, 0.7);
        }
        70% {
          transform: scale(1);
          box-shadow: 0 0 0 6px rgba(5, 150, 105, 0);
        }
        100% {
          transform: scale(0.95);
          box-shadow: 0 0 0 0 rgba(5, 150, 105, 0);
        }
      }

      .user-profile-badge {
        display: flex;
        align-items: center;
        gap: 0.65rem;
        padding: 0.3rem 0.6rem;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
      }

      .user-avatar {
        width: 30px;
        height: 30px;
        border-radius: 8px;
        background: #4338ca;
        color: #ffffff;
        font-size: 0.75rem;
        font-weight: 700;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .user-info {
        display: flex;
        flex-direction: column;
        line-height: 1.2;
      }

      .user-name {
        font-size: 0.78rem;
        font-weight: 700;
        color: #0f172a;
      }

      .user-company {
        font-size: 0.68rem;
        color: #64748b;
        font-weight: 500;
      }

      .btn-nav-logout {
        width: 36px;
        height: 36px;
        border-radius: 9px;
        border: 1px solid #e2e8f0;
        background: #ffffff;
        color: #64748b;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .btn-nav-logout:hover {
        background: #fff1f2;
        border-color: #fecdd3;
        color: #e11d48;
      }

      @media (max-width: 1024px) {
        .brand-subtitle,
        .user-info {
          display: none;
        }
        .nav-container {
          padding: 0 1rem;
        }
        .tab-label {
          display: none;
        }
      }
    `,
  ],
})
export class EnterpriseNavbarComponent {
  @Input() activeRole: EnterpriseNavRole = 'DASHBOARD';

  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);

  navigate(path: string): void {
    this.router.navigateByUrl(path);
  }

  getUserName(): string {
    if (this.activeRole === 'VENDOR') return 'PT Krakatau (Procurement)';
    if (this.activeRole === 'SELLER') return 'Budi Santoso (Asset Head)';
    if (this.activeRole === 'ADMIN') return 'Super Administrator';
    return 'Corporate Officer';
  }

  getUserCompany(): string {
    if (this.activeRole === 'VENDOR') return 'PT Krakatau Peleburan';
    if (this.activeRole === 'SELLER') return 'PT Cilegon Baja Mandiri';
    if (this.activeRole === 'ADMIN') return 'Bursa Lelang Indonesia';
    return 'Enterprise Holding';
  }

  getUserInitials(): string {
    if (this.activeRole === 'VENDOR') return 'KP';
    if (this.activeRole === 'SELLER') return 'CB';
    if (this.activeRole === 'ADMIN') return 'AD';
    return 'EP';
  }

  logout(): void {
    this.authService.logout();
    this.router.navigateByUrl('/login');
  }
}
