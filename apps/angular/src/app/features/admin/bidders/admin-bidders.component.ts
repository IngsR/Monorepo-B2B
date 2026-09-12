import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiFailure, toApiFailure } from '../../../core/domain/api-failure';
import { formatDateTime } from '../../../core/domain/format';
import { Bidder, Paginated } from '../../../core/domain/models';
import { AsyncResource } from '../../../core/state/async-resource';
import { BidderService } from '../../../core/services/directory.service';
import { NotificationService } from '../../../core/services/notification.service';
import { AccountStatusBadgeComponent } from '../../../shared/ui/badge.component';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { DialogComponent } from '../../../shared/ui/dialog.component';
import {
  FormFieldComponent,
  ReadonlyFieldComponent,
} from '../../../shared/ui/form-field.component';
import { IconComponent } from '../../../shared/ui/icon.component';
import { PaginationComponent } from '../../../shared/ui/pagination.component';
import {
  EmptyStateComponent,
  ErrorStateComponent,
  TableSkeletonComponent,
} from '../../../shared/ui/state-block.component';
import { AlertComponent } from '../../../shared/ui/toast.component';

/**
 * Bidder management.
 *
 * A bidder profile is what a bid is recorded against. Each profile links to one
 * user account. The bid count column is derived from the bids actually placed,
 * which is the only activity figure the backend exposes — there is no win rate,
 * spend or credit metric to show.
 *
 * A suspended or inactive bidder profile cannot place bids; the API refuses the
 * attempt and the status here is how an administrator sees that.
 */
