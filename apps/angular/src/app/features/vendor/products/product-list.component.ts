import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiFailure, toApiFailure } from '../../../core/domain/api-failure';
import { formatDateTime } from '../../../core/domain/format';
import { Category, Paginated, Product } from '../../../core/domain/models';
import { CategoryService, ProductService } from '../../../core/services/catalogue.service';
import { NotificationService } from '../../../core/services/notification.service';
import { AsyncResource } from '../../../core/state/async-resource';
import { ConfirmDialogComponent } from '../../../shared/ui/dialog.component';
import { MatIconComponent } from '../../../shared/ui/mat-icon.component';
import { PaginationComponent } from '../../../shared/ui/pagination.component';
import {
  EmptyStateComponent,
  ErrorStateComponent,
  TableSkeletonComponent,
} from '../../../shared/ui/state-block.component';
import { AlertComponent } from '../../../shared/ui/toast.component';

/**
 * Barang Saya — Vendor Product Inventory.
 *
 * Scoped to the authenticated vendor via `/products/mine`.
 * Provides compact operational table on desktop and responsive stacked cards on mobile.
 */
@Component({
  selector: 'app-product-list',
  standalone: true,
  imports: [
    RouterLink,
    ConfirmDialogComponent,
    MatIconComponent,
    PaginationComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    TableSkeletonComponent,
    AlertComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page vendor-products-page">
      <header class="page-head">
        <div class="page-head-text">
          <div class="page-eyebrow">
            <span class="eyebrow-chip">KATALOG INVENTARIS</span>
            <span class="eyebrow-note">Aset Lot Penjual</span>
          </div>
          <h1 class="page-title">Barang Saya</h1>
          <p class="page-subtitle">
            Daftar inventaris barang milik perusahaan Anda yang siap untuk dijadikan lot lelang.
          </p>
        </div>
        <div class="page-actions">
          <a class="btn btn-seller" routerLink="/vendor/products/new">
            <mat-icon fontIcon="add" [size]="16" />
            <span>Daftarkan Barang Baru</span>
          </a>
        </div>
      </header>

      @if (deleteFailure(); as failure) {
        <app-alert tone="danger" [title]="failure.message">{{ failure.detail }}</app-alert>
      }

      <!-- Operational Toolbar -->
      <div class="toolbar">
        <div class="toolbar-field toolbar-grow">
          <label class="form-label" for="product-search">Cari Barang</label>
          <div class="input-affix-wrap">
            <span class="search-prefix">
              <mat-icon fontIcon="search" [size]="16" />
            </span>
            <input
              id="product-search"
              type="search"
              class="form-input search-with-icon"
              placeholder="Cari berdasarkan kode atau nama barang..."
              [value]="searchInput()"
              (input)="onSearchInput($event)"
            />
          </div>
        </div>

        <div class="toolbar-field">
          <label class="form-label" for="product-category">Kategori</label>
          <select
            id="product-category"
            class="form-select"
            [value]="categoryFilter()"
            (change)="setCategory($event)"
          >
            <option value="ALL">Semua Kategori</option>
            @for (category of categories(); track category.id) {
              <option [value]="category.id">{{ category.name }}</option>
            }
          </select>
        </div>

        <div class="toolbar-field toolbar-action">
          <button
            type="button"
            class="btn btn-secondary"
            (click)="reload()"
            [disabled]="products.isLoading()"
          >
            <mat-icon fontIcon="refresh" [size]="16" />
            <span>Perbarui</span>
          </button>
        </div>
      </div>

      <!-- Content Container -->
      <div class="surface-card">
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
              [title]="hasFilters() ? 'Tidak ada barang yang cocok' : 'Belum ada barang di katalog'"
              [description]="
                hasFilters()
                  ? 'Coba kata kunci pencarian berbeda atau hapus filter kategori.'
                  : 'Daftarkan barang pertama Anda untuk mulai menyusun lot lelang.'
              "
            >
              @if (hasFilters()) {
                <button type="button" class="btn btn-secondary" (click)="clearFilters()">
                  <mat-icon fontIcon="close" [size]="14" />
                  <span>Hapus Filter</span>
                </button>
              } @else {
                <a class="btn btn-seller" routerLink="/vendor/products/new">
                  <mat-icon fontIcon="add" [size]="16" />
                  <span>Daftarkan Barang Baru</span>
                </a>
              }
            </app-empty-state>
          }
          @default {
            <!-- Desktop Dense Table -->
            <div class="table-scroll hide-mobile">
              <table class="data-table">
                <thead>
                  <tr>
                    <th scope="col">Kode Barang</th>
                    <th scope="col">Spesifikasi & Nama Barang</th>
                    <th scope="col">Kategori</th>
                    <th scope="col" class="col-numeric">Lot Terkait</th>
                    <th scope="col">Diperbarui</th>
                    <th scope="col" class="cell-actions">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  @for (product of productList(); track product.id) {
                    <tr>
                      <td>
                        <span class="text-mono-id font-bold">{{ product.code }}</span>
                      </td>
                      <td>
                        <div class="product-info-cell">
                          <span class="product-name">{{ product.name }}</span>
                          @if (product.description) {
                            <p class="product-desc-snippet">{{ product.description }}</p>
                          }
                        </div>
                      </td>
                      <td>
                        <span class="category-badge">{{ product.category?.name ?? 'Umum' }}</span>
                      </td>
                      <td class="col-numeric">
                        <span class="text-numeric">{{ product.auctionCount ?? 0 }}</span>
                      </td>
                      <td>
                        <span class="text-meta">{{ updated(product.updatedAt) }}</span>
                      </td>
                      <td class="cell-actions">
                        <div class="actions-group">
                          <a
                            class="btn btn-ghost btn-sm"
                            [routerLink]="['/vendor/products', product.id, 'edit']"
                          >
                            <mat-icon fontIcon="edit" [size]="14" />
                            <span>Edit</span>
                          </a>
                          <button
                            type="button"
                            class="btn btn-ghost btn-sm action-danger"
                            (click)="confirmDelete(product)"
                          >
                            <mat-icon fontIcon="delete" [size]="14" />
                            <span>Hapus</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>

            <!-- Mobile Stacked Card List -->
            <div class="mobile-product-stack hide-desktop">
              @for (product of productList(); track product.id) {
                <article class="mobile-product-card">
                  <div class="mobile-product-card-head">
                    <span class="text-mono-id font-bold">{{ product.code }}</span>
                    <span class="category-badge">{{ product.category?.name ?? 'Umum' }}</span>
                  </div>

                  <div class="mobile-product-card-body">
                    <h3 class="mobile-product-title">{{ product.name }}</h3>
                    @if (product.description) {
                      <p class="mobile-product-desc">{{ product.description }}</p>
                    }
                  </div>

                  <div class="mobile-product-card-meta">
                    <div class="meta-item">
                      <span class="text-meta">Lot Terkait:</span>
                      <span class="text-numeric font-bold">{{ product.auctionCount ?? 0 }}</span>
                    </div>
                    <div class="meta-item">
                      <span class="text-meta">Pembaruan:</span>
                      <span class="text-meta-date">{{ updated(product.updatedAt) }}</span>
                    </div>
                  </div>

                  <div class="mobile-product-card-actions">
                    <a
                      class="btn btn-secondary btn-sm btn-grow"
                      [routerLink]="['/vendor/products', product.id, 'edit']"
                    >
                      <mat-icon fontIcon="edit" [size]="14" />
                      <span>Edit Barang</span>
                    </a>
                    <button
                      type="button"
                      class="btn btn-danger-soft btn-sm"
                      (click)="confirmDelete(product)"
                    >
                      <mat-icon fontIcon="delete" [size]="14" />
                      <span>Hapus</span>
                    </button>
                  </div>
                </article>
              }
            </div>

            @if (meta(); as m) {
              <app-pagination [meta]="m" (pageChange)="setPage($event)" />
            }
          }
        }
      </div>
    </div>

    @if (pendingDelete(); as product) {
      <app-confirm-dialog
        title="Hapus barang ini dari katalog?"
        [subtitle]="product.name"
        [message]="
          'Barang ' +
          product.code +
          ' akan dihapus secara permanen dari inventaris Anda. Barang yang sudah terkait dalam lelang aktif atau terjadwal tidak dapat dihapus.'
        "
        confirmLabel="Hapus Barang"
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
      .vendor-products-page {
        display: flex;
        flex-direction: column;
        gap: var(--sp-5);
        font-family: var(--font-sans);
      }

      .page-eyebrow {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: var(--sp-1);
      }

      .eyebrow-chip {
        font-size: 0.65rem;
        font-weight: var(--fw-bold);
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: #a86445;
        background: #f6efea;
        border: 1px solid #e5c4b4;
        padding: 2px 7px;
        border-radius: var(--r-xs);
      }

      .eyebrow-note {
        font-size: var(--fs-xs);
        color: #64706b;
      }

      .surface-card {
        background: #ffffff;
        border: 1px solid #d9ddd8;
        border-radius: var(--r-md);
        box-shadow: 0 1px 2px rgba(23, 32, 30, 0.04);
        overflow: hidden;
      }

      /* Toolbar */
      .toolbar {
        display: flex;
        align-items: flex-end;
        gap: var(--sp-3);
        flex-wrap: wrap;
      }

      .toolbar-grow {
        flex: 1;
        min-width: 220px;
      }

      .toolbar-action {
        flex-shrink: 0;
      }

      .search-prefix {
        color: #64706b;
      }

      /* Desktop Table */
      .table-scroll {
        overflow-x: auto;
      }

      .data-table {
        width: 100%;
        border-collapse: collapse;
        font-size: var(--fs-sm);

        th {
          background: #faf9f6;
          padding: 10px var(--sp-4);
          font-weight: var(--fw-semibold);
          color: #64706b;
          text-align: left;
          border-bottom: 1px solid #d9ddd8;
          font-size: 0.725rem;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        td {
          padding: 12px var(--sp-4);
          border-bottom: 1px solid #f0ede6;
          vertical-align: middle;
        }

        tr:last-child td {
          border-bottom: none;
        }

        tr:hover td {
          background: #faf9f6;
        }
      }

      .product-info-cell {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .product-name {
        font-weight: var(--fw-semibold);
        color: #17201e;
      }

      .product-desc-snippet {
        font-size: var(--fs-xs);
        color: #64706b;
        margin: 0;
        display: -webkit-box;
        -webkit-line-clamp: 1;
        line-clamp: 1;
        -webkit-box-orient: vertical;
        overflow: hidden;
        max-width: 50ch;
      }

      .category-badge {
        font-size: 0.7rem;
        font-weight: var(--fw-medium);
        color: #26332f;
        background: #f0ede6;
        border: 1px solid #d9ddd8;
        padding: 2px 8px;
        border-radius: var(--r-xs);
        white-space: nowrap;
      }

      .text-mono-id {
        font-family: var(--font-mono);
        font-size: 0.75rem;
        color: #64706b;
      }

      .font-bold {
        font-weight: var(--fw-bold);
        color: #17201e;
      }

      .text-numeric {
        font-family: var(--font-mono);
        font-variant-numeric: tabular-nums;
      }

      .text-meta {
        font-size: var(--fs-xs);
        color: #64706b;
      }

      .text-meta-date {
        font-family: var(--font-mono);
        font-size: 0.7rem;
        color: #64706b;
      }

      .col-numeric {
        text-align: right;
      }

      .cell-actions {
        text-align: right;
        white-space: nowrap;
      }

      .actions-group {
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }

      .action-danger {
        color: var(--c-danger);
        &:hover {
          background-color: var(--c-danger-soft);
        }
      }

      /* Mobile Stack */
      .mobile-product-stack {
        display: flex;
        flex-direction: column;
        gap: var(--sp-3);
        padding: var(--sp-3);
      }

      .mobile-product-card {
        background: #ffffff;
        border: 1px solid #d9ddd8;
        border-radius: var(--r-sm);
        padding: var(--sp-3);
        display: flex;
        flex-direction: column;
        gap: var(--sp-2-5, 10px);
      }

      .mobile-product-card-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--sp-2);
      }

      .mobile-product-title {
        font-size: var(--fs-sm);
        font-weight: var(--fw-bold);
        color: #17201e;
        margin: 0;
      }

      .mobile-product-desc {
        font-size: var(--fs-xs);
        color: #64706b;
        margin: 4px 0 0 0;
        line-height: var(--lh-normal);
        display: -webkit-box;
        -webkit-line-clamp: 2;
        line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      .mobile-product-card-meta {
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: #faf9f6;
        padding: 6px 10px;
        border-radius: var(--r-xs);
      }

      .meta-item {
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .mobile-product-card-actions {
        display: flex;
        align-items: center;
        gap: var(--sp-2);
      }

      .btn-grow {
        flex: 1;
        justify-content: center;
      }

      .btn-danger-soft {
        background: var(--c-danger-soft);
        color: var(--c-danger);
        border: 1px solid var(--c-danger-border);
        border-radius: var(--r-sm);
        padding: 6px 10px;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 4px;

        &:hover {
          background: #fee2e2;
        }
      }

      /* Responsive Display */
      .hide-desktop {
        display: none !important;
      }

      @media (max-width: 768px) {
        .hide-mobile {
          display: none !important;
        }

        .hide-desktop {
          display: flex !important;
        }

        .toolbar-action {
          width: 100%;
          .btn {
            width: 100%;
            justify-content: center;
          }
        }
      }

      @media (max-width: 540px) {
        .page-head {
          flex-direction: column;
        }

        .page-actions {
          width: 100%;
          .btn {
            width: 100%;
            justify-content: center;
          }
        }
      }
    `,
  ],
})
export class ProductListComponent {
  private readonly productService = inject(ProductService);
  private readonly categoryService = inject(CategoryService);
  private readonly notifications = inject(NotificationService);

  readonly products = new AsyncResource<Paginated<Product>>();
  readonly categoriesResource = new AsyncResource<Paginated<Category>>();

  readonly page = signal(1);
  readonly pageSize = signal(15);
  readonly searchInput = signal('');
  readonly categoryFilter = signal<string>('ALL');

  readonly pendingDelete = signal<Product | null>(null);
  readonly deleting = signal(false);
  readonly deleteFailure = signal<ApiFailure | null>(null);

  readonly productList = computed(() => this.products.data()?.items ?? []);
  readonly meta = computed(() => this.products.data()?.meta ?? null);
  readonly categories = computed(() => this.categoriesResource.data()?.items ?? []);

  readonly hasFilters = computed(
    () => this.searchInput().trim().length > 0 || this.categoryFilter() !== 'ALL',
  );

  constructor() {
    this.categoriesResource.load(this.categoryService.list({ limit: 100 }));
    this.reload();
  }

  reload(): void {
    this.deleteFailure.set(null);
    const categoryId = this.categoryFilter() === 'ALL' ? undefined : this.categoryFilter();
    const search = this.searchInput().trim() || undefined;

    this.products.load(
      this.productService.listMine({
        page: this.page(),
        limit: this.pageSize(),
        categoryId,
        search,
      }),
    );
  }

  onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchInput.set(value);
    this.page.set(1);
    this.reload();
  }

  setCategory(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.categoryFilter.set(select.value);
    this.page.set(1);
    this.reload();
  }

  setPage(p: number): void {
    this.page.set(p);
    this.reload();
  }

  clearFilters(): void {
    this.searchInput.set('');
    this.categoryFilter.set('ALL');
    this.page.set(1);
    this.reload();
  }

  confirmDelete(product: Product): void {
    this.deleteFailure.set(null);
    this.pendingDelete.set(product);
  }

  deleteProduct(): void {
    const product = this.pendingDelete();
    if (!product) return;

    this.deleting.set(true);
    this.productService.delete(product.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.pendingDelete.set(null);
        this.notifications.success(
          'Barang berhasil dihapus',
          `Barang "${product.name}" berhasil dihapus dari katalog.`,
        );
        this.reload();
      },
      error: (err: unknown) => {
        this.deleting.set(false);
        this.pendingDelete.set(null);
        this.deleteFailure.set(toApiFailure(err));
      },
    });
  }

  updated(iso: string): string {
    return formatDateTime(iso);
  }
}
