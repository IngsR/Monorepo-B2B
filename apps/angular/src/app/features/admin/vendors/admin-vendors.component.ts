import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiFailure, toApiFailure } from '../../../core/domain/api-failure';
import { AccountStatus } from '../../../core/domain/enums';
import { formatDateTime } from '../../../core/domain/format';
import { Paginated, Vendor } from '../../../core/domain/models';
import { VendorService } from '../../../core/services/directory.service';
import { NotificationService } from '../../../core/services/notification.service';
import { AsyncResource } from '../../../core/state/async-resource';
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
 * Vendor management.
 *
 * A vendor profile is the record that owns products. Each profile belongs to
 * exactly one user account, and the associated user is shown explicitly so an
 * administrator can see the link between login and company.
 *
 * Only the fields the backend models are shown — company, contact, phone,
 * address, description and status. There is no billing, contract or commission
 * concept in this system.
 */
@Component({
  selector: 'app-admin-vendors',
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
          <h1 class="page-title">Vendors</h1>
          <p class="page-subtitle">
            Vendor records and the user accounts they belong to. A vendor owns the products that
            auctions are created from.
          </p>
        </div>
        <div class="page-actions">
          <app-button label="New vendor" icon="plus" variant="primary" (clicked)="openCreate()" />
        </div>
      </header>

      @if (actionFailure(); as failure) {
        <app-alert tone="danger" [title]="failure.message">{{ failure.detail }}</app-alert>
      }

      <div class="toolbar">
        <div class="toolbar-field toolbar-grow">
          <label class="form-label" for="vendor-search">Search</label>
          <input
            id="vendor-search"
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
            [disabled]="vendors.isLoading()"
          >
            <app-icon name="refresh" [size]="15" />
            Refresh
          </button>
        </div>
      </div>

      <div class="card">
        @switch (true) {
          @case (vendors.isLoading() && !vendors.data()) {
            <app-table-skeleton [count]="5" />
          }
          @case (vendors.hasError()) {
            @if (vendors.error(); as failure) {
              <app-error-state
                [failure]="failure"
                [retrying]="vendors.isLoading()"
                (retry)="reload()"
              />
            }
          }
          @case (vendorList().length === 0) {
            <app-empty-state
              icon="building"
              [title]="searchInput() ? 'No vendors match this search' : 'No vendors yet'"
              [description]="
                searchInput()
                  ? 'Try a different search term.'
                  : 'Create a vendor profile to let a user publish products and run auctions.'
              "
            >
              @if (searchInput()) {
                <button type="button" class="btn btn-secondary" (click)="clearSearch()">
                  Clear search
                </button>
              } @else {
                <app-button
                  label="New vendor"
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
                    <th scope="col">Company</th>
                    <th scope="col">Contact</th>
                    <th scope="col">Associated user</th>
                    <th scope="col">Status</th>
                    <th scope="col" class="col-numeric">Products</th>
                    <th scope="col">Created</th>
                    <th scope="col" class="cell-actions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  @for (vendor of vendorList(); track vendor.id) {
                    <tr>
                      <td data-label="Company">
                        <div class="vendor-cell">
                          <span class="avatar avatar-sm avatar-neutral">{{
                            initials(vendor)
                          }}</span>
                          <div>
                            <span class="cell-primary">{{ vendor.companyName }}</span>
                            <span class="text-mono-id">{{ vendor.id }}</span>
                          </div>
                        </div>
                      </td>
                      <td data-label="Contact">
                        <span class="cell-primary contact-name">{{ vendor.contactPerson }}</span>
                        <p class="text-meta">{{ vendor.phone }}</p>
                      </td>
                      <td data-label="Associated user">
                        @if (vendor.user; as user) {
                          <span class="text-meta">{{ user.email }}</span>
                        } @else {
                          <span class="badge badge-warning">No linked user</span>
                        }
                      </td>
                      <td data-label="Status">
                        <app-account-status-badge [status]="vendor.status" />
                      </td>
                      <td data-label="Products" class="col-numeric">
                        <span class="text-numeric">{{ vendor.productCount ?? 0 }}</span>
                      </td>
                      <td data-label="Created">
                        <span class="text-meta">{{ dateTime(vendor.createdAt) }}</span>
                      </td>
                      <td data-label="Actions" class="cell-actions">
                        <button
                          type="button"
                          class="btn btn-ghost btn-sm"
                          (click)="openEdit(vendor)"
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
        [title]="editing() ? 'Edit vendor' : 'Create vendor profile'"
        [subtitle]="
          editing() ? editingVendor()!.companyName : 'Links a user account to a vendor record.'
        "
        icon="building"
        size="lg"
        [confirmLabel]="editing() ? 'Save changes' : 'Create vendor'"
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
                  The user who will sign in. A new vendor account is created with this email.
                </p>
              </div>
            </div>

            <div class="form-grid">
              <app-form-field
                label="Email address"
                [required]="true"
                [control]="email"
                [errorMap]="emailErrors"
                controlId="vendor-email"
              >
                <input
                  id="vendor-email"
                  type="email"
                  class="form-input"
                  formControlName="email"
                  autocomplete="off"
                />
              </app-form-field>

              <app-form-field
                label="First name"
                [control]="firstName"
                controlId="vendor-first-name"
              >
                <input
                  id="vendor-first-name"
                  type="text"
                  class="form-input"
                  formControlName="firstName"
                />
              </app-form-field>

              <app-form-field label="Last name" [control]="lastName" controlId="vendor-last-name">
                <input
                  id="vendor-last-name"
                  type="text"
                  class="form-input"
                  formControlName="lastName"
                />
              </app-form-field>
            </div>
          } @else if (editingVendor()?.user?.email) {
            <app-readonly-field
              label="Associated user"
              [value]="editingVendor()!.user!.email"
              hint="The login linked to this vendor record."
            />
          }

          <div class="form-section-head dialog-section-head">
            <span class="form-section-index">{{ editing() ? '1' : '2' }}</span>
            <div>
              <p class="form-section-title">Vendor details</p>
              <p class="form-section-desc">Company identity and contact information.</p>
            </div>
          </div>

          <app-form-field
            label="Company name"
            [required]="true"
            [control]="companyName"
            [errorMap]="requiredErrors"
            controlId="vendor-company"
          >
            <input
              id="vendor-company"
              type="text"
              class="form-input"
              formControlName="companyName"
            />
          </app-form-field>

          <div class="form-grid">
            <app-form-field
              label="Contact person"
              [required]="true"
              [control]="contactPerson"
              [errorMap]="requiredErrors"
              controlId="vendor-contact"
            >
              <input
                id="vendor-contact"
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
              controlId="vendor-phone"
            >
              <input id="vendor-phone" type="tel" class="form-input" formControlName="phone" />
            </app-form-field>

            <div class="form-grid-full">
              <app-form-field label="Address" [control]="address" controlId="vendor-address">
                <textarea
                  id="vendor-address"
                  class="form-textarea"
                  rows="2"
                  formControlName="address"
                ></textarea>
              </app-form-field>
            </div>

            <div class="form-grid-full">
              <app-form-field
                label="Description"
                [control]="description"
                controlId="vendor-description"
              >
                <textarea
                  id="vendor-description"
                  class="form-textarea"
                  rows="2"
                  formControlName="description"
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
      .vendor-cell {
        display: flex;
        align-items: center;
        gap: var(--sp-3);
      }
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
export class AdminVendorsComponent {
  private readonly fb = inject(FormBuilder);
  private readonly vendorService = inject(VendorService);
  private readonly notifications = inject(NotificationService);

  readonly vendors = new AsyncResource<Paginated<Vendor>>();

  readonly searchInput = signal('');
  readonly page = signal(1);

  readonly dialogOpen = signal(false);
  readonly editing = signal(false);
  readonly editingVendor = signal<Vendor | null>(null);
  readonly saving = signal(false);
  readonly actionFailure = signal<ApiFailure | null>(null);
  readonly dialogFailure = signal<ApiFailure | null>(null);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    firstName: [''],
    lastName: [''],
    companyName: ['', [Validators.required]],
    contactPerson: ['', [Validators.required]],
    phone: ['', [Validators.required]],
    address: [''],
    description: [''],
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
  get description() {
    return this.form.controls.description;
  }

  readonly emailErrors = {
    required: 'Email address is required',
    email: 'Enter a valid email address',
  };
  readonly requiredErrors = { required: 'This field is required' };

  readonly vendorList = computed(() => this.vendors.data()?.items ?? []);
  readonly meta = computed(
    () => this.vendors.data()?.meta ?? { total: 0, page: 1, limit: 12, totalPages: 1 },
  );

  constructor() {
    this.reload();
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
    this.form.reset({
      email: '',
      firstName: '',
      lastName: '',
      companyName: '',
      contactPerson: '',
      phone: '',
      address: '',
      description: '',
    });
    this.dialogOpen.set(true);
  }

  openEdit(vendor: Vendor): void {
    this.editing.set(true);
    this.editingVendor.set(vendor);
    this.dialogFailure.set(null);
    this.form.reset({
      email: vendor.user?.email ?? '',
      firstName: vendor.user?.firstName ?? '',
      lastName: vendor.user?.lastName ?? '',
      companyName: vendor.companyName,
      contactPerson: vendor.contactPerson,
      phone: vendor.phone,
      address: vendor.address ?? '',
      description: vendor.description ?? '',
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
    const vendor = this.editingVendor();

    // Email is only required when creating the login alongside the profile.
    if (!vendor && this.email.invalid) this.email.markAsTouched();
    if (this.companyName.invalid || this.contactPerson.invalid || this.phone.invalid) {
      this.form.markAllAsTouched();
    }
    if (this.companyName.invalid || this.contactPerson.invalid || this.phone.invalid) return;
    if (!vendor && this.email.invalid) return;

    this.saving.set(true);
    this.dialogFailure.set(null);
    this.actionFailure.set(null);

    const value = this.form.getRawValue();

    const request$ = vendor
      ? this.vendorService.update(vendor.id, {
          companyName: value.companyName.trim(),
          contactPerson: value.contactPerson.trim(),
          phone: value.phone.trim(),
          address: value.address.trim(),
          description: value.description.trim(),
        })
      : this.vendorService.create({
          email: value.email.trim(),
          firstName: value.firstName.trim() || undefined,
          lastName: value.lastName.trim() || undefined,
          companyName: value.companyName.trim(),
          contactPerson: value.contactPerson.trim(),
          phone: value.phone.trim(),
          address: value.address.trim(),
          description: value.description.trim(),
        });

    request$.subscribe({
      next: (saved) => {
        this.saving.set(false);
        this.dialogOpen.set(false);
        this.editingVendor.set(null);
        this.notifications.success(vendor ? 'Vendor updated' : 'Vendor created', saved.companyName);
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
        if (failure.fieldErrors?.['companyName']) {
          this.companyName.setErrors({ server: true });
          this.companyName.markAsTouched();
        }
      },
    });
  }

  initials(vendor: Vendor): string {
    return vendor.companyName
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word[0])
      .join('')
      .toUpperCase();
  }

  dateTime(iso: string | null | undefined): string {
    return formatDateTime(iso);
  }

  protected readonly AccountStatus = AccountStatus;
}
