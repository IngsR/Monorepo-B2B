import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
} from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { ApiFailure } from '../../core/domain/api-failure';
import { minimumNextBid, resolveTiming } from '../../core/domain/auction-lifecycle';
import { AuctionStatus, UserRole } from '../../core/domain/enums';
import { formatAmount, parseAmount } from '../../core/domain/format';
import { Auction } from '../../core/domain/models';
import { ClockService } from '../../core/services/clock.service';
import { AuthService } from '../../core/services/session.service';
import { BadgeComponent } from '../../shared/ui/badge.component';
import { ButtonComponent } from '../../shared/ui/button.component';
import { CountdownComponent } from '../../shared/ui/countdown.component';
import { FormFieldComponent } from '../../shared/ui/form-field.component';
import { IconComponent } from '../../shared/ui/icon.component';
import { PriceComponent, PriceTileComponent } from '../../shared/ui/price.component';
import { AlertComponent } from '../../shared/ui/toast.component';

/**
 * Validates that a bid is at least the current minimum next bid.
 * The getter is passed in so the rule always reads the live value.
 */
function minimumBidValidator(minimum: () => number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value as number | null;
    const missing = value === null || value === undefined || Number.isNaN(value);
    if (missing) return null;

    const bound = minimum();
    const tooLow = (value as number) < bound;
    if (!tooLow) return null;

    const error: ValidationErrors = { belowMinimum: true };
    error['minimum'] = bound;
    return error;
  };
}

/**
 * The bidding panel.
 *
 * The most consequential interaction in the product, so it makes four things
 * unmistakable:
 *
 *  1. The current price and the minimum next bid dominate the panel.
 *  2. Validation is immediate and client-side, but the copy states plainly that
 *     the server is authoritative — a bid can still be refused if the price
 *     moved between render and submit.
 *  3. Every state the auction can be in produces a distinct, explained panel
 *     (not started, active, ending soon, window closed, ended, cancelled).
 *  4. Only a bidder can bid. Vendors and administrators see the figures but no
 *     bid control, and an unauthenticated visitor is told to sign in.
 */
