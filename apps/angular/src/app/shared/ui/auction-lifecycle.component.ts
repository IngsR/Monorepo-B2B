import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { LIFECYCLE_PATH } from '../../core/domain/auction-lifecycle';
import { AuctionStatus } from '../../core/domain/enums';
import { formatDateTime } from '../../core/domain/format';
import { Auction } from '../../core/domain/models';
import { IconComponent } from './icon.component';

export interface LifecycleStep {
  status: AuctionStatus;
  label: string;
  time: string;
  state: 'done' | 'current' | 'pending' | 'cancelled' | 'ended';
}

export type LifecycleVariant = 'full' | 'compact';

/**
 * Auction lifecycle indicator.
 *
 * Renders the state machine so the current state and the remaining path are
 * legible at a glance:
 *
 *   DRAFT → SCHEDULED → ACTIVE → ENDED
 *
 * and CANCELLED, which branches off any non-terminal state and is itself
 * terminal. The component deliberately never draws an edge from DRAFT to ACTIVE
 * or from SCHEDULED to ENDED — those transitions do not exist, and the diagram
 * is the user's mental model of the rules.
 *
 * `variant="compact"` is used on auction cards; `full` on the management screen.
 */
@Component({
  selector: 'app-auction-lifecycle',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="lifecycle-block">
      <div
        class="lifecycle"
        [attr.aria-label]="'Auction lifecycle, current state ' + currentLabel()"
      >
        @for (step of steps(); track step.status; let last = $last) {
          <div class="lifecycle-step" [class]="'lifecycle-step is-' + step.state">
            <div class="lifecycle-node-row">
              <span class="lifecycle-marker">
                @if (step.state === 'done') {
                  <app-icon name="check" [size]="11" />
                } @else if (step.state === 'cancelled') {
                  <app-icon name="close" [size]="11" />
                } @else if (step.state === 'ended') {
                  <app-icon name="check" [size]="11" />
                } @else {
                  {{ $index + 1 }}
                }
              </span>
              @if (!last) {
                <span class="lifecycle-connector"></span>
              }
            </div>
            <span class="lifecycle-label">
              {{ step.label }}
              @if (step.state === 'current') {
                <span class="sr-only">(current state)</span>
              }
            </span>
            @if (variant() === 'full' && step.time) {
              <span class="lifecycle-time">{{ step.time }}</span>
            }
          </div>
        }
      </div>

      @if (isCancelled()) {
        <p class="lifecycle-terminal-note text-helper">
          <app-icon name="ban" [size]="13" />
          <span>
            Cancelled is a terminal state — it branches off the lifecycle and no further transitions
            are possible.
          </span>
        </p>
      } @else if (isEnded()) {
        <p class="lifecycle-terminal-note text-helper">
          <app-icon name="check" [size]="13" />
          <span>
            The auction has ended. The winner is derived from the highest valid bid; no separate
            winner record is created.
          </span>
        </p>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .lifecycle-terminal-note {
        display: flex;
        align-items: flex-start;
        gap: var(--sp-2);
        margin-top: var(--sp-4);
        padding: var(--sp-3);
        background: var(--c-surface-sunken);
        border-radius: var(--r-sm);
      }
    `,
  ],
})
export class AuctionLifecycleComponent {
  readonly auction = input.required<Auction>();
  readonly variant = input<LifecycleVariant>('full');

  readonly isCancelled = computed(() => this.auction().status === AuctionStatus.CANCELLED);
  readonly isEnded = computed(() => this.auction().status === AuctionStatus.ENDED);

  readonly currentLabel = computed(() => this.auction().status);

  readonly steps = computed<LifecycleStep[]>(() => {
    const auction = this.auction();
    const cancelled = auction.status === AuctionStatus.CANCELLED;

    // A cancelled auction keeps the path visible up to the point it was withdrawn,
    // then shows CANCELLED in place of the remaining steps.
    const reachedIndex = cancelled
      ? this.lastReachedIndex(auction)
      : LIFECYCLE_PATH.indexOf(auction.status);

    return LIFECYCLE_PATH.map((status, index): LifecycleStep => {
      const isCurrent = status === auction.status;

      let state: LifecycleStep['state'];
      if (isCurrent) {
        state = status === AuctionStatus.ENDED ? 'ended' : 'current';
      } else if (cancelled && index === reachedIndex + 1) {
        // The step where cancellation took effect.
        state = 'cancelled';
      } else if (index < reachedIndex || (cancelled && index <= reachedIndex)) {
        state = 'done';
      } else {
        state = 'pending';
      }

      return {
        status,
        label: LABELS[status],
        time: this.timeFor(status, auction),
        state,
      };
    });
  });

  /** For a cancelled auction, the furthest milestone it actually reached. */
  private lastReachedIndex(auction: Auction): number {
    const now = Date.now();
    const started = new Date(auction.startTime).getTime() <= now;
    if (started) return LIFECYCLE_PATH.indexOf(AuctionStatus.ACTIVE);
    return LIFECYCLE_PATH.indexOf(AuctionStatus.DRAFT);
  }

  private timeFor(status: AuctionStatus, auction: Auction): string {
    switch (status) {
      case AuctionStatus.DRAFT:
        return `Created ${formatDateTime(auction.createdAt)}`;
      case AuctionStatus.SCHEDULED:
      case AuctionStatus.ACTIVE:
        return `From ${formatDateTime(auction.startTime)}`;
      case AuctionStatus.ENDED:
        return `Until ${formatDateTime(auction.endTime)}`;
      default:
        return '';
    }
  }
}

const LABELS: Record<AuctionStatus, string> = {
  [AuctionStatus.DRAFT]: 'Draft',
  [AuctionStatus.SCHEDULED]: 'Scheduled',
  [AuctionStatus.ACTIVE]: 'Active',
  [AuctionStatus.ENDED]: 'Ended',
  [AuctionStatus.CANCELLED]: 'Cancelled',
};
