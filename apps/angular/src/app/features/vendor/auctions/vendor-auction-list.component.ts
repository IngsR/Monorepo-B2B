import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { resolveTiming } from '../../../core/domain/auction-lifecycle';
import { AuctionStatus } from '../../../core/domain/enums';
import { formatAmount, formatDateTime } from '../../../core/domain/format';
import { Auction, AuctionQuery, Paginated } from '../../../core/domain/models';
import { AuctionService } from '../../../core/services/auction.service';
import { AsyncResource } from '../../../core/state/async-resource';
import { AuctionStatusBadgeComponent } from '../../../shared/ui/badge.component';
import { CountdownComponent } from '../../../shared/ui/countdown.component';
import { MatIconComponent } from '../../../shared/ui/mat-icon.component';
import { PaginationComponent } from '../../../shared/ui/pagination.component';
import {
  EmptyStateComponent,
  ErrorStateComponent,
  TableSkeletonComponent,
} from '../../../shared/ui/state-block.component';

/**
 * Lelang Saya — Vendor Auction Lots Ledger.
 *
 * Scoped to the authenticated vendor via `/auctions/mine`.
 * Features an operational table on desktop and responsive stacked cards on mobile.
 */
@Component({
  selector: 'app-vendor-auction-list',
  standalone: true,
  imports: [
    RouterLink,
    AuctionStatusBadgeComponent,
    CountdownComponent,
    MatIconComponent,
    PaginationComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    TableSkeletonComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page vendor-auctions-page">
      <header class="page-head">
        <div class="page-head-text">
          <div class="page-eyebrow">
            <span class="eyebrow-chip">OPERASIONAL LOT LELANG</span>
            <span class="eyebrow-note">Kendali Siklus Lot Penjual</span>
          </div>
          <h1 class="page-title">Lelang Saya</h1>
          <p class="page-subtitle">
            Seluruh lot lelang yang Anda terbitkan. Pantau pergerakan penawaran, jadwalkan draf, dan selesaikan penetapan hasil lelang.
          </p>
        </div>
        <div class="page-actions">
          <a class="btn btn-seller" routerLink="/vendor/auctions/new">
            <mat-icon fontIcon="gavel" [size]="16" />
            <span>Buat Lelang Baru</span>
          </a>
        </div>
      </header>

      <!-- Operational Filter Toolbar -->
      <div class="toolbar">
        <div class="toolbar-field toolbar-grow">
          <label class="form-label" for="auction-search">Cari Lot</label>
          <div class="input-affix-wrap">
            <span class="search-prefix">
              <mat-icon fontIcon="search" [size]="16" />
            </span>
            <input
              id="auction-search"
              type="search"
              class="form-input search-with-icon"
              placeholder="Cari berdasarkan nama lot atau kode barang..."
              [value]="searchInput()"
              (input)="onSearchInput($event)"
            />
          </div>
        </div>

        <div class="toolbar-field">
          <label class="form-label" for="auction-status">Status Siklus</label>
          <select
            id="auction-status"
            class="form-select"
            [value]="statusFilter()"
            (change)="setStatus($event)"
          >
            <option value="ALL">Semua Status</option>
            <option [value]="AuctionStatus.DRAFT">Draf (Persiapan)</option>
            <option [value]="AuctionStatus.SCHEDULED">Terjadwal</option>
            <option [value]="AuctionStatus.ACTIVE">Aktif (Sedang Berjalan)</option>
            <option [value]="AuctionStatus.ENDED">Selesai</option>
            <option [value]="AuctionStatus.CANCELLED">Dibatalkan</option>
          </select>
        </div>

        <div class="toolbar-field">
          <label class="form-label" for="auction-sort">Urutkan</label>
          <select
            id="auction-sort"
            class="form-select"
            [value]="orderBy()"
            (change)="setOrderBy($event)"
          >
            <option value="endingSoon">Segera Berakhir</option>
            <option value="newest">Terbaru</option>
            <option value="priceDesc">Harga Tertinggi</option>
            <option value="mostBids">Tawaran Terbanyak</option>
          </select>
        </div>

        <div class="toolbar-field toolbar-action">
          <button
            type="button"
            class="btn btn-secondary"
            (click)="reload()"
            [disabled]="auctions.isLoading()"
          >
            <mat-icon fontIcon="refresh" [size]="16" />
            <span>Perbarui</span>
          </button>
        </div>
      </div>

      <!-- Lot Ledger Container -->
      <div class="surface-card">
        @switch (true) {
          @case (auctions.isLoading() && !auctions.data()) {
            <app-table-skeleton [count]="5" />
          }
          @case (auctions.hasError()) {
            @if (auctions.error(); as failure) {
              <app-error-state
                [failure]="failure"
                [retrying]="auctions.isLoading()"
                (retry)="reload()"
              />
            }
          }
          @case (auctionList().length === 0) {
            <app-empty-state
              icon="hammer"
              [title]="hasFilters() ? 'Tidak ada lot yang cocok' : 'Belum ada lelang dibuat'"
              [description]="
                hasFilters()
                  ? 'Coba ubah status atau bersihkan kata kunci pencarian.'
                  : 'Pilih barang dari katalog inventaris Anda untuk mulai menyusun lot lelang.'
              "
            >
              @if (hasFilters()) {
                <button type="button" class="btn btn-secondary" (click)="clearFilters()">
                  <mat-icon fontIcon="close" [size]="14" />
                  <span>Hapus Filter</span>
                </button>
              } @else {
                <a class="btn btn-seller" routerLink="/vendor/auctions/new">
                  <mat-icon fontIcon="gavel" [size]="16" />
                  <span>Buat Lot Lelang</span>
                </a>
              }
            </app-empty-state>
          }
          @default {
            <!-- Desktop Scannable Operational Table -->
            <div class="table-scroll hide-mobile">
              <table class="data-table">
                <thead>
                  <tr>
                    <th scope="col">Lot Barang</th>
                    <th scope="col">Status</th>
                    <th scope="col">Jadwal & Waktu</th>
                    <th scope="col" class="col-numeric">Harga Saat Ini</th>
                    <th scope="col" class="col-numeric">Tawaran</th>
                    <th scope="col" class="cell-actions">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  @for (auction of auctionList(); track auction.id) {
                    <tr>
                      <td>
                        <div class="lot-cell">
                          <a
                            [routerLink]="['/vendor/auctions', auction.id]"
                            class="lot-name-link"
                          >
                            {{ auction.product?.name ?? 'Lot Lelang' }}
                          </a>
                          <span class="text-mono-id">{{ auction.product?.code }}</span>
                        </div>
                      </td>
                      <td>
                        <app-auction-status-badge
                          [status]="auction.status"
                          [endingSoon]="isEndingSoon(auction)"
                          size="sm"
                        />
                      </td>
                      <td>
                        @if (auction.status === AuctionStatus.ACTIVE && !isWindowClosed(auction)) {
                          <app-countdown [target]="auction.endTime" prefix="closes" size="sm" />
                        } @else if (auction.status === AuctionStatus.SCHEDULED) {
                          <span class="text-meta">Buka: {{ startLabel(auction) }}</span>
                        } @else if (isWindowClosed(auction) && auction.status === AuctionStatus.ACTIVE) {
                          <span class="badge badge-warning">Waktu habis · menunggu penutupan</span>
                        } @else {
                          <span class="text-meta">Selesai: {{ endLabel(auction) }}</span>
                        }
                      </td>
                      <td class="col-numeric">
                        <span class="text-numeric font-bold">{{ price(auction.currentPrice) }}</span>
                      </td>
                      <td class="col-numeric">
                        <span class="bid-count-pill">{{ auction.bidCount }}</span>
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

            <!-- Mobile Stacked Card List -->
            <div class="mobile-auction-stack hide-desktop">
              @for (auction of auctionList(); track auction.id) {
                <article class="mobile-auction-card">
                  <div class="mobile-auction-card-head">
                    <div class="lot-cell">
                      <a
                        [routerLink]="['/vendor/auctions', auction.id]"
                        class="lot-name-link"
                      >
                        {{ auction.product?.name ?? 'Lot Lelang' }}
                      </a>
                      <span class="text-mono-id">{{ auction.product?.code }}</span>
                    </div>
                    <app-auction-status-badge
                      [status]="auction.status"
                      [endingSoon]="isEndingSoon(auction)"
                      size="sm"
                    />
                  </div>

                  <div class="mobile-auction-timing-box">
                    @if (auction.status === AuctionStatus.ACTIVE && !isWindowClosed(auction)) {
                      <app-countdown [target]="auction.endTime" prefix="closes" size="sm" />
                    } @else if (auction.status === AuctionStatus.SCHEDULED) {
                      <span class="text-meta">Jadwal Buka: {{ startLabel(auction) }}</span>
                    } @else if (isWindowClosed(auction) && auction.status === AuctionStatus.ACTIVE) {
                      <span class="badge badge-warning">Waktu habis · menunggu penutupan</span>
                    } @else {
                      <span class="text-meta">Berakhir: {{ endLabel(auction) }}</span>
                    }
                  </div>

                  <div class="mobile-auction-card-data">
                    <div class="data-col">
                      <span class="text-meta">Harga Saat Ini</span>
                      <span class="text-numeric font-bold">{{ price(auction.currentPrice) }}</span>
                    </div>
                    <div class="data-col text-right">
                      <span class="text-meta">Penawaran</span>
                      <span class="bid-count-pill">{{ auction.bidCount }} tawaran</span>
                    </div>
                  </div>

                  <div class="mobile-auction-card-footer">
                    <a
                      class="btn btn-seller btn-sm btn-grow"
                      [routerLink]="['/vendor/auctions', auction.id]"
                    >
                      <mat-icon fontIcon="gavel" [size]="14" />
                      <span>Kelola Lot Lelang</span>
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

            @if (meta(); as m) {
              <app-pagination [meta]="m" (pageChange)="setPage($event)" />
            }
          }
        }
      </div>
    </div>
  `,
  styles: [
    `
      .vendor-auctions-page {
        display: flex;
        flex-direction: column;
        gap: var(--sp-5);
        font-family: var(--font-sans);
      }

      .page-eyebrow {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: var(--sp-1);
      }

      .eyebrow-chip {
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

      .eyebrow-note {
        font-size: var(--fs-xs);
        color: #64706b;
      }

      .surface-card {
        background: #ffffff;
        border: 1px solid #d9ddd8;
        border-radius: var(--r-md);
        box-shadow: 0 1px 2px rgba(23, 32, 30, 0.04);
        overflow: hidden;
      }

      /* Toolbar */
      .toolbar {
        display: flex;
        align-items: flex-end;
        gap: var(--sp-3);
        flex-wrap: wrap;
      }

      .toolbar-grow {
        flex: 1;
        min-width: 220px;
      }

      .toolbar-action {
        flex-shrink: 0;
      }

      .search-prefix {
        color: #64706b;
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
          font-size: 0.725rem;
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

      .lot-cell {
        display: flex;
        flex-direction: column;
        gap: 2px;
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
      }

      .font-bold {
        font-weight: var(--fw-bold);
        color: #17201e;
      }

      .text-meta {
        font-size: var(--fs-xs);
        color: #64706b;
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
        gap: 4px;
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

      /* Mobile Stack */
      .mobile-auction-stack {
        display: flex;
        flex-direction: column;
        gap: var(--sp-3);
        padding: var(--sp-3);
      }

      .mobile-auction-card {
        background: #ffffff;
        border: 1px solid #d9ddd8;
        border-radius: var(--r-sm);
        padding: var(--sp-3);
        display: flex;
        flex-direction: column;
        gap: var(--sp-2-5, 10px);
      }

      .mobile-auction-card-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: var(--sp-2);
      }

      .mobile-auction-timing-box {
        background: #faf9f6;
        padding: 6px 10px;
        border-radius: var(--r-xs);
      }

      .mobile-auction-card-data {
        display: flex;
        align-items: center;
        justify-content: space-between;
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

      .mobile-auction-card-footer {
        display: flex;
        align-items: center;
        gap: var(--sp-2);
      }

      .btn-grow {
        flex: 1;
        justify-content: center;
      }

      /* Responsive Display Controls */
      .hide-desktop {
        display: none !important;
      }

      @media (max-width: 768px) {
        .hide-mobile {
          display: none !important;
        }

        .hide-desktop {
          display: flex !important;
        }

        .toolbar-action {
          width: 100%;
          .btn {
            width: 100%;
            justify-content: center;
          }
        }
      }

      @media (max-width: 540px) {
        .page-head {
          flex-direction: column;
        }

        .page-actions {
          width: 100%;
          .btn {
            width: 100%;
            justify-content: center;
          }
        }
      }
    `,
  ],
})
export class VendorAuctionListComponent {
  private readonly auctionService = inject(AuctionService);

  readonly auctions = new AsyncResource<Paginated<Auction>>();

  readonly page = signal(1);
  readonly pageSize = signal(15);
  readonly searchInput = signal('');
  readonly statusFilter = signal<string>('ALL');
  readonly orderBy = signal<NonNullable<AuctionQuery['orderBy']>>('endingSoon');

  readonly auctionList = computed(() => this.auctions.data()?.items ?? []);
  readonly meta = computed(() => this.auctions.data()?.meta ?? null);

  readonly hasFilters = computed(
    () =>
      this.searchInput().trim().length > 0 ||
      this.statusFilter() !== 'ALL' ||
      this.orderBy() !== 'endingSoon',
  );

  protected readonly AuctionStatus = AuctionStatus;

  constructor() {
    this.reload();
  }

  reload(): void {
    const status = this.statusFilter() === 'ALL' ? undefined : (this.statusFilter() as AuctionStatus);
    const search = this.searchInput().trim() || undefined;

    this.auctions.load(
      this.auctionService.listMine({
        page: this.page(),
        limit: this.pageSize(),
        status,
        search,
        orderBy: this.orderBy(),
      }),
    );
  }

  onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchInput.set(value);
    this.page.set(1);
    this.reload();
  }

  setStatus(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.statusFilter.set(select.value);
    this.page.set(1);
    this.reload();
  }

  setOrderBy(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.orderBy.set(select.value as NonNullable<AuctionQuery['orderBy']>);
    this.page.set(1);
    this.reload();
  }

  setPage(p: number): void {
    this.page.set(p);
    this.reload();
  }

  clearFilters(): void {
    this.searchInput.set('');
    this.statusFilter.set('ALL');
    this.orderBy.set('endingSoon');
    this.page.set(1);
    this.reload();
  }

  isEndingSoon(auction: Auction): boolean {
    return resolveTiming(auction, Date.now()).endingSoon;
  }

  isWindowClosed(auction: Auction): boolean {
    return new Date(auction.endTime).getTime() <= Date.now();
  }

  price(value: number): string {
    return formatAmount(value);
  }

  startLabel(auction: Auction): string {
    return formatDateTime(auction.startTime);
  }

  endLabel(auction: Auction): string {
    return formatDateTime(auction.endTime);
  }
}
