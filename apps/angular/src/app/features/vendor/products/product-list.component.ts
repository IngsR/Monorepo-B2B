import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiFailure, toApiFailure } from '../../../core/domain/api-failure';
import { formatDateTime } from '../../../core/domain/format';
import { Category, Paginated, Product } from '../../../core/domain/models';
import { CategoryService, ProductService } from '../../../core/services/catalogue.service';
import { NotificationService } from '../../../core/services/notification.service';
import { AsyncResource } from '../../../core/state/async-resource';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { ConfirmDialogComponent } from '../../../shared/ui/dialog.component';
import { IconComponent } from '../../../shared/ui/icon.component';
import { PaginationComponent } from '../../../shared/ui/pagination.component';
import {
  EmptyStateComponent,
  ErrorStateComponent,
  TableSkeletonComponent,
} from '../../../shared/ui/state-block.component';
import { AlertComponent } from '../../../shared/ui/toast.component';

/**
 * My products.
 *
 * The vendor's own product catalogue. Every product listed here is owned by the
 * signed-in vendor — the API scopes `/products/mine` to the authenticated
 * identity, so there is no ownership column and no risk of an edit control
 * appearing on someone else's product.
 *
 * Only the fields the backend supports are shown: code, name, description and
 * category. There is no stock, pricing, shipping or inventory concept.
 */
