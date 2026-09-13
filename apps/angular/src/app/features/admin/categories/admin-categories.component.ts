import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiFailure, toApiFailure } from '../../../core/domain/api-failure';
import { formatDateTime } from '../../../core/domain/format';
import { Category, Paginated } from '../../../core/domain/models';
import { CategoryService } from '../../../core/services/catalogue.service';
import { NotificationService } from '../../../core/services/notification.service';
import { AsyncResource } from '../../../core/state/async-resource';
import { ConfirmDialogComponent, DialogComponent } from '../../../shared/ui/dialog.component';
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
 * Product Category Management.
 *
 * Provides administration of reference classification taxonomy for product lots.
 * Realigned 100% with NestJS backend `CategoriesController` and DTOs:
 * - Query: search (name), pagination.
 * - Create: name.
 * - Update: name.
 * - Delete: id (with server conflict protection if products reference it).
 */
@Component({
  selector: 'app-admin-categories',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    ConfirmDialogComponent,
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
              <mat-icon fontIcon="category" [size]="14" />
              Lot Taxonomy
            </span>
          </div>
          <h1 class="admin-title">Product Categories</h1>
          <p class="admin-subtitle">
            Shared classification catalog used by vendors to categorize industrial lots and by buyers to filter the marketplace floor.
          </p>
        </div>
        <div class="admin-actions">
          <button type="button" class="btn-admin-primary" (click)="openCreate()">
            <mat-icon fontIcon="add" [size]="16" />
            <span>New Category</span>
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
            id="category-search"
            type="search"
            class="admin-search-input"
            placeholder="Search categories by name..."
            [value]="searchInput()"
            (input)="onSearchInput($event)"
          />
        </div>

        <button
          type="button"
          class="btn-admin-secondary"
          (click)="reload()"
          [disabled]="categories.isLoading()"
        >
          <mat-icon fontIcon="refresh" [size]="16" [class.spin]="categories.isLoading()" />
          <span>Refresh</span>
        </button>
      </div>

      <!-- Main Content Card -->
      <div class="admin-card">
        @switch (true) {
          @case (categories.isLoading() && !categories.data()) {
            <app-table-skeleton [count]="5" />
          }
          @case (categories.hasError()) {
            @if (categories.error(); as failure) {
              <div class="card-inner-padding">
                <app-error-state
                  [failure]="failure"
                  [retrying]="categories.isLoading()"
                  (retry)="reload()"
                />
              </div>
            }
          }
          @case (categoryList().length === 0) {
            <div class="card-inner-padding">
              <app-empty-state
                icon="layers"
                [title]="searchInput() ? 'No categories match search query' : 'No categories configured'"
                [description]="
                  searchInput()
                    ? 'Try searching with a different category name.'
                    : 'Create a product category to allow vendors to classify and publish auction lots.'
                "
              >
                @if (searchInput()) {
                  <button type="button" class="btn-admin-secondary" (click)="clearSearch()">
                    <mat-icon fontIcon="clear" [size]="14" />
                    <span>Clear Search</span>
                  </button>
                } @else {
                  <button type="button" class="btn-admin-primary" (click)="openCreate()">
                    <mat-icon fontIcon="add" [size]="16" />
                    <span>Create Category</span>
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
                    <th scope="col">Category Name</th>
                    <th scope="col">Category ID</th>
                    <th scope="col">Created Date</th>
                    <th scope="col">Last Modified</th>
                    <th scope="col" class="cell-action-col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  @for (category of categoryList(); track category.id) {
                    <tr>
                      <td>
                        <div class="category-identity-cell">
                          <span class="category-avatar">
                            <mat-icon fontIcon="label" [size]="16" />
                          </span>
                          <span class="cell-name-strong">{{ category.name }}</span>
                        </div>
                      </td>
                      <td>
                        <span class="mono-id-tag">{{ category.id }}</span>
                      </td>
                      <td>
                        <span class="cell-text-muted">{{ dateTime(category.createdAt) }}</span>
                      </td>
                      <td>
                        <span class="cell-text-muted">{{ dateTime(category.updatedAt) }}</span>
                      </td>
                      <td class="cell-action-col">
                        <div class="action-btn-group">
                          <button
                            type="button"
                            class="btn-admin-table-action"
                            (click)="openEdit(category)"
                          >
                            <mat-icon fontIcon="edit" [size]="14" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            class="btn-admin-table-action action-danger"
                            (click)="openDelete(category)"
                          >
                            <mat-icon fontIcon="delete_outline" [size]="14" />
                            <span>Delete</span>
                          </button>
                        </div>
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
        [title]="editing() ? 'Edit Product Category' : 'Create Product Category'"
        [subtitle]="
          editing()
            ? 'Update classification taxonomy for ' + editingCategory()!.name
            : 'Add a new classification taxonomy for industrial product lots.'
        "
        icon="layers"
        [confirmLabel]="editing() ? 'Save Changes' : 'Create Category'"
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
          <app-form-field
            label="Category Name"
            [required]="true"
            [control]="nameCtrl"
            [errorMap]="requiredErrors"
            hint="A clear, distinctive name (e.g. Industrial Machinery, Ferrous Scrap, Electronic Equipment)."
            controlId="category-name"
          >
            <input
              id="category-name"
              type="text"
              class="form-input"
              formControlName="name"
              placeholder="e.g. Industrial Machinery"
            />
          </app-form-field>
        </form>
      </app-dialog>
    }

    <!-- Delete Confirmation Dialog -->
    @if (deleteOpen()) {
      <app-confirm-dialog
        title="Delete Product Category"
        [message]="deleteMessage()"
        confirmLabel="Delete Category"
        tone="danger"
        [busy]="saving()"
        (confirmed)="confirmDelete()"
        (dismissed)="closeDelete()"
      />
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

      .category-identity-cell {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .category-avatar {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 30px;
        height: 30px;
        background: #fcfbf8;
        color: #b7791f;
        border: 1px solid #ddd9d0;
        border-radius: 6px;
        flex-shrink: 0;
      }

      .cell-name-strong {
        font-weight: 600;
        color: #172033;
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

      .action-btn-group {
        display: inline-flex;
        align-items: center;
        gap: 8px;
      }

      .btn-admin-table-action {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 5px 10px;
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

        &.action-danger {
          color: #b94a48;

          &:hover {
            background: #b94a48;
            color: #ffffff;
            border-color: #b94a48;

            mat-icon {
              color: #ffffff;
            }
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

      .dialog-alert {
        margin-bottom: 16px;
      }
    `,
  ],
})
export class AdminCategoriesComponent {
  private readonly fb = inject(FormBuilder);
  private readonly categoryService = inject(CategoryService);
  private readonly notifications = inject(NotificationService);

  readonly categories = new AsyncResource<Paginated<Category>>();

  readonly searchInput = signal('');
  readonly page = signal(1);

  readonly dialogOpen = signal(false);
  readonly editing = signal(false);
  readonly editingCategory = signal<Category | null>(null);

  readonly deleteOpen = signal(false);
  readonly deletingCategory = signal<Category | null>(null);

  readonly saving = signal(false);
  readonly actionFailure = signal<ApiFailure | null>(null);
  readonly dialogFailure = signal<ApiFailure | null>(null);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(255)]],
  });

  get nameCtrl() {
    return this.form.controls.name;
  }

  readonly requiredErrors = {
    required: 'Category name is required',
    maxlength: 'Category name must not exceed 255 characters',
  };

  readonly categoryList = computed(() => this.categories.data()?.items ?? []);
  readonly meta = computed(
    () => this.categories.data()?.meta ?? { total: 0, page: 1, limit: 12, totalPages: 1 },
  );

  constructor() {
    this.reload();
  }

  reload(): void {
    this.categories.load(
      this.categoryService.list({
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
    this.editingCategory.set(null);
    this.dialogFailure.set(null);
    this.form.reset({
      name: '',
    });
    this.dialogOpen.set(true);
  }

  openEdit(category: Category): void {
    this.editing.set(true);
    this.editingCategory.set(category);
    this.dialogFailure.set(null);
    this.form.reset({
      name: category.name,
    });
    this.dialogOpen.set(true);
  }

  closeDialog(): void {
    if (this.saving()) return;
    this.dialogOpen.set(false);
    this.editingCategory.set(null);
    this.dialogFailure.set(null);
  }

  openDelete(category: Category): void {
    this.deletingCategory.set(category);
    this.deleteOpen.set(true);
  }

  closeDelete(): void {
    if (this.saving()) return;
    this.deleteOpen.set(false);
    this.deletingCategory.set(null);
  }

  readonly deleteMessage = computed(() => {
    const cat = this.deletingCategory();
    return `Are you sure you want to delete the category "${cat?.name ?? ''}"? If this category is currently assigned to products, the server will reject the request.`;
  });

  confirmDelete(): void {
    const category = this.deletingCategory();
    if (!category) return;

    this.saving.set(true);
    this.actionFailure.set(null);

    this.categoryService.delete(category.id).subscribe({
      next: () => {
        this.saving.set(false);
        this.deleteOpen.set(false);
        this.deletingCategory.set(null);
        this.notifications.success('Category removed', category.name);
        this.reload();
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.deleteOpen.set(false);
        const failure = toApiFailure(error);
        this.actionFailure.set(failure);
      },
    });
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
    const category = this.editingCategory();

    const request$ = category
      ? this.categoryService.update(category.id, {
          name: value.name.trim(),
        })
      : this.categoryService.create({
          name: value.name.trim(),
        });

    request$.subscribe({
      next: (saved) => {
        this.saving.set(false);
        this.dialogOpen.set(false);
        this.editingCategory.set(null);
        this.notifications.success(
          category ? 'Category updated' : 'Category created',
          saved.name,
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
