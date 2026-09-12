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
          <h1 class="page-title">My bids</h1>
          <p class="page-subtitle">
            Every bid you have placed, with your current position on each auction. The highest valid
            bid at the end time determines the outcome — that result is derived by the platform, not
            decided here.
          </p>
        </div>
        <div class="page-actions">
          <a class="btn btn-primary" routerLink="/marketplace">
            <app-icon name="gavel" [size]="15" />
            Browse auctions
          </a>
        </div>
      </header>

      <!-- Summary counts derived from the actual bid list -->
      @if (bids.isSuccess()) {
        <div class="stat-grid">
          <div class="stat-card">
            <span class="stat-label">Currently highest</span>
            <span class="stat-value">{{ countStanding('winning') }}</span>
            <span class="stat-foot">Leading on active auctions</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Outbid</span>
            <span class="stat-value">{{ countStanding('outbid') }}</span>
            <span class="stat-foot">A higher bid exists</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Ended</span>
            <span class="stat-value">{{ countStanding('ended') }}</span>
            <span class="stat-foot">Result already derived</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Cancelled</span>
            <span class="stat-value">{{ countStanding('cancelled') }}</span>
            <span class="stat-foot">Auction withdrawn</span>
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
          All bids ({{ rows().length }})
        </button>
        <button
          type="button"
          class="tab"
          role="tab"
          [class.is-active]="filter() === 'winning'"
          [attr.aria-selected]="filter() === 'winning'"
          (click)="setFilter('winning')"
        >
          Highest ({{ countStanding('winning') }})
        </button>
        <button
          type="button"
          class="tab"
          role="tab"
          [class.is-active]="filter() === 'outbid'"
          [attr.aria-selected]="filter() === 'outbid'"
          (click)="setFilter('outbid')"
        >
          Outbid ({{ countStanding('outbid') }})
        </button>
        <button
          type="button"
          class="tab"
          role="tab"
          [class.is-active]="filter() === 'closed'"
          [attr.aria-selected]="filter() === 'closed'"
          (click)="setFilter('closed')"
        >
          Closed ({{ countStanding('ended') + countStanding('cancelled') }})
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
                <a class="btn btn-primary" routerLink="/marketplace">Find an auction</a>
              } @else {
                <button type="button" class="btn btn-secondary" (click)="setFilter('ALL')">
                  Show all bids
                </button>
              }
            </app-empty-state>
          }
          @default {
            <div class="table-scroll">
              <table class="data-table data-table--stacked">
                <thead>
                  <tr>
                    <th scope="col">Auction</th>
                    <th scope="col">Status</th>
                    <th scope="col" class="col-numeric">Your bid</th>
                    <th scope="col" class="col-numeric">Highest bid</th>
                    <th scope="col">Placed</th>
                    <th scope="col">Your position</th>
                    <th scope="col" class="cell-actions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of visibleRows(); track row.bid.id) {
                    <tr>
                      <td data-label="Auction">
                        <span class="cell-primary">
                          {{ row.bid.auction?.product?.name ?? 'Auction' }}
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
                      <td data-label="Your bid" class="col-numeric">
                        <span class="text-numeric bid-my-amount">{{ money(row.bid.amount) }}</span>
                      </td>
                      <td data-label="Highest bid" class="col-numeric">
                        <span class="text-numeric">{{ money(row.highestAmount) }}</span>
                      </td>
                      <td data-label="Placed">
                        <span class="text-meta">{{ relative(row.bid.createdAt) }}</span>
                      </td>
                      <td data-label="Your position">
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
                            Bid at least {{ money(minimumFor(row)) }} to retake the lead.
                          </p>
                        }
                      </td>
                      <td data-label="Actions" class="cell-actions">
                        @if (row.bid.auction; as auction) {
                          <a
                            class="btn btn-sm"
                            [class.btn-primary]="row.standing === 'outbid'"
                            [class.btn-secondary]="row.standing !== 'outbid'"
                            [routerLink]="['/marketplace', auction.id]"
                          >
                            {{ actionLabel(row) }}
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

      <app-alert tone="info" title="How results are determined">
        A bid is only valid if it meets the minimum for the auction at the moment the server
        receives it. When the auction ends, the highest valid bid determines the outcome. The
        platform derives that result — there is no separate winner record, and a leading bid before
        the close is not a win.
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
        label: 'Auction unavailable',
        highestAmount,
        isHighestBid,
      };
    }

    if (auction.status === AuctionStatus.CANCELLED) {
      return {
        bid,
        standing: 'cancelled',
        label: 'Auction cancelled',
        highestAmount,
        isHighestBid,
      };
    }

    if (auction.status === AuctionStatus.ENDED) {
      return { bid, standing: 'ended', label: 'Auction ended', highestAmount, isHighestBid };
    }

    if (auction.status === AuctionStatus.DRAFT || auction.status === AuctionStatus.SCHEDULED) {
      return { bid, standing: 'pending', label: 'Not started', highestAmount, isHighestBid };
    }

    // ActiveRecord: either leading, or the window has closed and we await the close.
    if (!resolveTiming(auction).acceptingBids) {
      return { bid, standing: 'pending', label: 'Awaiting close', highestAmount, isHighestBid };
    }

    return isHighestBid
      ? { bid, standing: 'winning', label: 'Highest bid', highestAmount, isHighestBid }
      : { bid, standing: 'outbid', label: 'Outbid', highestAmount, isHighestBid };
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
        return 'Bid again';
      case 'winning':
      case 'pending':
        return 'View auction';
      default:
        return 'View result';
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
        return 'You are not leading any auctions';
      case 'outbid':
        return 'You have not been outbid';
      case 'closed':
        return 'No closed auctions yet';
      default:
        return 'You have not placed any bids';
    }
  }

  emptyDescription(): string {
    switch (this.filter()) {
      case 'winning':
        return 'When your bid is the highest on a live auction, it will appear here.';
      case 'outbid':
        return 'All of your active bids are currently the highest.';
      case 'closed':
        return 'Auctions you bid on that have ended or been cancelled will appear here.';
      default:
        return 'Browse the marketplace to find an active auction and place your first bid.';
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
