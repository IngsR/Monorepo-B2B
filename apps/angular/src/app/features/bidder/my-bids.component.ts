import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { resolveTiming } from '../../core/domain/auction-lifecycle';
import { AuctionStatus } from '../../core/domain/enums';
import { formatAmount, formatDateTime, formatRelative } from '../../core/domain/format';
import { Bid, Paginated } from '../../core/domain/models';
import { AsyncResource } from '../../core/state/async-resource';
import { BidService } from '../../core/services/bid.service';
import { AuctionStatusBadgeComponent } from '../../shared/ui/badge.component';
import { MatIconComponent } from '../../shared/ui/mat-icon.component';
import { PaginationComponent } from '../../shared/ui/pagination.component';
import {
  EmptyStateComponent,
  ErrorStateComponent,
  TableSkeletonComponent,
} from '../../shared/ui/state-block.component';
import { AlertComponent } from '../../shared/ui/toast.component';

/**
 * Position of the bidder's bid relative to the auction — derived, never assumed.
 */
export type BidStanding = 'winning' | 'outbid' | 'ended' | 'cancelled' | 'pending';

interface MyBidRow {
  bid: Bid;
  standing: BidStanding;
  label: string;
  highestAmount: number | null;
  isHighestBid: boolean;
}

/**
 * My Bids — Bidder Procurement Activity Dashboard.
 *
 * Provides a clear, authoritative ledger of every bid submitted:
 *  - Categorised by standing: Winning (Memimpin), Outbid (Terlampaui), and Closed
 *  - Fully synchronised with URL query parameters (/my-bids?filter=winning, /my-bids?filter=outbid)
 *  - Clear actions to retake the lead or inspect the lot dossier
 */
