import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { resolveTiming } from '../../core/domain/auction-lifecycle';
import { AuctionStatus } from '../../core/domain/enums';
import { formatAmount, formatDateTime, formatRelative } from '../../core/domain/format';
import { Bid, Paginated } from '../../core/domain/models';
import { AsyncResource } from '../../core/state/async-resource';
import { BidService } from '../../core/services/bid.service';
import { AuctionStatusBadgeComponent } from '../../shared/ui/badge.component';
import { IconComponent } from '../../shared/ui/icon.component';
import { PaginationComponent } from '../../shared/ui/pagination.component';
import {
  EmptyStateComponent,
  ErrorStateComponent,
  TableSkeletonComponent,
} from '../../shared/ui/state-block.component';
import { AlertComponent } from '../../shared/ui/toast.component';

/**
 * Position of the bidder's bid relative to the auction — derived, never assumed.
 *
 * Deliberately there is no "Won" state. The winner is derived by the server from
 * the highest valid bid at the end time, and until the auction has actually
 * ended, the leading bid is only leading.
 */
export type BidStanding = 'winning' | 'outbid' | 'ended' | 'cancelled' | 'pending';

interface MyBidRow {
  bid: Bid;
  standing: BidStanding;
  label: string;
  /** Highest bid on the auction at the time of reading. */
  highestAmount: number | null;
  isHighestBid: boolean;
}

/**
 * My bids.
 *
 * A bidder-centric view of every bid they have placed, grouped by what the bidder
 * needs to do about it. The important distinction the screen makes explicit:
 *
 *   Winning / Highest  — active auction, this bid is currently the highest
 *   Outbid             — active auction, a higher bid exists
 *   Auction ended      — the auction closed; the result is derived from the highest bid
 *   Auction cancelled  — the auction was withdrawn; the bid will not be acted on
 *   Pending            — the auction has not started yet
 *
 * No label anywhere claims the bidder has won before the auction has ended.
 */
