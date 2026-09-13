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
import { IconComponent } from '../../shared/ui/icon.component';
import { EmptyStateComponent, ErrorStateComponent } from '../../shared/ui/state-block.component';
import { AlertComponent } from '../../shared/ui/toast.component';

/**
 * Vendor Dashboard — B2B Auction Workspace.
 *
 * Operational cockpit for managing auctions, monitoring active bids,
 * and reviewing product lots. Designed with formal B2B hierarchy,
 * clean surface compositions, and restrained aesthetics.
 */
@Component({
  selector: 'app-vendor-dashboard',
  standalone: true,
  imports: [
    RouterLink,
    AuctionStatusBadgeComponent,
    IconComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    AlertComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page vendor-workspace">
      <!-- 1. Workspace Header -->
      <header class="workspace-header">
        <div class="workspace-header-main">
          <div class="workspace-eyebrow">
            <span class="workspace-chip">PORTAL LELANG B2B</span>
            @if (vendor()) {
              <span class="workspace-verified-badge">
                <app-icon name="shield" [size]="12" />
                <span>Vendor Terverifikasi</span>
              </span>
            }
          </div>
          <h1 class="workspace-title">{{ companyName() }}</h1>
          <p class="workspace-subtitle">
            Pusat operasional lelang. Pantau lot yang sedang aktif, kelola inventaris produk, dan jadwalkan penawaran baru.
          </p>
        </div>
        <div class="workspace-actions">
          <a class="btn btn-secondary" routerLink="/vendor/products/new">
            <app-icon name="plus" [size]="14" />
            <span>Tambah Lot Produk</span>
          </a>
          <a class="btn btn-seller" routerLink="/vendor/auctions/new">
            <app-icon name="hammer" [size]="14" />
            <span>Buat Lelang Baru</span>
          </a>
        </div>
      </header>

      <!-- Vendor Profile Alert if missing -->
      @if (profileResolved() && !vendor()) {
        <div class="workspace-alert-slot">
          <app-alert tone="warning" title="Profil penjual belum lengkap">
            Akun Anda belum memiliki data profil perusahaan resmi.
            Lengkapi data bisnis Anda melalui <a routerLink="/profile">Profil & Akun</a> untuk memulai lelang.
          </app-alert>
        </div>
      }

      @if (!auctions.hasError()) {
        <!-- 2. Auction Overview: Single Unified Metrics Strip -->
        <section class="metrics-strip-container" aria-label="Ringkasan Status Lelang">
          <div class="metrics-strip">
            <div class="metric-cell metric-cell--active">
              <div class="metric-cell-header">
                <span class="metric-dot dot-active"></span>
                <span class="metric-label">Sedang Berlangsung</span>
              </div>
              <div class="metric-value-row">
                <span class="metric-value">{{ countBy(AuctionStatus.ACTIVE) }}</span>
                <span class="metric-context">Lot aktif</span>
              </div>
            </div>

            <div class="metric-cell metric-cell--scheduled">
              <div class="metric-cell-header">
                <span class="metric-dot dot-scheduled"></span>
                <span class="metric-label">Akan Datang</span>
              </div>
              <div class="metric-value-row">
                <span class="metric-value">{{ countBy(AuctionStatus.SCHEDULED) }}</span>
                <span class="metric-context">Terjadwal</span>
              </div>
            </div>

            <div class="metric-cell metric-cell--draft">
              <div class="metric-cell-header">
                <span class="metric-dot dot-draft"></span>
                <span class="metric-label">Draft / Persiapan</span>
              </div>
              <div class="metric-value-row">
                <span class="metric-value">{{ countBy(AuctionStatus.DRAFT) }}</span>
                <span class="metric-context">Perlu jadwal</span>
              </div>
            </div>

            <div class="metric-cell metric-cell--ended">
              <div class="metric-cell-header">
                <span class="metric-dot dot-ended"></span>
                <span class="metric-label">Tuntas / Selesai</span>
              </div>
              <div class="metric-value-row">
                <span class="metric-value">{{ countBy(AuctionStatus.ENDED) }}</span>
                <span class="metric-context">Selesai</span>
              </div>
            </div>
          </div>
        </section>

        <!-- 3. Immediate Action Callout (Only if items need attention) -->
        @if (needsAttention().length > 0) {
          <section class="action-needed-panel" aria-label="Lot Memerlukan Tindakan">
            <div class="panel-header">
              <div class="panel-header-title">
                <app-icon name="alert" [size]="16" />
                <h2 class="panel-heading">Perlu Tindakan Operasional</h2>
                <span class="panel-badge">{{ needsAttention().length }}</span>
              </div>
              <p class="panel-hint">Lot berikut membutuhkan penetapan jadwal atau penutupan resmi.</p>
            </div>

            <div class="table-scroll">
              <table class="data-table">
                <thead>
                  <tr>
                    <th scope="col">Lot Produk</th>
                    <th scope="col">Status</th>
                    <th scope="col">Kondisi</th>
                    <th scope="col" class="col-numeric">Harga Saat Ini</th>
                    <th scope="col" class="cell-actions">Aksi Cepat</th>
                  </tr>
                </thead>
                <tbody>
                  @for (auction of needsAttention(); track auction.id) {
                    <tr>
                      <td data-label="Lot Produk">
                        <div class="lot-cell">
                          <span class="lot-name">{{ auction.product?.name }}</span>
                          <span class="text-mono-id">{{ auction.product?.code }}</span>
                        </div>
                      </td>
                      <td data-label="Status">
                        <app-auction-status-badge [status]="auction.status" size="sm" />
                      </td>
                      <td data-label="Kondisi">
                        <span class="attention-note">{{ attentionReason(auction) }}</span>
                      </td>
                      <td data-label="Harga Saat Ini" class="col-numeric">
                        <span class="text-numeric">{{ price(auction.currentPrice) }}</span>
                      </td>
                      <td data-label="Aksi Cepat" class="cell-actions">
                        <a
                          class="btn btn-seller btn-sm"
                          [routerLink]="['/vendor/auctions', auction.id]"
                        >
                          <app-icon name="hammer" [size]="13" />
                          <span>Kelola</span>
                        </a>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </section>
        }

        <!-- 4. Operational Tables Layout (Two-Column / Stacked Composition) -->
        <div class="workspace-grid">
          <!-- Main: Active & Recent Auctions -->
          <section class="workspace-section">
            <div class="section-title-row">
              <div class="section-title-wrap">
                <h2 class="section-title">Aktivitas Lelang Utama</h2>
                <span class="section-count-tag">{{ auctionList().length }} Total</span>
              </div>
              <a class="section-action-link" routerLink="/vendor/auctions">
                <span>Buka Semua Lelang</span>
                <app-icon name="arrow-right" [size]="13" />
              </a>
            </div>

            @if (auctions.isLoading() && !auctions.data()) {
              <div class="surface-panel">
                <div class="table-skeleton-rows">
                  @for (i of skeletonItems; track i) {
                    <div class="skeleton-row">
                      <div class="skeleton" style="width: 40%; height: 14px;"></div>
                      <div class="skeleton" style="width: 20%; height: 14px;"></div>
                      <div class="skeleton" style="width: 20%; height: 14px;"></div>
                    </div>
                  }
                </div>
              </div>
            } @else if (recentAuctions().length === 0) {
              <div class="surface-panel">
                <app-empty-state
                  icon="hammer"
                  title="Belum ada lelang dibuat"
                  description="Daftarkan produk Anda terlebih dahulu, lalu buat lelang lot baru untuk mulai menerima penawaran."
                >
                  <a class="btn btn-seller" routerLink="/vendor/auctions/new">
                    <app-icon name="plus" [size]="14" />
                    <span>Buat Lelang Pertama</span>
                  </a>
                </app-empty-state>
              </div>
            } @else {
              <div class="surface-panel">
                <div class="table-scroll">
                  <table class="data-table">
                    <thead>
                      <tr>
                        <th scope="col">Lot Produk</th>
                        <th scope="col">Status</th>
                        <th scope="col" class="col-numeric">Harga Saat Ini</th>
                        <th scope="col" class="col-numeric">Tawaran</th>
                        <th scope="col" class="cell-actions">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (auction of recentAuctions(); track auction.id) {
                        <tr>
                          <td data-label="Lot Produk">
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
                          <td data-label="Status">
                            <app-auction-status-badge [status]="auction.status" size="sm" />
                          </td>
                          <td data-label="Harga Saat Ini" class="col-numeric">
                            <span class="text-numeric">{{ price(auction.currentPrice) }}</span>
                          </td>
                          <td data-label="Tawaran" class="col-numeric">
                            <span class="bid-count-pill">{{ auction.bidCount }}</span>
                          </td>
                          <td data-label="Aksi" class="cell-actions">
                            <a
                              class="btn btn-secondary btn-sm"
                              [routerLink]="['/vendor/auctions', auction.id]"
                            >
                              <app-icon name="hammer" [size]="12" />
                              <span>Kelola</span>
                            </a>
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            }
          </section>

          <!-- Side: Ready Lots Inventory -->
          <section class="workspace-section">
            <div class="section-title-row">
              <div class="section-title-wrap">
                <h2 class="section-title">Inventaris Produk / Lot</h2>
                <span class="section-count-tag">{{ productList().length }} Terdaftar</span>
              </div>
              <a class="section-action-link" routerLink="/vendor/products">
                <span>Kelola Inventaris</span>
                <app-icon name="arrow-right" [size]="13" />
              </a>
            </div>

            @if (products.isLoading() && !products.data()) {
              <div class="surface-panel">
                <div class="table-skeleton-rows">
                  @for (i of skeletonItems; track i) {
                    <div class="skeleton-row">
                      <div class="skeleton" style="width: 50%; height: 14px;"></div>
                      <div class="skeleton" style="width: 30%; height: 14px;"></div>
                    </div>
                  }
                </div>
              </div>
            } @else if (productList().length === 0) {
              <div class="surface-panel">
                <app-empty-state
                  icon="package"
                  title="Inventaris produk masih kosong"
                  description="Produk adalah dasar untuk lot lelang. Daftarkan produk katalog Anda sebelum membuat lelang."
                >
                  <a class="btn btn-secondary" routerLink="/vendor/products/new">
                    <app-icon name="plus" [size]="14" />
                    <span>Daftarkan Produk</span>
                  </a>
                </app-empty-state>
              </div>
            } @else {
              <div class="surface-panel">
                <div class="table-scroll">
                  <table class="data-table">
                    <thead>
                      <tr>
                        <th scope="col">Kode & Nama</th>
                        <th scope="col">Kategori</th>
                        <th scope="col" class="cell-actions">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (product of productList().slice(0, 5); track product.id) {
                        <tr>
                          <td data-label="Kode & Nama">
                            <div class="lot-cell">
                              <span class="lot-name">{{ product.name }}</span>
                              <span class="text-mono-id">{{ product.code }}</span>
                            </div>
                          </td>
                          <td data-label="Kategori">
                            <span class="category-chip">{{ product.category?.name ?? '—' }}</span>
                          </td>
                          <td data-label="Aksi" class="cell-actions">
                            <a
                              class="btn btn-ghost btn-sm"
                              [routerLink]="['/vendor/products', product.id, 'edit']"
                              title="Edit Lot"
                            >
                              <app-icon name="edit" [size]="13" />
                            </a>
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            }
          </section>
        </div>
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
      .vendor-workspace {
        display: flex;
        flex-direction: column;
        gap: var(--sp-6);
      }

      /* 1. Workspace Header */
      .workspace-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: var(--sp-5);
        padding-bottom: var(--sp-5);
        border-bottom: 1px solid var(--c-border);
      }

      .workspace-header-main {
        display: flex;
        flex-direction: column;
        gap: var(--sp-1-5, 6px);
      }

      .workspace-eyebrow {
        display: flex;
        align-items: center;
        gap: var(--sp-2-5, 10px);
      }

      .workspace-chip {
        font-size: 0.65rem;
        font-weight: var(--fw-bold);
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--c-seller);
        background: var(--c-seller-soft);
        border: 1px solid var(--c-seller-border);
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
        color: var(--c-text);
        margin: 0;
        line-height: var(--lh-tight);
      }

      .workspace-subtitle {
        font-size: var(--fs-sm);
        color: var(--c-text-muted);
        margin: 0;
        max-width: 680px;
        line-height: var(--lh-normal);
      }

      .workspace-actions {
        display: flex;
        align-items: center;
        gap: var(--sp-2-5, 10px);
        flex-shrink: 0;
      }

      .workspace-alert-slot {
        margin-bottom: var(--sp-2);
      }

      /* 2. Single Unified Metrics Strip */
      .metrics-strip-container {
        width: 100%;
      }

      .metrics-strip {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        background: var(--c-surface);
        border: 1px solid var(--c-border);
        border-radius: var(--r-md);
        box-shadow: var(--sh-xs);
        overflow: hidden;
      }

      .metric-cell {
        padding: var(--sp-4) var(--sp-5);
        display: flex;
        flex-direction: column;
        gap: var(--sp-2);
        border-right: 1px solid var(--c-border);
        background: var(--c-surface);
        transition: background-color var(--dur-fast);

        &:last-child {
          border-right: none;
        }

        &:hover {
          background-color: var(--c-surface-sunken);
        }
      }

      .metric-cell-header {
        display: flex;
        align-items: center;
        gap: var(--sp-2);
      }

      .metric-dot {
        width: 8px;
        height: 8px;
        border-radius: var(--r-full);
      }

      .dot-active { background: var(--c-success); box-shadow: 0 0 0 2px var(--c-success-soft); }
      .dot-scheduled { background: var(--c-info); box-shadow: 0 0 0 2px var(--c-info-soft); }
      .dot-draft { background: var(--c-warning); box-shadow: 0 0 0 2px var(--c-warning-soft); }
      .dot-ended { background: var(--c-neutral); box-shadow: 0 0 0 2px var(--c-neutral-soft); }

      .metric-label {
        font-size: var(--fs-xs);
        font-weight: var(--fw-semibold);
        color: var(--c-text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }

      .metric-value-row {
        display: flex;
        align-items: baseline;
        gap: var(--sp-2);
      }

      .metric-value {
        font-family: var(--font-mono);
        font-size: 1.875rem;
        font-weight: var(--fw-bold);
        color: var(--c-text);
        line-height: 1;
      }

      .metric-context {
        font-size: var(--fs-xs);
        color: var(--c-text-muted);
      }

      /* 3. Action Needed Panel */
      .action-needed-panel {
        background: var(--c-surface);
        border: 1px solid var(--c-warning-border);
        border-left: 4px solid var(--c-warning);
        border-radius: var(--r-md);
        box-shadow: var(--sh-xs);
        overflow: hidden;
      }

      .panel-header {
        padding: var(--sp-3-5, 14px) var(--sp-4);
        border-bottom: 1px solid var(--c-border);
        background: var(--c-warning-soft);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--sp-3);
      }

      .panel-header-title {
        display: flex;
        align-items: center;
        gap: var(--sp-2);
        color: var(--c-warning);
      }

      .panel-heading {
        font-size: var(--fs-sm);
        font-weight: var(--fw-bold);
        color: var(--c-text);
        margin: 0;
      }

      .panel-badge {
        font-size: var(--fs-2xs);
        font-weight: var(--fw-bold);
        background: var(--c-warning);
        color: #ffffff;
        padding: 1px 6px;
        border-radius: var(--r-full);
      }

      .panel-hint {
        font-size: var(--fs-xs);
        color: var(--c-text-muted);
        margin: 0;
      }

      .attention-note {
        font-size: var(--fs-xs);
        color: var(--c-warning);
        font-weight: var(--fw-medium);
      }

      /* 4. Main Grid & Section Panels */
      .workspace-grid {
        display: grid;
        grid-template-columns: 1.5fr 1fr;
        gap: var(--sp-6);
        align-items: start;
      }

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
        font-weight: var(--fw-semibold);
        color: var(--c-text);
        margin: 0;
      }

      .section-count-tag {
        font-size: var(--fs-2xs);
        font-weight: var(--fw-medium);
        color: var(--c-text-muted);
        background: var(--c-surface-sunken);
        padding: 2px 6px;
        border-radius: var(--r-sm);
        border: 1px solid var(--c-border);
      }

      .section-action-link {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: var(--fs-xs);
        font-weight: var(--fw-medium);
        color: var(--c-seller);
        text-decoration: none;

        &:hover {
          text-decoration: underline;
        }
      }

      /* Surface Panel (Restrained, no card-in-card) */
      .surface-panel {
        background: var(--c-surface);
        border: 1px solid var(--c-border);
        border-radius: var(--r-md);
        box-shadow: var(--sh-xs);
        overflow: hidden;
      }

      .lot-cell {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .lot-name {
        font-weight: var(--fw-medium);
        color: var(--c-text);
      }

      .lot-name-link {
        font-weight: var(--fw-medium);
        color: var(--c-text);
        text-decoration: none;

        &:hover {
          color: var(--c-seller);
          text-decoration: underline;
        }
      }

      .bid-count-pill {
        font-family: var(--font-mono);
        font-size: var(--fs-xs);
        font-weight: var(--fw-semibold);
        color: var(--c-text-secondary);
        background: var(--c-surface-sunken);
        padding: 2px 7px;
        border-radius: var(--r-sm);
      }

      .category-chip {
        font-size: var(--fs-xs);
        color: var(--c-text-secondary);
      }

      /* Skeleton styles */
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

      @media (max-width: 1024px) {
        .workspace-grid {
          grid-template-columns: 1fr;
        }

        .metrics-strip {
          grid-template-columns: repeat(2, 1fr);
        }

        .metric-cell:nth-child(2) {
          border-right: none;
        }

        .metric-cell:nth-child(-n + 2) {
          border-bottom: 1px solid var(--c-border);
        }
      }

      @media (max-width: 640px) {
        .workspace-header {
          flex-direction: column;
        }

        .workspace-actions {
          width: 100%;
          justify-content: flex-start;
        }

        .metrics-strip {
          grid-template-columns: 1fr;
        }

        .metric-cell {
          border-right: none !important;
          border-bottom: 1px solid var(--c-border);

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

  readonly recentAuctions = computed(() => this.auctionList().slice(0, 6));

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
    this.products.load(this.productService.listMine({ limit: 10 }));
  }

  countBy(status: AuctionStatus): number {
    return this.auctionList().filter((a) => a.status === status).length;
  }

  attentionReason(auction: Auction): string {
    if (auction.status === AuctionStatus.DRAFT) {
      return 'Draft lelang — tetapkan jadwal untuk publikasi';
    }
    return 'Waktu lelang berakhir — lakukan penutupan resmi';
  }

  price(value: number): string {
    return formatAmount(value);
  }

  created(iso: string): string {
    return formatDateTime(iso);
  }
}
