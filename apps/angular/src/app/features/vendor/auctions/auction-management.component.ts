import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  LifecycleTransition,
  getTransition,
  minimumNextBid,
  resolveTiming,
  transitionsFrom,
} from '../../../core/domain/auction-lifecycle';
import { ApiFailure, toApiFailure } from '../../../core/domain/api-failure';
import { AuctionStatus } from '../../../core/domain/enums';
import { formatAmount, formatDateTime } from '../../../core/domain/format';
import { Auction, Bid, Paginated } from '../../../core/domain/models';
import { AsyncResource } from '../../../core/state/async-resource';
import { AuctionService } from '../../../core/services/auction.service';
import { NotificationService } from '../../../core/services/notification.service';
import { AuthService } from '../../../core/services/session.service';
import { AuctionStatusBadgeComponent } from '../../../shared/ui/badge.component';
import { CountdownComponent } from '../../../shared/ui/countdown.component';
import { DialogComponent } from '../../../shared/ui/dialog.component';
import { MatIconComponent } from '../../../shared/ui/mat-icon.component';
import { BreadcrumbsComponent, Crumb } from '../../../shared/ui/pagination.component';
import { ErrorStateComponent } from '../../../shared/ui/state-block.component';
import { AlertComponent } from '../../../shared/ui/toast.component';

/**
 * Auction Management — Vendor Auction Dossier.
 *
 * Dedicated operational dossier for sellers. Displays technical lot parameters,
 * lifecycle state machine controls, and verified real-time bid activity without
 * any buyer-oriented bidding panels.
 */
