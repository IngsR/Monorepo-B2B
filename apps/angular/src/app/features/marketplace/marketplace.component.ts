import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuctionStatus, DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from '../../core/domain/enums';
import { Auction, AuctionQuery, Category, Paginated } from '../../core/domain/models';
import { AuctionService } from '../../core/services/auction.service';
import { CategoryService } from '../../core/services/catalogue.service';
import { AsyncResource } from '../../core/state/async-resource';
import { AuctionCardComponent } from '../../shared/ui/auction-card.component';
import { ButtonComponent } from '../../shared/ui/button.component';
import { MatIconComponent } from '../../shared/ui/mat-icon.component';
import { PaginationComponent } from '../../shared/ui/pagination.component';
import {
  CardSkeletonComponent,
  EmptyStateComponent,
  ErrorStateComponent,
} from '../../shared/ui/state-block.component';

type OrderBy = NonNullable<AuctionQuery['orderBy']>;

interface SortOption {
  value: OrderBy;
  label: string;
}

/** The complete marketplace filter state, mirrored into the URL query string. */
interface MarketplaceFilters {
  search: string;
  status: AuctionStatus | 'ALL';
  categoryId: string;
  minPrice: number | null;
  maxPrice: number | null;
  orderBy: OrderBy;
  page: number;
  limit: number;
}

/**
 * Auction Marketplace — B2B Procurement Floor.
 *
 * Dedicated to industrial equipment, auction lots, and commercial surplus discovery:
 *  - Institutional procurement header with real-time lot figures
 *  - Deterministic sidebar filtering (Status, Category, Price range)
 *  - Fully reactive to URL query parameters (listening to shortcuts like /marketplace?status=ACTIVE)
 *  - Clean, scannable industrial lot cards
 */
