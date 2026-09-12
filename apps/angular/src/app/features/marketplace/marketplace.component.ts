import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuctionStatus, DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from '../../core/domain/enums';
import { Auction, AuctionQuery, Category, Paginated } from '../../core/domain/models';
import { AuctionService } from '../../core/services/auction.service';
import { CategoryService } from '../../core/services/catalogue.service';
import { AsyncResource } from '../../core/state/async-resource';
import { AuctionCardComponent } from '../../shared/ui/auction-card.component';
import { ButtonComponent } from '../../shared/ui/button.component';
import { FormFieldComponent } from '../../shared/ui/form-field.component';
import { IconComponent } from '../../shared/ui/icon.component';
import { PaginationComponent } from '../../shared/ui/pagination.component';
import {
  CardSkeletonComponent,
  EmptyStateComponent,
  ErrorStateComponent,
} from '../../shared/ui/state-block.component';
import { AlertComponent } from '../../shared/ui/toast.component';

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
    AlertComponent,
    ButtonComponent,
    FormFieldComponent,
    IconComponent,
    PaginationComponent,
    CardSkeletonComponent,
    EmptyStateComponent,
    ErrorStateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <header class="page-head">
        <div class="page-head-text">
          <h1 class="page-title">Auction marketplace</h1>
          <p class="page-subtitle">
            Live and upcoming auctions across all vendors. Prices are server-authoritative and
            update when a bid is accepted.
          </p>
        </div>
        <div class="page-actions">
          <app-button
            label="Refresh"
            icon="refresh"
            variant="secondary"
            [loading]="auctions.isLoading()"
            (clicked)="reload()"
          />
        </div>
      </header>

      <!-- Filters -->
      <div class="toolbar">
        <div class="toolbar-field toolbar-grow">
          <label class="form-label" for="mp-search">Search</label>
          <div class="input-affix-wrap">
            <input
              id="mp-search"
              type="search"
              class="form-input"
              placeholder="Search by lot name, product code or vendor"
              [value]="searchInput()"
              (input)="onSearchInput($event)"
            />
          </div>
        </div>

        <div class="toolbar-field">
          <label class="form-label" for="mp-status">Status</label>
          <select
            id="mp-status"
            class="form-select"
            [value]="filters().status"
            (change)="setStatus($event)"
          >
            <option value="ALL">All statuses</option>
            <option [value]="AuctionStatus.ACTIVE">Active</option>
            <option [value]="AuctionStatus.SCHEDULED">Scheduled</option>
            <option [value]="AuctionStatus.DRAFT">Draft</option>
            <option [value]="AuctionStatus.ENDED">Ended</option>
            <option [value]="AuctionStatus.CANCELLED">Cancelled</option>
          </select>
        </div>

        <div class="toolbar-field">
          <label class="form-label" for="mp-category">Category</label>
          <select
            id="mp-category"
            class="form-select"
            [value]="filters().categoryId"
            (change)="setCategory($event)"
          >
            <option value="ALL">All categories</option>
            @for (category of categories(); track category.id) {
              <option [value]="category.id">{{ category.name }}</option>
            }
          </select>
        </div>

        <div class="toolbar-field">
          <label class="form-label" for="mp-min">Min price</label>
          <input
            id="mp-min"
            type="number"
            class="form-input"
            min="0"
            placeholder="No minimum"
            [value]="filters().minPrice ?? ''"
            (change)="setMinPrice($event)"
          />
        </div>

        <div class="toolbar-field">
          <label class="form-label" for="mp-max">Max price</label>
          <input
            id="mp-max"
            type="number"
            class="form-input"
            min="0"
            placeholder="No maximum"
            [value]="filters().maxPrice ?? ''"
            (change)="setMaxPrice($event)"
          />
        </div>

        <div class="toolbar-field">
          <label class="form-label" for="mp-sort">Sort by</label>
          <select
            id="mp-sort"
            class="form-select"
            [value]="filters().orderBy"
            (change)="setOrderBy($event)"
          >
            @for (option of sortOptions; track option.value) {
              <option [value]="option.value">{{ option.label }}</option>
            }
          </select>
        </div>

        @if (hasActiveFilters()) {
          <div class="toolbar-field toolbar-reset">
            <app-button
              label="Clear filters"
              variant="ghost"
              icon="close"
              (clicked)="clearFilters()"
            />
          </div>
        }
      </div>

      <!-- Result summary -->
      @if (auctions.isSuccess() && data(); as result) {
        <p class="result-summary">
          Showing <strong class="text-numeric">{{ result.items.length }}</strong> of
          <strong class="text-numeric">{{ result.meta.total }}</strong>
          {{ result.meta.total === 1 ? 'auction' : 'auctions' }}
          @if (activeFilterCount() > 0) {
            <span class="result-filter-note">
              · {{ activeFilterCount() }}
              {{ activeFilterCount() === 1 ? 'filter' : 'filters' }} applied
            </span>
          }
        </p>
      }

      <!-- Results -->
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
                title="No auctions match these filters"
                description="Try widening the price range, choosing a different category, or clearing the status filter."
              >
                <app-button label="Clear filters" variant="secondary" (clicked)="clearFilters()" />
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
        <p class="text-label">Auction lifecycle</p>
        <p class="text-helper lifecycle-reference-copy">
          Auctions move <strong>Draft → Scheduled → Active → Ended</strong>. A draft cannot jump
          directly to active, and a scheduled auction cannot jump to ended. Any non-terminal auction
          can instead be <strong>Cancelled</strong>, which is final. The published end time is
          authoritative for bidding: an auction may briefly still read Active after its window has
          closed, until an authorised user closes it.
        </p>
      </div>
    </div>
  `,
  styles: [
    `
      .toolbar-reset {
        justify-content: flex-end;
      }
      .result-summary {
        font-size: var(--fs-base);
        color: var(--c-text-secondary);
      }
      .result-filter-note {
        color: var(--c-text-muted);
      }
      .lifecycle-reference {
        gap: var(--sp-2);
        display: flex;
        flex-direction: column;
      }
      .lifecycle-reference-copy {
        max-width: 100ch;
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
    { value: 'endingSoon', label: 'Closing soonest first' },
    { value: 'newest', label: 'Newest listings' },
    { value: 'priceAsc', label: 'Price: low to high' },
    { value: 'priceDesc', label: 'Price: high to low' },
    { value: 'mostBids', label: 'Most bids' },
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

  constructor() {
    this.searchInput.set(this.filters().search);
    this.loadCategories();
    this.reload();
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
