import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AccountStatus, UserRole } from '../../../core/domain/enums';
import { ApiFailure, toApiFailure } from '../../../core/domain/api-failure';
import { formatDateTime } from '../../../core/domain/format';
import { Paginated, User, UserQuery } from '../../../core/domain/models';
import { AsyncResource } from '../../../core/state/async-resource';
import { UserService } from '../../../core/services/directory.service';
import { NotificationService } from '../../../core/services/notification.service';
import { AccountStatusBadgeComponent } from '../../../shared/ui/badge.component';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { DialogComponent } from '../../../shared/ui/dialog.component';
import { FormFieldComponent } from '../../../shared/ui/form-field.component';
import { IconComponent } from '../../../shared/ui/icon.component';
import { PaginationComponent } from '../../../shared/ui/pagination.component';
import {
  EmptyStateComponent,
  ErrorStateComponent,
  TableSkeletonComponent,
} from '../../../shared/ui/state-block.component';
import { AlertComponent } from '../../../shared/ui/toast.component';

/**
 * User management.
 *
 * The identity records behind every vendor and bidder profile. The table shows
 * exactly what the API returns — id, name, email, role and status — and nothing
 * more. Creating a user is the first step; attaching a vendor or bidder profile
 * happens on those screens.
 *
 * Status and role are administrative fields: they are only editable here, and
 * the client cannot grant them to itself (the API rejects an attempt).
 */