@Component({
  selector: 'app-admin-bidders',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    AccountStatusBadgeComponent,
    ButtonComponent,
    DialogComponent,
    FormFieldComponent,
    ReadonlyFieldComponent,
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
          <h1 class="page-title">Bidders</h1>
          <p class="page-subtitle">
            Bidder records and the user accounts behind them. Bids are recorded against a bidder
            profile, which is resolved from the authenticated identity at the moment a bid is
            placed.
          </p>
        </div>
        <div class="page-actions">
          <app-button label="New bidder" icon="plus" variant="primary" (clicked)="openCreate()" />
        </div>
      </header>

      @if (actionFailure(); as failure) {
        <app-alert tone="danger" [title]="failure.message">{{ failure.detail }}</app-alert>
      }

      <div class="toolbar">
        <div class="toolbar-field toolbar-grow">
          <label class="form-label" for="bidder-search">Search</label>
          <input
            id="bidder-search"
            type="search"
            class="form-input"
            placeholder="Search by company, contact person, phone or email"
            [value]="searchInput()"
            (input)="onSearchInput($event)"
          />
        </div>
        <div class="toolbar-field">
          <button
            type="button"
            class="btn btn-secondary"
            (click)="reload()"
            [disabled]="bidders.isLoading()"
          >
            <app-icon name="refresh" [size]="15" />
            Refresh
          </button>
        </div>
      </div>

      <div class="card">
        @switch (true) {
          @case (bidders.isLoading() && !bidders.data()) {
            <app-table-skeleton [count]="5" />
          }
          @case (bidders.hasError()) {
            @if (bidders.error(); as failure) {
              <app-error-state
                [failure]="failure"
                [retrying]="bidders.isLoading()"
                (retry)="reload()"
              />
            }
          }
          @case (bidderList().length === 0) {
            <app-empty-state
              icon="user"
              [title]="searchInput() ? 'No bidders match this search' : 'No bidders yet'"
              [description]="
                searchInput()
                  ? 'Try a different search term.'
                  : 'Create a bidder profile to let a user take part in auctions.'
              "
            >
              @if (searchInput()) {
                <button type="button" class="btn btn-secondary" (click)="clearSearch()">
                  Clear search
                </button>
              } @else {
                <app-button
                  label="New bidder"
                  icon="plus"
                  variant="primary"
                  (clicked)="openCreate()"
                />
              }
            </app-empty-state>
          }
          @default {
            <div class="table-scroll">
              <table class="data-table data-table--stacked">
                <thead>
                  <tr>
                    <th scope="col">Bidder</th>
                    <th scope="col">Contact</th>
                    <th scope="col">Associated user</th>
                    <th scope="col">Status</th>
                    <th scope="col" class="col-numeric">Bids placed</th>
                    <th scope="col">Created</th>
                    <th scope="col" class="cell-actions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  @for (bidder of bidderList(); track bidder.id) {
                    <tr>
                      <td data-label="Bidder">
                        <span class="cell-primary">{{
                          bidder.companyName ?? bidder.contactPerson
                        }}</span>
                        <span class="text-mono-id">{{ bidder.id }}</span>
                      </td>
                      <td data-label="Contact">
                        <span class="cell-primary contact-name">{{ bidder.contactPerson }}</span>
                        <p class="text-meta">{{ bidder.phone }}</p>
                      </td>
                      <td data-label="Associated user">
                        @if (bidder.user; as user) {
                          <span class="text-meta">{{ user.email }}</span>
                        } @else {
                          <span class="badge badge-warning">No linked user</span>
                        }
                      </td>
                      <td data-label="Status">
                        <app-account-status-badge [status]="bidder.status" />
                      </td>
                      <td data-label="Bids placed" class="col-numeric">
                        <span class="text-numeric">{{ bidder.bidCount ?? 0 }}</span>
                      </td>
                      <td data-label="Created">
                        <span class="text-meta">{{ dateTime(bidder.createdAt) }}</span>
                      </td>
                      <td data-label="Actions" class="cell-actions">
                        <button
                          type="button"
                          class="btn btn-ghost btn-sm"
                          (click)="openEdit(bidder)"
                        >
                          <app-icon name="edit" [size]="14" />
                          Edit
                        </button>
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

    @if (dialogOpen()) {
      <app-dialog
        [title]="editing() ? 'Edit bidder' : 'Create bidder profile'"
        [subtitle]="
          editing()
            ? (editingBidder()!.companyName ?? editingBidder()!.contactPerson)
            : 'Links a user account to a bidder record.'
        "
        icon="user"
        size="lg"
        [confirmLabel]="editing() ? 'Save changes' : 'Create bidder'"
        [busy]="saving()"
        (confirmed)="save()"
        (dismissed)="closeDialog()"
      >
        @if (dialogFailure(); as failure) {
          <div class="dialog-alert">
            <app-alert tone="danger" [title]="failure.message" [message]="failure.detail ?? ''" />
          </div>
        }

        <form [formGroup]="form" (ngSubmit)="save()" novalidate>
          @if (!editing()) {
            <div class="form-section-head dialog-section-head">
              <span class="form-section-index">1</span>
              <div>
                <p class="form-section-title">Login account</p>
                <p class="form-section-desc">
                  A new bidder account is created with this email address.
                </p>
              </div>
            </div>

            <div class="form-grid">
              <app-form-field
                label="Email address"
                [required]="true"
                [control]="email"
                [errorMap]="emailErrors"
                controlId="bidder-email"
              >
                <input
                  id="bidder-email"
                  type="email"
                  class="form-input"
                  formControlName="email"
                  autocomplete="off"
                />
              </app-form-field>

              <app-form-field
                label="First name"
                [control]="firstName"
                controlId="bidder-first-name"
              >
                <input
                  id="bidder-first-name"
                  type="text"
                  class="form-input"
                  formControlName="firstName"
                />
              </app-form-field>

              <app-form-field label="Last name" [control]="lastName" controlId="bidder-last-name">
                <input
                  id="bidder-last-name"
                  type="text"
                  class="form-input"
                  formControlName="lastName"
                />
              </app-form-field>
            </div>
          } @else if (editingBidder()?.user?.email) {
            <app-readonly-field
              label="Associated user"
              [value]="editingBidder()!.user!.email"
              hint="The login linked to this bidder record."
            />
          }

          <div class="form-section-head dialog-section-head">
            <span class="form-section-index">{{ editing() ? '1' : '2' }}</span>
            <div>
              <p class="form-section-title">Bidder details</p>
              <p class="form-section-desc">
                Company name is optional — an individual bidder may not have one.
              </p>
            </div>
          </div>

          <div class="form-grid">
            <div class="form-grid-full">
              <app-form-field
                label="Company name"
                [control]="companyName"
                controlId="bidder-company"
              >
                <input
                  id="bidder-company"
                  type="text"
                  class="form-input"
                  formControlName="companyName"
                />
              </app-form-field>
            </div>

            <app-form-field
              label="Contact person"
              [required]="true"
              [control]="contactPerson"
              [errorMap]="requiredErrors"
              controlId="bidder-contact"
            >
              <input
                id="bidder-contact"
                type="text"
                class="form-input"
                formControlName="contactPerson"
              />
            </app-form-field>

            <app-form-field
              label="Phone"
              [required]="true"
              [control]="phone"
              [errorMap]="requiredErrors"
              controlId="bidder-phone"
            >
              <input id="bidder-phone" type="tel" class="form-input" formControlName="phone" />
            </app-form-field>

            <div class="form-grid-full">
              <app-form-field label="Address" [control]="address" controlId="bidder-address">
                <textarea
                  id="bidder-address"
                  class="form-textarea"
                  rows="2"
                  formControlName="address"
                ></textarea>
              </app-form-field>
            </div>
          </div>
        </form>
      </app-dialog>
    }
  `,
  styles: [
    `
      .contact-name {
        display: block;
      }
      .dialog-alert {
        margin-bottom: var(--sp-4);
      }
      .dialog-section-head {
        margin-bottom: var(--sp-4);
      }
      .dialog-section-head:not(:first-child) {
        margin-top: var(--sp-5);
        padding-top: var(--sp-5);
        border-top: 1px solid var(--c-border);
      }
    `,
  ],
})
export class AdminBiddersComponent {
  private readonly fb = inject(FormBuilder);
  private readonly bidderService = inject(BidderService);
  private readonly notifications = inject(NotificationService);

  readonly bidders = new AsyncResource<Paginated<Bidder>>();

  readonly searchInput = signal('');
  readonly page = signal(1);

  readonly dialogOpen = signal(false);
  readonly editing = signal(false);
  readonly editingBidder = signal<Bidder | null>(null);
  readonly saving = signal(false);
  readonly actionFailure = signal<ApiFailure | null>(null);
  readonly dialogFailure = signal<ApiFailure | null>(null);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    firstName: [''],
    lastName: [''],
    companyName: [''],
    contactPerson: ['', [Validators.required]],
    phone: ['', [Validators.required]],
    address: [''],
  });

  get email() {
    return this.form.controls.email;
  }
  get firstName() {
    return this.form.controls.firstName;
  }
  get lastName() {
    return this.form.controls.lastName;
  }
  get companyName() {
    return this.form.controls.companyName;
  }
  get contactPerson() {
    return this.form.controls.contactPerson;
  }
  get phone() {
    return this.form.controls.phone;
  }
  get address() {
    return this.form.controls.address;
  }

  readonly emailErrors = {
    required: 'Email address is required',
    email: 'Enter a valid email address',
  };
  readonly requiredErrors = { required: 'This field is required' };

  readonly bidderList = computed(() => this.bidders.data()?.items ?? []);
  readonly meta = computed(
    () => this.bidders.data()?.meta ?? { total: 0, page: 1, limit: 12, totalPages: 1 },
  );

  constructor() {
    this.reload();
  }

  reload(): void {
    this.bidders.load(
      this.bidderService.list({
        page: this.page(),
        limit: 12,
        search: this.searchInput() || undefined,
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

  setPage(page: number): void {
    this.page.set(page);
    this.reload();
  }

  clearSearch(): void {
    this.searchInput.set('');
    this.page.set(1);
    this.reload();
  }

  openCreate(): void {
    this.editing.set(false);
    this.editingBidder.set(null);
    this.dialogFailure.set(null);
    this.form.reset({
      email: '',
      firstName: '',
      lastName: '',
      companyName: '',
      contactPerson: '',
      phone: '',
      address: '',
    });
    this.dialogOpen.set(true);
  }

  openEdit(bidder: Bidder): void {
    this.editing.set(true);
    this.editingBidder.set(bidder);
    this.dialogFailure.set(null);
    this.form.reset({
      email: bidder.user?.email ?? '',
      firstName: bidder.user?.firstName ?? '',
      lastName: bidder.user?.lastName ?? '',
      companyName: bidder.companyName ?? '',
      contactPerson: bidder.contactPerson,
      phone: bidder.phone,
      address: bidder.address ?? '',
    });
    this.dialogOpen.set(true);
  }

  closeDialog(): void {
    if (this.saving()) return;
    this.dialogOpen.set(false);
    this.editingBidder.set(null);
    this.dialogFailure.set(null);
  }

  save(): void {
    const bidder = this.editingBidder();

    if (!bidder) {
      if (this.form.invalid) {
        this.form.markAllAsTouched();
        return;
      }
    } else if (this.contactPerson.invalid || this.phone.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.dialogFailure.set(null);
    this.actionFailure.set(null);

    const value = this.form.getRawValue();

    const request$ = bidder
      ? this.bidderService.update(bidder.id, {
          companyName: value.companyName.trim(),
          contactPerson: value.contactPerson.trim(),
          phone: value.phone.trim(),
          address: value.address.trim(),
        })
      : this.bidderService.create({
          email: value.email.trim(),
          firstName: value.firstName.trim() || undefined,
          lastName: value.lastName.trim() || undefined,
          companyName: value.companyName.trim() || undefined,
          contactPerson: value.contactPerson.trim(),
          phone: value.phone.trim(),
          address: value.address.trim(),
        });

    request$.subscribe({
      next: (saved) => {
        this.saving.set(false);
        this.dialogOpen.set(false);
        this.editingBidder.set(null);
        this.notifications.success(
          bidder ? 'Bidder updated' : 'Bidder created',
          saved.companyName ?? saved.contactPerson,
        );
        this.reload();
      },
      error: (error: unknown) => {
        this.saving.set(false);
        const failure = toApiFailure(error);
        this.dialogFailure.set(failure);

        if (failure.fieldErrors?.['email']) {
          this.email.setErrors({ server: true });
          this.email.markAsTouched();
        }
      },
    });
  }

  dateTime(iso: string | null | undefined): string {
    return formatDateTime(iso);
  }
}
