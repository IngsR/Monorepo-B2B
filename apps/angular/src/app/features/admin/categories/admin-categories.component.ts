import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiFailure, toApiFailure } from '../../../core/domain/api-failure';
import { formatDateTime } from '../../../core/domain/format';
import { Category, Paginated } from '../../../core/domain/models';
import { AsyncResource } from '../../../core/state/async-resource';
import { CategoryService } from '../../../core/services/catalogue.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { ConfirmDialogComponent, DialogComponent } from '../../../shared/ui/dialog.component';
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
 * Category management.
 *
 * Categories are shared reference data: products reference them, and the
 * marketplace filters on them. Because of that a category that is in use cannot
 * be deleted — the API refuses with a conflict and the UI surfaces the reason
 * rather than offering a destructive action that cannot succeed.
 *
 * Deletion is a hard delete, so it is always confirmed.
 */
@Component({
  selector: 'app-admin-categories',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    ButtonComponent,
    ConfirmDialogComponent,
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
          <h1 class="page-title">Categories</h1>
          <p class="page-subtitle">
            Categories classify products and drive the marketplace filter. A category that is
            assigned to a product cannot be deleted until those products are reassigned.
          </p>
        </div>
        <div class="page-actions">
          <app-button label="New category" icon="plus" variant="primary" (clicked)="openCreate()" />
        </div>
      </header>

      @if (actionFailure(); as failure) {
        <app-alert tone="danger" [title]="failure.message">{{ failure.detail }}</app-alert>
      }

      <div class="toolbar">
        <div class="toolbar-field toolbar-grow">
          <label class="form-label" for="category-search">Search</label>
          <input
            id="category-search"
            type="search"
            class="form-input"
            placeholder="Search by name or description"
            [value]="searchInput()"
            (input)="onSearchInput($event)"
          />
        </div>
        <div class="toolbar-field">
          <button
            type="button"
            class="btn btn-secondary"
            (click)="reload()"
            [disabled]="categories.isLoading()"
          >
            <app-icon name="refresh" [size]="15" />
            Refresh
          </button>
        </div>
      </div>

      <div class="card">
        @switch (true) {
          @case (categories.isLoading() && !categories.data()) {
            <app-table-skeleton [count]="5" />
          }
          @case (categories.hasError()) {
            @if (categories.error(); as failure) {
              <app-error-state
                [failure]="failure"
                [retrying]="categories.isLoading()"
                (retry)="reload()"
              />
            }
          }
          @case (categoryList().length === 0) {
            <app-empty-state
              icon="layers"
              [title]="searchInput() ? 'No categories match this search' : 'No categories yet'"
              [description]="
                searchInput()
                  ? 'Try a different search term.'
                  : 'Create a category before vendors can classify their products.'
              "
            >
              @if (searchInput()) {
                <button type="button" class="btn btn-secondary" (click)="clearSearch()">
                  Clear search
                </button>
              } @else {
                <app-button
                  label="New category"
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
                    <th scope="col">Category</th>
                    <th scope="col">Slug</th>
                    <th scope="col">Description</th>
                    <th scope="col" class="col-numeric">Products</th>
                    <th scope="col">Updated</th>
                    <th scope="col" class="cell-actions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  @for (category of categoryList(); track category.id) {
                    <tr>
                      <td data-label="Category">
                        <span class="cell-primary">{{ category.name }}</span>
                        <span class="text-mono-id">{{ category.id }}</span>
                      </td>
                      <td data-label="Slug">
                        <span class="text-mono-id">{{ category.slug }}</span>
                      </td>
                      <td data-label="Description">
                        <span class="text-meta description-cell">
                          {{ category.description || '—' }}
                        </span>
                      </td>
                      <td data-label="Products" class="col-numeric">
                        <span
                          class="badge"
                          [class.badge-plain]="!category.productCount"
                          [class.badge-info]="!!category.productCount"
                        >
                          {{ category.productCount ?? 0 }}
                        </span>
                      </td>
                      <td data-label="Updated">
                        <span class="text-meta">{{ dateTime(category.updatedAt) }}</span>
                      </td>
                      <td data-label="Actions" class="cell-actions">
                        <div class="row-actions">
                          <button
                            type="button"
                            class="btn btn-ghost btn-sm"
                            (click)="openEdit(category)"
                          >
                            <app-icon name="edit" [size]="14" />
                            Edit
                          </button>

                          <!-- Deletion is withheld when the category is in use -->
                          <button
                            type="button"
                            class="btn btn-ghost btn-sm row-action-danger"
                            [disabled]="!!category.productCount"
                            [attr.title]="
                              category.productCount
                                ? 'This category is assigned to products and cannot be deleted'
                                : 'Delete this category'
                            "
                            (click)="confirmDelete(category)"
                          >
                            <app-icon name="trash" [size]="14" />
                            Delete
                          </button>
                        </div>
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

      @if (inUseCount() > 0) {
        <app-alert tone="info" title="Some categories are in use">
          {{ inUseCount() }} {{ inUseCount() === 1 ? 'category is' : 'categories are' }} assigned to
          one or more products. Those categories cannot be deleted until the products are moved to
          another category.
        </app-alert>
      }
    </div>

    <!-- Create / edit -->
    @if (dialogOpen()) {
      <app-dialog
        [title]="editing() ? 'Edit category' : 'Create category'"
        [subtitle]="
          editing() ? editingCategory()!.name : 'Categories classify products across all vendors.'
        "
        icon="layers"
        [confirmLabel]="editing() ? 'Save changes' : 'Create category'"
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
            label="Category name"
            [required]="true"
            [control]="name"
            [errorMap]="nameErrors"
            hint="Must be unique. The slug is generated from this name."
            controlId="category-name"
          >
            <input id="category-name" type="text" class="form-input" formControlName="name" />
          </app-form-field>

          <app-form-field
            label="Description"
            [control]="description"
            hint="Optional. Shown as guidance when vendors pick a category."
            controlId="category-description"
          >
            <textarea
              id="category-description"
              class="form-textarea"
              rows="3"
              formControlName="description"
            ></textarea>
          </app-form-field>
        </form>
      </app-dialog>
    }

    <!-- Delete confirmation -->
    @if (pendingDelete(); as category) {
      <app-confirm-dialog
        title="Delete this category?"
        [subtitle]="category.name"
        [message]="
          'The category ' +
          category.name +
          ' will be permanently removed. Products currently assigned to it must be moved to another category first.'
        "
        confirmLabel="Delete category"
        icon="trash"
        tone="danger"
        [busy]="deleting()"
        (confirmed)="deleteCategory()"
        (dismissed)="pendingDelete.set(null)"
      />
    }
  `,
  styles: [
    `
      .description-cell {
        display: -webkit-box;
        -webkit-line-clamp: 2;
        line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
        max-width: 46ch;
      }
      .row-actions {
        display: inline-flex;
        gap: var(--sp-1);
        justify-content: flex-end;
      }
      .row-action-danger {
        color: var(--c-danger);
      }
      .row-action-danger:hover:not(:disabled) {
        background: var(--c-danger-soft);
      }
      .dialog-alert {
        margin-bottom: var(--sp-4);
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
  readonly saving = signal(false);
  readonly actionFailure = signal<ApiFailure | null>(null);
  readonly dialogFailure = signal<ApiFailure | null>(null);

  readonly pendingDelete = signal<Category | null>(null);
  readonly deleting = signal(false);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
    description: [''],
  });

  get name() {
    return this.form.controls.name;
  }
  get description() {
    return this.form.controls.description;
  }

  readonly nameErrors = { required: 'Category name is required' };

  readonly categoryList = computed(() => this.categories.data()?.items ?? []);
  readonly meta = computed(
    () => this.categories.data()?.meta ?? { total: 0, page: 1, limit: 20, totalPages: 1 },
  );

  readonly inUseCount = computed(
    () => this.categoryList().filter((c) => (c.productCount ?? 0) > 0).length,
  );

  constructor() {
    this.reload();
  }

  reload(): void {
    this.categories.load(
      this.categoryService.list({
        page: this.page(),
        limit: 20,
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
    this.form.reset({ name: '', description: '' });
    this.dialogOpen.set(true);
  }

  openEdit(category: Category): void {
    this.editing.set(true);
    this.editingCategory.set(category);
    this.dialogFailure.set(null);
    this.form.reset({ name: category.name, description: category.description ?? '' });
    this.dialogOpen.set(true);
  }

  closeDialog(): void {
    if (this.saving()) return;
    this.dialogOpen.set(false);
    this.editingCategory.set(null);
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
    const payload = {
      name: value.name.trim(),
      description: value.description.trim() || undefined,
    };
    const category = this.editingCategory();

    const request$ = category
      ? this.categoryService.update(category.id, payload)
      : this.categoryService.create(payload);

    request$.subscribe({
      next: (saved) => {
        this.saving.set(false);
        this.dialogOpen.set(false);
        this.editingCategory.set(null);
        this.notifications.success(category ? 'Category updated' : 'Category created', saved.name);
        this.reload();
      },
      error: (error: unknown) => {
        this.saving.set(false);
        const failure = toApiFailure(error);
        this.dialogFailure.set(failure);

        if (failure.fieldErrors?.['name'] || failure.status === 409) {
          this.name.setErrors({ server: true });
          this.name.markAsTouched();
        }
      },
    });
  }

  confirmDelete(category: Category): void {
    // Guard as well as disable: an in-use category can never be removed.
    if (category.productCount) {
      this.notifications.warning(
        'Category in use',
        `${category.name} is assigned to ${category.productCount} product${category.productCount === 1 ? '' : 's'}. Reassign them first.`,
      );
      return;
    }
    this.actionFailure.set(null);
    this.pendingDelete.set(category);
  }

  deleteCategory(): void {
    const category = this.pendingDelete();
    if (!category) return;

    this.deleting.set(true);
    this.actionFailure.set(null);

    this.categoryService.delete(category.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.pendingDelete.set(null);
        this.notifications.success('Category deleted', category.name);
        this.reload();
      },
      error: (error: unknown) => {
        this.deleting.set(false);
        this.pendingDelete.set(null);
        const failure = toApiFailure(error);
        this.actionFailure.set(failure);
        this.notifications.fromFailure(failure, 'Could not delete category');
      },
    });
  }

  dateTime(iso: string | null | undefined): string {
    return formatDateTime(iso);
  }
}
