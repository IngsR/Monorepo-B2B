import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { ApiFailure, toApiFailure } from '../../../core/domain/api-failure';
import { AuctionStatus } from '../../../core/domain/enums';
import {
  formatAmount,
  isoToLocalInput,
  localInputToIso,
  parseAmount,
} from '../../../core/domain/format';
import { Auction, CreateAuctionPayload, Paginated, Product } from '../../../core/domain/models';
import { AuctionService } from '../../../core/services/auction.service';
import { ProductService } from '../../../core/services/catalogue.service';
import { NotificationService } from '../../../core/services/notification.service';
import { AuthService } from '../../../core/services/session.service';
import { AsyncResource } from '../../../core/state/async-resource';
import { ButtonComponent } from '../../../shared/ui/button.component';
import {
  FormFieldComponent,
  ReadonlyFieldComponent,
} from '../../../shared/ui/form-field.component';
import { IconComponent } from '../../../shared/ui/icon.component';
import { BreadcrumbsComponent, Crumb } from '../../../shared/ui/pagination.component';
import { ErrorStateComponent } from '../../../shared/ui/state-block.component';
import { AlertComponent } from '../../../shared/ui/toast.component';

/**
 * Create / edit auction.
 *
 * The form contains only what the client is allowed to supply: the product, the
 * starting price, the bid increment and the schedule.
 *
 * Deliberately absent, because the server derives them:
 *   vendorId      — taken from the authenticated vendor identity
 *   currentPrice  — derived from the highest valid bid (equals startingPrice until one exists)
 *   bidderId      — resolved from the JWT when a bid is placed
 *   winner        — derived from the highest valid bid at the end time; not a stored entity
 *
 * Every constraint the backend enforces is stated in the field hint *and*
 * validated client-side, so a rejection is rare and never surprising.
 */
