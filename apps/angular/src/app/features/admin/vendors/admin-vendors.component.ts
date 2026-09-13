import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiFailure, toApiFailure } from '../../../core/domain/api-failure';
import { UserRole } from '../../../core/domain/enums';
import { formatDateTime } from '../../../core/domain/format';
import { Paginated, User, Vendor } from '../../../core/domain/models';
import { UserService, VendorService } from '../../../core/services/directory.service';
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
 * Vendor Directory Management.
 *
 * Provides administration of enterprise vendor entities that own product catalogs.
 * Realigned 100% with NestJS backend `VendorsController` and DTOs:
 * - Query: search (companyName), pagination.
 * - Create: userId, companyName, companyAddress, phone.
 * - Update: companyName, companyAddress, phone.
 */
@Component({
  selector: 'app-admin-vendors',
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
              <mat-icon fontIcon="storefront" [size]="14" />
              Vendor Directory
            </span>
          </div>
          <h1 class="admin-title">Vendor Profiles</h1>
          <p class="admin-subtitle">
            Enterprise supplier profiles attached to platform user accounts. Vendors own product catalogs and can schedule auction events.
          </p>
        </div>
        <div class="admin-actions">
          <button type="button" class="btn-admin-primary" (click)="openCreate()">
            <mat-icon fontIcon="add_business" [size]="16" />
            <span>Create Vendor Profile</span>
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
            id="vendor-search"
            type="search"
            class="admin-search-input"
            placeholder="Search by company name..."
            [value]="searchInput()"
            (input)="onSearchInput($event)"
          />
        </div>

        <button
          type="button"
          class="btn-admin-secondary"
          (click)="reload()"
          [disabled]="vendors.isLoading()"
        >
          <mat-icon fontIcon="refresh" [size]="16" [class.spin]="vendors.isLoading()" />
          <span>Refresh</span>
        </button>
      </div>

      <!-- Main Content Card -->
      <div class="admin-card">
        @switch (true) {
          @case (vendors.isLoading() && !vendors.data()) {
            <app-table-skeleton [count]="5" />
          }
          @case (vendors.hasError()) {
            @if (vendors.error(); as failure) {
              <div class="card-inner-padding">
                <app-error-state
                  [failure]="failure"
                  [retrying]="vendors.isLoading()"
                  (retry)="reload()"
                />
              </div>
            }
          }
          @case (vendorList().length === 0) {
            <div class="card-inner-padding">
              <app-empty-state
                icon="building"
                [title]="searchInput() ? 'No vendors match search query' : 'No vendor profiles registered'"
                [description]="
                  searchInput()
                    ? 'Try searching with a different company name.'
                    : 'Create a vendor profile and link it to a user account with the VENDOR role.'
                "
              >
                @if (searchInput()) {
                  <button type="button" class="btn-admin-secondary" (click)="clearSearch()">
                    <mat-icon fontIcon="clear" [size]="14" />
                    <span>Clear Search</span>
                  </button>
                } @else {
                  <button type="button" class="btn-admin-primary" (click)="openCreate()">
                    <mat-icon fontIcon="add_business" [size]="16" />
                    <span>Create Vendor</span>
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
                    <th scope="col">Company Name</th>
                    <th scope="col">Phone Contact</th>
                    <th scope="col">Company Address</th>
                    <th scope="col">Linked User ID</th>
                    <th scope="col">Registered</th>
                    <th scope="col" class="cell-action-col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  @for (vendor of vendorList(); track vendor.id) {
                    <tr>
                      <td>
                        <div class="vendor-identity-cell">
                          <span class="vendor-avatar">
                            <mat-icon fontIcon="business" [size]="16" />
                          </span>
                          <span class="cell-name-strong">{{ vendor.companyName }}</span>
                        </div>
                      </td>
                      <td>
                        <span class="cell-text-secondary">{{ vendor.phone || '—' }}</span>
                      </td>
                      <td>
                        <span class="cell-address-preview" [title]="vendor.companyAddress || ''">
                          {{ vendor.companyAddress || '—' }}
                        </span>
                      </td>
                      <td>
                        <span class="mono-id-tag">{{ vendor.userId }}</span>
                      </td>
                      <td>
                        <span class="cell-text-muted">{{ dateTime(vendor.createdAt) }}</span>
                      </td>
                      <td class="cell-action-col">
                        <button
                          type="button"
                          class="btn-admin-table-action"
                          (click)="openEdit(vendor)"
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
        [title]="editing() ? 'Edit Vendor Profile' : 'Create Vendor Profile'"
        [subtitle]="
          editing()
            ? 'Update company information for ' + editingVendor()!.companyName
            : 'Link a company profile to an authorized vendor user account.'
        "
        icon="building"
        [confirmLabel]="editing() ? 'Save Changes' : 'Create Vendor'"
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
              hint="Select a user account with VENDOR role, or enter their User UUID."
              controlId="vendor-user-id"
            >
              @if (vendorUsers().length > 0) {
                <select id="vendor-user-id" class="form-select" formControlName="userId">
                  <option value="" disabled>Select a vendor user...</option>
                  @for (u of vendorUsers(); track u.id) {
                    <option [value]="u.id">{{ u.name }} ({{ u.email }})</option>
                  }
                </select>
              } @else {
                <input
                  id="vendor-user-id"
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
              <div class="readonly-box">{{ editingVendor()?.userId }}</div>
            </div>
          }

          <!-- Company Name -->
          <app-form-field
            label="Company Name"
            [required]="true"
            [control]="companyNameCtrl"
            [errorMap]="requiredErrors"
            hint="The registered business name of the supplier."
            controlId="vendor-company"
          >
            <input
              id="vendor-company"
              type="text"
              class="form-input"
              formControlName="companyName"
              placeholder="e.g. PT Industri Prima Sukses"
            />
          </app-form-field>

          <!-- Phone -->
          <app-form-field
            label="Business Phone Number"
            [control]="phoneCtrl"
            hint="Direct contact line for auction settlement and logistics."
            controlId="vendor-phone"
          >
            <input
              id="vendor-phone"
              type="tel"
              class="form-input"
              formControlName="phone"
              placeholder="e.g. +62 21 555 1234"
            />
          </app-form-field>

          <!-- Company Address -->
          <app-form-field
            label="Company Address"
            [control]="companyAddressCtrl"
            hint="Headquarters or principal industrial facility address."
            controlId="vendor-address"
          >
            <textarea
              id="vendor-address"
              class="form-textarea"
              rows="3"
              formControlName="companyAddress"
              placeholder="e.g. Kawasan Industri MM2100, Blok C-12, Cikarang Barat, Bekasi"
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

      .vendor-identity-cell {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .vendor-avatar {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 30px;
        height: 30px;
        background: #edf5f1;
        color: #2f6b57;
        border: 1px solid #b4d8ca;
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
export class AdminVendorsComponent {
  private readonly fb = inject(FormBuilder);
  private readonly vendorService = inject(VendorService);
  private readonly userService = inject(UserService);
  private readonly notifications = inject(NotificationService);

  readonly vendors = new AsyncResource<Paginated<Vendor>>();
  readonly users = new AsyncResource<Paginated<User>>();

  readonly searchInput = signal('');
  readonly page = signal(1);

  readonly dialogOpen = signal(false);
  readonly editing = signal(false);
  readonly editingVendor = signal<Vendor | null>(null);
  readonly saving = signal(false);
  readonly actionFailure = signal<ApiFailure | null>(null);
  readonly dialogFailure = signal<ApiFailure | null>(null);

  readonly form = this.fb.nonNullable.group({
    userId: ['', [Validators.required]],
    companyName: ['', [Validators.required]],
    companyAddress: [''],
    phone: [''],
  });

  get userIdCtrl() {
    return this.form.controls.userId;
  }
  get companyNameCtrl() {
    return this.form.controls.companyName;
  }
  get companyAddressCtrl() {
    return this.form.controls.companyAddress;
  }
  get phoneCtrl() {
    return this.form.controls.phone;
  }

  readonly requiredErrors = { required: 'This field is required' };

  readonly vendorList = computed(() => this.vendors.data()?.items ?? []);
  readonly meta = computed(
    () => this.vendors.data()?.meta ?? { total: 0, page: 1, limit: 12, totalPages: 1 },
  );

  readonly vendorUsers = computed(
    () => this.users.data()?.items.filter((u) => u.role === UserRole.VENDOR) ?? [],
  );

  constructor() {
    this.reload();
    this.loadVendorUsers();
  }

  reload(): void {
    this.vendors.load(
      this.vendorService.list({
        page: this.page(),
        limit: 12,
        search: this.searchInput() || undefined,
      }),
      { keepData: true },
    );
  }

  loadVendorUsers(): void {
    this.users.load(this.userService.list({ role: UserRole.VENDOR, limit: 100 }));
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
    this.editingVendor.set(null);
    this.dialogFailure.set(null);
    this.userIdCtrl.setValidators([Validators.required]);
    this.userIdCtrl.updateValueAndValidity();
    this.form.reset({
      userId: this.vendorUsers()[0]?.id ?? '',
      companyName: '',
      companyAddress: '',
      phone: '',
    });
    this.dialogOpen.set(true);
  }

  openEdit(vendor: Vendor): void {
    this.editing.set(true);
    this.editingVendor.set(vendor);
    this.dialogFailure.set(null);
    this.userIdCtrl.clearValidators();
    this.userIdCtrl.updateValueAndValidity();
    this.form.reset({
      userId: vendor.userId,
      companyName: vendor.companyName,
      companyAddress: vendor.companyAddress ?? '',
      phone: vendor.phone ?? '',
    });
    this.dialogOpen.set(true);
  }

  closeDialog(): void {
    if (this.saving()) return;
    this.dialogOpen.set(false);
    this.editingVendor.set(null);
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
    const vendor = this.editingVendor();

    const request$ = vendor
      ? this.vendorService.update(vendor.id, {
          companyName: value.companyName.trim(),
          companyAddress: value.companyAddress?.trim() || null,
          phone: value.phone?.trim() || null,
        })
      : this.vendorService.create({
          userId: value.userId.trim(),
          companyName: value.companyName.trim(),
          companyAddress: value.companyAddress?.trim() || undefined,
          phone: value.phone?.trim() || undefined,
        });

    request$.subscribe({
      next: (saved) => {
        this.saving.set(false);
        this.dialogOpen.set(false);
        this.editingVendor.set(null);
        this.notifications.success(
          vendor ? 'Vendor profile updated' : 'Vendor profile created',
          saved.companyName,
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