@Component({
  selector: 'app-product-list',
  standalone: true,
  imports: [
    RouterLink,
    ButtonComponent,
    ConfirmDialogComponent,
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
          <h1 class="page-title">My products</h1>
          <p class="page-subtitle">
            Products are the base record an auction is created from. Each product belongs to your
            vendor account and is classified by category.
          </p>
        </div>
        <div class="page-actions">
          <a class="btn btn-primary" routerLink="/vendor/products/new">
            <app-icon name="plus" [size]="15" />
            New product
          </a>
        </div>
      </header>

      @if (deleteFailure(); as failure) {
        <app-alert tone="danger" [title]="failure.message">{{ failure.detail }}</app-alert>
      }

      <div class="toolbar">
        <div class="toolbar-field toolbar-grow">
          <label class="form-label" for="product-search">Search</label>
          <input
            id="product-search"
            type="search"
            class="form-input"
            placeholder="Search by product code, name or description"
            [value]="searchInput()"
            (input)="onSearchInput($event)"
          />
        </div>
        <div class="toolbar-field">
          <label class="form-label" for="product-category">Category</label>
          <select
            id="product-category"
            class="form-select"
            [value]="categoryFilter()"
            (change)="setCategory($event)"
          >
            <option value="ALL">All categories</option>
            @for (category of categories(); track category.id) {
              <option [value]="category.id">{{ category.name }}</option>
            }
          </select>
        </div>
        <div class="toolbar-field">
          <app-button
            label="Refresh"
            icon="refresh"
            variant="secondary"
            [loading]="products.isLoading()"
            (clicked)="reload()"
          />
        </div>
      </div>

      <div class="card">
        @switch (true) {
          @case (products.isLoading() && !products.data()) {
            <app-table-skeleton [count]="5" />
          }
          @case (products.hasError()) {
            @if (products.error(); as failure) {
              <app-error-state
                [failure]="failure"
                [retrying]="products.isLoading()"
                (retry)="reload()"
              />
            }
          }
          @case (productList().length === 0) {
            <app-empty-state
              icon="package"
              [title]="hasFilters() ? 'No products match this search' : 'No products yet'"
              [description]="
                hasFilters()
                  ? 'Try a different search term or clear the category filter.'
                  : 'Create your first product to start building auctions against it.'
              "
            >
              @if (hasFilters()) {
                <app-button label="Clear filters" variant="secondary" (clicked)="clearFilters()" />
              } @else {
                <a class="btn btn-primary" routerLink="/vendor/products/new">Create a product</a>
              }
            </app-empty-state>
          }
          @default {
            <div class="table-scroll">
              <table class="data-table data-table--stacked">
                <thead>
                  <tr>
                    <th scope="col">Code</th>
                    <th scope="col">Name</th>
                    <th scope="col">Category</th>
                    <th scope="col">Auctions</th>
                    <th scope="col">Updated</th>
                    <th scope="col" class="cell-actions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  @for (product of productList(); track product.id) {
                    <tr>
                      <td data-label="Code">
                        <span class="text-mono-id">{{ product.code }}</span>
                      </td>
                      <td data-label="Name">
                        <span class="cell-primary">{{ product.name }}</span>
                        @if (product.description) {
                          <p class="text-helper row-description">{{ product.description }}</p>
                        }
                      </td>
                      <td data-label="Category">
                        <span class="badge badge-plain">{{ product.category?.name ?? '—' }}</span>
                      </td>
                      <td data-label="Auctions">
                        <span class="text-numeric">{{ product.auctionCount ?? 0 }}</span>
                      </td>
                      <td data-label="Updated">
                        <span class="text-meta">{{ updated(product.updatedAt) }}</span>
                      </td>
                      <td data-label="Actions" class="cell-actions">
                        <div class="row-actions">
                          <a
                            class="btn btn-ghost btn-sm"
                            [routerLink]="['/vendor/products', product.id, 'edit']"
                          >
                            <app-icon name="edit" [size]="14" />
                            Edit
                          </a>
                          <button
                            type="button"
                            class="btn btn-ghost btn-sm row-action-danger"
                            (click)="confirmDelete(product)"
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
    </div>

    @if (pendingDelete(); as product) {
      <app-confirm-dialog
        title="Delete this product?"
        [subtitle]="product.name"
        [message]="
          'The product ' +
          product.code +
          ' will be permanently removed from your catalogue. Products that are already used by an auction cannot be deleted.'
        "
        confirmLabel="Delete product"
        icon="trash"
        tone="danger"
        [busy]="deleting()"
        (confirmed)="deleteProduct()"
        (dismissed)="pendingDelete.set(null)"
      />
    }
  `,
  styles: [
    `
      .row-description {
        margin-top: 2px;
        display: -webkit-box;
        -webkit-line-clamp: 1;
        line-clamp: 1;
        -webkit-box-orient: vertical;
        overflow: hidden;
        max-width: 52ch;
      }
      .row-actions {
        display: inline-flex;
        gap: var(--sp-1);
        justify-content: flex-end;
      }
      .row-action-danger {
        color: var(--c-danger);
      }
      .row-action-danger:hover {
        background: var(--c-danger-soft);
      }
    `,
  ],
})
export class ProductListComponent {
  private readonly productService = inject(ProductService);
  private readonly categoryService = inject(CategoryService);
  private readonly notifications = inject(NotificationService);

  readonly products = new AsyncResource<Paginated<Product>>();
  readonly categories = signal<Category[]>([]);

  readonly searchInput = signal('');
  readonly categoryFilter = signal('ALL');
  readonly page = signal(1);

  readonly pendingDelete = signal<Product | null>(null);
  readonly deleting = signal(false);
  readonly deleteFailure = signal<ApiFailure | null>(null);

  readonly productList = computed(() => this.products.data()?.items ?? []);
  readonly meta = computed(
    () => this.products.data()?.meta ?? { total: 0, page: 1, limit: 12, totalPages: 1 },
  );

  readonly hasFilters = computed(() => !!this.searchInput() || this.categoryFilter() !== 'ALL');

  constructor() {
    this.loadCategories();
    this.reload();
  }

  private loadCategories(): void {
    this.categoryService.list({ limit: 100 }).subscribe({
      next: (result) => this.categories.set(result.items),
      error: () => this.categories.set([]),
    });
  }

  reload(): void {
    this.products.load(
      this.productService.listMine({
        page: this.page(),
        limit: 12,
        search: this.searchInput() || undefined,
        categoryId: this.categoryFilter(),
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

  setCategory(event: Event): void {
    this.categoryFilter.set((event.target as HTMLSelectElement).value);
    this.page.set(1);
    this.reload();
  }

  setPage(page: number): void {
    this.page.set(page);
    this.reload();
  }

  clearFilters(): void {
    this.searchInput.set('');
    this.categoryFilter.set('ALL');
    this.page.set(1);
    this.reload();
  }

  updated(iso: string): string {
    return formatDateTime(iso);
  }

  confirmDelete(product: Product): void {
    this.deleteFailure.set(null);
    this.pendingDelete.set(product);
  }

  /**
   * Deletion is confirmed first. A 409 means the product is referenced by an
   * auction — the backend refuses and explains, and the message is surfaced
   * rather than swallowed.
   */
  deleteProduct(): void {
    const product = this.pendingDelete();
    if (!product) return;

    this.deleting.set(true);
    this.deleteFailure.set(null);

    this.productService.delete(product.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.pendingDelete.set(null);
        this.notifications.success('Product deleted', `${product.code} has been removed.`);
        this.reload();
      },
      error: (error: unknown) => {
        this.deleting.set(false);
        this.pendingDelete.set(null);
        const failure = toApiFailure(error);
        this.deleteFailure.set(failure);
        this.notifications.fromFailure(failure, 'Could not delete product');
      },
    });
  }
}