@Component({
  selector: 'app-marketplace',
  standalone: true,
  imports: [
    AuctionCardComponent,
    ButtonComponent,
    MatIconComponent,
    PaginationComponent,
    CardSkeletonComponent,
    EmptyStateComponent,
    ErrorStateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page marketplace-page">
      <!-- 1. Institutional Procurement Header -->
      <section class="marketplace-procurement-head">
        <div class="procurement-head-text">
          <span class="procurement-eyebrow">
            <mat-icon fontIcon="verified" [size]="14" />
            <span>Lantai Lelang B2B · Pengadaan Industri</span>
          </span>
          <h1 class="procurement-title">Katalog Lot Lelang Resmi</h1>
          <p class="procurement-copy">
            Akses langsung ke inventaris peralatan industri, mesin pabrik, dan surplus komersial
            dari vendor terverifikasi dengan ketentuan penawaran terbuka dan server-authoritative.
          </p>
        </div>

        <div class="procurement-head-meta">
          <div class="procurement-meta-stat">
            <span class="procurement-stat-val">{{ statTotal() }}</span>
            <span class="procurement-stat-lbl">Total Lot Lelang</span>
          </div>
          <div class="procurement-meta-stat">
            <span class="procurement-stat-val">{{ statActive() }}</span>
            <span class="procurement-stat-lbl">Sedang Berlangsung</span>
          </div>
        </div>
      </section>

      <!-- 2. Two-Column Procurement Layout -->
      <div class="marketplace-layout">
        <!-- Left Filter Sidebar -->
        <aside class="marketplace-sidebar-filter" aria-label="Filter lelang">
          <div class="filter-sidebar-card">
            <div class="filter-sidebar-header">
              <span class="filter-sidebar-title">
                <mat-icon fontIcon="tune" [size]="16" />
                <span>Filter Lot Lelang</span>
              </span>
              @if (hasActiveFilters()) {
                <button
                  type="button"
                  class="btn btn-ghost btn-sm reset-btn"
                  (click)="clearFilters()"
                  title="Reset Semua Filter"
                >
                  <mat-icon fontIcon="refresh" [size]="13" />
                  <span>Reset</span>
                </button>
              }
            </div>

            <!-- Status Filter -->
            <div class="filter-section">
              <h3 class="filter-section-title">Status Lelang</h3>
              <div class="filter-options-list">
                <button
                  type="button"
                  class="filter-option-item"
                  [class.is-active]="filters().status === 'ALL'"
                  (click)="setStatusValue('ALL')"
                >
                  <span>Semua Status</span>
                  <mat-icon fontIcon="layers" [size]="15" />
                </button>
                <button
                  type="button"
                  class="filter-option-item"
                  [class.is-active]="filters().status === AuctionStatus.ACTIVE"
                  (click)="setStatusValue(AuctionStatus.ACTIVE)"
                >
                  <span>Sedang Berlangsung</span>
                  <mat-icon fontIcon="gavel" [size]="15" />
                </button>
                <button
                  type="button"
                  class="filter-option-item"
                  [class.is-active]="filters().status === AuctionStatus.SCHEDULED"
                  (click)="setStatusValue(AuctionStatus.SCHEDULED)"
                >
                  <span>Segera Dimulai</span>
                  <mat-icon fontIcon="calendar_today" [size]="15" />
                </button>
                <button
                  type="button"
                  class="filter-option-item"
                  [class.is-active]="filters().status === AuctionStatus.ENDED"
                  (click)="setStatusValue(AuctionStatus.ENDED)"
                >
                  <span>Telah Berakhir</span>
                  <mat-icon fontIcon="done" [size]="15" />
                </button>
              </div>
            </div>

            <!-- Category Filter -->
            <div class="filter-section">
              <h3 class="filter-section-title">Kategori Produk</h3>
              <div class="filter-options-list">
                <button
                  type="button"
                  class="filter-option-item"
                  [class.is-active]="filters().categoryId === 'ALL'"
                  (click)="setCategoryValue('ALL')"
                >
                  <span>Semua Kategori</span>
                  <mat-icon fontIcon="category" [size]="15" />
                </button>
                @for (category of categories(); track category.id) {
                  <button
                    type="button"
                    class="filter-option-item"
                    [class.is-active]="filters().categoryId === category.id"
                    (click)="setCategoryValue(category.id)"
                  >
                    <span class="category-name-truncate">{{ category.name }}</span>
                    @if (category.productCount) {
                      <span class="category-chip-count">{{ category.productCount }}</span>
                    }
                  </button>
                }
              </div>
            </div>

            <!-- Price Range Filter -->
            <div class="filter-section">
              <h3 class="filter-section-title">Rentang Harga (Rp)</h3>
              <div class="filter-price-inputs">
                <div class="input-affix-wrap">
                  <span class="search-prefix"><mat-icon fontIcon="attach_money" [size]="15" /></span>
                  <input
                    id="mp-min"
                    type="number"
                    class="form-input search-with-icon"
                    min="0"
                    placeholder="Harga Minimum"
                    [value]="filters().minPrice ?? ''"
                    (change)="setMinPrice($event)"
                  />
                </div>
                <div class="input-affix-wrap">
                  <span class="search-prefix"><mat-icon fontIcon="attach_money" [size]="15" /></span>
                  <input
                    id="mp-max"
                    type="number"
                    class="form-input search-with-icon"
                    min="0"
                    placeholder="Harga Maksimum"
                    [value]="filters().maxPrice ?? ''"
                    (change)="setMaxPrice($event)"
                  />
                </div>
              </div>
            </div>
          </div>
        </aside>

        <!-- Right Main Catalog Content -->
        <main class="marketplace-main-content">
          <!-- In-Page Search Toolbar -->
          <div class="toolbar">
            <div class="toolbar-field toolbar-grow">
              <label class="form-label" for="mp-search">Cari Lot & Mesin</label>
              <div class="input-affix-wrap">
                <span class="search-prefix">
                  <mat-icon fontIcon="search" [size]="16" />
                </span>
                <input
                  id="mp-search"
                  #searchBox
                  type="search"
                  class="form-input search-with-icon"
                  placeholder="Cari berdasarkan nama lot, kode produk, atau vendor"
                  [value]="searchInput()"
                  (input)="onSearchInput($event)"
                />
              </div>
            </div>

            <div class="toolbar-field">
              <label class="form-label" for="mp-sort">Urutkan Berdasarkan</label>
              <select
                id="mp-sort"
                class="form-select sort-select"
                [value]="filters().orderBy"
                (change)="setOrderBy($event)"
              >
                @for (option of sortOptions; track option.value) {
                  <option [value]="option.value">{{ option.label }}</option>
                }
              </select>
            </div>
          </div>

          <!-- Active filters, removable individually -->
          @if (hasActiveFilters()) {
            <div class="filter-bar">
              <span class="filter-bar-label">Filter Aktif:</span>
              @for (chip of activeChips(); track chip.key) {
                <span class="filter-chip">
                  <span>{{ chip.label }}</span>
                  <button
                    type="button"
                    class="filter-chip-remove"
                    [attr.aria-label]="'Hapus filter ' + chip.label"
                    (click)="removeChip(chip.key)"
                  >
                    <mat-icon fontIcon="close" [size]="12" />
                  </button>
                </span>
              }
              <app-button
                label="Hapus Semua"
                variant="ghost"
                (clicked)="clearFilters()"
              />
            </div>
          }

          <!-- Result count toolbar -->
          <div class="grid-toolbar">
            @if (auctions.isSuccess() && data(); as result) {
              <p class="grid-toolbar-count">
                Menampilkan <strong class="text-numeric">{{ result.items.length }}</strong> dari
                <strong class="text-numeric">{{ result.meta.total }}</strong> lot lelang terdaftar
              </p>
            } @else {
              <span></span>
            }
          </div>

          <!-- Auction Cards Grid -->
          @switch (true) {
            @case (auctions.isLoading() && !auctions.data()) {
              <div class="auction-grid">
                @for (i of skeletonItems; track i) {
                  <app-card-skeleton />
                }
              </div>
            }
            @case (auctions.hasError()) {
              @if (auctions.error(); as failure) {
                <div class="card">
                  <app-error-state
                    [failure]="failure"
                    [retrying]="auctions.isLoading()"
                    (retry)="reload()"
                  />
                </div>
              }
            }
            @case (true) {
              @let result = data()!;
              @if (result.items.length === 0) {
                <div class="card">
                  <app-empty-state
                    title="Tidak ada lot lelang yang sesuai dengan filter"
                    description="Sesuaikan kata kunci pencarian, rentang harga, atau hapus filter status untuk melihat lot lelang lainnya."
                  >
                    <app-button
                      label="Reset Semua Filter"
                      variant="secondary"
                      (clicked)="clearFilters()"
                    />
                  </app-empty-state>
                </div>
              } @else {
                <div class="auction-grid">
                  @for (auction of result.items; track auction.id) {
                    <app-auction-card
                      [auction]="auction"
                      linkPrefix="/marketplace"
                      [navigateOnCta]="openAuction"
                    />
                  }
                </div>

                <div class="pagination-wrap">
                  <app-pagination [meta]="result.meta" (pageChange)="setPage($event)" />
                </div>
              }
            }
          }

          <!-- Auction lifecycle reference -->
          <div class="lifecycle-reference">
            <p class="text-label">
              <mat-icon fontIcon="info" [size]="14" />
              <span>Ketentuan & Siklus Transaksi Lelang B2B</span>
            </p>
            <p class="text-helper lifecycle-reference-copy">
              Alur lelang berlangsung secara ketat: <strong>Draft → Terjadwal → Berlangsung (Active) → Selesai (Ended)</strong>.
              Waktu berakhir yang dipublikasikan bersifat server-authoritative: penawaran dinyatakan sah jika
              diterima dan divalidasi server sebelum batas waktu penutupan lelang.
            </p>
          </div>
        </main>
      </div>
    </div>
  `,
  styles: [
    `
      .marketplace-layout {
        display: grid;
        grid-template-columns: 260px 1fr;
        gap: var(--sp-6);
        align-items: start;
        margin-top: var(--sp-6);

        @media (max-width: 960px) {
          grid-template-columns: 1fr;
        }
      }

      .filter-sidebar-card {
        background: var(--c-surface);
        border: 1px solid var(--c-border);
        border-radius: var(--r-md);
        padding: var(--sp-4);
        display: flex;
        flex-direction: column;
        gap: var(--sp-4);
      }

      .filter-sidebar-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding-bottom: var(--sp-3);
        border-bottom: 1px solid var(--c-border);
      }

      .filter-sidebar-title {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: var(--fs-sm);
        font-weight: var(--fw-bold);
        color: var(--c-text);
      }

      .reset-btn {
        padding: 2px 6px;
        font-size: var(--fs-xs);
      }

      .filter-section {
        display: flex;
        flex-direction: column;
        gap: var(--sp-2);
      }

      .filter-section-title {
        font-size: var(--fs-xs);
        font-weight: var(--fw-semibold);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--c-text-muted);
        margin: 0;
      }

      .filter-options-list {
        display: flex;
        flex-direction: column;
        gap: 3px;
      }

      .filter-option-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 6px 10px;
        border-radius: var(--r-sm);
        background: transparent;
        border: 1px solid transparent;
        color: var(--c-text-secondary);
        font-size: var(--fs-xs);
        font-weight: var(--fw-medium);
        cursor: pointer;
        text-align: left;
        transition: all var(--dur-fast) var(--ease);

        &:hover {
          background: var(--c-canvas);
          color: var(--c-text);
        }

        &.is-active {
          background: var(--c-brand-soft);
          color: var(--c-brand);
          font-weight: var(--fw-semibold);
          border-color: var(--c-brand-border);
        }
      }

      .category-name-truncate {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 180px;
      }

      .category-chip-count {
        font-size: var(--fs-2xs);
        background: var(--c-surface-sunken);
        color: var(--c-text-muted);
        padding: 1px 6px;
        border-radius: var(--r-full);
      }

      .filter-price-inputs {
        display: flex;
        flex-direction: column;
        gap: var(--sp-2);
      }

      .search-prefix {
        position: absolute;
        left: 10px;
        display: flex;
        align-items: center;
        color: var(--c-text-muted);
        pointer-events: none;
      }

      .search-with-icon {
        padding-left: 32px;
        height: 36px;
        font-size: var(--fs-xs);
      }

      .grid-toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: var(--sp-2);
      }

      .grid-toolbar-count {
        font-size: var(--fs-xs);
        color: var(--c-text-muted);
      }

      .auction-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(290px, 1fr));
        gap: var(--sp-5);
      }

      .pagination-wrap {
        margin-top: var(--sp-5);
      }

      .lifecycle-reference {
        background: var(--c-surface);
        border: 1px solid var(--c-border);
        border-radius: var(--r-md);
        padding: var(--sp-4) var(--sp-5);
        display: flex;
        flex-direction: column;
        gap: var(--sp-2);
        margin-top: var(--sp-6);
      }

      .lifecycle-reference-copy {
        max-width: 90ch;
        font-size: var(--fs-xs);
        line-height: var(--lh-normal);
      }
    `,
  ],
})
export class MarketplaceComponent {
  private readonly auctionService = inject(AuctionService);
  private readonly categoryService = inject(CategoryService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly AuctionStatus = AuctionStatus;
  protected readonly skeletonItems = Array.from({ length: 6 }, (_, i) => i);

  readonly auctions = new AsyncResource<Paginated<Auction>>();
  readonly categories = signal<Category[]>([]);
  readonly data = computed(() => this.auctions.data());

  readonly sortOptions: SortOption[] = [
    { value: 'endingSoon', label: 'Segera Berakhir Dahulu' },
    { value: 'newest', label: 'Lot Lelang Terbaru' },
    { value: 'priceAsc', label: 'Harga: Terendah ke Tertinggi' },
    { value: 'priceDesc', label: 'Harga: Tertinggi ke Terendah' },
    { value: 'mostBids', label: 'Penawaran Terbanyak' },
  ];

  readonly searchInput = signal('');

  readonly filters = signal<MarketplaceFilters>({
    search: '',
    status: 'ALL',
    categoryId: 'ALL',
    minPrice: null,
    maxPrice: null,
    orderBy: 'endingSoon',
    page: 1,
    limit: DEFAULT_PAGE_SIZE,
  });

  readonly hasActiveFilters = computed(() => this.activeFilterCount() > 0);

  readonly activeFilterCount = computed(() => {
    const f = this.filters();
    let count = 0;
    if (f.search) count += 1;
    if (f.status !== 'ALL') count += 1;
    if (f.categoryId !== 'ALL') count += 1;
    if (f.minPrice !== null) count += 1;
    if (f.maxPrice !== null) count += 1;
    return count;
  });

  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;

  readonly statTotal = computed(() => this.data()?.meta.total ?? 0);
  readonly statActive = computed(
    () => this.data()?.items.filter((a) => a.status === AuctionStatus.ACTIVE).length ?? 0,
  );

  readonly activeChips = computed<{ key: keyof MarketplaceFilters; label: string }[]>(() => {
    const f = this.filters();
    const chips: { key: keyof MarketplaceFilters; label: string }[] = [];
    if (f.search) chips.push({ key: 'search', label: `Pencarian: "${f.search}"` });
    if (f.status !== 'ALL') {
      const statusMap: Record<string, string> = {
        ACTIVE: 'Sedang Berlangsung',
        SCHEDULED: 'Segera Dimulai',
        ENDED: 'Telah Berakhir',
        CANCELLED: 'Dibatalkan',
      };
      chips.push({ key: 'status', label: `Status: ${statusMap[f.status] ?? f.status}` });
    }
    if (f.categoryId !== 'ALL') {
      const name = this.categories().find((c) => c.id === f.categoryId)?.name ?? 'Kategori';
      chips.push({ key: 'categoryId', label: `Kategori: ${name}` });
    }
    if (f.minPrice !== null) chips.push({ key: 'minPrice', label: `Harga Min: Rp ${f.minPrice.toLocaleString('id-ID')}` });
    if (f.maxPrice !== null) chips.push({ key: 'maxPrice', label: `Harga Maks: Rp ${f.maxPrice.toLocaleString('id-ID')}` });
    return chips;
  });

  constructor() {
    this.loadCategories();

    // React to query parameter changes from navigation shortcuts or URL updates
    this.route.queryParams.subscribe((params) => {
      const search = params['search'] ?? '';
      const status = (params['status'] as AuctionStatus | 'ALL') ?? 'ALL';
      const categoryId = params['categoryId'] ?? 'ALL';
      const minPrice = toNumberOrNull(params['minPrice']);
      const maxPrice = toNumberOrNull(params['maxPrice']);
      const rawOrderBy = params['orderBy'];
      const orderBy: OrderBy =
        rawOrderBy === 'closingSoonest' ? 'endingSoon' : (rawOrderBy as OrderBy) ?? 'endingSoon';
      const page = toNumberOrNull(params['page']) ?? 1;

      this.searchInput.set(search);
      this.filters.set({
        search,
        status,
        categoryId,
        minPrice,
        maxPrice,
        orderBy,
        page,
        limit: DEFAULT_PAGE_SIZE,
      });
      this.reload();
    });
  }

  removeChip(key: keyof MarketplaceFilters): void {
    if (key === 'search') {
      this.searchInput.set('');
      this.patch({ search: '', page: 1 });
      return;
    }
    if (key === 'categoryId') {
      this.patch({ categoryId: 'ALL', page: 1 });
      return;
    }
    if (key === 'status') {
      this.patch({ status: 'ALL', page: 1 });
      return;
    }
    this.patch({ [key]: null, page: 1 } as Partial<MarketplaceFilters>);
  }

  setCategoryValue(categoryId: string): void {
    this.patch({ categoryId, page: 1 });
  }

  setStatusValue(status: AuctionStatus | 'ALL'): void {
    this.patch({ status, page: 1 });
  }

  readonly openAuction = (auction: Auction): void => {
    void this.router.navigate(['/marketplace', auction.id]);
  };

  private loadCategories(): void {
    this.categoryService.list({ limit: 100 }).subscribe({
      next: (result) => this.categories.set(result.items),
      error: () => this.categories.set([]),
    });
  }

  reload(): void {
    const f = this.filters();
    this.auctions.load(
      this.auctionService.list({
        page: f.page,
        limit: f.limit,
        search: f.search || undefined,
        status: f.status,
        categoryId: f.categoryId,
        minPrice: f.minPrice ?? undefined,
        maxPrice: f.maxPrice ?? undefined,
        orderBy: f.orderBy,
      }),
      { keepData: true },
    );
  }

  private searchTimer?: ReturnType<typeof setTimeout>;

  onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchInput.set(value);

    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.patch({ search: value, page: 1 });
    }, 350);
  }

  setStatus(event: Event): void {
    this.patch({
      status: (event.target as HTMLSelectElement).value as AuctionStatus | 'ALL',
      page: 1,
    });
  }

  setCategory(event: Event): void {
    this.patch({ categoryId: (event.target as HTMLSelectElement).value, page: 1 });
  }

  setMinPrice(event: Event): void {
    this.patch({ minPrice: toNumberOrNull((event.target as HTMLInputElement).value), page: 1 });
  }

  setMaxPrice(event: Event): void {
    this.patch({ maxPrice: toNumberOrNull((event.target as HTMLInputElement).value), page: 1 });
  }

  setOrderBy(event: Event): void {
    this.patch({ orderBy: (event.target as HTMLSelectElement).value as OrderBy, page: 1 });
  }

  setPage(page: number): void {
    this.patch({ page });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  clearFilters(): void {
    this.searchInput.set('');
    this.patch({
      search: '',
      status: 'ALL',
      categoryId: 'ALL',
      minPrice: null,
      maxPrice: null,
      orderBy: 'endingSoon',
      page: 1,
    });
  }

  private patch(partial: Partial<MarketplaceFilters>): void {
    const next = { ...this.filters(), ...partial };
    this.filters.set(next);
    this.syncUrl(next);
  }

  private syncUrl(f: MarketplaceFilters): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        search: f.search || null,
        status: f.status === 'ALL' ? null : f.status,
        categoryId: f.categoryId === 'ALL' ? null : f.categoryId,
        minPrice: f.minPrice ?? null,
        maxPrice: f.maxPrice ?? null,
        orderBy: f.orderBy === 'endingSoon' ? null : f.orderBy,
        page: f.page === 1 ? null : f.page,
      },
      queryParamsHandling: '',
      replaceUrl: true,
    });
  }
}

function toNumberOrNull(value: string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