@Component({
  selector: 'app-my-bids',
  standalone: true,
  imports: [
    RouterLink,
    AuctionStatusBadgeComponent,
    MatIconComponent,
    PaginationComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    TableSkeletonComponent,
    AlertComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page my-bids-page">
      <header class="page-head">
        <div class="page-head-text">
          <span class="procurement-eyebrow">
            <mat-icon fontIcon="history_edu" [size]="14" />
            <span>Aktivitas Pengadaan & Penawaran</span>
          </span>
          <h1 class="page-title">Penawaran Saya</h1>
          <p class="page-subtitle">
            Buku catatan seluruh tawaran yang telah Anda kirimkan. Status peringkat dan penentuan
            pemenang diproses oleh sistem lelang server-authoritative secara real-time.
          </p>
        </div>
        <div class="page-actions">
          <a class="btn btn-primary" routerLink="/marketplace">
            <mat-icon fontIcon="storefront" [size]="16" />
            <span>Jelajahi Lantai Lelang</span>
          </a>
        </div>
      </header>

      <!-- Summary metrics cards -->
      @if (bids.isSuccess()) {
        <div class="stat-grid">
          <div class="stat-card" [class.is-highlighted]="countStanding('winning') > 0">
            <span class="stat-label">Memimpin Saat Ini</span>
            <span class="stat-value text-numeric">{{ countStanding('winning') }}</span>
            <span class="stat-foot">Tawaran tertinggi pada lot lelang aktif</span>
          </div>
          <div class="stat-card" [class.is-warning]="countStanding('outbid') > 0">
            <span class="stat-label">Terlampaui</span>
            <span class="stat-value text-numeric">{{ countStanding('outbid') }}</span>
            <span class="stat-foot">Perlu tawaran lebih tinggi untuk merebut lead</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Lelang Berakhir</span>
            <span class="stat-value text-numeric">{{ countStanding('ended') }}</span>
            <span class="stat-foot">Hasil final telah ditetapkan sistem</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Dibatalkan</span>
            <span class="stat-value text-numeric">{{ countStanding('cancelled') }}</span>
            <span class="stat-foot">Lot lelang ditarik kembali oleh vendor</span>
          </div>
        </div>
      }

      <!-- Status Tabs (Synchronized with Query Params) -->
      <div class="tabs" role="tablist">
        <button
          type="button"
          class="tab"
          role="tab"
          [class.is-active]="filter() === 'ALL'"
          [attr.aria-selected]="filter() === 'ALL'"
          (click)="setFilter('ALL')"
        >
          <mat-icon fontIcon="layers" [size]="15" />
          <span>Semua ({{ rows().length }})</span>
        </button>
        <button
          type="button"
          class="tab"
          role="tab"
          [class.is-active]="filter() === 'winning'"
          [attr.aria-selected]="filter() === 'winning'"
          (click)="setFilter('winning')"
        >
          <mat-icon fontIcon="trending_up" [size]="15" />
          <span>Memimpin ({{ countStanding('winning') }})</span>
        </button>
        <button
          type="button"
          class="tab"
          role="tab"
          [class.is-active]="filter() === 'outbid'"
          [attr.aria-selected]="filter() === 'outbid'"
          (click)="setFilter('outbid')"
        >
          <mat-icon fontIcon="trending_down" [size]="15" />
          <span>Terlampaui ({{ countStanding('outbid') }})</span>
        </button>
        <button
          type="button"
          class="tab"
          role="tab"
          [class.is-active]="filter() === 'closed'"
          [attr.aria-selected]="filter() === 'closed'"
          (click)="setFilter('closed')"
        >
          <mat-icon fontIcon="done_all" [size]="15" />
          <span>Selesai ({{ countStanding('ended') + countStanding('cancelled') }})</span>
        </button>
      </div>

      <!-- Table Card Container -->
      <div class="card ledger-card">
        @switch (true) {
          @case (bids.isLoading() && !bids.data()) {
            <app-table-skeleton [count]="5" />
          }
          @case (bids.hasError()) {
            @if (bids.error(); as failure) {
              <app-error-state
                [failure]="failure"
                [retrying]="bids.isLoading()"
                (retry)="reload()"
              />
            }
          }
          @case (visibleRows().length === 0) {
            <app-empty-state
              [title]="emptyTitle()"
              [description]="emptyDescription()"
            >
              @if (filter() === 'ALL') {
                <a class="btn btn-primary" routerLink="/marketplace">
                  <mat-icon fontIcon="storefront" [size]="15" />
                  <span>Jelajahi Lantai Lelang</span>
                </a>
              } @else {
                <button type="button" class="btn btn-secondary" (click)="setFilter('ALL')">
                  <mat-icon fontIcon="refresh" [size]="15" />
                  <span>Tampilkan Semua Penawaran</span>
                </button>
              }
            </app-empty-state>
          }
          @default {
            <div class="table-scroll">
              <table class="data-table data-table--stacked">
                <thead>
                  <tr>
                    <th scope="col">Lot Lelang</th>
                    <th scope="col">Status</th>
                    <th scope="col" class="col-numeric">Tawaran Anda</th>
                    <th scope="col" class="col-numeric">Tawaran Tertinggi</th>
                    <th scope="col">Waktu Tawaran</th>
                    <th scope="col">Peringkat Anda</th>
                    <th scope="col" class="cell-actions">Tindakan</th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of visibleRows(); track row.bid.id) {
                    <tr>
                      <td data-label="Lot Lelang">
                        <div class="cell-primary-group">
                          <span class="cell-primary">
                            {{ row.bid.auction?.product?.name ?? 'Lot Lelang Industri' }}
                          </span>
                          <span class="lot-subline">
                            <span class="text-mono-id">{{ row.bid.auction?.product?.code ?? '—' }}</span>
                            @if (row.bid.auction?.product?.category; as cat) {
                              <span class="dot-sep" aria-hidden="true">·</span>
                              <span class="text-meta">{{ cat.name }}</span>
                            }
                          </span>
                        </div>
                      </td>
                      <td data-label="Status">
                        @if (row.bid.auction; as auction) {
                          <app-auction-status-badge
                            [status]="auction.status"
                            [endingSoon]="isEndingSoon(row)"
                            size="sm"
                          />
                        } @else {
                          <span class="text-meta">—</span>
                        }
                      </td>
                      <td data-label="Tawaran Anda" class="col-numeric">
                        <span class="text-numeric bid-my-amount">{{ money(row.bid.amount) }}</span>
                      </td>
                      <td data-label="Tawaran Tertinggi" class="col-numeric">
                        <span class="text-numeric">{{ money(row.highestAmount) }}</span>
                      </td>
                      <td data-label="Waktu Tawaran">
                        <span class="text-meta">{{ relative(row.bid.createdAt) }}</span>
                      </td>
                      <td data-label="Peringkat Anda">
                        <span [class]="'bid-standing-chip standing-' + row.standing">
                          @if (row.standing === 'winning') {
                            <mat-icon fontIcon="trending_up" [size]="14" />
                          } @else if (row.standing === 'outbid') {
                            <mat-icon fontIcon="trending_down" [size]="14" />
                          } @else if (row.standing === 'cancelled') {
                            <mat-icon fontIcon="block" [size]="14" />
                          } @else if (row.standing === 'ended') {
                            <mat-icon fontIcon="done" [size]="14" />
                          } @else {
                            <mat-icon fontIcon="schedule" [size]="14" />
                          }
                          <span>{{ row.label }}</span>
                        </span>

                        @if (row.standing === 'outbid') {
                          <p class="outbid-hint text-helper">
                            Tawar minimal <strong>{{ money(minimumFor(row)) }}</strong> untuk merebut kembali.
                          </p>
                        }
                      </td>
                      <td data-label="Tindakan" class="cell-actions">
                        @if (row.bid.auction; as auction) {
                          <a
                            class="btn btn-sm"
                            [class.btn-primary]="row.standing === 'outbid'"
                            [class.btn-secondary]="row.standing !== 'outbid'"
                            [routerLink]="['/marketplace', auction.id]"
                          >
                            @if (row.standing === 'outbid') {
                              <mat-icon fontIcon="gavel" [size]="14" />
                            } @else {
                              <mat-icon fontIcon="visibility" [size]="14" />
                            }
                            <span>{{ actionLabel(row) }}</span>
                          </a>
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>

            <app-pagination [meta]="meta()" (pageChange)="setPage($event)" />
          }
        }
      </div>

      <!-- Server Authoritative Note -->
      <app-alert tone="info" title="Prinsip Validasi & Penetapan Pemenang Lelang B2B">
        Penawaran Anda diuji terhadap nilai berjalan di database server secara real-time. Pemenang lelang ditentukan secara deterministik oleh server dari penawaran tertinggi yang sah ketika batas waktu lelang berakhir.
      </app-alert>
    </div>
  `,
  styles: [
    `
      .my-bids-page {
        display: flex;
        flex-direction: column;
        gap: var(--sp-6);
      }

      .procurement-eyebrow {
        display: inline-flex;
        align-items: center;
        gap: var(--sp-2);
        font-size: var(--fs-xs);
        font-weight: var(--fw-semibold);
        letter-spacing: var(--tracking-caps);
        text-transform: uppercase;
        color: var(--c-brand);
        margin-bottom: var(--sp-1);
      }

      .stat-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: var(--sp-4);
      }

      .stat-card {
        background: var(--c-surface);
        border: 1px solid var(--c-border);
        border-radius: var(--r-md);
        padding: var(--sp-4);
        display: flex;
        flex-direction: column;
        gap: 2px;
        box-shadow: var(--sh-xs);

        &.is-highlighted {
          border-left: 3px solid var(--c-brand);
        }

        &.is-warning {
          border-left: 3px solid var(--c-warning);
        }
      }

      .stat-label {
        font-size: var(--fs-xs);
        font-weight: var(--fw-medium);
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--c-text-muted);
      }

      .stat-value {
        font-family: var(--font-mono);
        font-size: var(--fs-2xl);
        font-weight: var(--fw-bold);
        color: var(--c-text);
        line-height: 1.2;
      }

      .stat-foot {
        font-size: var(--fs-2xs);
        color: var(--c-text-muted);
        margin-top: var(--sp-1);
      }

      .tabs {
        display: flex;
        align-items: center;
        gap: var(--sp-2);
        border-bottom: 1px solid var(--c-border);
        padding-bottom: 0;
        overflow-x: auto;
      }

      .tab {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: var(--sp-3) var(--sp-4);
        background: transparent;
        border: none;
        border-bottom: 2px solid transparent;
        font-size: var(--fs-sm);
        font-weight: var(--fw-medium);
        color: var(--c-text-secondary);
        cursor: pointer;
        white-space: nowrap;
        transition: all var(--dur-fast) var(--ease);

        &:hover {
          color: var(--c-text);
          border-bottom-color: var(--c-border-strong);
        }

        &.is-active {
          color: var(--c-brand);
          font-weight: var(--fw-bold);
          border-bottom-color: var(--c-brand);
        }
      }

      .ledger-card {
        padding: 0;
        overflow: hidden;
      }

      .cell-primary-group {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .lot-subline {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: var(--fs-xs);
      }

      .dot-sep {
        color: var(--c-border-strong);
      }

      .bid-my-amount {
        font-weight: var(--fw-bold);
        color: var(--c-text);
      }

      .bid-standing-chip {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 3px 8px;
        border-radius: var(--r-sm);
        font-size: var(--fs-xs);
        font-weight: var(--fw-semibold);
      }

      .standing-winning {
        background: var(--c-brand-soft);
        color: var(--c-brand);
        border: 1px solid var(--c-brand-border);
      }

      .standing-outbid {
        background: var(--c-warning-soft);
        color: var(--c-warning);
        border: 1px solid var(--c-warning-border);
      }

      .standing-ended {
        background: var(--c-surface-sunken);
        color: var(--c-text-secondary);
        border: 1px solid var(--c-border);
      }

      .standing-cancelled {
        background: var(--c-danger-soft);
        color: var(--c-danger);
        border: 1px solid var(--c-danger-border);
      }

      .standing-pending {
        background: var(--c-canvas);
        color: var(--c-text-muted);
        border: 1px solid var(--c-border);
      }

      .outbid-hint {
        margin-top: 4px;
        font-size: var(--fs-2xs);
        color: var(--c-warning);
        line-height: var(--lh-tight);
      }
    `,
  ],
})
export class MyBidsComponent {
  private readonly bidService = inject(BidService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly bids = new AsyncResource<Paginated<Bid>>();
  readonly filter = signal<'ALL' | 'winning' | 'outbid' | 'closed'>('ALL');
  readonly page = signal(1);

  readonly rows = computed<MyBidRow[]>(() =>
    (this.bids.data()?.items ?? []).map((bid) => this.toRow(bid)),
  );

  readonly visibleRows = computed(() => {
    const rows = this.rows();
    switch (this.filter()) {
      case 'winning':
        return rows.filter((r) => r.standing === 'winning');
      case 'outbid':
        return rows.filter((r) => r.standing === 'outbid');
      case 'closed':
        return rows.filter((r) => r.standing === 'ended' || r.standing === 'cancelled');
      default:
        return rows;
    }
  });

  readonly meta = computed(
    () => this.bids.data()?.meta ?? { total: 0, page: 1, limit: 50, totalPages: 1 },
  );

  constructor() {
    this.route.queryParams.subscribe((params) => {
      const filterParam = params['filter'];
      if (filterParam === 'winning' || filterParam === 'outbid' || filterParam === 'closed') {
        this.filter.set(filterParam);
      } else {
        this.filter.set('ALL');
      }
    });
    this.reload();
  }

  reload(): void {
    this.bids.load(this.bidService.listMine({ limit: 50 }), { keepData: true });
  }

  private toRow(bid: Bid): MyBidRow {
    const auction = bid.auction;
    const highestAmount = auction?.currentPrice ?? bid.amount;
    const isHighestBid = bid.amount >= highestAmount;

    if (!auction) {
      return {
        bid,
        standing: 'pending',
        label: 'Lelang tidak tersedia',
        highestAmount,
        isHighestBid,
      };
    }

    if (auction.status === AuctionStatus.CANCELLED) {
      return {
        bid,
        standing: 'cancelled',
        label: 'Dibatalkan',
        highestAmount,
        isHighestBid,
      };
    }

    if (auction.status === AuctionStatus.ENDED) {
      return { bid, standing: 'ended', label: 'Lelang Selesai', highestAmount, isHighestBid };
    }

    if (auction.status === AuctionStatus.DRAFT || auction.status === AuctionStatus.SCHEDULED) {
      return { bid, standing: 'pending', label: 'Belum Dimulai', highestAmount, isHighestBid };
    }

    if (!resolveTiming(auction).acceptingBids) {
      return { bid, standing: 'pending', label: 'Menunggu Penutupan', highestAmount, isHighestBid };
    }

    return isHighestBid
      ? { bid, standing: 'winning', label: 'Tawaran Memimpin', highestAmount, isHighestBid }
      : { bid, standing: 'outbid', label: 'Terlampaui', highestAmount, isHighestBid };
  }

  countStanding(standing: BidStanding): number {
    return this.rows().filter((r) => r.standing === standing).length;
  }

  actionLabel(row: MyBidRow): string {
    switch (row.standing) {
      case 'outbid':
        return 'Tawar Lagi';
      case 'winning':
      case 'pending':
        return 'Lihat Lot';
      default:
        return 'Lihat Hasil';
    }
  }

  isEndingSoon(row: MyBidRow): boolean {
    const auction = row.bid.auction;
    return auction ? resolveTiming(auction).endingSoon : false;
  }

  minimumFor(row: MyBidRow): number | null {
    const auction = row.bid.auction;
    if (!auction) return null;
    return auction.currentPrice + auction.bidIncrement;
  }

  emptyTitle(): string {
    switch (this.filter()) {
      case 'winning':
        return 'Belum ada lot lelang yang Anda pimpin saat ini';
      case 'outbid':
        return 'Tidak ada tawaran Anda yang terlampaui';
      case 'closed':
        return 'Belum ada lot lelang yang telah selesai';
      default:
        return 'Anda belum memasang tawaran apapun';
    }
  }

  emptyDescription(): string {
    switch (this.filter()) {
      case 'winning':
        return 'Saat penawaran Anda memimpin pada lot lelang yang sedang berlangsung, item tersebut akan ditampilkan di sini.';
      case 'outbid':
        return 'Semua tawaran aktif Anda saat ini masih berada di posisi teratas.';
      case 'closed':
        return 'Lelang yang Anda ikuti dan telah berakhir atau ditarik akan muncul di sini.';
      default:
        return 'Jelajahi lantai lelang untuk menemukan lot industri dan pasang penawaran pertama Anda.';
    }
  }

  setFilter(filter: 'ALL' | 'winning' | 'outbid' | 'closed'): void {
    this.filter.set(filter);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { filter: filter === 'ALL' ? null : filter },
      queryParamsHandling: '',
    });
  }

  setPage(page: number): void {
    this.page.set(page);
    this.reload();
  }

  money(value: number | null | undefined): string {
    return formatAmount(value);
  }

  relative(iso: string): string {
    return formatRelative(iso);
  }

  dateTime(iso: string | null | undefined): string {
    return formatDateTime(iso);
  }
}