@Component({
  selector: 'app-my-bids',
  standalone: true,
  imports: [
    RouterLink,
    AuctionStatusBadgeComponent,
    IconComponent,
    PaginationComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    TableSkeletonComponent,
    AlertComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <header class="page-head">
        <div class="page-head-text">
          <h1 class="page-title">Penawaran Saya</h1>
          <p class="page-subtitle">
            Daftar seluruh tawaran yang telah Anda pasang beserta posisi peringkat Anda pada setiap lot lelang. Penawaran tertinggi sah pada penutupan lelang menentukan pemenang secara transparan.
          </p>
        </div>
        <div class="page-actions">
          <a class="btn btn-primary" routerLink="/marketplace">
            <app-icon name="gavel" [size]="15" />
            <span>Jelajahi Lelang</span>
          </a>
        </div>
      </header>

      <!-- Summary counts derived from the actual bid list -->
      @if (bids.isSuccess()) {
        <div class="stat-grid">
          <div class="stat-card">
            <span class="stat-label">Memimpin Saat Ini</span>
            <span class="stat-value">{{ countStanding('winning') }}</span>
            <span class="stat-foot">Tawaran tertinggi pada lelang aktif</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Terlampaui</span>
            <span class="stat-value">{{ countStanding('outbid') }}</span>
            <span class="stat-foot">Ada tawaran lain lebih tinggi</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Lelang Berakhir</span>
            <span class="stat-value">{{ countStanding('ended') }}</span>
            <span class="stat-foot">Hasil telah ditetapkan server</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Dibatalkan</span>
            <span class="stat-value">{{ countStanding('cancelled') }}</span>
            <span class="stat-foot">Lelang ditarik kembali</span>
          </div>
        </div>
      }

      <div class="tabs" role="tablist">
        <button
          type="button"
          class="tab"
          role="tab"
          [class.is-active]="filter() === 'ALL'"
          [attr.aria-selected]="filter() === 'ALL'"
          (click)="setFilter('ALL')"
        >
          <app-icon name="layers" [size]="14" />
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
          <app-icon name="trending-up" [size]="14" />
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
          <app-icon name="alert" [size]="14" />
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
          <app-icon name="check" [size]="14" />
          <span>Selesai ({{ countStanding('ended') + countStanding('cancelled') }})</span>
        </button>
      </div>

      <div class="card">
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
              icon="trending-up"
              [title]="emptyTitle()"
              [description]="emptyDescription()"
            >
              @if (filter() === 'ALL') {
                <a class="btn btn-primary" routerLink="/marketplace">
                  <app-icon name="gavel" [size]="15" />
                  <span>Jelajahi Lelang</span>
                </a>
              } @else {
                <button type="button" class="btn btn-secondary" (click)="setFilter('ALL')">
                  <app-icon name="refresh" [size]="15" />
                  <span>Tampilkan Semua Tawaran</span>
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
                    <th scope="col">Waktu</th>
                    <th scope="col">Posisi Anda</th>
                    <th scope="col" class="cell-actions">Tindakan</th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of visibleRows(); track row.bid.id) {
                    <tr>
                      <td data-label="Lot Lelang">
                        <span class="cell-primary">
                          {{ row.bid.auction?.product?.name ?? 'Lot Lelang' }}
                        </span>
                        <span class="text-mono-id">{{ row.bid.auction?.product?.code }}</span>
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
                      <td data-label="Waktu">
                        <span class="text-meta">{{ relative(row.bid.createdAt) }}</span>
                      </td>
                      <td data-label="Posisi Anda">
                        <span [class]="'bid-state bid-state-' + stateClass(row.standing)">
                          @if (row.standing === 'winning') {
                            <app-icon name="trending-up" [size]="11" />
                          } @else if (row.standing === 'outbid') {
                            <app-icon name="alert" [size]="11" />
                          } @else if (row.standing === 'cancelled') {
                            <app-icon name="ban" [size]="11" />
                          } @else if (row.standing === 'ended') {
                            <app-icon name="check" [size]="11" />
                          } @else {
                            <app-icon name="clock" [size]="11" />
                          }
                          {{ row.label }}
                        </span>

                        @if (row.standing === 'outbid') {
                          <p class="outbid-hint text-helper">
                            Tawar minimal {{ money(minimumFor(row)) }} untuk merebut kembali peringkat teratas.
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
                              <app-icon name="gavel" [size]="13" />
                            } @else {
                              <app-icon name="eye" [size]="13" />
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

      <app-alert tone="info" title="Penentuan Hasil Pemenang Lelang">
        Penawaran dinyatakan sah jika memenuhi batas minimal saat diterima server secara real-time. Ketika batas waktu lelang berakhir, penawaran sah tertinggi otomatis ditetapkan sebagai pemenang oleh sistem.
      </app-alert>
    </div>
  `,
  styles: [
    `
      .bid-my-amount {
        font-weight: var(--fw-bold);
      }
      .outbid-hint {
        margin-top: var(--sp-1);
      }
      :host ::ng-deep .bid-state app-icon {
        flex-shrink: 0;
      }
    `,
  ],
})
export class MyBidsComponent {
  private readonly bidService = inject(BidService);
  private readonly route = inject(ActivatedRoute);

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
    const filterParam = this.route.snapshot.queryParamMap.get('filter');
    if (filterParam === 'winning' || filterParam === 'outbid' || filterParam === 'closed') {
      this.filter.set(filterParam);
    }
    this.reload();
  }

  reload(): void {
    this.bids.load(this.bidService.listMine({ limit: 50 }), { keepData: true });
  }

  /**
   * Derives the bidder's position from the auction state and the highest bid.
   * This mirrors the server's view; it is a presentation of fact, not a verdict.
   */
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
        label: 'Lelang dibatalkan',
        highestAmount,
        isHighestBid,
      };
    }

    if (auction.status === AuctionStatus.ENDED) {
      return { bid, standing: 'ended', label: 'Lelang berakhir', highestAmount, isHighestBid };
    }

    if (auction.status === AuctionStatus.DRAFT || auction.status === AuctionStatus.SCHEDULED) {
      return { bid, standing: 'pending', label: 'Belum dimulai', highestAmount, isHighestBid };
    }

    // ActiveRecord: either leading, or the window has closed and we await the close.
    if (!resolveTiming(auction).acceptingBids) {
      return { bid, standing: 'pending', label: 'Menunggu penutupan', highestAmount, isHighestBid };
    }

    return isHighestBid
      ? { bid, standing: 'winning', label: 'Tawaran Tertinggi', highestAmount, isHighestBid }
      : { bid, standing: 'outbid', label: 'Terlampaui', highestAmount, isHighestBid };
  }

  countStanding(standing: BidStanding): number {
    return this.rows().filter((r) => r.standing === standing).length;
  }

  stateClass(standing: BidStanding): string {
    switch (standing) {
      case 'winning':
        return 'winning';
      case 'outbid':
        return 'outbid';
      case 'ended':
        return 'ended';
      case 'cancelled':
        return 'cancelled';
      default:
        return 'ended';
    }
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

  /** The minimum the bidder would need to retake the lead. */
  minimumFor(row: MyBidRow): number | null {
    const auction = row.bid.auction;
    if (!auction) return null;
    return auction.currentPrice + auction.bidIncrement;
  }

  emptyTitle(): string {
    switch (this.filter()) {
      case 'winning':
        return 'Belum ada lelang yang Anda pimpin saat ini';
      case 'outbid':
        return 'Tidak ada tawaran Anda yang terlampaui';
      case 'closed':
        return 'Belum ada lelang yang telah selesai';
      default:
        return 'Anda belum memasang tawaran apapun';
    }
  }

  emptyDescription(): string {
    switch (this.filter()) {
      case 'winning':
        return 'Saat tawaran Anda memimpin pada lelang yang sedang berlangsung, lot tersebut akan tampil di sini.';
      case 'outbid':
        return 'Semua tawaran aktif Anda saat ini masih berada di posisi teratas.';
      case 'closed':
        return 'Lelang yang Anda ikuti dan telah berakhir atau dibatalkan akan muncul di sini.';
      default:
        return 'Jelajahi marketplace untuk menemukan lot lelang aktif dan mulai memasang tawaran pertama Anda.';
    }
  }

  setFilter(filter: 'ALL' | 'winning' | 'outbid' | 'closed'): void {
    this.filter.set(filter);
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