@Component({
  selector: 'app-auction-management',
  standalone: true,
  imports: [
    RouterLink,
    AuctionStatusBadgeComponent,
    CountdownComponent,
    DialogComponent,
    MatIconComponent,
    BreadcrumbsComponent,
    ErrorStateComponent,
    AlertComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page vendor-dossier-page">
      <app-breadcrumbs [items]="crumbs()" />

      @switch (true) {
        @case (auction.isLoading() && !auction.data()) {
          <div class="surface-card p-6">
            <div class="skeleton skeleton-title mb-4"></div>
            <div class="skeleton skeleton-text"></div>
          </div>
        }

        @case (auction.hasError()) {
          <div class="surface-card">
            @if (auction.error(); as failure) {
              <app-error-state
                [failure]="failure"
                [retrying]="auction.isLoading()"
                (retry)="reload()"
              >
                <a class="btn btn-secondary" routerLink="/vendor/auctions">
                  <mat-icon fontIcon="chevron_left" [size]="16" />
                  <span>Kembali ke Lelang Saya</span>
                </a>
              </app-error-state>
            }
          </div>
        }

        @case (true) {
          @let data = auctionData()!;

          <!-- Dossier Header -->
          <header class="page-head dossier-head">
            <div class="page-head-text">
              <div class="dossier-eyebrow">
                <span class="dossier-tag">DOSSIER LOT OPERASIONAL</span>
                <span class="text-mono-id font-bold">{{ data.product?.code ?? 'LOT-—' }}</span>
                <app-auction-status-badge
                  [status]="data.status"
                  [endingSoon]="timing().endingSoon"
                  size="sm"
                />
              </div>
              <h1 class="page-title">{{ data.product?.name ?? 'Lot Lelang Industri' }}</h1>
              <p class="page-subtitle">
                Berkas kendali operasional lot lelang. Pantau perkembangan penawaran masuk dan lakukan transisi status sesuai ketentuan sistem.
              </p>
            </div>

            <div class="page-actions">
              <a class="btn btn-secondary" [routerLink]="['/marketplace', data.id]" target="_blank">
                <mat-icon fontIcon="open_in_new" [size]="16" />
                <span>Lihat Halaman Publik</span>
              </a>
              @if (canEdit()) {
                <a class="btn btn-secondary" [routerLink]="['/vendor/auctions', data.id, 'edit']">
                  <mat-icon fontIcon="edit" [size]="16" />
                  <span>Edit Ketentuan</span>
                </a>
              }
            </div>
          </header>

          @if (actionFailure(); as failure) {
            <app-alert tone="danger" [title]="failure.message">{{ failure.detail }}</app-alert>
          }

          @if (statusWindowMismatch()) {
            <app-alert tone="warning" title="Batas waktu lelang telah berakhir">
              Periode waktu penawaran telah habis dan penawaran baru otomatis ditolak oleh sistem.
              Segera konfirmasikan penutupan lot untuk memindahkan status menjadi <strong>Selesai (ENDED)</strong>.
            </app-alert>
          }

          <!-- Operational Two-Column Dossier Composition -->
          <div class="dossier-grid">
            <!-- Left Column: Lifecycle & Specifications -->
            <div class="dossier-col-main">
              <!-- 1. Lifecycle Control Surface -->
              <section class="surface-card dossier-section" aria-label="Kendali Status Siklus">
                <div class="card-header-strip">
                  <div class="header-title-group">
                    <mat-icon fontIcon="history_toggle_drop_down" [size]="18" />
                    <h2 class="section-heading">Kendali Status Siklus</h2>
                  </div>
                  <span class="status-indicator-pill">{{ data.status }}</span>
                </div>

                <div class="dossier-section-body">
                  <div class="lifecycle-track">
                    <div class="lifecycle-step" [class.is-done]="isPassed(AuctionStatus.DRAFT, data.status)">
                      <span class="step-dot"></span>
                      <span class="step-label">Draf</span>
                    </div>
                    <div class="lifecycle-divider"></div>
                    <div class="lifecycle-step" [class.is-done]="isPassed(AuctionStatus.SCHEDULED, data.status)">
                      <span class="step-dot"></span>
                      <span class="step-label">Terjadwal</span>
                    </div>
                    <div class="lifecycle-divider"></div>
                    <div class="lifecycle-step" [class.is-done]="isPassed(AuctionStatus.ACTIVE, data.status)">
                      <span class="step-dot"></span>
                      <span class="step-label">Aktif</span>
                    </div>
                    <div class="lifecycle-divider"></div>
                    <div class="lifecycle-step" [class.is-done]="isPassed(AuctionStatus.ENDED, data.status)">
                      <span class="step-dot"></span>
                      <span class="step-label">Selesai</span>
                    </div>
                  </div>

                  @if (isTerminal()) {
                    <div class="terminal-note">
                      <mat-icon fontIcon="lock" [size]="16" />
                      <span>
                        Status <strong>{{ data.status === AuctionStatus.CANCELLED ? 'Dibatalkan' : 'Selesai' }}</strong>
                        adalah kondisi final lot. Tidak ada transisi status lebih lanjut.
                      </span>
                    </div>
                  } @else {
                    <div class="transition-actions-box">
                      <div class="transition-actions-head">
                        <span class="text-meta">Aksi perubahan status yang sah dari {{ data.status }}:</span>
                      </div>
                      <div class="transition-buttons-row">
                        @for (transition of transitions(); track transition.to) {
                          <button
                            type="button"
                            class="btn"
                            [class.btn-seller]="!transition.destructive && transition.to !== AuctionStatus.ENDED"
                            [class.btn-success]="transition.to === AuctionStatus.ENDED"
                            [class.btn-danger-outline]="transition.destructive"
                            [disabled]="busy()"
                            (click)="requestTransition(transition)"
                          >
                            <mat-icon [fontIcon]="transitionIcon(transition)" [size]="16" />
                            <span>{{ transition.label }}</span>
                          </button>
                        }
                      </div>
                      <p class="transition-hint-text">
                        Perubahan status harus dikonfirmasi terlebih dahulu karena berdampak langsung pada hak penawaran peserta.
                      </p>
                    </div>
                  }
                </div>
              </section>

              <!-- 2. Product Information Sheet -->
              <section class="surface-card dossier-section" aria-label="Informasi Barang Lot">
                <div class="card-header-strip">
                  <div class="header-title-group">
                    <mat-icon fontIcon="inventory_2" [size]="18" />
                    <h2 class="section-heading">Spesifikasi Barang Inventaris</h2>
                  </div>
                  <span class="category-badge">{{ data.product?.category?.name ?? 'Umum' }}</span>
                </div>

                <div class="dossier-section-body">
                  <div class="spec-table">
                    <div class="spec-row">
                      <span class="spec-label">Kode Barang</span>
                      <span class="spec-value text-mono-id font-bold">{{ data.product?.code }}</span>
                    </div>
                    <div class="spec-row">
                      <span class="spec-label">Nama Lot</span>
                      <span class="spec-value font-bold">{{ data.product?.name }}</span>
                    </div>
                    <div class="spec-row">
                      <span class="spec-label">Kategori</span>
                      <span class="spec-value">{{ data.product?.category?.name ?? 'Umum' }}</span>
                    </div>
                    <div class="spec-row">
                      <span class="spec-label">Deskripsi Teknis</span>
                      <div class="spec-value desc-text">
                        {{ data.product?.description || 'Tidak ada deskripsi tambahan.' }}
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </div>

            <!-- Right Column: Financial & Timing Dossier Facts -->
            <div class="dossier-col-side">
              <!-- Financial Parameters Card -->
              <section class="surface-card dossier-section" aria-label="Parameter Finansial Lot">
                <div class="card-header-strip">
                  <div class="header-title-group">
                    <mat-icon fontIcon="payments" [size]="18" />
                    <h2 class="section-heading">Parameter Finansial</h2>
                  </div>
                </div>

                <div class="dossier-section-body">
                  <div class="current-price-display">
                    <span class="price-type-label">Penawaran Tertinggi Saat Ini</span>
                    <span class="price-value-primary">{{ money(data.currentPrice) }}</span>
                    <span class="price-sub-note">
                      {{ data.bidCount > 0 ? (data.bidCount + ' penawaran sah masuk') : 'Belum ada tawaran masuk' }}
                    </span>
                  </div>

                  <div class="financial-facts-grid">
                    <div class="fact-item">
                      <span class="fact-label">Harga Buka (Starting)</span>
                      <span class="fact-val text-mono-id">{{ money(data.startingPrice) }}</span>
                    </div>
                    <div class="fact-item">
                      <span class="fact-label">Kelipatan (Increment)</span>
                      <span class="fact-val text-mono-id">{{ money(data.bidIncrement) }}</span>
                    </div>
                    <div class="fact-item">
                      <span class="fact-label">Minimum Tawaran Berikutnya</span>
                      <span class="fact-val text-mono-id font-bold">{{ money(minimum()) }}</span>
                    </div>
                    <div class="fact-item">
                      <span class="fact-label">Total Penawaran Sah</span>
                      <span class="fact-val text-mono-id">{{ data.bidCount }}</span>
                    </div>
                  </div>
                </div>
              </section>

              <!-- Timing Window Card -->
              <section class="surface-card dossier-section" aria-label="Jadwal Waktu Lelang">
                <div class="card-header-strip">
                  <div class="header-title-group">
                    <mat-icon fontIcon="schedule" [size]="18" />
                    <h2 class="section-heading">Jadwal & Waktu</h2>
                  </div>
                </div>

                <div class="dossier-section-body">
                  @if (data.status === AuctionStatus.ACTIVE && timing().acceptingBids) {
                    <div class="timing-countdown-box">
                      <span class="text-meta">Sisa Waktu Penawaran:</span>
                      <app-countdown [target]="data.endTime" prefix="closes" size="md" />
                    </div>
                  }

                  <div class="timing-rows">
                    <div class="timing-row">
                      <span class="timing-label">Waktu Buka</span>
                      <span class="timing-val text-mono-id">{{ dateTime(data.startTime) }}</span>
                    </div>
                    <div class="timing-row">
                      <span class="timing-label">Waktu Selesai</span>
                      <span class="timing-val text-mono-id">{{ dateTime(data.endTime) }}</span>
                    </div>
                  </div>

                  <div class="ownership-verified-note">
                    <mat-icon fontIcon="verified_user" [size]="14" />
                    <span>Anda memiliki otoritas penuh untuk mengelola lot lelang ini.</span>
                  </div>
                </div>
              </section>
            </div>
          </div>

          <!-- Bottom Section: Verified Bid Activity Ledger -->
          <section class="surface-card dossier-section" aria-label="Riwayat Aktivitas Penawaran">
            <div class="card-header-strip">
              <div class="header-title-group">
                <mat-icon fontIcon="receipt_long" [size]="18" />
                <h2 class="section-heading">Buku Besar Aktivitas Penawaran</h2>
              </div>
              <span class="bid-count-badge">{{ data.bidCount }} Penawaran Tercatat</span>
            </div>

            <div class="dossier-section-body">
              @if (bids.isLoading() && !bids.data()) {
                <div class="bids-skeleton-stack">
                  @for (i of skeletonRows; track i) {
                    <div class="skeleton" style="height: 40px;"></div>
                  }
                </div>
              } @else if (bidList().length === 0) {
                <div class="empty-bids-message">
                  <mat-icon fontIcon="info" [size]="20" />
                  <p>Belum ada aktivitas penawaran yang tercatat pada lot lelang ini.</p>
                </div>
              } @else {
                <!-- Desktop Ledger Table -->
                <div class="table-scroll hide-mobile">
                  <table class="data-table">
                    <thead>
                      <tr>
                        <th scope="col">Urutan</th>
                        <th scope="col">Status Posisi</th>
                        <th scope="col" class="col-numeric">Besaran Penawaran</th>
                        <th scope="col">Waktu Pencatatan Server</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (bid of bidList(); track bid.id; let i = $index) {
                        <tr [class.leading-bid-row]="i === 0">
                          <td>
                            <span class="text-mono-id font-bold">#{{ i + 1 }}</span>
                          </td>
                          <td>
                            @if (i === 0) {
                              <span class="leading-badge">
                                <mat-icon fontIcon="emoji_events" [size]="14" />
                                <span>Tawaran Tertinggi (Memimpin)</span>
                              </span>
                            } @else {
                              <span class="outbid-badge">Tawaran Terlampaui</span>
                            }
                          </td>
                          <td class="col-numeric">
                            <span class="text-numeric font-bold">{{ money(bid.amount) }}</span>
                          </td>
                          <td>
                            <span class="text-meta text-mono-id">{{ dateTime(bid.createdAt) }}</span>
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>

                <!-- Mobile Ledger Stack -->
                <div class="mobile-bids-stack hide-desktop">
                  @for (bid of bidList(); track bid.id; let i = $index) {
                    <div class="mobile-bid-item" [class.leading-bid-card]="i === 0">
                      <div class="mobile-bid-head">
                        <span class="text-mono-id font-bold">Tawaran #{{ i + 1 }}</span>
                        @if (i === 0) {
                          <span class="leading-badge">
                            <mat-icon fontIcon="emoji_events" [size]="12" />
                            <span>Memimpin</span>
                          </span>
                        } @else {
                          <span class="outbid-badge">Terlampaui</span>
                        }
                      </div>
                      <div class="mobile-bid-body">
                        <div class="bid-amount-text font-bold">{{ money(bid.amount) }}</div>
                        <span class="text-meta text-mono-id">{{ dateTime(bid.createdAt) }}</span>
                      </div>
                    </div>
                  }
                </div>
              }
            </div>
          </section>
        }
      }
    </div>

    <!-- Confirmation Dialog for Lifecycle Transitions -->
    @if (pendingTransition(); as transition) {
      <app-dialog
        [title]="'Konfirmasi ' + transition.label"
        icon="alert"
        tone="warning"
        (dismissed)="cancelTransition()"
      >
        <div class="dialog-flow-body">
          <p class="dialog-explanation">{{ transition.description }}</p>
          <div class="dialog-transition-box">
            <span class="text-meta">Perubahan Status:</span>
            <div class="transition-pill-row">
              <span class="status-from">{{ auctionData()?.status }}</span>
              <mat-icon fontIcon="arrow_forward" [size]="14" />
              <span class="status-to">{{ transition.to }}</span>
            </div>
          </div>
          @if (transition.destructive) {
            <p class="dialog-warning-callout">
              Tindakan ini bersifat final dan tidak dapat dibatalkan kembali setelah dikonfirmasi.
            </p>
          }
        </div>

        <div dialog-actions class="dialog-actions-row">
          <button
            type="button"
            class="btn btn-secondary"
            [disabled]="busy()"
            (click)="cancelTransition()"
          >
            Batal
          </button>
          <button
            type="button"
            class="btn"
            [class.btn-danger]="transition.destructive"
            [class.btn-seller]="!transition.destructive"
            [disabled]="busy()"
            (click)="confirmTransition(transition)"
          >
            <span>Konfirmasi Ubah Status</span>
          </button>
        </div>
      </app-dialog>
    }
  `,
  styles: [
    `
      .vendor-dossier-page {
        display: flex;
        flex-direction: column;
        gap: var(--sp-5);
        font-family: var(--font-sans);
      }

      .dossier-head {
        border-bottom: 1px solid #d9ddd8;
        padding-bottom: var(--sp-4);
      }

      .dossier-eyebrow {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
        margin-bottom: var(--sp-1);
      }

      .dossier-tag {
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

      .surface-card {
        background: #ffffff;
        border: 1px solid #d9ddd8;
        border-radius: var(--r-md);
        box-shadow: 0 1px 2px rgba(23, 32, 30, 0.04);
        overflow: hidden;
      }

      .card-header-strip {
        background: #faf9f6;
        border-bottom: 1px solid #d9ddd8;
        padding: 12px var(--sp-4);
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .header-title-group {
        display: flex;
        align-items: center;
        gap: 8px;
        color: #17201e;
      }

      .section-heading {
        font-size: var(--fs-sm);
        font-weight: var(--fw-bold);
        color: #17201e;
        margin: 0;
      }

      .dossier-section-body {
        padding: var(--sp-4);
        display: flex;
        flex-direction: column;
        gap: var(--sp-4);
      }

      /* Dossier Grid */
      .dossier-grid {
        display: grid;
        grid-template-columns: 1fr 360px;
        gap: var(--sp-5);
      }

      .dossier-col-main,
      .dossier-col-side {
        display: flex;
        flex-direction: column;
        gap: var(--sp-5);
      }

      /* Lifecycle Track */
      .lifecycle-track {
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: #f5f3ee;
        padding: 10px 16px;
        border-radius: var(--r-sm);
      }

      .lifecycle-step {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: var(--fs-xs);
        font-weight: var(--fw-semibold);
        color: #64706b;

        &.is-done {
          color: #1b6348;
          .step-dot {
            background: #1b6348;
          }
        }
      }

      .step-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #cbd5e1;
      }

      .lifecycle-divider {
        flex: 1;
        height: 2px;
        background: #d9ddd8;
        margin: 0 8px;
      }

      .status-indicator-pill {
        font-family: var(--font-mono);
        font-size: 0.7rem;
        font-weight: var(--fw-bold);
        color: #a86445;
        background: #f6efea;
        padding: 2px 8px;
        border-radius: var(--r-xs);
      }

      .terminal-note {
        display: flex;
        align-items: center;
        gap: 8px;
        background: #f5f3ee;
        padding: 10px 14px;
        border-radius: var(--r-sm);
        font-size: var(--fs-xs);
        color: #26332f;
      }

      .transition-actions-box {
        display: flex;
        flex-direction: column;
        gap: var(--sp-2-5, 10px);
      }

      .transition-buttons-row {
        display: flex;
        align-items: center;
        gap: var(--sp-2);
        flex-wrap: wrap;
      }

      .btn-success {
        background-color: #1b6348;
        color: #ffffff;
        &:hover {
          background-color: #144e39;
        }
      }

      .btn-danger-outline {
        background: transparent;
        color: var(--c-danger);
        border: 1px solid var(--c-danger-border);
        &:hover {
          background: var(--c-danger-soft);
        }
      }

      .transition-hint-text {
        font-size: 0.7rem;
        color: #64706b;
        margin: 0;
      }

      /* Spec Table */
      .spec-table {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .spec-row {
        display: grid;
        grid-template-columns: 140px 1fr;
        gap: var(--sp-2);
        font-size: var(--fs-xs);
        padding: 4px 0;
        border-bottom: 1px solid #f0ede6;

        &:last-child {
          border-bottom: none;
        }
      }

      .spec-label {
        color: #64706b;
      }

      .spec-value {
        color: #17201e;
      }

      .desc-text {
        line-height: var(--lh-normal);
        white-space: pre-line;
      }

      /* Side Facts */
      .current-price-display {
        background: #faf9f6;
        border: 1px solid #d9ddd8;
        border-radius: var(--r-sm);
        padding: var(--sp-3);
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .price-type-label {
        font-size: 0.7rem;
        font-weight: var(--fw-semibold);
        color: #64706b;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }

      .price-value-primary {
        font-family: var(--font-mono);
        font-size: var(--fs-xl);
        font-weight: var(--fw-bold);
        color: #17201e;
      }

      .price-sub-note {
        font-size: var(--fs-xs);
        color: #64706b;
      }

      .financial-facts-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--sp-3);
      }

      .fact-item {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .fact-label {
        font-size: 0.7rem;
        color: #64706b;
      }

      .fact-val {
        font-size: var(--fs-sm);
        color: #17201e;
      }

      .timing-countdown-box {
        background: #f6efea;
        border: 1px solid #e5c4b4;
        border-radius: var(--r-sm);
        padding: 8px 12px;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .timing-rows {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .timing-row {
        display: flex;
        justify-content: space-between;
        font-size: var(--fs-xs);
      }

      .timing-label {
        color: #64706b;
      }

      .timing-val {
        color: #17201e;
      }

      .ownership-verified-note {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 0.7rem;
        color: #1b6348;
        background: #edf6f2;
        padding: 6px 10px;
        border-radius: var(--r-xs);
      }

      /* Bids Ledger */
      .bid-count-badge {
        font-family: var(--font-mono);
        font-size: 0.725rem;
        font-weight: var(--fw-semibold);
        color: #64706b;
        background: #f0ede6;
        padding: 2px 8px;
        border-radius: var(--r-xs);
      }

      .leading-bid-row td {
        background: #faf9f6;
      }

      .leading-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 0.7rem;
        font-weight: var(--fw-semibold);
        color: #a86445;
        background: #f6efea;
        border: 1px solid #e5c4b4;
        padding: 2px 7px;
        border-radius: var(--r-xs);
      }

      .outbid-badge {
        font-size: 0.7rem;
        color: #64706b;
      }

      .empty-bids-message {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: var(--fs-xs);
        color: #64706b;
        padding: var(--sp-4);
        background: #faf9f6;
        border-radius: var(--r-sm);
      }

      .mobile-bids-stack {
        display: flex;
        flex-direction: column;
        gap: var(--sp-2);
      }

      .mobile-bid-item {
        background: #ffffff;
        border: 1px solid #d9ddd8;
        border-radius: var(--r-sm);
        padding: var(--sp-2-5, 10px);
        display: flex;
        flex-direction: column;
        gap: 6px;

        &.leading-bid-card {
          border-left: 3px solid #a86445;
          background: #faf9f6;
        }
      }

      .mobile-bid-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .mobile-bid-body {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .bid-amount-text {
        font-family: var(--font-mono);
        font-size: var(--fs-sm);
        color: #17201e;
      }

      /* Dialog styles */
      .dialog-flow-body {
        display: flex;
        flex-direction: column;
        gap: var(--sp-3);
      }

      .dialog-explanation {
        font-size: var(--fs-sm);
        color: #26332f;
        margin: 0;
        line-height: var(--lh-normal);
      }

      .dialog-transition-box {
        display: flex;
        align-items: center;
        gap: var(--sp-2);
        background: #f5f3ee;
        padding: 8px 12px;
        border-radius: var(--r-xs);
      }

      .transition-pill-row {
        display: flex;
        align-items: center;
        gap: 6px;
        font-family: var(--font-mono);
        font-size: var(--fs-xs);
        font-weight: var(--fw-bold);
      }

      .status-from {
        color: #64706b;
      }

      .status-to {
        color: #a86445;
      }

      .dialog-warning-callout {
        font-size: var(--fs-xs);
        color: var(--c-danger);
        margin: 0;
      }

      .dialog-actions-row {
        display: flex;
        justify-content: flex-end;
        gap: var(--sp-2);
        width: 100%;
      }

      /* Responsive Display Controls */
      .hide-desktop {
        display: none !important;
      }

      @media (max-width: 900px) {
        .dossier-grid {
          grid-template-columns: 1fr;
        }

        .hide-mobile {
          display: none !important;
        }

        .hide-desktop {
          display: flex !important;
        }
      }
    `,
  ],
})
export class AuctionManagementComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly auctionService = inject(AuctionService);
  private readonly notifications = inject(NotificationService);
  private readonly auth = inject(AuthService);

  protected readonly AuctionStatus = AuctionStatus;
  protected readonly skeletonRows = Array.from({ length: 4 }, (_, i) => i);

  readonly auction = new AsyncResource<Auction>();
  readonly bids = new AsyncResource<Paginated<Bid>>();

  readonly busy = signal(false);
  readonly actionFailure = signal<ApiFailure | null>(null);
  readonly pendingTransition = signal<LifecycleTransition | null>(null);

  private readonly auctionId = this.route.snapshot.paramMap.get('id') ?? '';

  readonly auctionData = computed(() => this.auction.data());
  readonly bidList = computed(() => this.bids.data()?.items ?? []);

  readonly timing = computed(() => {
    const data = this.auctionData();
    return data
      ? resolveTiming(data)
      : { acceptingBids: false, endingSoon: false, clockExpired: false };
  });

  readonly minimum = computed(() => {
    const data = this.auctionData();
    return data ? minimumNextBid(data) : 0;
  });

  readonly transitions = computed<LifecycleTransition[]>(() => {
    const data = this.auctionData();
    return data ? transitionsFrom(data.status) : [];
  });

  readonly isTerminal = computed(() => {
    const status = this.auctionData()?.status;
    return status === AuctionStatus.ENDED || status === AuctionStatus.CANCELLED;
  });

  readonly statusWindowMismatch = computed(() => {
    const data = this.auctionData();
    if (!data) return false;
    return data.status === AuctionStatus.ACTIVE && resolveTiming(data).clockExpired;
  });

  readonly canManage = computed(() => {
    const data = this.auctionData();
    if (!data) return false;
    if (this.auth.isAdmin()) return true;
    return this.auth.vendor()?.id === data.vendorId;
  });

  readonly canEdit = computed(() => {
    if (!this.canManage()) return false;
    const status = this.auctionData()?.status;
    return status === AuctionStatus.DRAFT;
  });

  readonly crumbs = computed<Crumb[]>(() => [
    { label: 'Lelang Saya', link: '/vendor/auctions' },
    { label: this.auctionData()?.product?.name ?? 'Detail Lot' },
  ]);

  constructor() {
    this.reload();
  }

  reload(): void {
    this.auction.load(this.auctionService.getById(this.auctionId));
    this.bids.load(this.auctionService.listBids(this.auctionId, { sort: 'highest', limit: 50 }));
  }

  isPassed(step: AuctionStatus, current: AuctionStatus): boolean {
    const order = [
      AuctionStatus.DRAFT,
      AuctionStatus.SCHEDULED,
      AuctionStatus.ACTIVE,
      AuctionStatus.ENDED,
    ];
    const currentIndex = order.indexOf(current);
    const stepIndex = order.indexOf(step);
    return currentIndex >= stepIndex && currentIndex !== -1 && stepIndex !== -1;
  }

  transitionIcon(transition: LifecycleTransition): string {
    switch (transition.to) {
      case AuctionStatus.SCHEDULED:
        return 'schedule';
      case AuctionStatus.ACTIVE:
        return 'play_arrow';
      case AuctionStatus.ENDED:
        return 'check_circle';
      default:
        return 'cancel';
    }
  }

  requestTransition(transition: LifecycleTransition): void {
    const data = this.auctionData();
    if (data && !getTransition(data.status, transition.to)) {
      this.notifications.warning(
        'Aksi tidak lagi tersedia',
        `Lelang saat ini berstatus ${data.status}. Halaman akan dimuat ulang.`,
      );
      this.reload();
      return;
    }
    this.actionFailure.set(null);
    this.pendingTransition.set(transition);
  }

  confirmTransition(transition: LifecycleTransition): void {
    this.busy.set(true);
    this.auctionService.changeStatus(this.auctionId, transition.to).subscribe({
      next: (updated) => {
        this.busy.set(false);
        this.pendingTransition.set(null);
        this.notifications.success(
          'Status lelang diperbarui',
          `Status lelang berhasil diubah menjadi ${updated.status}.`,
        );
        this.reload();
      },
      error: (err: unknown) => {
        this.busy.set(false);
        this.actionFailure.set(toApiFailure(err));
      },
    });
  }

  cancelTransition(): void {
    this.pendingTransition.set(null);
  }

  money(value: number): string {
    return formatAmount(value);
  }

  dateTime(iso: string): string {
    return formatDateTime(iso);
  }
}
