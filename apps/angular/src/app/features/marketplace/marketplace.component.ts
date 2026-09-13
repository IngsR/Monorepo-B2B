import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { resolveTiming } from '../../core/domain/auction-lifecycle';
import { AuctionStatus, DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from '../../core/domain/enums';
import { Auction, AuctionQuery, Category, Paginated } from '../../core/domain/models';
import { AuctionService } from '../../core/services/auction.service';
import { CategoryService } from '../../core/services/catalogue.service';
import { AsyncResource } from '../../core/state/async-resource';
import { AuctionCardComponent } from '../../shared/ui/auction-card.component';
import { ButtonComponent } from '../../shared/ui/button.component';
import { IconComponent } from '../../shared/ui/icon.component';
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
 * Auction marketplace.
 *
 * The discovery surface for every role, but designed as a marketplace rather
 * than a management table: cards, a prominent current price, an urgency signal
 * and a single clear call to action per lot.
 *
 * Default ordering is "closing soonest", so live auctions a bidder can act on
 * appear first, followed by scheduled, then ended. Management actions never
 * appear here — a vendor or administrator manages auctions from their own
 * workspace, not from discovery.
 *
 * Filter state lives in the URL query string so a filtered view is shareable and
 * survives a refresh.
 */
@Component({
  selector: 'app-marketplace',
  standalone: true,
  imports: [
    AuctionCardComponent,
    ButtonComponent,
    IconComponent,
    PaginationComponent,
    CardSkeletonComponent,
    EmptyStateComponent,
    ErrorStateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page marketplace-page">
      <!-- 1. E-Commerce Hero Banner (Tokopedia/Shopee style) -->
      <section class="marketplace-ecom-hero">
        <div class="hero-ecom-content">
          <div class="hero-ecom-text">
            <span class="hero-ecom-eyebrow">
              <app-icon name="shield" [size]="14" />
              <span>BidForge Marketplace · Lelang Resmi B2B</span>
            </span>
            <h1 class="hero-ecom-title">Pengadaan & Aset Industri Harga Terbaik Pasar</h1>
            <p class="hero-ecom-copy">
              Temukan lot lelang resmi dari vendor terverifikasi di seluruh kategori. Transparan, aman,
              dan server-authoritative tanpa markup tersembunyi.
            </p>
            <div class="hero-ecom-badges">
              <span class="hero-trust-badge">
                <app-icon name="check" [size]="12" />
                <span>Vendor Terverifikasi</span>
              </span>
              <span class="hero-trust-badge">
                <app-icon name="shield" [size]="12" />
                <span>Jaminan Transaksi B2B</span>
              </span>
              <span class="hero-trust-badge">
                <app-icon name="clock" [size]="12" />
                <span>Live Real-Time Timer</span>
              </span>
            </div>
            <div class="marketplace-hero-actions">
              <button type="button" class="btn btn-hero" (click)="focusSearch()">
                <app-icon name="search" [size]="16" />
                <span>Cari Lot Lelang</span>
              </button>
              <button
                type="button"
                class="btn btn-hero-ghost"
                (click)="setStatusValue(AuctionStatus.ACTIVE)"
              >
                <app-icon name="gavel" [size]="16" />
                <span>Lelang Sedang Berlangsung</span>
              </button>
            </div>
          </div>

          <div class="hero-ecom-stats">
            <div class="hero-ecom-stat-card">
              <span class="hero-stat-num">{{ statTotal() }}</span>
              <span class="hero-stat-desc">Total Lot Terdaftar</span>
            </div>
            <div class="hero-ecom-stat-card">
              <span class="hero-stat-num">{{ statActive() }}</span>
              <span class="hero-stat-desc">Sedang Berlangsung</span>
            </div>
            <div class="hero-ecom-stat-card">
              <span class="hero-stat-num">{{ statEndingSoon() }}</span>
              <span class="hero-stat-desc">Segera Berakhir</span>
            </div>
            <div class="hero-ecom-stat-card">
              <span class="hero-stat-num">{{ statBids() }}</span>
              <span class="hero-stat-desc">Total Penawaran</span>
            </div>
          </div>
        </div>
      </section>

      <!-- 2. Two-Column E-Commerce Layout -->
      <div class="marketplace-ecom-layout">
        <!-- Left Filter Sidebar -->
        <aside class="marketplace-sidebar-filter" aria-label="Filter lelang">
          <div class="filter-sidebar-card">
            <div class="filter-sidebar-header">
              <span class="filter-sidebar-title">
                <app-icon name="filter" [size]="16" />
                <span>Filter Pencarian</span>
              </span>
              @if (hasActiveFilters()) {
                <button
                  type="button"
                  class="btn btn-ghost btn-sm"
                  (click)="clearFilters()"
                  title="Reset Semua Filter"
                >
                  <app-icon name="trash" [size]="13" />
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
                  <app-icon name="layers" [size]="14" />
                </button>
                <button
                  type="button"
                  class="filter-option-item"
                  [class.is-active]="filters().status === AuctionStatus.ACTIVE"
                  (click)="setStatusValue(AuctionStatus.ACTIVE)"
                >
                  <span>Sedang Berlangsung (Live)</span>
                  <app-icon name="gavel" [size]="14" />
                </button>
                <button
                  type="button"
                  class="filter-option-item"
                  [class.is-active]="filters().status === AuctionStatus.SCHEDULED"
                  (click)="setStatusValue(AuctionStatus.SCHEDULED)"
                >
                  <span>Segera Dimulai</span>
                  <app-icon name="calendar" [size]="14" />
                </button>
                <button
                  type="button"
                  class="filter-option-item"
                  [class.is-active]="filters().status === AuctionStatus.ENDED"
                  (click)="setStatusValue(AuctionStatus.ENDED)"
                >
                  <span>Telah Berakhir</span>
                  <app-icon name="check" [size]="14" />
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
                  <app-icon name="layers" [size]="14" />
                </button>
                @for (category of categories(); track category.id) {
                  <button
                    type="button"
                    class="filter-option-item"
                    [class.is-active]="filters().categoryId === category.id"
                    (click)="setCategoryValue(category.id)"
                  >
                    <span>{{ category.name }}</span>
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
                  <span class="search-prefix"><app-icon name="tag" [size]="13" /></span>
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
                  <span class="search-prefix"><app-icon name="tag" [size]="13" /></span>
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
              <label class="form-label" for="mp-search">Cari Lot & Produk</label>
              <div class="input-affix-wrap">
                <span class="search-prefix">
                  <app-icon name="search" [size]="15" />
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
              <label class="form-label" for="mp-sort">Urutkan</label>
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

          <!-- Active filters, removable one at a time -->
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
                    <app-icon name="close" [size]="12" />
                  </button>
                </span>
              }
              <app-button
                label="Hapus Semua"
                variant="ghost"
                icon="trash"
                (clicked)="clearFilters()"
              />
            </div>
          }

          <!-- Result count toolbar -->
          <div class="grid-toolbar">
            @if (auctions.isSuccess() && data(); as result) {
              <p class="grid-toolbar-count">
                Menampilkan <strong class="text-numeric">{{ result.items.length }}</strong> dari
                <strong class="text-numeric">{{ result.meta.total }}</strong> lot lelang
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
                    icon="search"
                    title="Tidak ada lelang yang sesuai dengan filter"
                    description="Coba ubah kata kunci pencarian, rentang harga, atau hapus filter untuk melihat semua lot lelang."
                  >
                    <app-button
                      label="Reset Semua Filter"
                      variant="secondary"
                      icon="refresh"
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

                <div class="card">
                  <app-pagination [meta]="result.meta" (pageChange)="setPage($event)" />
                </div>
              }
            }
          }

          <!-- Auction lifecycle reference -->
          <div class="card card-body lifecycle-reference">
            <p class="text-label">
              <app-icon name="info" [size]="13" />
              <span>Ketentuan & Siklus Hidup Lelang</span>
            </p>
            <p class="text-helper lifecycle-reference-copy">
              Alur lelang berlangsung <strong>Draft → Terjadwal → Berlangsung (Active) → Berakhir</strong>.
              Waktu berakhir yang dipublikasikan bersifat server-authoritative: penawaran dinyatakan sah jika
              diterima server sebelum batas waktu berakhir.
            </p>
          </div>
        </main>
      </div>
    </div>
  `,
  styles: [
    `
      .search-prefix {
        position: absolute;
        left: 11px;
        display: flex;
        color: var(--c-text-muted);
        pointer-events: none;
      }
      .search-with-icon {
        padding-left: 34px;
      }
      .sort-field {
        display: block;
      }
      .lifecycle-reference {
        gap: var(--sp-2);
        display: flex;
        flex-direction: column;
        margin-top: var(--sp-4);
      }
      .lifecycle-reference-copy {
        max-width: 100ch;
      }
      .marketplace-hero-actions {
        display: flex;
        gap: var(--sp-3);
        margin-top: var(--sp-2);
        flex-wrap: wrap;
      }
      .category-chip-count {
        font-size: var(--fs-xs);
        background: var(--c-surface-sunken);
        color: var(--c-text-muted);
        padding: 2px 6px;
        border-radius: var(--r-full);
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

  /**
   * Filter state. Initialised from the URL so a filtered marketplace view can be
   * bookmarked and shared.
   */
  readonly filters = signal<MarketplaceFilters>({
    search: this.route.snapshot.queryParamMap.get('search') ?? '',
    status: (this.route.snapshot.queryParamMap.get('status') as AuctionStatus | 'ALL') ?? 'ALL',
    categoryId: this.route.snapshot.queryParamMap.get('categoryId') ?? 'ALL',
    minPrice: toNumberOrNull(this.route.snapshot.queryParamMap.get('minPrice')),
    maxPrice: toNumberOrNull(this.route.snapshot.queryParamMap.get('maxPrice')),
    orderBy: (this.route.snapshot.queryParamMap.get('orderBy') as OrderBy) ?? 'endingSoon',
    page: toNumberOrNull(this.route.snapshot.queryParamMap.get('page')) ?? 1,
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

  /**
   * Headline figures shown in the hero. Derived from the page of results on
   * screen, never invented: "Open now" counts live auctions in the current
   * result set, and "Closing soon" counts active lots within the window.
   */
  readonly statTotal = computed(() => this.data()?.meta.total ?? 0);
  readonly statActive = computed(
    () => this.data()?.items.filter((a) => a.status === AuctionStatus.ACTIVE).length ?? 0,
  );
  readonly statEndingSoon = computed(
    () =>
      this.data()?.items.filter(
        (a) => a.status === AuctionStatus.ACTIVE && resolveTiming(a).endingSoon,
      ).length ?? 0,
  );
  readonly statBids = computed(
    () => this.data()?.items.reduce((sum, a) => sum + a.bidCount, 0) ?? 0,
  );

  /** Active filters as removable chips, so each can be dropped individually. */
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
    this.searchInput.set(this.filters().search);
    this.loadCategories();
    this.reload();
  }

  /** Focuses the search box from the hero CTA. */
  focusSearch(): void {
    const el = document.getElementById('mp-search') as HTMLInputElement | null;
    el?.focus();
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  /** Clears a single active filter chip. */
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

  /** Stable handler passed to the card so the CTA performs client-side routing. */
  readonly openAuction = (auction: Auction): void => {
    void this.router.navigate(['/marketplace', auction.id]);
  };

  private loadCategories(): void {
    this.categoryService.list({ limit: 100 }).subscribe({
      next: (result) => this.categories.set(result.items),
      // A category list failure must not block the marketplace itself.
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

  /**
   * Search is debounced so typing does not issue a request per keystroke, but
   * the input stays responsive because it is bound to its own signal.
   */
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
    this.reload();
  }

  /** Mirrors the filter state into the URL so the view is shareable. */
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
