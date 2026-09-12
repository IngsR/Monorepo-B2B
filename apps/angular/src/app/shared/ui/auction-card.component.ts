import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
} from '@angular/core';
import { resolveTiming } from '../../core/domain/auction-lifecycle';
import { AuctionStatus } from '../../core/domain/enums';
import { formatDateTime, formatDuration } from '../../core/domain/format';
import { Auction } from '../../core/domain/models';
import { ClockService } from '../../core/services/clock.service';
import { AuctionStatusBadgeComponent } from './badge.component';
import { CountdownComponent } from './countdown.component';
import { IconComponent } from './icon.component';
import { PriceComponent } from './price.component';

/**
 * Auction card.
 *
 * Used on the marketplace grid, the vendor's auction list and the bidder's
 * dashboard. Communicates state through four independent channels so it works
 * without colour:
 *
 *   1. a status badge with a text label and glyph
 *   2. an urgency line ("Closes in 42m 10s") that changes wording, not just hue
 *   3. the CTA text, which differs per state
 *   4. opacity and a muted price tone for terminal auctions
 *
 * @example
 * <app-auction-card [auction]="a" linkPrefix="/marketplace" />
 */
@Component({
  selector: 'app-auction-card',
  standalone: true,
  imports: [AuctionStatusBadgeComponent, CountdownComponent, IconComponent, PriceComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="auction-card" [class.is-terminal]="isTerminal()">
      <div class="auction-card-media">
        @if (imageUrl()) {
          <img [src]="imageUrl()!" [alt]="productName()" loading="lazy" />
        } @else {
          <div class="auction-card-media-fallback">
            <app-icon name="image" [size]="28" />
          </div>
        }

        <span class="auction-card-status">
          <app-auction-status-badge
            [status]="auction().status"
            [endingSoon]="timing().endingSoon"
            size="sm"
          />
        </span>

        @if (showCountdown()) {
          <span class="auction-card-countdown" [class.is-urgent]="timing().endingSoon">
            <app-icon name="clock" [size]="12" />
            @if (isActive()) {
              <app-countdown
                [target]="auction().endTime"
                prefix="none"
                tone="onMedia"
                size="sm"
                [showIcon]="false"
              />
            } @else if (isScheduled()) {
              <span class="text-numeric">{{ timeToStart() }}</span>
            } @else {
              <span>{{ closedLabel() }}</span>
            }
          </span>
        }
      </div>

      <div class="auction-card-body">
        <p class="auction-card-eyebrow">
          <span>{{ categoryName() }}</span>
          <span aria-hidden="true">·</span>
          <span class="text-mono-id">{{ productCode() }}</span>
        </p>

        <h3 class="auction-card-title">{{ productName() }}</h3>

        @if (vendorName() && showVendor()) {
          <p class="text-helper vendor-line">
            <app-icon name="building" [size]="13" />
            <span>{{ vendorName() }}</span>
          </p>
        }

        <div class="auction-card-bid-row">
          <app-price
            [amount]="auction().currentPrice"
            [label]="priceLabel()"
            [tone]="isTerminal() ? 'muted' : 'default'"
            size="sm"
          />
          <span class="badge badge-plain bid-count">
            <app-icon name="gavel" [size]="12" />
            {{ auction().bidCount }} {{ auction().bidCount === 1 ? 'bid' : 'bids' }}
          </span>
        </div>

        <div class="auction-card-metrics">
          <div class="meta-item">
            <span class="price-label">Increment</span>
            <span class="meta-value text-numeric">{{ incrementLabel() }}</span>
          </div>
          @if (secondaryFigure(); as figure) {
            <div class="meta-item">
              <span class="price-label">{{ figure.label }}</span>
              <span class="meta-value text-numeric">{{ figure.value }}</span>
            </div>
          }
        </div>
      </div>

      <div class="auction-card-footer">
        <span class="cta-hint">{{ ctaHint() }}</span>
        <a class="btn btn-primary btn-sm" [href]="link()" (click)="onCta($event)">
          {{ ctaLabel() }}
          <app-icon name="arrow-right" [size]="14" />
        </a>
      </div>
    </article>
  `,
  styles: [
    `
      .vendor-line {
        display: flex;
        align-items: center;
        gap: var(--sp-2);
        margin-top: calc(var(--sp-1) * -1);
      }
      .bid-count {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        white-space: nowrap;
      }
      .cta-hint {
        font-size: var(--fs-sm);
        color: var(--c-text-muted);
      }
      .auction-card-countdown app-countdown {
        display: inline-flex;
      }
    `,
  ],
})
export class AuctionCardComponent {
  readonly auction = input.required<Auction>();
  /** Base path for the detail link, so the same card works across features. */
  readonly linkPrefix = input('/marketplace');
  readonly showVendor = input(true);
  readonly showCountdown = input(true);
  /** Optional client-side navigation handler; when absent the href is used. */
  readonly navigateOnCta = input<((auction: Auction) => void) | null>(null);

  private readonly clock = inject(ClockService);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    const release = this.clock.subscribe();
    this.destroyRef.onDestroy(release);
  }

  readonly timing = computed(() => resolveTiming(this.auction(), this.clock.now()));

  readonly isActive = computed(() => this.auction().status === AuctionStatus.ACTIVE);
  readonly isScheduled = computed(() => this.auction().status === AuctionStatus.SCHEDULED);
  readonly isDraft = computed(() => this.auction().status === AuctionStatus.DRAFT);
  readonly isEnded = computed(() => this.auction().status === AuctionStatus.ENDED);
  readonly isCancelled = computed(() => this.auction().status === AuctionStatus.CANCELLED);
  readonly isTerminal = computed(() => this.isEnded() || this.isCancelled());

  readonly imageUrl = computed(() => null as string | null);
  readonly productName = computed(() => this.auction().product?.name ?? 'Untitled product');
  readonly productCode = computed(() => this.auction().product?.code ?? '—');
  readonly categoryName = computed(() => this.auction().product?.category?.name ?? 'Uncategorised');
  readonly vendorName = computed(() => this.auction().vendor?.companyName ?? '');

  readonly incrementLabel = computed(
    () => `$${this.auction().bidIncrement.toLocaleString('en-US')}`,
  );

  /** Active auctions lead with the price; scheduled ones lead with the start price. */
  readonly priceLabel = computed(() => {
    if (this.isActive()) return 'Current price';
    if (this.isScheduled()) return 'Starting price';
    if (this.isEnded()) return 'Final price';
    if (this.isCancelled()) return 'Last price';
    return 'Starting price';
  });

  readonly secondaryFigure = computed<{ label: string; value: string } | null>(() => {
    const auction = this.auction();
    if (this.isActive()) {
      return { label: 'Closes', value: formatDateTime(auction.endTime) };
    }
    if (this.isScheduled()) {
      return { label: 'Opens', value: formatDateTime(auction.startTime) };
    }
    if (this.isDraft()) {
      return { label: 'Scheduled for', value: formatDateTime(auction.startTime) };
    }
    return { label: 'Closed', value: formatDateTime(auction.endTime) };
  });

  readonly timeToStart = computed(() => {
    const ms = this.timing().msToStart;
    return ms > 0 ? `in ${formatDuration(ms)}` : 'starting now';
  });

  readonly closedLabel = computed(() => {
    if (this.isCancelled()) return 'Cancelled';
    if (this.isEnded()) return 'Ended';
    if (this.isDraft()) return 'Not scheduled';
    // ACTIVE with an expired clock: the window closed but the status has not been
    // updated yet. Say so plainly rather than implying bidding is still open.
    return 'Window closed';
  });

  readonly ctaLabel = computed(() => {
    if (this.isActive()) return this.timing().acceptingBids ? 'Bid now' : 'View';
    if (this.isScheduled()) return 'View lot';
    if (this.isDraft()) return 'Review';
    return 'View result';
  });

  readonly ctaHint = computed(() => {
    if (this.isActive() && !this.timing().acceptingBids) return 'Awaiting close';
    if (this.isActive()) return 'Open for bidding';
    if (this.isScheduled()) return 'Opens soon';
    if (this.isDraft()) return 'Not published';
    if (this.isCancelled()) return 'Withdrawn';
    return 'Finished';
  });

  readonly link = computed(() => `${this.linkPrefix()}/${this.auction().id}`);

  onCta(event: MouseEvent): void {
    const handler = this.navigateOnCta();
    if (!handler) return;
    event.preventDefault();
    handler(this.auction());
  }
}
