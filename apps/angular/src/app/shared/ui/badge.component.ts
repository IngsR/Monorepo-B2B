import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { AccountStatus, AuctionStatus } from '../../core/domain/enums';

export type BadgeTone =
  'neutral' | 'brand' | 'active' | 'scheduled' | 'warning' | 'danger' | 'info' | 'success';

export type BadgeSize = 'sm' | 'md';

/**
 * Status badge.
 *
 * Colour is only ever one of the signals: every badge carries a text label, and
 * the status variants below also pick an icon so the state remains legible in
 * grayscale, for colour-blind users and in high-contrast mode.
 */
@Component({
  selector: 'app-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="badge" [class]="'badge badge-' + tone() + (size() === 'sm' ? ' badge-sm' : '')">
      @switch (tone()) {
        @case ('active') {
          <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden="true">
            <circle cx="5" cy="5" r="4" fill="currentColor" />
          </svg>
        }
        @case ('scheduled') {
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="3"
            stroke-linecap="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
        }
        @case ('warning') {
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="3"
            stroke-linecap="round"
            aria-hidden="true"
          >
            <path d="M12 8v5" />
            <path d="M12 17h.01" />
          </svg>
        }
        @case ('danger') {
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="3"
            stroke-linecap="round"
            aria-hidden="true"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        }
        @case ('success') {
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="3"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M20 6L9 17l-5-5" />
          </svg>
        }
      }
      <ng-content>{{ label() }}</ng-content>
    </span>
  `,
})
export class BadgeComponent {
  readonly tone = input<BadgeTone>('neutral');
  readonly label = input<string>('');
  readonly size = input<BadgeSize>('md');

  readonly sizeClass = computed(() => (this.size() === 'sm' ? 'badge-sm' : ''));
}

/**
 * Auction status badge — maps each lifecycle state to its tone and label.
 *
 *   DRAFT      neutral   (inactive, not yet scheduled)
 *   SCHEDULED  info      (informational: waiting for its window)
 *   ACTIVE     success   (live and accepting bids)
 *   ENDED      neutral   (terminal, complete)
 *   CANCELLED  danger    (terminal, withdrawn)
 *
 * "Ending soon" is a time-window condition layered on top of ACTIVE, not a
 * separate status, and uses the warning tone.
 */
@Component({
  selector: 'app-auction-status-badge',
  standalone: true,
  imports: [BadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (endingSoon()) {
      <app-badge tone="warning" size="sm" label="Ending soon" />
    } @else {
      <app-badge [tone]="tone()" [size]="size()" [label]="label()" />
    }
  `,
})
export class AuctionStatusBadgeComponent {
  readonly status = input.required<AuctionStatus>();
  /** True when the auction is active with under 30 minutes remaining. */
  readonly endingSoon = input(false);
  readonly size = input<BadgeSize>('md');

  readonly label = computed(() => {
    switch (this.status()) {
      case AuctionStatus.DRAFT:
        return 'Draft';
      case AuctionStatus.SCHEDULED:
        return 'Scheduled';
      case AuctionStatus.ACTIVE:
        return 'Active';
      case AuctionStatus.ENDED:
        return 'Ended';
      case AuctionStatus.CANCELLED:
        return 'Cancelled';
      default:
        return this.status();
    }
  });

  readonly tone = computed<BadgeTone>(() => {
    switch (this.status()) {
      case AuctionStatus.ACTIVE:
        return 'success';
      case AuctionStatus.SCHEDULED:
        return 'info';
      case AuctionStatus.CANCELLED:
        return 'danger';
      case AuctionStatus.DRAFT:
      case AuctionStatus.ENDED:
      default:
        return 'neutral';
    }
  });
}

/** Account status badge for users, vendors and bidders. */
@Component({
  selector: 'app-account-status-badge',
  standalone: true,
  imports: [BadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-badge [tone]="tone()" [label]="label()" size="sm" />`,
})
export class AccountStatusBadgeComponent {
  readonly status = input.required<AccountStatus>();

  readonly label = computed(() => {
    switch (this.status()) {
      case AccountStatus.ACTIVE:
        return 'Active';
      case AccountStatus.INACTIVE:
        return 'Inactive';
      case AccountStatus.SUSPENDED:
        return 'Suspended';
      default:
        return this.status();
    }
  });

  readonly tone = computed<BadgeTone>(() => {
    switch (this.status()) {
      case AccountStatus.ACTIVE:
        return 'success';
      case AccountStatus.SUSPENDED:
        return 'danger';
      default:
        return 'neutral';
    }
  });
}