@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    AccountStatusBadgeComponent,
    ButtonComponent,
    DialogComponent,
    FormFieldComponent,
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
          <h1 class="page-title">Users</h1>
          <p class="page-subtitle">
            Authentication identities and their platform role. A vendor or bidder user needs a
            matching profile before they can own products or place bids.
          </p>
        </div>
        <div class="page-actions">
          <app-button label="New user" icon="plus" variant="primary" (clicked)="openCreate()" />
        </div>
      </header>

      @if (actionFailure(); as failure) {
        <app-alert tone="danger" [title]="failure.message">{{ failure.detail }}</app-alert>
      }

      <div class="toolbar">
        <div class="toolbar-field toolbar-grow">
          <label class="form-label" for="user-search">Search</label>
          <input
            id="user-search"
            type="search"
            class="form-input"
            placeholder="Search by name, email or role"
            [value]="searchInput()"
            (input)="onSearchInput($event)"
          />
        </div>
        <div class="toolbar-field">
          <label class="form-label" for="user-role">Role</label>
          <select
            id="user-role"
            class="form-select"
            [value]="roleFilter()"
            (change)="setRole($event)"
          >
            <option value="ALL">All roles</option>
            <option [value]="UserRole.ADMIN">Admin</option>
            <option [value]="UserRole.VENDOR">Vendor</option>
            <option [value]="UserRole.BIDDER">Bidder</option>
          </select>
        </div>
        <div class="toolbar-field">
          <label class="form-label" for="user-status">Status</label>
          <select
            id="user-status"
            class="form-select"
            [value]="statusFilter()"
            (change)="setStatus($event)"
          >
            <option value="ALL">All statuses</option>
            <option [value]="AccountStatus.ACTIVE">Active</option>
            <option [value]="AccountStatus.INACTIVE">Inactive</option>
            <option [value]="AccountStatus.SUSPENDED">Suspended</option>
          </select>
        </div>
        <div class="toolbar-field">
          <button
            type="button"
            class="btn btn-secondary"
            (click)="reload()"
            [disabled]="users.isLoading()"
          >
            <app-icon name="refresh" [size]="15" />
            Refresh
          </button>
        </div>
      </div>

      <div class="card">
        @switch (true) {
          @case (users.isLoading() && !users.data()) {
            <app-table-skeleton [count]="6" />
          }
          @case (users.hasError()) {
            @if (users.error(); as failure) {
              <app-error-state
                [failure]="failure"
                [retrying]="users.isLoading()"
                (retry)="reload()"
              />
            }
          }
          @case (userList().length === 0) {
            <app-empty-state
              icon="users"
              [title]="hasFilters() ? 'No users match these filters' : 'No users yet'"
              [description]="
                hasFilters()
                  ? 'Try a different search term or clear the role and status filters.'
                  : 'Create a user account to give someone access to the platform.'
              "
            >
              @if (hasFilters()) {
                <button type="button" class="btn btn-secondary" (click)="clearFilters()">
                  Clear filters
                </button>
              } @else {
                <app-button
                  label="New user"
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
                    <th scope="col">User ID</th>
                    <th scope="col">Name</th>
                    <th scope="col">Email</th>
                    <th scope="col">Role</th>
                    <th scope="col">Status</th>
                    <th scope="col">Created</th>
                    <th scope="col" class="cell-actions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  @for (user of userList(); track user.id) {
                    <tr>
                      <td data-label="User ID">
                        <span class="text-mono-id">{{ user.id }}</span>
                      </td>
                      <td data-label="Name">
                        <div class="user-cell">
                          <span class="avatar avatar-sm avatar-neutral">{{ initials(user) }}</span>
                          <span class="cell-primary">{{ name(user) }}</span>
                        </div>
                      </td>
                      <td data-label="Email">
                        <span class="text-meta">{{ user.email }}</span>
                      </td>
                      <td data-label="Role">
                        <span class="badge badge-plain">{{ roleLabel(user.role) }}</span>
                      </td>
                      <td data-label="Status">
                        <app-account-status-badge [status]="user.status" />
                      </td>
                      <td data-label="Created">
                        <span class="text-meta">{{ dateTime(user.createdAt) }}</span>
                      </td>
                      <td data-label="Actions" class="cell-actions">
                        <button type="button" class="btn btn-ghost btn-sm" (click)="openEdit(user)">
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

    <!-- Create / edit -->
    @if (dialogOpen()) {
      <app-dialog
        [title]="editing() ? 'Edit user' : 'Create user'"
        [subtitle]="
          editing() ? editingUser()!.email : 'The account will be able to sign in immediately.'
        "
        icon="user"
        [confirmLabel]="editing() ? 'Save changes' : 'Create user'"
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
          <app-form-field
            label="Email address"
            [required]="true"
            [control]="email"
            [errorMap]="emailErrors"
            hint="Used to sign in and must be unique."
            controlId="user-email"
          >
            <input
              id="user-email"
              type="email"
              class="form-input"
              formControlName="email"
              autocomplete="off"
            />
          </app-form-field>

          <div class="form-grid">
            <app-form-field
              label="First name"
              [required]="true"
              [control]="firstName"
              [errorMap]="requiredErrors"
              controlId="user-first-name"
            >
              <input
                id="user-first-name"
                type="text"
                class="form-input"
                formControlName="firstName"
              />
            </app-form-field>

            <app-form-field
              label="Last name"
              [required]="true"
              [control]="lastName"
              [errorMap]="requiredErrors"
              controlId="user-last-name"
            >
              <input
                id="user-last-name"
                type="text"
                class="form-input"
                formControlName="lastName"
              />
            </app-form-field>
          </div>

          <div class="form-grid">
            <app-form-field
              label="Role"
              [required]="true"
              [control]="role"
              [errorMap]="requiredErrors"
              hint="Determines which workspace the user can access."
              controlId="user-role-field"
            >
              <select id="user-role-field" class="form-select" formControlName="role">
                <option [value]="UserRole.ADMIN">Administrator</option>
                <option [value]="UserRole.VENDOR">Vendor</option>
                <option [value]="UserRole.BIDDER">Bidder</option>
              </select>
            </app-form-field>

            <app-form-field
              label="Status"
              [control]="status"
              hint="Only an active account can sign in."
              controlId="user-status-field"
            >
              <select id="user-status-field" class="form-select" formControlName="status">
                <option [value]="AccountStatus.ACTIVE">Active</option>
                <option [value]="AccountStatus.INACTIVE">Inactive</option>
                <option [value]="AccountStatus.SUSPENDED">Suspended</option>
              </select>
            </app-form-field>
          </div>

          @if (!editing()) {
            <app-alert tone="info" title="Password">
              The server issues the initial password for a new account. The user should change it
              from their profile after signing in.
            </app-alert>
          }
        </form>
      </app-dialog>
    }
  `,
  styles: [
    `
      .user-cell {
        display: flex;
        align-items: center;
        gap: var(--sp-2);
      }
      .dialog-alert {
        margin-bottom: var(--sp-4);
      }
    `,
  ],
})
export class AdminUsersComponent {
  private readonly fb = inject(FormBuilder);
  private readonly userService = inject(UserService);
  private readonly notifications = inject(NotificationService);

  protected readonly UserRole = UserRole;
  protected readonly AccountStatus = AccountStatus;

  readonly users = new AsyncResource<Paginated<User>>();

  readonly searchInput = signal('');
  readonly roleFilter = signal<UserRole | 'ALL'>('ALL');
  readonly statusFilter = signal<AccountStatus | 'ALL'>('ALL');
  readonly page = signal(1);

  readonly dialogOpen = signal(false);
  readonly editing = signal(false);
  readonly editingUser = signal<User | null>(null);
  readonly saving = signal(false);
  readonly actionFailure = signal<ApiFailure | null>(null);
  readonly dialogFailure = signal<ApiFailure | null>(null);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    firstName: ['', [Validators.required]],
    lastName: ['', [Validators.required]],
    role: [UserRole.BIDDER, [Validators.required]],
    status: [AccountStatus.ACTIVE],
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
  get role() {
    return this.form.controls.role;
  }
  get status() {
    return this.form.controls.status;
  }

  readonly emailErrors = {
    required: 'Email address is required',
    email: 'Enter a valid email address',
  };
  readonly requiredErrors = { required: 'This field is required' };

  readonly userList = computed(() => this.users.data()?.items ?? []);
  readonly meta = computed(
    () => this.users.data()?.meta ?? { total: 0, page: 1, limit: 12, totalPages: 1 },
  );

  readonly hasFilters = computed(
    () => !!this.searchInput() || this.roleFilter() !== 'ALL' || this.statusFilter() !== 'ALL',
  );

  constructor() {
    this.reload();
  }

  reload(): void {
    const query: UserQuery = {
      page: this.page(),
      limit: 12,
      search: this.searchInput() || undefined,
      role: this.roleFilter(),
      status: this.statusFilter(),
      sort: 'newest',
    };
    this.users.load(this.userService.list(query), { keepData: true });
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

  setRole(event: Event): void {
    this.roleFilter.set((event.target as HTMLSelectElement).value as UserRole | 'ALL');
    this.page.set(1);
    this.reload();
  }

  setStatus(event: Event): void {
    this.statusFilter.set((event.target as HTMLSelectElement).value as AccountStatus | 'ALL');
    this.page.set(1);
    this.reload();
  }

  setPage(page: number): void {
    this.page.set(page);
    this.reload();
  }

  clearFilters(): void {
    this.searchInput.set('');
    this.roleFilter.set('ALL');
    this.statusFilter.set('ALL');
    this.page.set(1);
    this.reload();
  }

  openCreate(): void {
    this.editing.set(false);
    this.editingUser.set(null);
    this.dialogFailure.set(null);
    this.form.reset({
      email: '',
      firstName: '',
      lastName: '',
      role: UserRole.BIDDER,
      status: AccountStatus.ACTIVE,
    });
    this.dialogOpen.set(true);
  }

  openEdit(user: User): void {
    this.editing.set(true);
    this.editingUser.set(user);
    this.dialogFailure.set(null);
    this.form.reset({
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      status: user.status,
    });
    this.dialogOpen.set(true);
  }

  closeDialog(): void {
    if (this.saving()) return;
    this.dialogOpen.set(false);
    this.editingUser.set(null);
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
    const user = this.editingUser();

    const request$ = user
      ? this.userService.update(user.id, {
          email: value.email.trim(),
          firstName: value.firstName.trim(),
          lastName: value.lastName.trim(),
          role: value.role,
          status: value.status,
        })
      : this.userService.create({
          email: value.email.trim(),
          firstName: value.firstName.trim(),
          lastName: value.lastName.trim(),
          role: value.role,
          status: value.status,
        });

    request$.subscribe({
      next: (saved) => {
        this.saving.set(false);
        this.dialogOpen.set(false);
        this.editingUser.set(null);
        this.notifications.success(
          user ? 'User updated' : 'User created',
          `${saved.firstName} ${saved.lastName} · ${saved.email}`,
        );
        this.reload();
      },
      error: (error: unknown) => {
        this.saving.set(false);
        const failure = toApiFailure(error);
        this.dialogFailure.set(failure);

        // A duplicate email surfaces on the field itself.
        if (failure.fieldErrors?.['email'] || failure.status === 409) {
          this.email.setErrors({ server: true });
          this.email.markAsTouched();
        }
      },
    });
  }

  name(user: User): string {
    const value = `${user.firstName} ${user.lastName}`.trim();
    return value && value !== '—' ? value : user.email;
  }

  initials(user: User): string {
    const first = user.firstName?.trim()[0] ?? '';
    const last = user.lastName?.trim()[0] ?? '';
    return `${first}${last}`.toUpperCase() || user.email[0]?.toUpperCase() || '?';
  }

  roleLabel(role: UserRole): string {
    switch (role) {
      case UserRole.ADMIN:
        return 'Admin';
      case UserRole.VENDOR:
        return 'Vendor';
      case UserRole.BIDDER:
        return 'Bidder';
      default:
        return role;
    }
  }

  dateTime(iso: string | null | undefined): string {
    return formatDateTime(iso);
  }
}
