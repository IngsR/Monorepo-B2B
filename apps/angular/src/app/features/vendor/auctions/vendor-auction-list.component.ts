import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { resolveTiming, transitionsFrom } from '../../../core/domain/auction-lifecycle';
import { AuctionStatus, DEFAULT_PAGE_SIZE } from '../../../core/domain/enums';
import { formatAmount, formatDateTime } from '../../../core/domain/format';
import { Auction, AuctionQuery, Paginated } from '../../../core/domain/models';
import { AuctionService } from '../../../core/services/auction.service';
import { AsyncResource } from '../../../core/state/async-resource';
import { AuctionStatusBadgeComponent } from '../../../shared/ui/badge.component';
import { CountdownComponent } from '../../../shared/ui/countdown.component';
import { IconComponent } from '../../../shared/ui/icon.component';
import { PaginationComponent } from '../../../shared/ui/pagination.component';
import {
  EmptyStateComponent,
  ErrorStateComponent,
  TableSkeletonComponent,
} from '../../../shared/ui/state-block.component';

/**
 * My auctions.
 *
 * Lists only the auctions owned by the signed-in vendor, with the lifecycle
 * state as the primary column and the set of legal actions shown inline. The
 * action buttons come from the same transition table the management screen uses,
 * so the two screens can never disagree about what is permitted.
 *
 * A vendor editing another vendor's auction is structurally impossible here:
 * `/auctions/mine` is scoped by the authenticated identity.
 */
