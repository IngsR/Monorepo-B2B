import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuctionStatus } from '../../core/domain/enums';
import { formatAmount, formatDateTime } from '../../core/domain/format';
import { Auction, Paginated, Product } from '../../core/domain/models';
import { AuctionService } from '../../core/services/auction.service';
import { ProductService } from '../../core/services/catalogue.service';
import { AuthService } from '../../core/services/session.service';
import { AsyncResource } from '../../core/state/async-resource';
import { AuctionStatusBadgeComponent } from '../../shared/ui/badge.component';
import { MatIconComponent } from '../../shared/ui/mat-icon.component';
import { EmptyStateComponent, ErrorStateComponent } from '../../shared/ui/state-block.component';
import { AlertComponent } from '../../shared/ui/toast.component';

/**
 * Vendor Overview — Auction Operations Cockpit.
 *
 * Operational workspace for managing auction lots, monitoring real-time active bids,
 * and reviewing product lots. Designed with 60/30/10 institutional palette,
 * Manrope & IBM Plex Mono typography, and mobile-first stacked layouts.
 */
@Component({
  selector: 'app-vendor-dashboard',
  standalone: true,
  imports: [
    RouterLink,
    AuctionStatusBadgeComponent,
    MatIconComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    AlertComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page vendor-overview-page">
      <!-- 1. Workspace Header -->
      <header class="workspace-header">
        <div class="workspace-header-main">
          <div class="workspace-eyebrow">
            <span class="workspace-chip">AUCTION OPERATIONS DESK</span>
            @if (vendor()) {
              <span class="workspace-verified-badge">
                <mat-icon fontIcon="verified" [size]="14" />
                <span>Vendor Terverifikasi</span>
              </span>
            }
          </div>
          <h1 class="workspace-title">{{ companyName() }}</h1>
          <p class="workspace-subtitle">
            Ruang kerja operasional penjual. Kelola inventaris barang industri, pantau lot yang sedang aktif, dan tindak lanjuti status lelang.
          </p>
        </div>
        <div class="workspace-actions">
          <a class="btn btn-secondary" routerLink="/vendor/products/new">
            <mat-icon fontIcon="add" [size]="16" />
            <span>Daftarkan Barang</span>
          </a>
          <a class="btn btn-seller" routerLink="/vendor/auctions/new">
            <mat-icon fontIcon="gavel" [size]="16" />
            <span>Buat Lelang Baru</span>
          </a>
        </div>
      </header>

      <!-- Vendor Profile Incomplete Alert if applicable -->
      @if (profileResolved() && !vendor()) {
        <div class="workspace-alert-slot">
          <app-alert tone="warning" title="Profil penjual belum lengkap">
            Akun Anda belum memiliki data profil perusahaan resmi.
            Lengkapi data bisnis Anda melalui <a routerLink="/profile">Profil & Akun</a> untuk memulai proses lelang.
          </app-alert>
        </div>
      }

      @if (!auctions.hasError()) {
        <!-- 2. Operational Metrics Strip (Accurately computed from backend items) -->
        <section class="metrics-strip-container" aria-label="Ringkasan Operasional Lot Lelang">
          <div class="metrics-strip">
            <div class="metric-cell">
              <div class="metric-cell-header">
                <span class="metric-dot dot-inventory"></span>
                <span class="metric-label">Total Barang Katalog</span>
              </div>
              <div class="metric-value-row">
                <span class="metric-value">{{ totalProducts() }}</span>
                <span class="metric-context">Barang siap lelang</span>
              </div>
            </div>

            <div class="metric-cell metric-cell--active">
              <div class="metric-cell-header">
                <span class="metric-dot dot-active"></span>
                <span class="metric-label">Lelang Sedang Berlangsung</span>
              </div>
              <div class="metric-value-row">
                <span class="metric-value">{{ countBy(AuctionStatus.ACTIVE) }}</span>
                <span class="metric-context">Lot aktif terbuka</span>
              </div>
            </div>

            <div class="metric-cell metric-cell--scheduled">
              <div class="metric-cell-header">
                <span class="metric-dot dot-scheduled"></span>
                <span class="metric-label">Lelang Terjadwal</span>
              </div>
              <div class="metric-value-row">
                <span class="metric-value">{{ countBy(AuctionStatus.SCHEDULED) }}</span>
                <span class="metric-context">Menunggu waktu buka</span>
              </div>
            </div>

            <div class="metric-cell metric-cell--draft">
              <div class="metric-cell-header">
                <span class="metric-dot dot-draft"></span>
                <span class="metric-label">Draf Persiapan</span>
              </div>
              <div class="metric-value-row">
                <span class="metric-value">{{ countBy(AuctionStatus.DRAFT) }}</span>
                <span class="metric-context">Perlu dijadwalkan</span>
              </div>
            </div>

            <div class="metric-cell metric-cell--ended">
              <div class="metric-cell-header">
                <span class="metric-dot dot-ended"></span>
                <span class="metric-label">Lelang Selesai</span>
              </div>
              <div class="metric-value-row">
                <span class="metric-value">{{ countBy(AuctionStatus.ENDED) }}</span>
                <span class="metric-context">Penetapan tuntas</span>
              </div>
            </div>
          </div>
        </section>

        <!-- 3. Immediate Action Callout (Only when items need attention) -->
        @if (needsAttention().length > 0) {
          <section class="action-needed-panel" aria-label="Lot Memerlukan Tindakan Operasional">
            <div class="panel-header">
              <div class="panel-header-title">
                <mat-icon fontIcon="warning" [size]="18" class="warning-icon" />
                <h2 class="panel-heading">Perlu Tindakan Operasional</h2>
                <span class="panel-badge">{{ needsAttention().length }} Lot</span>
              </div>
              <p class="panel-hint">Lot berikut membutuhkan penentuan jadwal atau konfirmasi penutupan resmi.</p>
            </div>

            <!-- Desktop Table View -->
            <div class="table-scroll hide-mobile">
              <table class="data-table">
                <thead>
                  <tr>
                    <th scope="col">Lot Produk</th>
                    <th scope="col">Status</th>
                    <th scope="col">Catatan Operasional</th>
                    <th scope="col" class="col-numeric">Harga Saat Ini</th>
                    <th scope="col" class="cell-actions">Aksi Cepat</th>
                  </tr>
                </thead>
                <tbody>
                  @for (auction of needsAttention(); track auction.id) {
                    <tr>
                      <td>
                        <div class="lot-cell">
                          <span class="lot-name">{{ auction.product?.name ?? 'Tanpa nama' }}</span>
                          <span class="text-mono-id">{{ auction.product?.code }}</span>
                        </div>
                      </td>
                      <td>
                        <app-auction-status-badge [status]="auction.status" size="sm" />
                      </td>
                      <td>
                        <span class="attention-note">{{ attentionReason(auction) }}</span>
                      </td>
                      <td class="col-numeric">
                        <span class="text-numeric">{{ price(auction.currentPrice) }}</span>
                      </td>
                      <td class="cell-actions">
                        <a
                          class="btn btn-seller btn-sm"
                          [routerLink]="['/vendor/auctions', auction.id]"
                        >
                          <mat-icon fontIcon="gavel" [size]="14" />
                          <span>Kelola Lot</span>
                        </a>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>

            <!-- Mobile Stacked Card View -->
            <div class="mobile-attention-stack hide-desktop">
              @for (auction of needsAttention(); track auction.id) {
                <div class="mobile-attention-card">
                  <div class="mobile-attention-card-head">
                    <div class="lot-cell">
                      <span class="lot-name">{{ auction.product?.name ?? 'Tanpa nama' }}</span>
                      <span class="text-mono-id">{{ auction.product?.code }}</span>
                    </div>
                    <app-auction-status-badge [status]="auction.status" size="sm" />
                  </div>
                  <div class="mobile-attention-body">
                    <div class="attention-note-block">
                      <mat-icon fontIcon="info" [size]="14" />
                      <span>{{ attentionReason(auction) }}</span>
                    </div>
                    <div class="attention-price-row">
                      <span class="text-meta">Harga Saat Ini:</span>
                      <span class="text-numeric">{{ price(auction.currentPrice) }}</span>
                    </div>
                  </div>
                  <div class="mobile-attention-footer">
                    <a
                      class="btn btn-seller btn-sm btn-block"
                      [routerLink]="['/vendor/auctions', auction.id]"
                    >
                      <mat-icon fontIcon="gavel" [size]="14" />
                      <span>Kelola Lot Lelang</span>
                    </a>
                  </div>
                </div>
              }
            </div>
          </section>
        }

        <!-- 4. Main Operational Lot List -->
        <section class="workspace-section">
          <div class="section-title-row">
            <div class="section-title-wrap">
              <h2 class="section-title">Aktivitas Lot Lelang Terkini</h2>
              <span class="section-count-tag">{{ auctionList().length }} Terdaftar</span>
            </div>
            <a class="section-action-link" routerLink="/vendor/auctions">
              <span>Buka Seluruh Lelang</span>
              <mat-icon fontIcon="arrow_forward" [size]="14" />
            </a>
          </div>

          @if (auctions.isLoading() && !auctions.data()) {
            <div class="surface-panel">
              <div class="table-skeleton-rows">
                @for (i of skeletonItems; track i) {
                  <div class="skeleton-row">
                    <div class="skeleton" style="width: 40%; height: 16px;"></div>
                    <div class="skeleton" style="width: 20%; height: 16px;"></div>
                    <div class="skeleton" style="width: 20%; height: 16px;"></div>
                  </div>
                }
              </div>
            </div>
          } @else if (recentAuctions().length === 0) {
            <div class="surface-panel">
              <app-empty-state
                icon="hammer"
                title="Belum ada lot lelang dibuat"
                description="Daftarkan barang Anda ke katalog terlebih dahulu, kemudian jadwalkan lelang lot baru."
              >
                <div class="empty-actions">
                  <a class="btn btn-secondary" routerLink="/vendor/products/new">
                    <mat-icon fontIcon="add" [size]="16" />
                    <span>Daftarkan Barang Baru</span>
                  </a>
                  <a class="btn btn-seller" routerLink="/vendor/auctions/new">
                    <mat-icon fontIcon="gavel" [size]="16" />
                    <span>Buat Lelang Pertama</span>
                  </a>
                </div>
              </app-empty-state>
            </div>
          } @else {
            <!-- Desktop Scannable Table -->
            <div class="surface-panel hide-mobile">
              <div class="table-scroll">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th scope="col">Lot Produk</th>
                      <th scope="col">Status</th>
                      <th scope="col" class="col-numeric">Harga Saat Ini</th>
                      <th scope="col" class="col-numeric">Total Penawaran</th>
                      <th scope="col" class="cell-actions">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (auction of recentAuctions(); track auction.id) {
                      <tr>
                        <td>
                          <div class="lot-cell">
                            <a
                              [routerLink]="['/vendor/auctions', auction.id]"
                              class="lot-name-link"
                            >
                              {{ auction.product?.name ?? 'Tanpa nama' }}
                            </a>
                            <span class="text-mono-id">{{ auction.product?.code }}</span>
                          </div>
                        </td>
                        <td>
                          <app-auction-status-badge [status]="auction.status" size="sm" />
                        </td>
                        <td class="col-numeric">
                          <span class="text-numeric">{{ price(auction.currentPrice) }}</span>
                        </td>
                        <td class="col-numeric">
                          <span class="bid-count-pill">{{ auction.bidCount }} tawaran</span>
                        </td>
                        <td class="cell-actions">
                          <div class="actions-group">
                            <a
                              class="btn btn-seller btn-sm"
                              [routerLink]="['/vendor/auctions', auction.id]"
                            >
                              <mat-icon fontIcon="gavel" [size]="14" />
                              <span>Kelola</span>
                            </a>
                            <a
                              class="btn btn-ghost btn-sm"
                              [routerLink]="['/marketplace', auction.id]"
                              title="Tinjau tampilan publik"
                            >
                              <mat-icon fontIcon="open_in_new" [size]="14" />
                            </a>
                          </div>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Mobile Stacked Card View -->
            <div class="mobile-lot-stack hide-desktop">
              @for (auction of recentAuctions(); track auction.id) {
                <article class="mobile-lot-card">
                  <div class="mobile-lot-card-head">
                    <div class="lot-cell">
                      <a
                        [routerLink]="['/vendor/auctions', auction.id]"
                        class="lot-name-link"
                      >
                        {{ auction.product?.name ?? 'Tanpa nama' }}
                      </a>
                      <span class="text-mono-id">{{ auction.product?.code }}</span>
                    </div>
                    <app-auction-status-badge [status]="auction.status" size="sm" />
                  </div>

                  <div class="mobile-lot-card-data">
                    <div class="data-col">
                      <span class="text-meta">Harga Saat Ini</span>
                      <span class="text-numeric font-bold">{{ price(auction.currentPrice) }}</span>
                    </div>
                    <div class="data-col text-right">
                      <span class="text-meta">Aktivitas</span>
                      <span class="bid-count-pill">{{ auction.bidCount }} tawaran</span>
                    </div>
                  </div>

                  <div class="mobile-lot-card-footer">
                    <a
                      class="btn btn-seller btn-sm btn-grow"
                      [routerLink]="['/vendor/auctions', auction.id]"
                    >
                      <mat-icon fontIcon="gavel" [size]="14" />
                      <span>Kelola Lot</span>
                    </a>
                    <a
                      class="btn btn-secondary btn-sm"
                      [routerLink]="['/marketplace', auction.id]"
                      title="Lihat halaman publik"
                    >
                      <mat-icon fontIcon="open_in_new" [size]="14" />
                      <span>Publik</span>
                    </a>
                  </div>
                </article>
              }
            </div>
          }
        </section>
      } @else {
        <div class="surface-panel">
          @if (auctions.error(); as failure) {
            <app-error-state
              [failure]="failure"
              [retrying]="auctions.isLoading()"
              (retry)="reload()"
            />
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      .vendor-overview-page {
        display: flex;
        flex-direction: column;
        gap: var(--sp-6);
        font-family: var(--font-sans);
      }

      /* 1. Workspace Header */
      .workspace-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: var(--sp-5);
        padding-bottom: var(--sp-5);
        border-bottom: 1px solid #d9ddd8;
      }

      .workspace-header-main {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .workspace-eyebrow {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .workspace-chip {
        font-size: 0.65rem;
        font-weight: var(--fw-bold);
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: #a86445;
        background: #f6efea;
        border: 1px solid #e5c4b4;
        padding: 2px 7px;
        border-radius: var(--r-xs);
      }

      .workspace-verified-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: var(--fs-xs);
        font-weight: var(--fw-medium);
        color: var(--c-success);
      }

      .workspace-title {
        font-size: var(--fs-2xl);
        font-weight: var(--fw-bold);
        letter-spacing: var(--tracking-tight);
        color: #17201e;
        margin: 0;
        line-height: var(--lh-tight);
      }

      .workspace-subtitle {
        font-size: var(--fs-sm);
        color: #64706b;
        margin: 0;
        max-width: 680px;
        line-height: var(--lh-normal);
      }

      .workspace-actions {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-shrink: 0;
      }

      .workspace-alert-slot {
        margin-bottom: var(--sp-2);
      }

      /* 2. Operational Metrics Strip */
      .metrics-strip-container {
        width: 100%;
      }

      .metrics-strip {
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        background: #ffffff;
        border: 1px solid #d9ddd8;
        border-radius: var(--r-md);
        box-shadow: 0 1px 2px rgba(23, 32, 30, 0.04);
        overflow: hidden;
      }

      .metric-cell {
        padding: var(--sp-4);
        display: flex;
        flex-direction: column;
        gap: var(--sp-2);
        border-right: 1px solid #d9ddd8;
        background: #ffffff;

        &:last-child {
          border-right: none;
        }
      }

      .metric-cell-header {
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .metric-dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        flex-shrink: 0;
      }

      .dot-inventory { background: #3e4a45; }
      .dot-active { background: #1b6348; }
      .dot-scheduled { background: #0369a1; }
      .dot-draft { background: #b45309; }
      .dot-ended { background: #64706b; }

      .metric-label {
        font-size: 0.6875rem;
        font-weight: var(--fw-semibold);
        color: #64706b;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }

      .metric-value-row {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .metric-value {
        font-family: var(--font-mono);
        font-size: var(--fs-2xl);
        font-weight: var(--fw-bold);
        color: #17201e;
        line-height: 1;
      }

      .metric-context {
        font-size: 0.7rem;
        color: #64706b;
      }

      /* 3. Action Needed Panel */
      .action-needed-panel {
        background: #ffffff;
        border: 1px solid #d9ddd8;
        border-left: 4px solid #a86445;
        border-radius: var(--r-md);
        padding: var(--sp-4);
        display: flex;
        flex-direction: column;
        gap: var(--sp-3);
      }

      .panel-header {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .panel-header-title {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .warning-icon {
        color: #a86445;
      }

      .panel-heading {
        font-size: var(--fs-base);
        font-weight: var(--fw-bold);
        color: #17201e;
        margin: 0;
      }

      .panel-badge {
        font-size: 0.65rem;
        font-weight: var(--fw-bold);
        color: #a86445;
        background: #f6efea;
        padding: 2px 8px;
        border-radius: var(--r-full);
      }

      .panel-hint {
        font-size: var(--fs-xs);
        color: #64706b;
        margin: 0;
      }

      .attention-note {
        font-size: var(--fs-xs);
        color: #a86445;
        font-weight: var(--fw-medium);
      }

      /* 4. Main Section */
      .workspace-section {
        display: flex;
        flex-direction: column;
        gap: var(--sp-3);
      }

      .section-title-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .section-title-wrap {
        display: flex;
        align-items: center;
        gap: var(--sp-2);
      }

      .section-title {
        font-size: var(--fs-base);
        font-weight: var(--fw-bold);
        color: #17201e;
        margin: 0;
      }

      .section-count-tag {
        font-size: var(--fs-xs);
        color: #64706b;
        background: #f0ede6;
        padding: 2px 7px;
        border-radius: var(--r-xs);
      }

      .section-action-link {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: var(--fs-xs);
        font-weight: var(--fw-semibold);
        color: #a86445;
        text-decoration: none;

        &:hover {
          color: #8f5138;
        }
      }

      .surface-panel {
        background: #ffffff;
        border: 1px solid #d9ddd8;
        border-radius: var(--r-md);
        box-shadow: 0 1px 2px rgba(23, 32, 30, 0.04);
        overflow: hidden;
      }

      /* Table layout */
      .table-scroll {
        overflow-x: auto;
      }

      .data-table {
        width: 100%;
        border-collapse: collapse;
        font-size: var(--fs-sm);

        th {
          background: #faf9f6;
          padding: 10px var(--sp-4);
          font-weight: var(--fw-semibold);
          color: #64706b;
          text-align: left;
          border-bottom: 1px solid #d9ddd8;
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        td {
          padding: 12px var(--sp-4);
          border-bottom: 1px solid #f0ede6;
          vertical-align: middle;
        }

        tr:last-child td {
          border-bottom: none;
        }

        tr:hover td {
          background: #faf9f6;
        }
      }

      .col-numeric {
        text-align: right;
      }

      .cell-actions {
        text-align: right;
        white-space: nowrap;
      }

      .actions-group {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }

      .lot-cell {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .lot-name {
        font-weight: var(--fw-semibold);
        color: #17201e;
      }

      .lot-name-link {
        font-weight: var(--fw-semibold);
        color: #17201e;
        text-decoration: none;

        &:hover {
          color: #a86445;
        }
      }

      .text-mono-id {
        font-family: var(--font-mono);
        font-size: 0.725rem;
        color: #64706b;
      }

      .text-numeric {
        font-family: var(--font-mono);
        font-variant-numeric: tabular-nums;
        font-size: var(--fs-sm);
        color: #17201e;
      }

      .font-bold {
        font-weight: var(--fw-bold);
      }

      .bid-count-pill {
        font-family: var(--font-mono);
        font-size: 0.75rem;
        font-weight: var(--fw-semibold);
        background: #f0ede6;
        color: #26332f;
        padding: 3px 8px;
        border-radius: var(--r-xs);
      }

      /* Mobile Stacked Items */
      .mobile-attention-stack,
      .mobile-lot-stack {
        display: flex;
        flex-direction: column;
        gap: var(--sp-3);
      }

      .mobile-attention-card,
      .mobile-lot-card {
        background: #ffffff;
        border: 1px solid #d9ddd8;
        border-radius: var(--r-sm);
        padding: var(--sp-3);
        display: flex;
        flex-direction: column;
        gap: var(--sp-3);
      }

      .mobile-attention-card {
        border-left: 3px solid #a86445;
      }

      .mobile-attention-card-head,
      .mobile-lot-card-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: var(--sp-2);
      }

      .mobile-attention-body {
        display: flex;
        flex-direction: column;
        gap: 6px;
        background: #faf9f6;
        padding: var(--sp-2);
        border-radius: var(--r-xs);
      }

      .attention-note-block {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: var(--fs-xs);
        color: #a86445;
        font-weight: var(--fw-medium);
      }

      .attention-price-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: var(--fs-xs);
      }

      .mobile-lot-card-data {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 6px 0;
        border-top: 1px solid #f0ede6;
        border-bottom: 1px solid #f0ede6;
      }

      .data-col {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .text-right {
        text-align: right;
      }

      .text-meta {
        font-size: 0.7rem;
        color: #64706b;
      }

      .mobile-attention-footer,
      .mobile-lot-card-footer {
        display: flex;
        align-items: center;
        gap: var(--sp-2);
      }

      .btn-block {
        width: 100%;
        justify-content: center;
      }

      .btn-grow {
        flex: 1;
        justify-content: center;
      }

      .empty-actions {
        display: flex;
        align-items: center;
        gap: var(--sp-2);
        margin-top: var(--sp-3);
      }

      /* Skeletons */
      .table-skeleton-rows {
        padding: var(--sp-4);
        display: flex;
        flex-direction: column;
        gap: var(--sp-3);
      }

      .skeleton-row {
        display: flex;
        align-items: center;
        gap: var(--sp-4);
      }

      /* Responsive Display Controls */
      .hide-desktop {
        display: none !important;
      }

      @media (max-width: 1100px) {
        .metrics-strip {
          grid-template-columns: repeat(3, 1fr);
        }

        .metric-cell:nth-child(3) {
          border-right: none;
        }

        .metric-cell:nth-child(-n + 3) {
          border-bottom: 1px solid #d9ddd8;
        }
      }

      @media (max-width: 768px) {
        .metrics-strip {
          grid-template-columns: repeat(2, 1fr);
        }

        .metric-cell:nth-child(2) {
          border-right: none;
        }

        .metric-cell:nth-child(-n + 4) {
          border-bottom: 1px solid #d9ddd8;
        }

        .hide-mobile {
          display: none !important;
        }

        .hide-desktop {
          display: flex !important;
        }
      }

      @media (max-width: 540px) {
        .workspace-header {
          flex-direction: column;
        }

        .workspace-actions {
          width: 100%;
          flex-direction: column;

          .btn {
            width: 100%;
            justify-content: center;
          }
        }

        .metrics-strip {
          grid-template-columns: 1fr;
        }

        .metric-cell {
          border-right: none !important;
          border-bottom: 1px solid #d9ddd8;

          &:last-child {
            border-bottom: none;
          }
        }
      }
    `,
  ],
})
export class VendorDashboardComponent {
  private readonly auctionService = inject(AuctionService);
  private readonly productService = inject(ProductService);
  private readonly auth = inject(AuthService);

  protected readonly AuctionStatus = AuctionStatus;
  protected readonly skeletonItems = Array.from({ length: 4 }, (_, i) => i);

  readonly auctions = new AsyncResource<Paginated<Auction>>();
  readonly products = new AsyncResource<Paginated<Product>>();

  readonly vendor = computed(() => this.auth.vendor());
  readonly profileResolved = computed(() => this.auth.identityResolved());

  readonly companyName = computed(
    () => this.vendor()?.companyName ?? this.auth.displayName() ?? 'Workspace Penjual',
  );

  readonly auctionList = computed(() => this.auctions.data()?.items ?? []);
  readonly productList = computed(() => this.products.data()?.items ?? []);
  readonly totalProducts = computed(() => this.products.data()?.meta?.total ?? this.productList().length);

  readonly recentAuctions = computed(() => this.auctionList().slice(0, 8));

  readonly needsAttention = computed(() =>
    this.auctionList()
      .filter((auction) => {
        if (auction.status === AuctionStatus.DRAFT) return true;
        if (
          auction.status === AuctionStatus.ACTIVE &&
          new Date(auction.endTime).getTime() <= Date.now()
        ) {
          return true;
        }
        return false;
      })
      .slice(0, 5),
  );

  constructor() {
    this.reload();
  }

  reload(): void {
    this.auctions.load(this.auctionService.listMine({ limit: 50, orderBy: 'newest' }));
    this.products.load(this.productService.listMine({ limit: 50 }));
  }

  countBy(status: AuctionStatus): number {
    return this.auctionList().filter((a) => a.status === status).length;
  }

  attentionReason(auction: Auction): string {
    if (auction.status === AuctionStatus.DRAFT) {
      return 'Draf lelang — tetapkan jadwal lelang untuk publikasi';
    }
    return 'Batas waktu berakhir — lakukan konfirmasi penutupan resmi';
  }

  price(value: number): string {
    return formatAmount(value);
  }

  created(iso: string): string {
    return formatDateTime(iso);
  }
}