@Component({
  selector: 'app-auction-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    AlertComponent,
    BreadcrumbsComponent,
    ButtonComponent,
    FormFieldComponent,
    ReadonlyFieldComponent,
    IconComponent,
    ErrorStateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-breadcrumbs [items]="crumbs()" />

      <header class="page-head">
        <div class="page-head-text">
          <h1 class="page-title">{{ isEdit() ? 'Edit auction' : 'Create auction' }}</h1>
          <p class="page-subtitle">
            {{
              isEdit()
                ? 'Auction terms can be changed while the auction is a draft or scheduled. Once it is active the terms are locked, because bidders have already bid against them.'
                : 'A new auction is created as a draft. Schedule it when the terms are settled, and it will run for the window you set.'
            }}
          </p>
        </div>
        <div class="page-actions">
          <a class="btn btn-secondary" routerLink="/vendor/auctions">
            <app-icon name="chevron-left" [size]="15" />
            Back to auctions
          </a>
        </div>
      </header>

      @if (isEdit() && existing.hasError()) {
        <div class="card">
          @if (existing.error(); as failure) {
            <app-error-state
              [failure]="failure"
              [retrying]="existing.isLoading()"
              (retry)="loadAuction()"
            />
          }
        </div>
      } @else {
        @if (failure(); as f) {
          <app-alert tone="danger" [title]="f.message">{{ f.detail }}</app-alert>
        }

        @if (editingLocked()) {
          <app-alert tone="warning" title="This auction can no longer be edited">
            Auction terms are fixed once an auction is active or has ended. Manage its lifecycle
            from the auction management screen instead.
          </app-alert>
        }

        <form [formGroup]="form" (ngSubmit)="submit()" novalidate class="card">
          <!-- 1. What is being auctioned -->
          <section class="form-section">
            <div class="form-section-head">
              <span class="form-section-index">1</span>
              <div>
                <h2 class="form-section-title">Product</h2>
                <p class="form-section-desc">
                  Choose one of your products. A product can back several auctions over time.
                </p>
              </div>
            </div>

            @if (productList().length === 0 && !products.isLoading()) {
              <app-alert tone="warning" title="No products available">
                You need at least one product before you can create an auction.
                <a routerLink="/vendor/products/new">Create a product first.</a>
              </app-alert>
            } @else {
              <app-form-field
                label="Product"
                [required]="true"
                [control]="productId"
                [errorMap]="productErrors"
                hint="Only products owned by your vendor account are listed."
                controlId="auction-product"
              >
                <select
                  id="auction-product"
                  class="form-select"
                  formControlName="productId"
                  [disabled]="editingLocked()"
                >
                  <option value="" disabled>Select a product</option>
                  @for (product of productList(); track product.id) {
                    <option [value]="product.id">{{ product.code }} — {{ product.name }}</option>
                  }
                </select>
              </app-form-field>
            }
          </section>

          <!-- 2. Pricing -->
          <section class="form-section">
            <div class="form-section-head">
              <span class="form-section-index">2</span>
              <div>
                <h2 class="form-section-title">Pricing</h2>
                <p class="form-section-desc">
                  The starting price is where bidding begins. The increment is the smallest amount
                  by which each new bid must exceed the current price.
                </p>
              </div>
            </div>

            <div class="form-grid">
              <app-form-field
                label="Starting price"
                [required]="true"
                [control]="startingPrice"
                [errorMap]="startingPriceErrors"
                hint="Must be greater than zero."
                controlId="auction-starting-price"
              >
                <div class="input-prefix">
                  <span class="input-prefix-symbol" aria-hidden="true">$</span>
                  <input
                    id="auction-starting-price"
                    type="number"
                    class="form-input"
                    formControlName="startingPrice"
                    min="0.01"
                    step="0.01"
                    inputmode="decimal"
                    placeholder="0.00"
                    [disabled]="editingLocked()"
                  />
                </div>
              </app-form-field>

              <app-form-field
                label="Bid increment"
                [required]="true"
                [control]="bidIncrement"
                [errorMap]="bidIncrementErrors"
                hint="Must be greater than zero."
                controlId="auction-bid-increment"
              >
                <div class="input-prefix">
                  <span class="input-prefix-symbol" aria-hidden="true">$</span>
                  <input
                    id="auction-bid-increment"
                    type="number"
                    class="form-input"
                    formControlName="bidIncrement"
                    min="0.01"
                    step="0.01"
                    inputmode="decimal"
                    placeholder="0.00"
                    [disabled]="editingLocked()"
                  />
                </div>
              </app-form-field>

              <!-- Derived, never submitted -->
              <div class="form-grid-full">
                <app-readonly-field
                  label="Minimum first bid"
                  [value]="firstBidLabel()"
                  hint="Starting price plus the increment. Bidders cannot bid below this."
                />
              </div>
            </div>
          </section>

          <!-- 3. Schedule -->
          <section class="form-section">
            <div class="form-section-head">
              <span class="form-section-index">3</span>
              <div>
                <h2 class="form-section-title">Schedule</h2>
                <p class="form-section-desc">
                  The end time is authoritative for bidding — no bid is accepted after it, even if
                  the auction has not been closed yet.
                </p>
              </div>
            </div>

            <div class="form-grid">
              <app-form-field
                label="Start date and time"
                [required]="true"
                [control]="startTime"
                [errorMap]="startTimeErrors"
                hint="Your local time."
                controlId="auction-start-time"
              >
                <input
                  id="auction-start-time"
                  type="datetime-local"
                  class="form-input"
                  formControlName="startTime"
                  [disabled]="editingLocked()"
                />
              </app-form-field>

              <app-form-field
                label="End date and time"
                [required]="true"
                [control]="endTime"
                [errorMap]="endTimeErrors"
                hint="Must be later than the start time."
                controlId="auction-end-time"
              >
                <input
                  id="auction-end-time"
                  type="datetime-local"
                  class="form-input"
                  formControlName="endTime"
                  [disabled]="editingLocked()"
                />
              </app-form-field>
            </div>

            @if (durationLabel(); as duration) {
              <p class="duration-note">
                <app-icon name="clock" [size]="14" />
                <span
                  >The bidding window will be open for <strong>{{ duration }}</strong
                  >.</span
                >
              </p>
            }
          </section>

          <!-- Server-managed values: shown, not editable -->
          <section class="form-section">
            <div class="form-section-head">
              <span class="form-section-index">4</span>
              <div>
                <h2 class="form-section-title">Platform-managed values</h2>
                <p class="form-section-desc">
                  These are set by the platform. They are shown so you know what to expect, and they
                  are never sent from this form.
                </p>
              </div>
            </div>

            <div class="form-grid">
              <app-readonly-field
                label="Vendor"
                [value]="vendorLabel()"
                hint="Ownership comes from your authenticated vendor account."
              />
              <app-readonly-field
                label="Current price"
                [value]="currentPriceLabel()"
                hint="Equals the starting price until a valid bid is accepted."
              />
              <app-readonly-field
                label="Initial status"
                [value]="isEdit() ? (existing.data()?.status ?? '—') : 'DRAFT'"
                hint="New auctions always begin as a draft."
              />
              <app-readonly-field
                label="Winner"
                [value]="'Not stored'"
                hint="The winner is derived from the highest valid bid at the end time. There is no winner record."
              />
            </div>
          </section>

          <div class="card-footer">
            <a class="btn btn-secondary" routerLink="/vendor/auctions">Cancel</a>
            <app-button
              type="submit"
              [label]="isEdit() ? 'Save changes' : 'Create draft auction'"
              variant="primary"
              [loading]="saving()"
              [disabled]="editingLocked() || productList().length === 0"
            />
          </div>
        </form>
      }
    </div>
  `,
  styles: [
    `
      .duration-note {
        display: flex;
        align-items: center;
        gap: var(--sp-2);
        font-size: var(--fs-sm);
        color: var(--c-text-secondary);
      }
    `,
  ],
})
export class AuctionFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auctionService = inject(AuctionService);
  private readonly productService = inject(ProductService);
  private readonly notifications = inject(NotificationService);
  private readonly auth = inject(AuthService);

  readonly existing = new AsyncResource<Auction>();
  readonly products = new AsyncResource<Paginated<Product>>();
  readonly saving = signal(false);
  readonly failure = signal<ApiFailure | null>(null);

  readonly auctionId = this.route.snapshot.paramMap.get('id');
  readonly isEdit = computed(() => !!this.auctionId);

  readonly form = this.fb.nonNullable.group({
    productId: ['', [Validators.required]],
    startingPrice: [null as number | null, [Validators.required, Validators.min(0.01)]],
    bidIncrement: [null as number | null, [Validators.required, Validators.min(0.01)]],
    startTime: ['', [Validators.required]],
    endTime: ['', [Validators.required]],
  });

  get productId() {
    return this.form.controls.productId;
  }
  get startingPrice() {
    return this.form.controls.startingPrice;
  }
  get bidIncrement() {
    return this.form.controls.bidIncrement;
  }
  get startTime() {
    return this.form.controls.startTime;
  }
  get endTime() {
    return this.form.controls.endTime;
  }

  readonly productErrors = { required: 'Select a product' };

  readonly startingPriceErrors = {
    required: 'Starting price is required',
    min: 'Starting price must be greater than zero',
  };

  readonly bidIncrementErrors = {
    required: 'Bid increment is required',
    min: 'Bid increment must be greater than zero',
  };

  readonly startTimeErrors = { required: 'Start date and time is required' };
  readonly endTimeErrors = {
    required: 'End date and time is required',
    order: 'End time must be later than the start time',
  };

  readonly productList = computed(() => this.products.data()?.items ?? []);
  readonly vendorLabel = computed(() => this.auth.vendor()?.companyName ?? '—');

  /** Active and ended auctions are read-only for terms. */
  readonly editingLocked = computed(() => {
    const status = this.existing.data()?.status;
    if (!status) return false;
    return (
      status === AuctionStatus.ACTIVE ||
      status === AuctionStatus.ENDED ||
      status === AuctionStatus.CANCELLED
    );
  });

  readonly firstBidLabel = computed(() => {
    const start = this.startingPrice.value;
    const increment = this.bidIncrement.value;
    if (start === null || increment === null) return '—';
    return formatAmount(start + increment);
  });

  readonly currentPriceLabel = computed(() => {
    const existing = this.existing.data();
    if (existing) return formatAmount(existing.currentPrice);
    const start = this.startingPrice.value;
    return start === null ? '—' : formatAmount(start);
  });

  readonly durationLabel = computed(() => {
    const start = this.startTime.value;
    const end = this.endTime.value;
    if (!start || !end) return '';

    const diff = new Date(end).getTime() - new Date(start).getTime();
    if (!Number.isFinite(diff) || diff <= 0) return '';

    const hours = Math.floor(diff / 3_600_000);
    const days = Math.floor(hours / 24);
    const remainder = hours % 24;

    if (days > 0)
      return `${days} ${days === 1 ? 'day' : 'days'}${remainder ? ` ${remainder}h` : ''}`;
    const minutes = Math.round((diff % 3_600_000) / 60_000);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  });

  readonly crumbs = computed<Crumb[]>(() => [
    { label: 'My auctions', link: '/vendor/auctions' },
    { label: this.isEdit() ? 'Edit auction' : 'Create auction' },
  ]);

  constructor() {
    this.loadProducts();
    if (this.isEdit()) this.loadAuction();
    this.watchSchedule();
  }

  /** Cross-field check so the end-before-start error appears while typing. */
  private watchSchedule(): void {
    this.form.valueChanges.subscribe(() => {
      const start = this.startTime.value;
      const end = this.endTime.value;

      if (start && end && new Date(end).getTime() <= new Date(start).getTime()) {
        this.endTime.setErrors({ ...(this.endTime.errors ?? {}), order: true });
      } else if (this.endTime.errors?.['order']) {
        const { order, ...rest } = this.endTime.errors;
        void order;
        this.endTime.setErrors(Object.keys(rest).length ? rest : null);
      }
    });
  }

  private loadProducts(): void {
    this.products.load(this.productService.listMine({ limit: 100 }));
  }

  loadAuction(): void {
    if (!this.auctionId) return;

    this.auctionService.getById(this.auctionId).subscribe({
      next: (auction) => {
        this.existing.set(auction);
        this.form.patchValue({
          productId: auction.productId,
          startingPrice: auction.startingPrice,
          bidIncrement: auction.bidIncrement,
          startTime: isoToLocalInput(auction.startTime),
          endTime: isoToLocalInput(auction.endTime),
        });
      },
      error: (error: unknown) => {
        this.existing.load(new Observable<Auction>((subscriber) => subscriber.error(error)));
      },
    });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const startIso = localInputToIso(raw.startTime);
    const endIso = localInputToIso(raw.endTime);

    // Final client-side guard before the server sees the payload.
    if (new Date(endIso).getTime() <= new Date(startIso).getTime()) {
      this.endTime.setErrors({ order: true });
      this.endTime.markAsTouched();
      return;
    }

    const payload: CreateAuctionPayload = {
      productId: raw.productId,
      startingPrice: parseAmount(raw.startingPrice) ?? 0,
      bidIncrement: parseAmount(raw.bidIncrement) ?? 0,
      startTime: startIso,
      endTime: endIso,
    };

    this.saving.set(true);
    this.failure.set(null);

    const request$ = this.isEdit()
      ? this.auctionService.update(this.auctionId!, payload)
      : this.auctionService.create(payload);

    request$.subscribe({
      next: (auction) => {
        this.saving.set(false);
        this.notifications.success(
          this.isEdit() ? 'Auction updated' : 'Draft auction created',
          this.isEdit()
            ? 'Your changes have been saved.'
            : 'The auction is a draft. Schedule it from the management screen when it is ready.',
        );
        void this.router.navigate(['/vendor/auctions', auction.id]);
      },
      error: (error: unknown) => {
        this.saving.set(false);
        const failure = toApiFailure(error);
        this.failure.set(failure);

        if (failure.fieldErrors) {
          const map: Record<string, { setErrors: (e: object) => void; markAsTouched: () => void }> =
            {
              productId: this.productId,
              startingPrice: this.startingPrice,
              bidIncrement: this.bidIncrement,
              startTime: this.startTime,
              endTime: this.endTime,
            };
          for (const [field, message] of Object.entries(failure.fieldErrors)) {
            const control = map[field];
            if (control) {
              control.setErrors({ server: message });
              control.markAsTouched();
            }
          }
        }
      },
    });
  }
}