@Component({
  selector: 'app-vendor-auction-list',
  standalone: true,
  imports: [
    RouterLink,
    AuctionStatusBadgeComponent,
    CountdownComponent,
    IconComponent,
    PaginationComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    TableSkeletonComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <header class="page-head">
        <div class="page-head-text">
          <h1 class="page-title">My auctions</h1>
          <p class="page-subtitle">
            Every auction you own, with the lifecycle actions available in its current state. A new
            auction starts as a draft and must be scheduled before it can run.
          </p>
        </div>
        <div class="page-actions">
          <a class="btn btn-primary" routerLink="/vendor/auctions/new">
            <app-icon name="plus" [size]="15" />
            New auction
          </a>
        </div>
      </header>

      <div class="toolbar">
        <div class="toolbar-field toolbar-grow">
          <label class="form-label" for="auction-search">Search</label>
          <input
            id="auction-search"
            type="search"
            class="form-input"
            placeholder="Search by lot name or product code"
            [value]="searchInput()"
            (input)="onSearchInput($event)"
          />
        </div>
        <div class="toolbar-field">
          <label class="form-label" for="auction-status">Status</label>
          <select
            id="auction-status"
            class="form-select"
            [value]="statusFilter()"
            (change)="setStatus($event)"
          >
            <option value="ALL">All statuses</option>
            <option [value]="AuctionStatus.DRAFT">Draft</option>
            <option [value]="AuctionStatus.SCHEDULED">Scheduled</option>
            <option [value]="AuctionStatus.ACTIVE">Active</option>
            <option [value]="AuctionStatus.ENDED">Ended</option>
            <option [value]="AuctionStatus.CANCELLED">Cancelled</option>
          </select>
        </div>
        <div class="toolbar-field">
          <label class="form-label" for="auction-sort">Sort by</label>
          <select
            id="auction-sort"
            class="form-select"
            [value]="orderBy()"
            (change)="setOrderBy($event)"
          >
            <option value="endingSoon">Closing soonest</option>
            <option value="newest">Newest first</option>
            <option value="priceDesc">Highest price</option>
            <option value="mostBids">Most bids</option>
          </select>
        </div>
        <div class="toolbar-field toolbar-reset">
          <button
            type="button"
            class="btn btn-secondary"
            (click)="reload()"
            [disabled]="auctions.isLoading()"
          >
            <app-icon name="refresh" [size]="15" />
            Refresh
          </button>
        </div>
      </div>

      <div class="card">
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
              [title]="hasFilters() ? 'No auctions match these filters' : 'No auctions yet'"
              [description]="
                hasFilters()
                  ? 'Try clearing the status filter or searching for a different lot.'
                  : 'Create an auction against one of your products. It will start as a draft.'
              "
            >
              @if (hasFilters()) {
                <button type="button" class="btn btn-secondary" (click)="clearFilters()">
                  Clear filters
                </button>
              } @else {
                <a class="btn btn-primary" routerLink="/vendor/auctions/new">Create an auction</a>
              }
            </app-empty-state>
          }
          @default {
            <div class="table-scroll">
              <table class="data-table data-table--stacked">
                <thead>
                  <tr>
                    <th scope="col">Lot</th>
                    <th scope="col">Status</th>
                    <th scope="col">Timing</th>
                    <th scope="col" class="col-numeric">Current price</th>
                    <th scope="col" class="col-numeric">Bids</th>
                    <th scope="col" class="cell-actions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  @for (auction of auctionList(); track auction.id) {
                    <tr>
                      <td data-label="Lot">
                        <span class="cell-primary">{{ auction.product?.name ?? 'Untitled' }}</span>
                        <span class="text-mono-id">{{ auction.product?.code }}</span>
                      </td>
                      <td data-label="Status">
                        <app-auction-status-badge
                          [status]="auction.status"
                          [endingSoon]="isEndingSoon(auction)"
                          size="sm"
                        />
                      </td>
                      <td data-label="Timing">
                        @if (auction.status === AuctionStatus.ACTIVE && !isWindowClosed(auction)) {
                          <app-countdown [target]="auction.endTime" prefix="closes" size="sm" />
                        } @else if (auction.status === AuctionStatus.SCHEDULED) {
                          <span class="text-meta">Opens {{ startLabel(auction) }}</span>
                        } @else if (
                          isWindowClosed(auction) && auction.status === AuctionStatus.ACTIVE
                        ) {
                          <span class="badge badge-warning">Window closed · awaiting close</span>
                        } @else {
                          <span class="text-meta">Ends {{ endLabel(auction) }}</span>
                        }
                      </td>
                      <td data-label="Current price" class="col-numeric">
                        <span class="text-numeric">{{ price(auction.currentPrice) }}</span>
                      </td>
                      <td data-label="Bids" class="col-numeric">
                        <span class="text-numeric">{{ auction.bidCount }}</span>
                      </td>
                      <td data-label="Actions" class="cell-actions">
                        <div class="row-actions">
                          <a
                            class="btn btn-secondary btn-sm"
                            [routerLink]="['/vendor/auctions', auction.id]"
                          >
                            Manage
                          </a>
                          <a
                            class="btn btn-ghost btn-sm"
                            [routerLink]="['/marketplace', auction.id]"
                          >
                            View
                          </a>
                        </div>
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
    </div>
  `,
  styles: [
    `
      .row-actions {
        display: inline-flex;
        gap: var(--sp-1);
        justify-content: flex-end;
      }
      .toolbar-reset {
        justify-content: flex-end;
      }
    `,
  ],
})
export class VendorAuctionListComponent {
  private readonly auctionService = inject(AuctionService);

  protected readonly AuctionStatus = AuctionStatus;

  readonly auctions = new AsyncResource<Paginated<Auction>>();

  readonly searchInput = signal('');
  readonly statusFilter = signal<AuctionStatus | 'ALL'>('ALL');
  readonly orderBy = signal<NonNullable<AuctionQuery['orderBy']>>('endingSoon');
  readonly page = signal(1);

  readonly auctionList = computed(() => this.auctions.data()?.items ?? []);
  readonly meta = computed(
    () =>
      this.auctions.data()?.meta ?? { total: 0, page: 1, limit: DEFAULT_PAGE_SIZE, totalPages: 1 },
  );

  readonly hasFilters = computed(() => !!this.searchInput() || this.statusFilter() !== 'ALL');

  constructor() {
    this.reload();
  }

  reload(): void {
    this.auctions.load(
      this.auctionService.listMine({
        page: this.page(),
        limit: DEFAULT_PAGE_SIZE,
        search: this.searchInput() || undefined,
        status: this.statusFilter(),
        orderBy: this.orderBy(),
      }),
      { keepData: true },
    );
  }

  private searchTimer?: ReturnType<typeof setTimeout>;

  onSearchInput(event: Event): void {
    this.searchInput.set((event.target as HTMLInputElement).value);
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.page.set(1);
      this.reload();
    }, 350);
  }

  setStatus(event: Event): void {
    this.statusFilter.set((event.target as HTMLSelectElement).value as AuctionStatus | 'ALL');
    this.page.set(1);
    this.reload();
  }

  setOrderBy(event: Event): void {
    this.orderBy.set(
      (event.target as HTMLSelectElement).value as NonNullable<AuctionQuery['orderBy']>,
    );
    this.page.set(1);
    this.reload();
  }

  setPage(page: number): void {
    this.page.set(page);
    this.reload();
  }

  clearFilters(): void {
    this.searchInput.set('');
    this.statusFilter.set('ALL');
    this.page.set(1);
    this.reload();
  }

  isWindowClosed(auction: Auction): boolean {
    return resolveTiming(auction).clockExpired;
  }

  isEndingSoon(auction: Auction): boolean {
    return resolveTiming(auction).endingSoon;
  }

  /** Number of lifecycle actions available — shown so inactive rows are self-explanatory. */
  actionCount(auction: Auction): number {
    return transitionsFrom(auction.status).length;
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
