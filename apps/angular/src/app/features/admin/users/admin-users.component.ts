import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { UserRole } from '../../../core/domain/enums';
import { ApiFailure, toApiFailure } from '../../../core/domain/api-failure';
import { formatDateTime } from '../../../core/domain/format';
import { Paginated, User, UserQuery } from '../../../core/domain/models';
import { AsyncResource } from '../../../core/state/async-resource';
import { UserService } from '../../../core/services/directory.service';
import { NotificationService } from '../../../core/services/notification.service';
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
 * User Identity Management.
 *
 * Provides administrative oversight and creation of core authentication identities.
 * Realigned 100% with NestJS backend `UsersController` and DTOs:
 * - Query: search (name/email), role (ADMIN, VENDOR, BIDDER), pagination.
 * - Create: email, password, name, role.
 * - Update: name, role.
 */
@Component({
  selector: 'app-admin-users',
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
              <mat-icon fontIcon="manage_accounts" [size]="14" />
              Identity Directory
            </span>
          </div>
          <h1 class="admin-title">User Accounts</h1>
          <p class="admin-subtitle">
            Manage central system authentication credentials and role assignments. Vendor and Bidder profiles attach to these accounts.
          </p>
        </div>
        <div class="admin-actions">
          <button type="button" class="btn-admin-primary" (click)="openCreate()">
            <mat-icon fontIcon="person_add" [size]="16" />
            <span>Create New User</span>
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
            id="user-search"
            type="search"
            class="admin-search-input"
            placeholder="Search by account name or email address..."
            [value]="searchInput()"
            (input)="onSearchInput($event)"
          />
        </div>

        <div class="toolbar-filter-group">
          <label class="toolbar-label" for="user-role">
            <mat-icon fontIcon="filter_list" [size]="16" />
            <span>Role:</span>
          </label>
          <select
            id="user-role"
            class="admin-select"
            [value]="roleFilter()"
            (change)="setRole($event)"
          >
            <option value="ALL">All Roles</option>
            <option [value]="UserRole.ADMIN">Administrator</option>
            <option [value]="UserRole.VENDOR">Vendor</option>
            <option [value]="UserRole.BIDDER">Bidder</option>
          </select>
        </div>

        <button
          type="button"
          class="btn-admin-secondary"
          (click)="reload()"
          [disabled]="users.isLoading()"
        >
          <mat-icon fontIcon="refresh" [size]="16" [class.spin]="users.isLoading()" />
          <span>Refresh</span>
        </button>
      </div>

      <!-- Main Content Card -->
      <div class="admin-card">
        @switch (true) {
          @case (users.isLoading() && !users.data()) {
            <app-table-skeleton [count]="6" />
          }
          @case (users.hasError()) {
            @if (users.error(); as failure) {
              <div class="card-inner-padding">
                <app-error-state
                  [failure]="failure"
                  [retrying]="users.isLoading()"
                  (retry)="reload()"
                />
              </div>
            }
          }
          @case (userList().length === 0) {
            <div class="card-inner-padding">
              <app-empty-state
                icon="users"
                [title]="hasFilters() ? 'No users match criteria' : 'No users registered yet'"
                [description]="
                  hasFilters()
                    ? 'Try adjusting your search query or reset the role filter.'
                    : 'Create an identity to grant access to the B2B platform.'
                "
              >
                @if (hasFilters()) {
                  <button type="button" class="btn-admin-secondary" (click)="clearFilters()">
                    <mat-icon fontIcon="clear" [size]="14" />
                    <span>Clear Filters</span>
                  </button>
                } @else {
                  <button type="button" class="btn-admin-primary" (click)="openCreate()">
                    <mat-icon fontIcon="person_add" [size]="16" />
                    <span>Create User</span>
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
                    <th scope="col">User Identity</th>
                    <th scope="col">Email Address</th>
                    <th scope="col">Platform Role</th>
                    <th scope="col">User ID</th>
                    <th scope="col">Registered</th>
                    <th scope="col" class="cell-action-col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  @for (user of userList(); track user.id) {
                    <tr>
                      <td>
                        <div class="user-identity-cell">
                          <span class="user-avatar">{{ initials(user) }}</span>
                          <span class="cell-name-strong">{{ userName(user) }}</span>
                        </div>
                      </td>
                      <td>
                        <span class="cell-text-secondary">{{ user.email }}</span>
                      </td>
                      <td>
                        <span class="role-pill" [class]="'role-pill-' + user.role.toLowerCase()">
                          {{ roleLabel(user.role) }}
                        </span>
                      </td>
                      <td>
                        <span class="mono-id-tag">{{ user.id }}</span>
                      </td>
                      <td>
                        <span class="cell-text-muted">{{ dateTime(user.createdAt) }}</span>
                      </td>
                      <td class="cell-action-col">
                        <button
                          type="button"
                          class="btn-admin-table-action"
                          (click)="openEdit(user)"
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
        [title]="editing() ? 'Edit User Identity' : 'Create User Account'"
        [subtitle]="
          editing()
            ? 'Update identity name and role assignment for ' + editingUser()!.email
            : 'Register a new authenticated identity with email credentials.'
        "
        icon="user"
        [confirmLabel]="editing() ? 'Save Changes' : 'Create User'"
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
          <!-- Full Name -->
          <app-form-field
            label="Full Name"
            [required]="true"
            [control]="nameCtrl"
            [errorMap]="requiredErrors"
            hint="The primary identity name displayed across platform audits."
            controlId="user-name"
          >
            <input
              id="user-name"
              type="text"
              class="form-input"
              formControlName="name"
              placeholder="e.g. Alexander Vance"
            />
          </app-form-field>

          <!-- Email (Editable on create, Readonly on edit) -->
          @if (!editing()) {
            <app-form-field
              label="Email Address"
              [required]="true"
              [control]="emailCtrl"
              [errorMap]="emailErrors"
              hint="Must be a unique email address used for platform sign-in."
              controlId="user-email"
            >
              <input
                id="user-email"
                type="email"
                class="form-input"
                formControlName="email"
                placeholder="user@company.com"
                autocomplete="off"
              />
            </app-form-field>

            <!-- Password -->
            <app-form-field
              label="Initial Password"
              [required]="true"
              [control]="passwordCtrl"
              [errorMap]="passwordErrors"
              hint="Minimum 8 characters. The user can change this after signing in."
              controlId="user-password"
            >
              <input
                id="user-password"
                type="password"
                class="form-input"
                formControlName="password"
                placeholder="••••••••••••"
                autocomplete="new-password"
              />
            </app-form-field>
          } @else {
            <div class="readonly-field-group">
              <label class="readonly-label">Email Address (Immutable)</label>
              <div class="readonly-box">{{ editingUser()?.email }}</div>
            </div>
          }

          <!-- Role selection -->
          <app-form-field
            label="Platform Role"
            [required]="true"
            [control]="roleCtrl"
            [errorMap]="requiredErrors"
            hint="Controls access boundaries and workspace tools."
            controlId="user-role-field"
          >
            <select id="user-role-field" class="form-select" formControlName="role">
              <option [value]="UserRole.ADMIN">Administrator (Full Access)</option>
              <option [value]="UserRole.VENDOR">Vendor (Product & Auction Provider)</option>
              <option [value]="UserRole.BIDDER">Bidder (Marketplace Participant)</option>
            </select>
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

      .toolbar-filter-group {
        display: flex;
        align-items: center;
        gap: 8px;
        height: 38px;
        padding: 0 12px;
        background: #ffffff;
        border: 1px solid #ddd9d0;
        border-radius: 6px;
      }

      .toolbar-label {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 0.75rem;
        font-weight: 600;
        color: #667085;
      }

      .admin-select {
        border: none;
        background: transparent;
        font-size: 0.8125rem;
        font-weight: 600;
        color: #172033;
        cursor: pointer;
        outline: none;
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

      .user-identity-cell {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .user-avatar {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 30px;
        height: 30px;
        background: #172033;
        color: #c6a15b;
        font-size: 0.6875rem;
        font-weight: 700;
        border-radius: 50%;
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

      .role-pill {
        display: inline-flex;
        padding: 3px 8px;
        font-size: 0.6875rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        border-radius: 4px;

        &.role-pill-admin {
          background: #172033;
          color: #c6a15b;
        }

        &.role-pill-vendor {
          background: #edf5f1;
          color: #2f6b57;
          border: 1px solid #b4d8ca;
        }

        &.role-pill-bidder {
          background: #edf3f8;
          color: #3f668c;
          border: 1px solid #b8d0e5;
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
        font-weight: 500;
      }

      .dialog-alert {
        margin-bottom: 16px;
      }
    `,
  ],
})
export class AdminUsersComponent {
  private readonly fb = inject(FormBuilder);
  private readonly userService = inject(UserService);
  private readonly notifications = inject(NotificationService);

  protected readonly UserRole = UserRole;

  readonly users = new AsyncResource<Paginated<User>>();

  readonly searchInput = signal('');
  readonly roleFilter = signal<UserRole | 'ALL'>('ALL');
  readonly page = signal(1);

  readonly dialogOpen = signal(false);
  readonly editing = signal(false);
  readonly editingUser = signal<User | null>(null);
  readonly saving = signal(false);
  readonly actionFailure = signal<ApiFailure | null>(null);
  readonly dialogFailure = signal<ApiFailure | null>(null);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    name: ['', [Validators.required]],
    role: [UserRole.BIDDER, [Validators.required]],
  });

  get emailCtrl() {
    return this.form.controls.email;
  }
  get passwordCtrl() {
    return this.form.controls.password;
  }
  get nameCtrl() {
    return this.form.controls.name;
  }
  get roleCtrl() {
    return this.form.controls.role;
  }

  readonly emailErrors = {
    required: 'Email address is required',
    email: 'Enter a valid email address',
  };
  readonly passwordErrors = {
    required: 'Initial password is required',
    minlength: 'Password must be at least 8 characters',
  };
  readonly requiredErrors = { required: 'This field is required' };

  readonly userList = computed(() => this.users.data()?.items ?? []);
  readonly meta = computed(
    () => this.users.data()?.meta ?? { total: 0, page: 1, limit: 12, totalPages: 1 },
  );

  readonly hasFilters = computed(
    () => !!this.searchInput() || this.roleFilter() !== 'ALL',
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

  setPage(page: number): void {
    this.page.set(page);
    this.reload();
  }

  clearFilters(): void {
    this.searchInput.set('');
    this.roleFilter.set('ALL');
    this.page.set(1);
    this.reload();
  }

  openCreate(): void {
    this.editing.set(false);
    this.editingUser.set(null);
    this.dialogFailure.set(null);
    this.passwordCtrl.setValidators([Validators.required, Validators.minLength(8)]);
    this.passwordCtrl.updateValueAndValidity();
    this.emailCtrl.setValidators([Validators.required, Validators.email]);
    this.emailCtrl.updateValueAndValidity();
    this.form.reset({
      email: '',
      password: '',
      name: '',
      role: UserRole.BIDDER,
    });
    this.dialogOpen.set(true);
  }

  openEdit(user: User): void {
    this.editing.set(true);
    this.editingUser.set(user);
    this.dialogFailure.set(null);
    // Clear password and email validation when editing since backend update accepts name & role only
    this.passwordCtrl.clearValidators();
    this.passwordCtrl.updateValueAndValidity();
    this.emailCtrl.clearValidators();
    this.emailCtrl.updateValueAndValidity();
    this.form.reset({
      email: user.email,
      password: '',
      name: this.userName(user),
      role: user.role,
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
          name: value.name.trim(),
          role: value.role,
        })
      : this.userService.create({
          email: value.email.trim(),
          password: value.password,
          name: value.name.trim(),
          role: value.role,
        });

    request$.subscribe({
      next: (saved) => {
        this.saving.set(false);
        this.dialogOpen.set(false);
        this.editingUser.set(null);
        this.notifications.success(
          user ? 'User updated successfully' : 'User created successfully',
          `${saved.name ?? value.name} · ${saved.email ?? value.email}`,
        );
        this.reload();
      },
      error: (error: unknown) => {
        this.saving.set(false);
        const failure = toApiFailure(error);
        this.dialogFailure.set(failure);

        if (failure.fieldErrors?.['email'] || failure.status === 409) {
          this.emailCtrl.setErrors({ server: true });
          this.emailCtrl.markAsTouched();
        }
      },
    });
  }

  userName(user: User): string {
    return user.name?.trim() || `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email;
  }

  initials(user: User): string {
    const name = this.userName(user);
    const parts = name.trim().split(/\s+/);
    if (parts.length > 1) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return parts[0][0]?.toUpperCase() || '?';
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
