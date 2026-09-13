import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiFailure, toApiFailure } from '../../../core/domain/api-failure';
import { UserRole } from '../../../core/domain/enums';
import { formatDateTime } from '../../../core/domain/format';
import { Bidder, Paginated, User } from '../../../core/domain/models';
import { BidderService, UserService } from '../../../core/services/directory.service';
import { NotificationService } from '../../../core/services/notification.service';
import { AsyncResource } from '../../../core/state/async-resource';
import { DialogComponent } from '../../../shared/ui/dialog.component';
import { FormFieldComponent } from '../../../shared/ui/form-field.component';
import { MatIconComponent } from '../../../shared/ui/mat-icon.component';
import { PaginationComponent } from '../../../shared/ui/pagination.component';
import {
  EmptyStateComponent,
  ErrorStateComponent,
  TableSkeletonComponent,
} from '../../../shared/ui/state-block.component';
import { AlertComponent } from '../../../shared/ui/toast.component';

/**
 * Bidder Directory Management.
 *
 * Provides administration of registered bidder profiles participating in auctions.
 * Realigned 100% with NestJS backend `BiddersController` and DTOs:
 * - Query: search (phone), pagination.
 * - Create: userId, phone, address.
 * - Update: phone, address.
 */
@Component({
  selector: 'app-admin-bidders',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    DialogComponent,
    FormFieldComponent,
    MatIconComponent,
    PaginationComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    TableSkeletonComponent,
    AlertComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="admin-page">
      <!-- Header -->
      <header class="admin-header">
        <div class="admin-header-main">
          <div class="admin-badge-strip">
            <span class="admin-console-pill">
              <mat-icon fontIcon="badge" [size]="14" />
              Bidder Directory
            </span>
          </div>
          <h1 class="admin-title">Bidder Profiles</h1>
          <p class="admin-subtitle">
            Marketplace participant profiles linked to user accounts. Bids on auction lots are placed against these verified bidder identities.
          </p>
        </div>
        <div class="admin-actions">
          <button type="button" class="btn-admin-primary" (click)="openCreate()">
            <mat-icon fontIcon="person_add_alt" [size]="16" />
            <span>Create Bidder Profile</span>
          </button>
        </div>
      </header>

      @if (actionFailure(); as failure) {
        <app-alert tone="danger" [title]="failure.message">{{ failure.detail }}</app-alert>
      }

      <!-- Toolbar -->
      <div class="admin-toolbar">
        <div class="toolbar-search-box">
          <mat-icon fontIcon="search" [size]="18" class="search-icon" />
          <input
            id="bidder-search"
            type="search"
            class="admin-search-input"
            placeholder="Search by contact phone number..."
            [value]="searchInput()"
            (input)="onSearchInput($event)"
          />
        </div>

        <button
          type="button"
          class="btn-admin-secondary"
          (click)="reload()"
          [disabled]="bidders.isLoading()"
        >
          <mat-icon fontIcon="refresh" [size]="16" [class.spin]="bidders.isLoading()" />
          <span>Refresh</span>
        </button>
      </div>

      <!-- Main Content Card -->
      <div class="admin-card">
        @switch (true) {
          @case (bidders.isLoading() && !bidders.data()) {
            <app-table-skeleton [count]="5" />
          }
          @case (bidders.hasError()) {
            @if (bidders.error(); as failure) {
              <div class="card-inner-padding">
                <app-error-state
                  [failure]="failure"
                  [retrying]="bidders.isLoading()"
                  (retry)="reload()"
                />
              </div>
            }
          }
          @case (bidderList().length === 0) {
            <div class="card-inner-padding">
              <app-empty-state
                icon="user"
                [title]="searchInput() ? 'No bidders match search query' : 'No bidder profiles registered'"
                [description]="
                  searchInput()
                    ? 'Try searching with a different phone number.'
                    : 'Create a bidder profile to link a user account to the auction bidding floor.'
                "
              >
                @if (searchInput()) {
                  <button type="button" class="btn-admin-secondary" (click)="clearSearch()">
                    <mat-icon fontIcon="clear" [size]="14" />
                    <span>Clear Search</span>
                  </button>
                } @else {
                  <button type="button" class="btn-admin-primary" (click)="openCreate()">
                    <mat-icon fontIcon="person_add_alt" [size]="16" />
                    <span>Create Bidder</span>
                  </button>
                }
              </app-empty-state>
            </div>
          }
          @default {
            <div class="admin-table-container">
              <table class="admin-data-table">
                <thead>
                  <tr>
                    <th scope="col">Contact Phone</th>
                    <th scope="col">Physical / Business Address</th>
                    <th scope="col">Linked User ID</th>
                    <th scope="col">Registered</th>
                    <th scope="col" class="cell-action-col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  @for (bidder of bidderList(); track bidder.id) {
                    <tr>
                      <td>
                        <div class="bidder-identity-cell">
                          <span class="bidder-avatar">
                            <mat-icon fontIcon="phone" [size]="16" />
                          </span>
                          <span class="cell-name-strong">{{ bidder.phone || 'No phone set' }}</span>
                        </div>
                      </td>
                      <td>
                        <span class="cell-address-preview" [title]="bidder.address || ''">
                          {{ bidder.address || '—' }}
                        </span>
                      </td>
                      <td>
                        <span class="mono-id-tag">{{ bidder.userId }}</span>
                      </td>
                      <td>
                        <span class="cell-text-muted">{{ dateTime(bidder.createdAt) }}</span>
                      </td>
                      <td class="cell-action-col">
                        <button
                          type="button"
                          class="btn-admin-table-action"
                          (click)="openEdit(bidder)"
                        >
                          <mat-icon fontIcon="edit" [size]="14" />
                          <span>Edit</span>
                        </button>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>

            <div class="pagination-footer">
              <app-pagination [meta]="meta()" (pageChange)="setPage($event)" />
            </div>
          }
        }
      </div>
    </div>

    <!-- Create / Edit Dialog -->
    @if (dialogOpen()) {
      <app-dialog
        [title]="editing() ? 'Edit Bidder Profile' : 'Create Bidder Profile'"
        [subtitle]="
          editing()
            ? 'Update phone and address details for bidder ' + (editingBidder()!.phone ?? editingBidder()!.userId)
            : 'Link a verified bidding profile to an authorized bidder user account.'
        "
        icon="user"
        [confirmLabel]="editing() ? 'Save Changes' : 'Create Bidder'"
        [busy]="saving()"
        (confirmed)="save()"
        (dismissed)="closeDialog()"
      >
        @if (dialogFailure(); as failure) {
          <div class="dialog-alert">
            <app-alert tone="danger" [title]="failure.message" [message]="failure.detail ?? ''" />
          </div>
        }

        <form [formGroup]="form" (ngSubmit)="save()" novalidate class="admin-dialog-form">
          <!-- Associated User (Editable on create, Readonly on edit) -->
          @if (!editing()) {
            <app-form-field
              label="Linked User Account"
              [required]="true"
              [control]="userIdCtrl"
              [errorMap]="requiredErrors"
              hint="Select a user account with BIDDER role, or enter their User UUID."
              controlId="bidder-user-id"
            >
              @if (bidderUsers().length > 0) {
                <select id="bidder-user-id" class="form-select" formControlName="userId">
                  <option value="" disabled>Select a bidder user...</option>
                  @for (u of bidderUsers(); track u.id) {
                    <option [value]="u.id">{{ u.name }} ({{ u.email }})</option>
                  }
                </select>
              } @else {
                <input
                  id="bidder-user-id"
                  type="text"
                  class="form-input"
                  formControlName="userId"
                  placeholder="Enter User UUID (e.g. 123e4567-e89b-12d3-a456-426614174000)"
                />
              }
            </app-form-field>
          } @else {
            <div class="readonly-field-group">
              <label class="readonly-label">Linked User ID (Immutable)</label>
              <div class="readonly-box">{{ editingBidder()?.userId }}</div>
            </div>
          }

          <!-- Phone -->
          <app-form-field
            label="Phone Number"
            [control]="phoneCtrl"
            hint="Contact phone used for settlement notification."
            controlId="bidder-phone"
          >
            <input
              id="bidder-phone"
              type="tel"
              class="form-input"
              formControlName="phone"
              placeholder="e.g. +62 812 3456 7890"
            />
          </app-form-field>

          <!-- Address -->
          <app-form-field
            label="Delivery / Billing Address"
            [control]="addressCtrl"
            hint="Physical location or corporate office address."
            controlId="bidder-address"
          >
            <textarea
              id="bidder-address"
              class="form-textarea"
              rows="3"
              formControlName="address"
              placeholder="e.g. Jl. Jend. Sudirman Kav. 52-53, Jakarta Selatan"
            ></textarea>
          </app-form-field>
        </form>
      </app-dialog>
    }
  `,
  styles: [
    `
      .admin-page {
        display: flex;
        flex-direction: column;
        gap: 24px;
        padding: 24px 28px 48px;
        max-width: 1400px;
        margin: 0 auto;
        color: #172033;
      }

      .admin-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 24px;
        padding-bottom: 20px;
        border-bottom: 1px solid #ddd9d0;
      }

      .admin-badge-strip {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 8px;
      }

      .admin-console-pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px;
        font-size: 0.6875rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        background: #172033;
        color: #c6a15b;
        border-radius: 4px;

        mat-icon {
          color: #c6a15b;
        }
      }

      .admin-title {
        font-size: 1.625rem;
        font-weight: 700;
        color: #172033;
        letter-spacing: -0.02em;
        line-height: 1.2;
        margin: 0 0 6px 0;
      }

      .admin-subtitle {
        font-size: 0.875rem;
        color: #667085;
        margin: 0;
        max-width: 720px;
        line-height: 1.5;
      }

      .btn-admin-primary {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        height: 38px;
        padding: 0 16px;
        font-size: 0.8125rem;
        font-weight: 600;
        background: #172033;
        color: #ffffff;
        border: 1px solid #172033;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.15s ease;

        mat-icon {
          color: #c6a15b;
        }

        &:hover {
          background: #222e46;
          border-color: #222e46;
        }
      }

      .btn-admin-secondary {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        height: 38px;
        padding: 0 16px;
        font-size: 0.8125rem;
        font-weight: 600;
        background: #ffffff;
        color: #172033;
        border: 1px solid #ddd9d0;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.15s ease;

        &:hover:not(:disabled) {
          border-color: #c6a15b;
          background: #fcfbf8;
        }

        &:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .spin {
          animation: spin 1s linear infinite;
        }
      }

      @keyframes spin {
        100% {
          transform: rotate(360deg);
        }
      }

      /* Toolbar */
      .admin-toolbar {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
      }

      .toolbar-search-box {
        display: flex;
        align-items: center;
        flex: 1;
        min-width: 260px;
        position: relative;

        .search-icon {
          position: absolute;
          left: 12px;
          color: #98a2b3;
          pointer-events: none;
        }

        .admin-search-input {
          width: 100%;
          height: 38px;
          padding: 0 14px 0 38px;
          font-size: 0.8125rem;
          color: #172033;
          background: #ffffff;
          border: 1px solid #ddd9d0;
          border-radius: 6px;
          transition: border-color 0.15s ease;

          &:focus {
            outline: none;
            border-color: #c6a15b;
            box-shadow: 0 0 0 3px rgba(198, 161, 91, 0.15);
          }

          &::placeholder {
            color: #98a2b3;
          }
        }
      }

      /* Main Card & Table */
      .admin-card {
        background: #ffffff;
        border: 1px solid #ddd9d0;
        border-radius: 8px;
        overflow: hidden;
      }

      .card-inner-padding {
        padding: 24px;
      }

      .admin-table-container {
        overflow-x: auto;
      }

      .admin-data-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.8125rem;

        th {
          padding: 12px 18px;
          text-align: left;
          font-size: 0.6875rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: #667085;
          background: #fcfbf8;
          border-bottom: 1px solid #ddd9d0;
          white-space: nowrap;
        }

        td {
          padding: 12px 18px;
          vertical-align: middle;
          border-bottom: 1px solid #f5f3ef;
          color: #172033;
        }

        tr:last-child td {
          border-bottom: none;
        }

        tbody tr:hover {
          background-color: #faf8f5;
        }
      }

      .bidder-identity-cell {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .bidder-avatar {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 30px;
        height: 30px;
        background: #edf3f8;
        color: #3f668c;
        border: 1px solid #b8d0e5;
        border-radius: 6px;
        flex-shrink: 0;
      }

      .cell-name-strong {
        font-weight: 600;
        color: #172033;
      }

      .cell-text-secondary {
        color: #667085;
      }

      .cell-text-muted {
        color: #98a2b3;
      }

      .cell-address-preview {
        display: block;
        max-width: 280px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: #667085;
      }

      .mono-id-tag {
        font-family: var(--font-mono, monospace);
        font-size: 0.6875rem;
        color: #667085;
        background: #f5f3ef;
        padding: 2px 6px;
        border-radius: 4px;
        border: 1px solid #ddd9d0;
      }

      .cell-action-col {
        text-align: right;
      }

      .btn-admin-table-action {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 5px 12px;
        font-size: 0.75rem;
        font-weight: 600;
        color: #172033;
        background: #ffffff;
        border: 1px solid #ddd9d0;
        border-radius: 4px;
        cursor: pointer;
        transition: all 0.15s ease;

        &:hover {
          background: #172033;
          color: #ffffff;
          border-color: #172033;

          mat-icon {
            color: #c6a15b;
          }
        }
      }

      .pagination-footer {
        padding: 12px 18px;
        border-top: 1px solid #ddd9d0;
        background: #fcfbf8;
      }

      /* Dialog Form Styles */
      .admin-dialog-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .readonly-field-group {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .readonly-label {
        font-size: 0.8125rem;
        font-weight: 600;
        color: #667085;
      }

      .readonly-box {
        padding: 8px 12px;
        background: #f5f3ef;
        border: 1px solid #ddd9d0;
        border-radius: 6px;
        font-size: 0.8125rem;
        color: #172033;
        font-family: var(--font-mono, monospace);
      }

      .dialog-alert {
        margin-bottom: 16px;
      }
    `,
  ],
})
export class AdminBiddersComponent {
  private readonly fb = inject(FormBuilder);
  private readonly bidderService = inject(BidderService);
  private readonly userService = inject(UserService);
  private readonly notifications = inject(NotificationService);

  readonly bidders = new AsyncResource<Paginated<Bidder>>();
  readonly users = new AsyncResource<Paginated<User>>();

  readonly searchInput = signal('');
  readonly page = signal(1);

  readonly dialogOpen = signal(false);
  readonly editing = signal(false);
  readonly editingBidder = signal<Bidder | null>(null);
  readonly saving = signal(false);
  readonly actionFailure = signal<ApiFailure | null>(null);
  readonly dialogFailure = signal<ApiFailure | null>(null);

  readonly form = this.fb.nonNullable.group({
    userId: ['', [Validators.required]],
    phone: [''],
    address: [''],
  });

  get userIdCtrl() {
    return this.form.controls.userId;
  }
  get phoneCtrl() {
    return this.form.controls.phone;
  }
  get addressCtrl() {
    return this.form.controls.address;
  }

  readonly requiredErrors = { required: 'This field is required' };

  readonly bidderList = computed(() => this.bidders.data()?.items ?? []);
  readonly meta = computed(
    () => this.bidders.data()?.meta ?? { total: 0, page: 1, limit: 12, totalPages: 1 },
  );

  readonly bidderUsers = computed(
    () => this.users.data()?.items.filter((u) => u.role === UserRole.BIDDER) ?? [],
  );

  constructor() {
    this.reload();
    this.loadBidderUsers();
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

  loadBidderUsers(): void {
    this.users.load(this.userService.list({ role: UserRole.BIDDER, limit: 100 }));
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
    this.userIdCtrl.setValidators([Validators.required]);
    this.userIdCtrl.updateValueAndValidity();
    this.form.reset({
      userId: this.bidderUsers()[0]?.id ?? '',
      phone: '',
      address: '',
    });
    this.dialogOpen.set(true);
  }

  openEdit(bidder: Bidder): void {
    this.editing.set(true);
    this.editingBidder.set(bidder);
    this.dialogFailure.set(null);
    this.userIdCtrl.clearValidators();
    this.userIdCtrl.updateValueAndValidity();
    this.form.reset({
      userId: bidder.userId,
      phone: bidder.phone ?? '',
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
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.dialogFailure.set(null);
    this.actionFailure.set(null);

    const value = this.form.getRawValue();
    const bidder = this.editingBidder();

    const request$ = bidder
      ? this.bidderService.update(bidder.id, {
          phone: value.phone?.trim() || null,
          address: value.address?.trim() || null,
        })
      : this.bidderService.create({
          userId: value.userId.trim(),
          phone: value.phone?.trim() || undefined,
          address: value.address?.trim() || undefined,
        });

    request$.subscribe({
      next: (saved) => {
        this.saving.set(false);
        this.dialogOpen.set(false);
        this.editingBidder.set(null);
        this.notifications.success(
          bidder ? 'Bidder profile updated' : 'Bidder profile created',
          saved.phone ?? saved.id,
        );
        this.reload();
      },
      error: (error: unknown) => {
        this.saving.set(false);
        const failure = toApiFailure(error);
        this.dialogFailure.set(failure);
      },
    });
  }

  dateTime(iso: string | null | undefined): string {
    return formatDateTime(iso);
  }
}
