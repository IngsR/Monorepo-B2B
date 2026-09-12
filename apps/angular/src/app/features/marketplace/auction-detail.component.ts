import { TitleCasePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { ApiFailure } from '../../core/domain/api-failure';
import {
  AuctionTiming,
  CLOSED_TIMING,
  minimumNextBid,
  resolveTiming,
} from '../../core/domain/auction-lifecycle';
import { AuctionStatus } from '../../core/domain/enums';
import { formatAmount, formatDateTime, formatDuration } from '../../core/domain/format';
import { Auction, Bid, Paginated } from '../../core/domain/models';
import { AuctionService } from '../../core/services/auction.service';
import { BidService } from '../../core/services/bid.service';
import { NotificationService } from '../../core/services/notification.service';
import { AuthService } from '../../core/services/session.service';
import { AsyncResource } from '../../core/state/async-resource';
import { AuctionLifecycleComponent } from '../../shared/ui/auction-lifecycle.component';
import { AuctionStatusBadgeComponent } from '../../shared/ui/badge.component';
import { BidHistoryComponent } from '../../shared/ui/bid-history.component';
import { CountdownComponent } from '../../shared/ui/countdown.component';
import { IconComponent } from '../../shared/ui/icon.component';
import { BreadcrumbsComponent, Crumb } from '../../shared/ui/pagination.component';
import { PriceComponent } from '../../shared/ui/price.component';
import {
  DetailSkeletonComponent,
  ErrorStateComponent,
} from '../../shared/ui/state-block.component';
import { AlertComponent } from '../../shared/ui/toast.component';
import { BidPanelComponent } from './bid-panel.component';

/**
 * Auction detail — the primary bidding experience.
 *
 * Layout: a two-column grid with the lot information on the left and a sticky
 * bidding panel on the right. Below 1180px the panel moves into the flow but
 * stays first in reading order, so the price and bid form are above the fold on
 * a phone.
 *
 * The page distinguishes four concepts that are easy to conflate:
 *  - the recorded status (shown as a badge)
 *  - the bidding window (driven by startTime/endTime, shown as a countdown)
 *  - the lifecycle path (the indicator, with the legal transitions)
 *  - authorization (who may bid, who may manage)
 */
@Component({
  selector: 'app-auction-detail',
  standalone: true,
  imports: [
    RouterLink,
    TitleCasePipe,
    AuctionLifecycleComponent,
    AuctionStatusBadgeComponent,
    BidHistoryComponent,
    BreadcrumbsComponent,
    CountdownComponent,
    IconComponent,
    PriceComponent,
    DetailSkeletonComponent,
    ErrorStateComponent,
    AlertComponent,
    BidPanelComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-breadcrumbs [items]="crumbs()" />

      @switch (true) {
        @case (auction.isLoading() && !auction.data()) {
          <app-detail-skeleton />
        }

        @case (auction.hasError()) {
          <div class="card">
            @if (auction.error(); as failure) {
              <app-error-state
                [failure]="failure"
                [retrying]="auction.isLoading()"
                (retry)="reload()"
              >
                <a class="btn btn-secondary" routerLink="/marketplace">Back to marketplace</a>
              </app-error-state>
            }
          </div>
        }

        @case (true) {
          @let auctionData = data()!;
          <!-- Header -->
          <header class="page-head detail-head">
            <div class="page-head-text">
              <div class="detail-eyebrow">
                <app-auction-status-badge
                  [status]="auctionData.status"
                  [endingSoon]="timing().endingSoon"
                />
                @if (auctionData.product?.category; as category) {
                  <span class="badge badge-plain">{{ category.name }}</span>
                }
                <span class="text-mono-id">{{ auctionData.product?.code }}</span>
              </div>
              <h1 class="detail-title">{{ productName() }}</h1>
              <p class="detail-vendor">
                <app-icon name="building" [size]="14" />
                <span>Offered by {{ vendorName() }}</span>
              </p>
            </div>

            <div class="page-actions">
              <!-- Management entry point appears only for the owning vendor or an admin -->
              @if (canManage()) {
                <a class="btn btn-secondary" [routerLink]="['/vendor/auctions', auctionData.id]">
                  <app-icon name="edit" [size]="15" />
                  Manage auction
                </a>
              }
              <a class="btn btn-secondary" routerLink="/marketplace">
                <app-icon name="chevron-left" [size]="15" />
                Marketplace
              </a>
            </div>
          </header>

          <!-- Recorded status vs. bidding window -->
          @if (statusWindowMismatch()) {
            <app-alert tone="warning" title="Recorded status and bidding window differ">
              This auction is recorded as <strong>{{ auctionData.status | titlecase }}</strong
              >, but its published end time has already passed. Bidding is closed; the auction
              remains open on the record until an authorised user closes it.
            </app-alert>
          }

          <div class="auction-detail-grid">
            <!-- Main column -->
            <div class="auction-detail-main">
              <!-- Gallery -->
              <div class="gallery">
                <div class="gallery-main">
                  <span class="auction-card-status">
                    <app-auction-status-badge
                      [status]="auctionData.status"
                      [endingSoon]="timing().endingSoon"
                    />
                  </span>
                  <div class="auction-card-media-fallback">
                    <div class="media-placeholder">
                      <app-icon name="image" [size]="34" />
                      <p class="state-description">
                        Product photography is not published for this lot. Technical details and
                        vendor information are listed below.
                      </p>
                    </div>
                  </div>
                </div>

                <!-- Thumbnail rail: real thumbnails once the API exposes media. -->
                <div class="gallery-rail" aria-hidden="true">
                  @for (i of gallerySlots; track i) {
                    <span class="auction-thumb" [class.is-active]="i === 0">
                      <span class="auction-card-media-fallback">
                        <app-icon name="image" [size]="16" />
                      </span>
                    </span>
                  }
                </div>
              </div>

              <!-- Key facts strip -->
              <div class="card fact-strip">
                <div class="fact">
                  <span class="fact-icon"><app-icon name="gavel" [size]="16" /></span>
                  <div class="fact-body">
                    <span class="fact-label">Current price</span>
                    <span class="fact-value text-numeric">{{ amountLabel(auctionData.currentPrice) }}</span>
                  </div>
                </div>
                <div class="fact">
                  <span class="fact-icon"><app-icon name="trending-up" [size]="16" /></span>
                  <div class="fact-body">
                    <span class="fact-label">Minimum next bid</span>
                    <span class="fact-value text-numeric">{{ minimumLabel() }}</span>
                  </div>
                </div>
                <div class="fact">
                  <span class="fact-icon"><app-icon name="users" [size]="16" /></span>
                  <div class="fact-body">
                    <span class="fact-label">Total bids</span>
                    <span class="fact-value text-numeric">{{ auctionData.bidCount }}</span>
                  </div>
                </div>
                <div class="fact">
                  <span class="fact-icon"><app-icon name="clock" [size]="16" /></span>
                  <div class="fact-body">
                    <span class="fact-label">
                      {{ auctionData.status === AuctionStatus.ACTIVE ? 'Closes' : 'Ends' }}
                    </span>
                    <span class="fact-value">{{ endLabel() }}</span>
                  </div>
                </div>
              </div>

              <!-- Price summary, repeated here for scanning on mobile -->
              <div class="card card-body detail-price-strip hide-desktop">
                <app-price [amount]="auctionData.currentPrice" label="Current price" size="lg" />
                <div class="detail-price-figures">
                  <div class="meta-item">
                    <span class="price-label">Minimum next bid</span>
                    <span class="meta-value text-numeric">{{ minimumLabel() }}</span>
                  </div>
                  <div class="meta-item">
                    <span class="price-label">Bid increment</span>
                    <span class="meta-value text-numeric">{{ incrementLabel() }}</span>
                  </div>
                </div>
              </div>

              <!-- Schedule & terms -->
              <section class="card">
                <div class="card-header">
                  <h2 class="section-heading">Schedule & terms</h2>
                  @if (auctionData.status === AuctionStatus.ACTIVE && timing().acceptingBids) {
                    <app-countdown [target]="auctionData.endTime" prefix="closes" size="md" />
                  }
                </div>
                <div class="card-body">
                  <div class="spec-list">
                    <div class="spec-item">
                      <span class="spec-item-label">Opening time</span>
                      <span class="spec-item-value">{{ startLabel() }}</span>
                    </div>
                    <div class="spec-item">
                      <span class="spec-item-label">Closing time</span>
                      <span class="spec-item-value">{{ endLabel() }}</span>
                    </div>
                    <div class="spec-item">
                      <span class="spec-item-label">Starting price</span>
                      <span class="spec-item-value text-numeric">{{ startingLabel() }}</span>
                    </div>
                    <div class="spec-item">
                      <span class="spec-item-label">Bid increment</span>
                      <span class="spec-item-value text-numeric">{{ incrementLabel() }}</span>
                    </div>
                    <div class="spec-item">
                      <span class="spec-item-label">Duration</span>
                      <span class="spec-item-value">{{ durationLabel() }}</span>
                    </div>
                    <div class="spec-item">
                      <span class="spec-item-label">Recorded status</span>
                      <span class="spec-item-value">{{ auctionData.status | titlecase }}</span>
                    </div>
                  </div>
                </div>
              </section>

              <!-- Product information -->
              <section class="card">
                <div class="card-header">
                  <h2 class="section-heading">Product information</h2>
                  @if (auctionData.product?.category; as category) {
                    <span class="badge badge-plain">{{ category.name }}</span>
                  }
                </div>
                <div class="card-body stack">
                  <div class="spec-list">
                    <div class="spec-item">
                      <span class="spec-item-label">Product code</span>
                      <span class="spec-item-value text-numeric">{{
                        auctionData.product?.code ?? '—'
                      }}</span>
                    </div>
                    <div class="spec-item">
                      <span class="spec-item-label">Category</span>
                      <span class="spec-item-value">{{
                        auctionData.product?.category?.name ?? '—'
                      }}</span>
                    </div>
                    <div class="spec-item">
                      <span class="spec-item-label">Listing ID</span>
                      <span class="spec-item-value text-mono-id">{{ auctionData.id }}</span>
                    </div>
                  </div>

                  @if (auctionData.product?.description) {
                    <div>
                      <p class="price-label description-label">Description</p>
                      <p class="detail-description">{{ auctionData.product.description }}</p>
                    </div>
                  } @else {
                    <p class="text-helper">
                      The vendor has not published a description for this lot. Review the schedule
                      and terms above before bidding.
                    </p>
                  }
                </div>
              </section>

              <!-- Vendor -->
              <section class="card">
                <div class="card-header">
                  <h2 class="section-heading">Offered by</h2>
                </div>
                <div class="card-body">
                  <div class="seller-card">
                    <span class="seller-avatar">{{ vendorInitials() }}</span>
                    <div class="seller-meta">
                      <span class="seller-name">{{ vendorName() }}</span>
                      <span class="text-helper">Verified vendor · listing this lot on BidForge</span>
                    </div>
                  </div>
                </div>
              </section>

              <!-- How bidding works -->
              <section class="card">
                <div class="card-header">
                  <h2 class="section-heading">How this auction works</h2>
                </div>
                <div class="card-body">
                  <ol class="process-list">
                    <li class="process-step">
                      <span class="process-index">1</span>
                      <div class="process-text">
                        <p class="process-title">Place a bid at or above the minimum</p>
                        <p class="process-copy">
                          Every bid must clear the current price plus the increment. The server
                          re-checks this when your bid arrives.
                        </p>
                      </div>
                    </li>
                    <li class="process-step">
                      <span class="process-index">2</span>
                      <div class="process-text">
                        <p class="process-title">The price moves only on a valid higher bid</p>
                        <p class="process-copy">
                          If the price changes before your bid is accepted, the bid is refused and
                          the new minimum is shown immediately.
                        </p>
                      </div>
                    </li>
                    <li class="process-step">
                      <span class="process-index">3</span>
                      <div class="process-text">
                        <p class="process-title">The highest valid bid at the close determines the outcome</p>
                        <p class="process-copy">
                          The result is derived from the bid history at the published end time — no
                          winner is declared before the auction closes.
                        </p>
                      </div>
                    </li>
                  </ol>
                </div>
              </section>

              <!-- Highest bid -->
              @if (highestBid(); as top) {
                <section class="card">
                  <div class="card-header">
                    <h2 class="section-heading">Highest bid</h2>
                    <span class="badge badge-active">
                      <span class="status-dot status-dot-pulse"></span>
                      {{ auctionData.status === AuctionStatus.ENDED ? 'Final' : 'Leading' }}
                    </span>
                  </div>
                  <div class="card-body">
                    <div class="bid-summary">
                      <div class="meta-item">
                        <span class="price-label">Amount</span>
                        <span class="meta-value text-numeric">{{ amountLabel(top.amount) }}</span>
                      </div>
                      @if (top.bidderCompanyName) {
                        <div class="meta-item">
                          <span class="price-label">Bidder</span>
                          <span class="meta-value">{{ top.bidderCompanyName }}</span>
                        </div>
                      }
                      <div class="meta-item">
                        <span class="price-label">Placed</span>
                        <span class="meta-value">{{ placedLabel(top.createdAt) }}</span>
                      </div>
                    </div>
                    <p class="text-helper highest-note">
                      The highest valid bid at the end time determines the outcome. The server
                      derives the result — no winner is recorded separately, and no winner is
                      declared before the auction closes.
                    </p>
                  </div>
                </section>
              }

              <!-- Bid history -->
              <section class="card">
                <div class="card-header">
                  <h2 class="section-heading">Bid history</h2>
                  <span class="badge badge-plain">
                    {{ auctionData.bidCount }} {{ auctionData.bidCount === 1 ? 'bid' : 'bids' }}
                  </span>
                </div>
                @if (bids.isLoading() && !bids.data()) {
                  <div class="card-body stack-sm">
                    @for (i of skeletonRows; track i) {
                      <div class="skeleton skeleton-text" style="height: 34px"></div>
                    }
                  </div>
                } @else if (bids.hasError()) {
                  @if (bids.error(); as failure) {
                    <app-error-state
                      [failure]="failure"
                      [retrying]="bids.isLoading()"
                      (retry)="reloadBids()"
                    />
                  }
                } @else {
                  <app-bid-history
                    [bids]="bidList()"
                    [currentBidderId]="currentBidderId()"
                    sort="highest"
                    [auctionEnded]="auctionData.status === AuctionStatus.ENDED"
                  />
                }
              </section>

              <!-- Lifecycle -->
              <section class="card">
                <div class="card-header">
                  <h2 class="section-heading">Auction lifecycle</h2>
                </div>
                <div class="card-body">
                  <app-auction-lifecycle [auction]="auctionData" variant="full" />
                </div>
              </section>
            </div>

            <!-- Bidding panel -->
            <app-bid-panel
              [auction]="auctionData"
              [submitting]="bidding()"
              [failure]="bidFailure()"
              (formValue)="placeBid($event)"
            />
          </div>
        }
      }
    </div>
  `,
  styles: [
    `
      .detail-head {
        align-items: flex-start;
      }
      .detail-eyebrow {
        display: flex;
        align-items: center;
        gap: var(--sp-3);
        flex-wrap: wrap;
        margin-bottom: var(--sp-3);
      }
      .detail-title {
        font-size: var(--fs-2xl);
        font-weight: var(--fw-bold);
        letter-spacing: var(--tracking-tight);
        line-height: var(--lh-snug);
        max-width: 42ch;
      }
      .detail-vendor {
        display: flex;
        align-items: center;
        gap: var(--sp-2);
        margin-top: var(--sp-3);
        font-size: var(--fs-base);
        color: var(--c-text-secondary);
      }
      .detail-price-strip {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: var(--sp-6);
        flex-wrap: wrap;
      }
      .detail-price-figures {
        display: flex;
        gap: var(--sp-7);
        flex-wrap: wrap;
      }
      .description-label {
        margin-bottom: var(--sp-2);
      }
      .detail-description {
        font-size: var(--fs-base);
        color: var(--c-text-secondary);
        line-height: var(--lh-normal);
        max-width: 78ch;
      }
      .highest-note {
        margin-top: var(--sp-4);
        max-width: 78ch;
      }
      .media-placeholder {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: var(--sp-3);
        padding: var(--sp-8);
        text-align: center;
        color: var(--c-text-muted);
      }
      .media-placeholder .state-description {
        max-width: 36ch;
      }
      /* The mobile price strip is a duplicate of the sticky panel on desktop. */
      @media (min-width: 1181px) {
        .hide-desktop { display: none; }
      }
    `,
  ],
})
export class AuctionDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly auctionService = inject(AuctionService);
  private readonly bidService = inject(BidService);
  private readonly auth = inject(AuthService);
  private readonly notifications = inject(NotificationService);

  protected readonly AuctionStatus = AuctionStatus;
  protected readonly skeletonRows = Array.from({ length: 4 }, (_, i) => i);
  /** Placeholder thumbnail slots until the API exposes product media. */
  protected readonly gallerySlots = Array.from({ length: 4 }, (_, i) => i);

  readonly auction = new AsyncResource<Auction>();
  readonly bids = new AsyncResource<Paginated<Bid>>();
  readonly bidding = signal(false);
  readonly bidFailure = signal<ApiFailure | null>(null);

  readonly data = computed(() => this.auction.data());
  readonly bidList = computed(() => this.bids.data()?.items ?? []);

  /**
   * The auction id, tracked as a signal rather than read once from the route
   * snapshot. Angular reuses the component when navigating between two
   * `/marketplace/:id` URLs, so a constructor-only read would leave the previous
   * auction's data on screen.
   */
  private readonly auctionId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('id') ?? '')),
    { initialValue: this.route.snapshot.paramMap.get('id') ?? '' },
  );

  constructor() {
    // Reload whenever the id changes, including the first resolution.
    effect(() => {
      const id = this.auctionId();
      if (id) this.reload(id);
    });
  }

  /**
   * Timing for the loaded auction. Returns a neutral "not open" shape before
   * the record arrives so the template never needs a null check.
   */
  readonly timing = computed<AuctionTiming>(() => {
    const auction = this.data();
    if (!auction) return CLOSED_TIMING;
    return resolveTiming(auction);
  });

  readonly productName = computed(() => this.data()?.product?.name ?? 'Auction lot');
  readonly vendorName = computed(() => this.data()?.vendor?.companyName ?? 'Unknown vendor');

  readonly vendorInitials = computed(() => {
    const name = this.vendorName();
    return name
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word[0])
      .join('')
      .toUpperCase();
  });

  /** Elapsed/planned window length, derived from start and end times. */
  readonly durationLabel = computed(() => {
    const auction = this.data();
    if (!auction) return '—';
    const ms = new Date(auction.endTime).getTime() - new Date(auction.startTime).getTime();
    if (ms <= 0) return '—';
    return formatDuration(ms);
  });

  readonly minimumLabel = computed(() => {
    const auction = this.data();
    return auction ? formatAmount(minimumNextBid(auction)) : '—';
  });

  readonly incrementLabel = computed(() =>
    this.data() ? formatAmount(this.data()!.bidIncrement) : '—',
  );

  readonly startingLabel = computed(() =>
    this.data() ? formatAmount(this.data()!.startingPrice) : '—',
  );

  readonly startLabel = computed(() => formatDateTime(this.data()?.startTime));
  readonly endLabel = computed(() => formatDateTime(this.data()?.endTime));

  readonly highestBid = computed(() => {
    const list = this.bidList();
    if (list.length === 0) return null;
    return [...list].sort((a, b) => b.amount - a.amount)[0];
  });

  readonly currentBidderId = computed(() => this.auth.bidder()?.id ?? null);

  /**
   * True when the recorded status says ACTIVE but the bidding window has closed.
   * The two are genuinely different facts and the UI must not paper over it.
   */
  readonly statusWindowMismatch = computed(
    () => this.timing().status === AuctionStatus.ACTIVE && this.timing().clockExpired,
  );

  /**
   * Management controls appear only for an administrator or the vendor that owns
   * the auction. A vendor inspecting another vendor's auction sees the same
   * read-only view as a bidder.
   */
  readonly canManage = computed(() => {
    const auction = this.data();
    if (!auction) return false;
    if (this.auth.isAdmin()) return true;
    if (!this.auth.isVendor()) return false;
    return this.auth.vendor()?.id === auction.vendorId;
  });

  readonly crumbs = computed<Crumb[]>(() => [
    { label: 'Marketplace', link: '/marketplace' },
    { label: this.productName() },
  ]);

  reload(id: string = this.auctionId()): void {
    this.auction.load(this.auctionService.getById(id));
    this.reloadBids(id);
  }

  reloadBids(id: string = this.auctionId()): void {
    this.bids.load(this.auctionService.listBids(id, { sort: 'highest', limit: 50 }));
  }

  amountLabel(value: number): string {
    return formatAmount(value);
  }

  placedLabel(iso: string): string {
    return formatDateTime(iso);
  }

  /**
   * Places a bid. Only the amount is sent — the bidder identity comes from the
   * JWT. A 409 means the price moved; the auction and history are refetched so
   * the user immediately sees the real minimum.
   */
  placeBid(amount: number): void {
    this.bidding.set(true);
    this.bidFailure.set(null);

    this.bidService.placeBid(this.auctionId(), { amount }).subscribe({
      next: (bid) => {
        this.bidding.set(false);
        this.notifications.success(
          'Bid accepted',
          `Your bid of ${formatAmount(bid.amount)} is currently the highest.`,
        );
        this.reload();
      },
      error: (error: unknown) => {
        this.bidding.set(false);
        const failure = this.bidFailureFrom(error);

        // A refused bid means the client's view of the price is stale.
        if (failure) {
          this.reload();
        }
      },
    });
  }

  private bidFailureFrom(error: unknown): ApiFailure | null {
    const failure =
      (error as { error?: unknown }) !== undefined
        ? // Normalise through the shared mapper so the message stays human-readable.
          ((): ApiFailure => {
            const e = error as { status?: number; error?: { message?: string; code?: string } };
            return {
              status: e.status ?? 0,
              code: e.error?.code ?? 'UNKNOWN_ERROR',
              message: e.error?.message ?? 'The bid could not be placed.',
            };
          })()
        : null;

    this.bidFailure.set(failure);
    return failure;
  }
}
