import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { formatAmount, formatRelative } from '../../core/domain/format';
import { Bid } from '../../core/domain/models';
import { IconComponent } from './icon.component';

export type BidSort = 'highest' | 'newest';

/**
 * Bid history.
 *
 * Presents bids in the order the context requires: by amount (highest first) on
 * the auction detail screen where the leading bid matters, or by time (newest
 * first) where the activity matters.
 *
 * Two rules are enforced here:
 *  - The leading bid is marked with an explicit "Leading bid" label, not just a
 *    colour, and the component never calls it a winner — the highest valid bid
 *    at the end time is what determines the outcome, and that is derived server-side.
 *  - Masked bidder identities render exactly as supplied by the API. The client
 *    never attempts to reveal an identity the server withheld.
 */
@Component({
  selector: 'app-bid-history',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (bids().length === 0) {
      <div class="state-block">
        <div class="state-icon">
          <app-icon name="gavel" [size]="20" />
        </div>
        <p class="state-title">No bids yet</p>
        <p class="state-description">
          {{ emptyMessage() }}
        </p>
      </div>
    } @else {
      <div class="bid-list" role="list">
        @for (bid of orderedBids(); track bid.id; let index = $index) {
          <div
            class="bid-row"
            role="listitem"
            [class.is-leading]="isLeading(bid, index)"
            [class.is-mine]="isMine(bid)"
          >
            <span class="bid-rank" aria-hidden="true">
              @if (isLeading(bid, index)) {
                <app-icon name="trending-up" [size]="13" />
              } @else {
                {{ index + 1 }}
              }
            </span>

            <div class="bid-main">
              <span class="bid-actor">
                <span>{{ actorLabel(bid) }}</span>
                @if (isMine(bid)) {
                  <span class="badge badge-brand">You</span>
                }
                @if (isLeading(bid, index)) {
                  <span class="badge badge-active">Leading bid</span>
                }
              </span>
              <span class="bid-time">{{ formatTime(bid.createdAt) }}</span>
            </div>

            <span class="bid-amount">
              <span aria-hidden="true">$</span>
              {{ amount(bid.amount) }}
            </span>
          </div>
        }
      </div>
    }
  `,
})
export class BidHistoryComponent {
  readonly bids = input.required<Bid[]>();
  readonly sort = input<BidSort>('highest');
  /** Identifier of the signed-in bidder, used to mark their own bids. */
  readonly currentBidderId = input<string | null>(null);
  /** True when the auction is finished and the top bid is therefore final. */
  readonly auctionEnded = input(false);
  readonly emptyMessage = input('Bids placed on this auction will appear here.');

  readonly orderedBids = computed(() => {
    const list = [...this.bids()];
    if (this.sort() === 'newest') {
      return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    return list.sort((a, b) => b.amount - a.amount);
  });

  /**
   * The leading bid is the highest amount. Also honours the server's `isHighest`
   * flag when present, since only the server knows which bid is currently valid.
   */
  isLeading(bid: Bid, index: number): boolean {
    if (bid.isHighest !== undefined) return bid.isHighest;
    return index === 0 && this.sort() === 'highest';
  }

  isMine(bid: Bid): boolean {
    const id = this.currentBidderId();
    return !!id && bid.bidderId === id;
  }

  /**
   * Bidder identity as permitted by the API. Falls back to a neutral label when
   * the server has masked the bidder.
   */
  actorLabel(bid: Bid): string {
    if (bid.bidderCompanyName) return bid.bidderCompanyName;
    if (bid.bidderDisplayName) return bid.bidderDisplayName;
    return 'Anonymous bidder';
  }

  amount(value: number): string {
    return formatAmount(value);
  }

  formatTime(iso: string): string {
    return formatRelative(iso);
  }
}