@Component({
  selector: 'app-bid-panel',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    BadgeComponent,
    ButtonComponent,
    CountdownComponent,
    FormFieldComponent,
    IconComponent,
    PriceComponent,
    PriceTileComponent,
    AlertComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <aside class="bid-panel" aria-label="Bidding">
      <!-- Headline figures -->
      <div class="bid-panel-hero">
        <div>
          <app-price
            [amount]="auction().currentPrice"
            label="Current price"
            size="hero"
            [tone]="auction().bidCount > 0 ? 'default' : 'muted'"
          />
          @if (auction().bidCount === 0) {
            <p class="text-helper no-bids-note">
              No bids yet — the price shown is the seller's starting price.
            </p>
          }
        </div>

        <div class="bid-panel-timing">
          @if (isActive() && timing().acceptingBids) {
            <app-countdown [target]="auction().endTime" prefix="closes" size="lg" />
            @if (timing().endingSoon) {
              <app-badge tone="warning" label="Ending soon" size="sm" />
            }
          } @else if (isScheduled()) {
            <app-countdown [target]="auction().startTime" prefix="starts" size="lg" tone="muted" />
          } @else if (isActive()) {
            <span class="countdown is-muted">
              <app-icon name="ban" [size]="17" />
              <span class="countdown-label">Bidding closed</span>
            </span>
          } @else if (isEnded()) {
            <span class="countdown is-muted">
              <app-icon name="check" [size]="17" />
              <span class="countdown-label">Auction ended</span>
            </span>
          } @else if (isCancelled()) {
            <span class="countdown is-muted">
              <app-icon name="close" [size]="17" />
              <span class="countdown-label">Auction cancelled</span>
            </span>
          } @else {
            <span class="countdown is-muted">
              <app-icon name="file-text" [size]="17" />
              <span class="countdown-label">Not yet scheduled</span>
            </span>
          }
        </div>
      </div>

      <!-- Key terms -->
      <div class="bid-panel-figures">
        <app-price-tile
          [amount]="minimumBid()"
          label="Minimum next bid"
          [size]="'md'"
          [accent]="canBidNow()"
          [hint]="'Current price + increment'"
        />
        <app-price-tile
          [amount]="auction().bidIncrement"
          label="Bid increment"
          size="sm"
          hint="Fixed by the vendor"
        />
      </div>

      <!-- Outcome feedback -->
      @if (feedback(); as f) {
        <app-alert [tone]="f.tone" [title]="f.title" [message]="f.message" />
      }

      <!-- Bid form: only rendered when bidding is actually possible -->
      @switch (panelState()) {
        @case ('anonymous') {
          <div class="panel-cta">
            <app-alert tone="info" title="Sign in to bid">
              Bidding requires a bidder account. Sign in to view your bid history and place bids.
            </app-alert>
            <a class="btn btn-primary btn-block btn-lg" [href]="loginLink()">Sign in to bid</a>
          </div>
        }

        @case ('active') {
          <form [formGroup]="form" (ngSubmit)="submit()" novalidate class="bid-form">
            <app-form-field
              label="Your bid"
              [required]="true"
              [control]="amount"
              [errorMap]="amountErrors()"
              controlId="bid-amount"
            >
              <div class="input-prefix">
                <span class="input-prefix-symbol" aria-hidden="true">$</span>
                <input
                  id="bid-amount"
                  type="number"
                  class="form-input bid-input"
                  formControlName="amount"
                  [attr.min]="minimumBid()"
                  [attr.step]="auction().bidIncrement"
                  inputmode="decimal"
                  autocomplete="off"
                />
              </div>
            </app-form-field>

            <div class="bid-quick-amounts">
              @for (preset of presets(); track preset.label) {
                <button type="button" class="bid-quick-btn" (click)="applyPreset(preset.value)">
                  {{ preset.label }}
                </button>
              }
            </div>

            <p class="bid-authority-note">
              <app-icon name="info" [size]="14" />
              <span>
                Your bid is checked against the live price when it reaches the server. If the price
                has moved, the bid is refused and you will see the new minimum.
              </span>
            </p>

            <app-button
              type="submit"
              [label]="submitLabel()"
              variant="primary"
              size="lg"
              [block]="true"
              [loading]="submitting()"
              [disabled]="amount.invalid"
            />
          </form>
        }

        @case ('not-bidder') {
          <app-alert tone="neutral" [title]="notBidderTitle()">
            {{ notBidderMessage() }}
          </app-alert>
        }

        @case ('bidder-inactive') {
          <app-alert tone="danger" title="Account not active">
            This bidder account is not active and cannot place bids. Contact your administrator.
          </app-alert>
        }

        @case ('scheduled') {
          <app-alert tone="info" title="Bidding has not opened yet">
            This auction starts at {{ startTime() }}. You can review the lot and return then.
          </app-alert>
        }

        @case ('window-closed') {
          <app-alert tone="warning" title="Bidding window closed">
            The published end time for this auction has passed, so no further bids can be accepted.
            The auction remains open on the record until the vendor or an administrator closes it.
          </app-alert>
        }

        @case ('ended') {
          <app-alert tone="neutral" title="Auction ended">
            The highest valid bid at the end time determines the outcome. The result is derived by
            the server; no winner is declared before the auction closes.
          </app-alert>
        }

        @case ('cancelled') {
          <app-alert tone="danger" title="Auction cancelled">
            This auction was withdrawn and will not proceed. Any bids placed remain in the history
            for the record.
          </app-alert>
        }

        @case ('draft') {
          <app-alert tone="neutral" title="Not published">
            This auction is still a draft. It will become available once it is scheduled and
            activated.
          </app-alert>
        }
      }
    </aside>
  `,
  styles: [
    `
      .bid-panel-timing {
        display: flex;
        align-items: center;
        gap: var(--sp-3);
        flex-wrap: wrap;
      }
      .no-bids-note {
        margin-top: var(--sp-2);
      }
      .bid-form {
        display: flex;
        flex-direction: column;
        gap: var(--sp-4);
      }
      .bid-form app-form-field {
        display: block;
      }
      .bid-input {
        font-family: var(--font-mono);
        font-size: var(--fs-lg);
        font-weight: var(--fw-bold);
      }
      .bid-authority-note {
        display: flex;
        align-items: flex-start;
        gap: var(--sp-2);
        font-size: var(--fs-sm);
        color: var(--c-text-muted);
        line-height: var(--lh-snug);
      }
      .bid-authority-note app-icon {
        margin-top: 2px;
        flex-shrink: 0;
      }
      .panel-cta {
        display: flex;
        flex-direction: column;
        gap: var(--sp-4);
      }
    `,
  ],
})
export class BidPanelComponent {
  readonly auction = input.required<Auction>();
  /** Emits when a bid was accepted, so the parent can refresh the auction. */
  readonly bidPlaced = output<void>();
  /** Emits when the server refused the bid with a conflict, so the parent refetches. */
  readonly bidConflict = output<void>();

  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly clock = inject(ClockService);

  readonly submitting = input(false);
  readonly failure = input<ApiFailure | null>(null);

  /**
   * The bid amount, validated against the live minimum on every change.
   *
   * The validator closes over `minimumBid()`, so as soon as another bid raises
   * the price the control re-validates and an already-typed amount becomes
   * invalid — which is exactly the feedback a bidder needs before submitting.
   * The server still re-checks the same rule, because the price can move between
   * render and submit.
   */
  readonly form = this.fb.nonNullable.group({
    amount: [
      null as number | null,
      [Validators.required, Validators.min(0.01), minimumBidValidator(() => this.minimumBid())],
    ],
  });

  get amount() {
    return this.form.controls.amount;
  }

  readonly timing = computed(() => resolveTiming(this.auction(), this.clock.now()));

  readonly isActive = computed(() => this.auction().status === AuctionStatus.ACTIVE);
  readonly isScheduled = computed(() => this.auction().status === AuctionStatus.SCHEDULED);
  readonly isEnded = computed(() => this.auction().status === AuctionStatus.ENDED);
  readonly isCancelled = computed(() => this.auction().status === AuctionStatus.CANCELLED);
  readonly isDraft = computed(() => this.auction().status === AuctionStatus.DRAFT);

  /** currentPrice + bidIncrement, computed in one place for the whole app. */
  readonly minimumBid = computed(() => minimumNextBid(this.auction()));

  private readonly role = computed(() => this.auth.role());
  private readonly canBid = computed(() => this.auth.canBid());

  readonly canBidNow = computed(
    () => this.timing().acceptingBids && this.auth.isBidder() && this.auth.canBid(),
  );

  /**
   * Which panel to show. Ordered by precedence: identity first, then lifecycle,
   * so a signed-out visitor is told to sign in rather than shown a form that
   * cannot work.
   */
  readonly panelState = computed<
    | 'anonymous'
    | 'not-bidder'
    | 'bidder-inactive'
    | 'active'
    | 'scheduled'
    | 'window-closed'
    | 'ended'
    | 'cancelled'
    | 'draft'
  >(() => {
    const auction = this.auction();
    const role = this.role();

    if (auction.status === AuctionStatus.CANCELLED) return 'cancelled';
    if (auction.status === AuctionStatus.ENDED) return 'ended';
    if (auction.status === AuctionStatus.DRAFT) return 'draft';

    if (auction.status === AuctionStatus.SCHEDULED) return 'scheduled';

    // From here the recorded status is ACTIVE.
    if (!this.timing().acceptingBids) return 'window-closed';

    if (role === null) return 'anonymous';
    if (role !== UserRole.BIDDER) return 'not-bidder';
    if (!this.canBid()) return 'bidder-inactive';
    return 'active';
  });

  readonly notBidderTitle = computed(() =>
    this.role() === UserRole.VENDOR ? 'Vendors cannot bid' : 'Administrators cannot bid',
  );

  readonly notBidderMessage = computed(() =>
    this.role() === UserRole.VENDOR
      ? 'You may inspect any auction, but bidding is reserved for bidder accounts. Manage this auction from your vendor workspace.'
      : 'Administrators inspect auctions and manage the platform. Bidding is reserved for bidder accounts.',
  );

  readonly submitLabel = computed(() =>
    this.timing().endingSoon ? 'Place bid — closing soon' : 'Place bid',
  );

  readonly startTime = computed(() => new Date(this.auction().startTime).toLocaleString('en-GB'));

  readonly loginLink = computed(
    () => `/login?returnUrl=${encodeURIComponent(`/marketplace/${this.auction().id}`)}`,
  );

  /** Quick-fill amounts derived from the increment, so the buttons are never arbitrary. */
  readonly presets = computed(() => {
    const minimum = this.minimumBid();
    const increment = this.auction().bidIncrement;
    return [
      { label: formatAmount(minimum), value: minimum },
      { label: `+${increment.toLocaleString('en-US')}`, value: minimum + increment },
      { label: `+${(increment * 2).toLocaleString('en-US')}`, value: minimum + increment * 2 },
    ];
  });

  readonly amountErrors = computed(() => ({
    required: 'Enter a bid amount',
    min: `Your bid must be at least ${formatAmount(this.minimumBid())}`,
    belowMinimum: `Your bid must be at least ${formatAmount(this.minimumBid())}`,
  }));

  /** Outcome feedback rendered above the form. */
  readonly feedback = computed(() => {
    const failure = this.failure();
    if (!failure) return null;

    if (failure.status === 409) {
      return {
        tone: 'warning' as const,
        title: 'Bid not accepted — price moved',
        message:
          failure.message ||
          'Another bid was accepted before yours reached the server. The minimum next bid has been updated below.',
      };
    }
    if (failure.status === 403) {
      return {
        tone: 'danger' as const,
        title: 'Bid refused',
        message: failure.message,
      };
    }
    if (failure.status >= 500 || failure.status === 0) {
      return {
        tone: 'danger' as const,
        title: 'Could not place your bid',
        message: failure.detail ?? 'The request could not be completed. Please try again.',
      };
    }
    return { tone: 'danger' as const, title: failure.message, message: failure.detail ?? '' };
  });

  applyPreset(value: number): void {
    this.amount.setValue(value);
    this.amount.markAsDirty();
  }

  /**
   * Client-side validation runs first for immediate feedback. The server still
   * validates the same rule against the live price, and a mismatch is surfaced
   * as a conflict.
   */
  submit(): void {
    const value = parseAmount(this.amount.value);

    if (value === null || value <= 0) {
      this.amount.setErrors({ required: true });
      this.amount.markAsTouched();
      return;
    }

    if (value < this.minimumBid()) {
      this.amount.setErrors({ belowMinimum: true });
      this.amount.markAsTouched();
      return;
    }

    this.amount.setErrors(null);
    this.formValue.emit(value);
  }

  /** The parent owns the HTTP call, so the panel stays presentational. */
  readonly formValue = output<number>();

  constructor() {
    // Prefill with the minimum bid so the common case is a single click, and
    // re-prefill whenever the auction changes (navigating between lots) — but
    // never overwrite an amount the bidder has already started typing.
    effect(() => {
      const minimum = this.minimumBid();
      if (this.amount.pristine || this.amount.value === null) {
        this.amount.setValue(minimum, { emitEvent: false });
      } else {
        // The price moved while an amount was entered: re-run validation so a
        // now-too-low bid is flagged immediately.
        this.amount.updateValueAndValidity({ emitEvent: false });
      }
    });
  }
}
