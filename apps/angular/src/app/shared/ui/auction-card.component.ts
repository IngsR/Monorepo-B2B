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
import { MatIconComponent } from './mat-icon.component';
import { PriceComponent } from './price.component';

/**
 * Institutional B2B Auction Lot Card.
 *
 * Specifically designed for industrial assets, machinery, and auction lots:
 *   - Lot header with product/lot code, category tag, and status badge
 *   - Clean industrial asset visual representation (fallback or actual media)
 *   - Authoritative product title and verified vendor identity
 *   - Clear price hierarchy: Current Price / Starting Price and Bid Increment
 *   - Valid bid count and server-authoritative countdown / closing time
 *   - Dedicated institutional CTA action
 */
@Component({
  selector: 'app-auction-card',
  standalone: true,
  imports: [AuctionStatusBadgeComponent, CountdownComponent, MatIconComponent, PriceComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="auction-card" [class.is-terminal]="isTerminal()">
      <!-- Lot Media Header -->
      <div class="auction-card-media">
        @if (imageUrl()) {
          <img [src]="imageUrl()!" [alt]="productName()" loading="lazy" />
        } @else {
          <div class="auction-card-media-fallback">
            <mat-icon fontIcon="precision_manufacturing" [size]="32" />
            <span class="lot-schematic-watermark">Lot {{ productCode() }}</span>
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
            <mat-icon fontIcon="schedule" [size]="13" />
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

      <!-- Lot Body -->
      <div class="auction-card-body">
        <div class="lot-meta-header">
          <span class="lot-code-chip">{{ productCode() }}</span>
          <span class="lot-category-tag">{{ categoryName() }}</span>
        </div>

        <h3 class="auction-card-title" [title]="productName()">{{ productName() }}</h3>

        @if (vendorName() && showVendor()) {
          <p class="vendor-line" [title]="vendorName()">
            <mat-icon fontIcon="storefront" [size]="14" />
            <span class="vendor-name-text">{{ vendorName() }}</span>
          </p>
        }

        <!-- Price Structure -->
        <div class="auction-card-bid-row">
          <app-price
            [amount]="auction().currentPrice"
            [label]="priceLabel()"
            [tone]="isTerminal() ? 'muted' : 'default'"
            size="sm"
          />
          <span class="bid-count-badge">
            <mat-icon fontIcon="gavel" [size]="13" />
            <span>{{ auction().bidCount }} penawaran</span>
          </span>
        </div>

        <!-- Metrics & Increments -->
        <div class="auction-card-metrics">
          <div class="meta-item">
            <span class="meta-item-label">Kelipatan Bid</span>
            <span class="meta-item-val text-numeric">{{ incrementLabel() }}</span>
          </div>
          @if (secondaryFigure(); as figure) {
            <div class="meta-item text-right">
              <span class="meta-item-label">{{ figure.label }}</span>
              <span class="meta-item-val text-numeric">{{ figure.value }}</span>
            </div>
          }
        </div>
      </div>

      <!-- Lot Footer CTA -->
      <div class="auction-card-footer">
        <span class="cta-hint">{{ ctaHint() }}</span>
        <a class="btn btn-primary btn-sm" [href]="link()" (click)="onCta($event)">
          <mat-icon [fontIcon]="ctaIcon()" [size]="14" />
          <span>{{ ctaLabel() }}</span>
        </a>
      </div>
    </article>
  `,
  styles: [
    `
      .lot-meta-header {
        display: flex;
        align-items: center;
        gap: var(--sp-2);
        margin-bottom: 2px;
      }

      .lot-code-chip {
        font-family: var(--font-mono);
        font-size: var(--fs-2xs);
        font-weight: var(--fw-semibold);
        color: var(--c-brand);
        background-color: var(--c-brand-soft);
        padding: 2px 6px;
        border-radius: var(--r-xs);
        border: 1px solid var(--c-brand-border);
      }

      .lot-category-tag {
        font-size: var(--fs-xs);
        color: var(--c-text-muted);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .vendor-line {
        display: flex;
        align-items: center;
        gap: var(--sp-2);
        font-size: var(--fs-xs);
        color: var(--c-text-secondary);
        margin-top: calc(var(--sp-1) * -1);

        mat-icon {
          color: var(--c-text-muted);
        }
      }

      .vendor-name-text {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .bid-count-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: var(--fs-xs);
        color: var(--c-text-secondary);
        background: var(--c-surface);
        padding: 2px 8px;
        border-radius: var(--r-sm);
        border: 1px solid var(--c-border);
        white-space: nowrap;

        mat-icon {
          color: var(--c-brand);
        }
      }

      .meta-item {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .meta-item.text-right {
        align-items: flex-end;
      }

      .meta-item-label {
        font-size: var(--fs-2xs);
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--c-text-muted);
      }

      .meta-item-val {
        font-size: var(--fs-xs);
        font-weight: var(--fw-semibold);
        color: var(--c-text);
      }

      .cta-hint {
        font-size: var(--fs-xs);
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
  readonly productName = computed(() => this.auction().product?.name ?? 'Lot Lelang Industri');
  readonly productCode = computed(() => this.auction().product?.code ?? 'LOT-—');
  readonly categoryName = computed(() => this.auction().product?.category?.name ?? 'Kategori Umum');
  readonly vendorName = computed(() => this.auction().vendor?.companyName ?? this.auction().product?.vendor?.companyName ?? '');

  readonly incrementLabel = computed(
    () => `Rp ${this.auction().bidIncrement.toLocaleString('id-ID')}`,
  );

  /** Active auctions lead with the price; scheduled ones lead with the start price. */
  readonly priceLabel = computed(() => {
    if (this.isActive()) return 'Tawaran Saat Ini';
    if (this.isScheduled()) return 'Harga Awal';
    if (this.isEnded()) return 'Harga Akhir';
    if (this.isCancelled()) return 'Harga Terakhir';
    return 'Harga Awal';
  });

  readonly secondaryFigure = computed<{ label: string; value: string } | null>(() => {
    const auction = this.auction();
    if (this.isActive()) {
      return { label: 'Batas Penutupan', value: formatDateTime(auction.endTime) };
    }
    if (this.isScheduled()) {
      return { label: 'Mulai Dibuka', value: formatDateTime(auction.startTime) };
    }
    if (this.isDraft()) {
      return { label: 'Jadwal Mulai', value: formatDateTime(auction.startTime) };
    }
    return { label: 'Waktu Selesai', value: formatDateTime(auction.endTime) };
  });

  readonly timeToStart = computed(() => {
    const ms = this.timing().msToStart;
    return ms > 0 ? `mulai ${formatDuration(ms)}` : 'dimulai sekarang';
  });

  readonly closedLabel = computed(() => {
    if (this.isCancelled()) return 'Dibatalkan';
    if (this.isEnded()) return 'Selesai';
    if (this.isDraft()) return 'Belum dijadwalkan';
    return 'Waktu ditutup';
  });

  readonly ctaLabel = computed(() => {
    if (this.isActive()) return this.timing().acceptingBids ? 'Tawar Sekarang' : 'Lihat Detail Lot';
    if (this.isScheduled()) return 'Lihat Jadwal';
    if (this.isDraft()) return 'Tinjau Lot';
    return 'Lihat Hasil';
  });

  readonly ctaIcon = computed(() => {
    if (this.isActive() && this.timing().acceptingBids) return 'gavel';
    if (this.isScheduled()) return 'calendar_today';
    return 'arrow_forward';
  });

  readonly ctaHint = computed(() => {
    if (this.isActive() && !this.timing().acceptingBids) return 'Menunggu penutupan lelang';
    if (this.isActive()) return 'Terbuka untuk penawaran sah';
    if (this.isScheduled()) return 'Segera dibuka';
    if (this.isDraft()) return 'Draf persiapan';
    if (this.isCancelled()) return 'Lelang ditarik';
    return 'Lelang selesai';
  });

  readonly link = computed(() => `${this.linkPrefix()}/${this.auction().id}`);

  onCta(event: MouseEvent): void {
    const handler = this.navigateOnCta();
    if (!handler) return;
    event.preventDefault();
    handler(this.auction());
  }
}
