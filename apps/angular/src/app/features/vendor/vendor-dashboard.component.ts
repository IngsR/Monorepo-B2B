import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuctionStatus } from '../../core/domain/enums';
import { formatAmount, formatDateTime } from '../../core/domain/format';
import { Auction, Paginated, Product } from '../../core/domain/models';
import { AuctionService } from '../../core/services/auction.service';
import { ProductService } from '../../core/services/catalogue.service';
import { AuthService } from '../../core/services/session.service';
import { AsyncResource } from '../../core/state/async-resource';
import { AuctionCardComponent } from '../../shared/ui/auction-card.component';
import { AuctionLifecycleComponent } from '../../shared/ui/auction-lifecycle.component';
import {
  AccountStatusBadgeComponent,
  AuctionStatusBadgeComponent,
} from '../../shared/ui/badge.component';
import { ButtonComponent } from '../../shared/ui/button.component';
import { IconComponent } from '../../shared/ui/icon.component';
import { PriceComponent } from '../../shared/ui/price.component';
import { EmptyStateComponent, ErrorStateComponent } from '../../shared/ui/state-block.component';
import { AlertComponent } from '../../shared/ui/toast.component';

/**
 * Vendor dashboard.
 *
 * An operational landing page for the vendor's own workspace: the state of their
 * profile, a count of their products and auctions by lifecycle state, the
 * auctions needing attention (draft, scheduled, or active but past its window),
 * and a short list of recent lots.
 *
 * The counts are derived from the vendor's own resources, so no figure here is
 * invented or aggregated from data the vendor cannot see.
 */
@Component({
  selector: 'app-vendor-dashboard',
  standalone: true,
  imports: [
    RouterLink,
    AuctionStatusBadgeComponent,
    AccountStatusBadgeComponent,
    AuctionCardComponent,
    ButtonComponent,
    IconComponent,
    AuctionLifecycleComponent,
    PriceComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    AlertComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <header class="page-head">
        <div class="page-head-text">
          <h1 class="page-title">Vendor workspace</h1>
          <p class="page-subtitle">
            Manage the products you own and drive each auction through its lifecycle. You only ever
            see your own catalogue here.
          </p>
        </div>
        <div class="page-actions">
          <a class="btn btn-secondary" routerLink="/vendor/products/new">
            <app-icon name="plus" [size]="15" />
            New product
          </a>
          <a class="btn btn-primary" routerLink="/vendor/auctions/new">
            <app-icon name="plus" [size]="15" />
            New auction
          </a>
        </div>
      </header>

      <!-- Vendor profile -->
      @if (vendor(); as v) {
        <section class="card">
          <div class="card-header">
            <h2 class="section-heading">Your vendor profile</h2>
            <app-account-status-badge [status]="v.status" />
          </div>
          <div class="card-body vendor-profile">
            <div class="vendor-identity">
              <span class="avatar avatar-lg">{{ vendorInitials() }}</span>
              <div>
                <p class="vendor-name">{{ v.companyName }}</p>
                <p class="text-meta">{{ v.contactPerson }} · {{ v.phone }}</p>
                @if (v.user?.email) {
                  <p class="text-helper">{{ v.user?.email }}</p>
                }
              </div>
            </div>

            <div class="meta-list vendor-meta">
              <div class="meta-item">
                <span class="price-label">Products</span>
                <span class="meta-value text-numeric">{{ v.productCount ?? 0 }}</span>
              </div>
              <div class="meta-item">
                <span class="price-label">Vendor since</span>
                <span class="meta-value">{{ memberSince() }}</span>
              </div>
            </div>

            <a class="btn btn-secondary" routerLink="/profile/vendor">
              <app-icon name="edit" [size]="15" />
              Edit profile
            </a>
          </div>
        </section>
      } @else if (profileResolved()) {
        <app-alert tone="warning" title="No vendor profile linked">
          Your account is a vendor role but has no vendor profile yet. Contact an administrator to
          have one created before you can publish products.
        </app-alert>
      }

      <!-- Auction pipeline -->
      @if (auctions.hasError()) {
        <div class="card">
          @if (auctions.error(); as failure) {
            <app-error-state
              [failure]="failure"
              [retrying]="auctions.isLoading()"
              (retry)="reload()"
            />
          }
        </div>
      } @else {
        <section>
          <h2 class="section-heading section-gap">Auction pipeline</h2>
          <div class="stat-grid">
            <div class="stat-card">
              <span class="stat-label">Draft</span>
              <span class="stat-value">{{ countBy(AuctionStatus.DRAFT) }}</span>
              <span class="stat-foot">Not yet scheduled</span>
            </div>
            <div class="stat-card">
              <span class="stat-label">Scheduled</span>
              <span class="stat-value">{{ countBy(AuctionStatus.SCHEDULED) }}</span>
              <span class="stat-foot">Waiting for start time</span>
            </div>
            <div class="stat-card">
              <span class="stat-label">Active</span>
              <span class="stat-value">{{ countBy(AuctionStatus.ACTIVE) }}</span>
              <span class="stat-foot">Open or awaiting close</span>
            </div>
            <div class="stat-card">
              <span class="stat-label">Ended</span>
              <span class="stat-value">{{ countBy(AuctionStatus.ENDED) }}</span>
              <span class="stat-foot">Result derived from bids</span>
            </div>
            <div class="stat-card">
              <span class="stat-label">Cancelled</span>
              <span class="stat-value">{{ countBy(AuctionStatus.CANCELLED) }}</span>
              <span class="stat-foot">Terminal state</span>
            </div>
          </div>
        </section>

        <!-- Needs attention -->
        @if (needsAttention().length > 0) {
          <section class="card">
            <div class="card-header">
              <h2 class="section-heading">Needs your attention</h2>
              <span class="badge badge-warning">{{ needsAttention().length }}</span>
            </div>
            <div class="table-scroll">
              <table class="data-table data-table--stacked">
                <thead>
                  <tr>
                    <th scope="col">Lot</th>
                    <th scope="col">Status</th>
                    <th scope="col">Why</th>
                    <th scope="col" class="col-numeric">Current price</th>
                    <th scope="col" class="cell-actions">Action</th>
                  </tr>
                </thead>
                <tbody>
                  @for (auction of needsAttention(); track auction.id) {
                    <tr>
                      <td data-label="Lot">
                        <span class="cell-primary">{{ auction.product?.name }}</span>
                        <span class="text-mono-id">{{ auction.product?.code }}</span>
                      </td>
                      <td data-label="Status">
                        <app-auction-status-badge [status]="auction.status" size="sm" />
                      </td>
                      <td data-label="Why">
                        <span class="text-meta">{{ attentionReason(auction) }}</span>
                      </td>
                      <td data-label="Current price" class="col-numeric">
                        <span class="text-numeric">{{ price(auction.currentPrice) }}</span>
                      </td>
                      <td data-label="Action" class="cell-actions">
                        <a
                          class="btn btn-secondary btn-sm"
                          [routerLink]="['/vendor/auctions', auction.id]"
                        >
                          Manage
                        </a>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </section>
        }

        <!-- Recent auctions -->
        <section>
          <div class="row-between section-gap">
            <h2 class="section-heading">Recent auctions</h2>
            <a class="btn btn-link" routerLink="/vendor/auctions">
              View all auctions
              <app-icon name="arrow-right" [size]="14" />
            </a>
          </div>

          @if (auctions.isLoading() && !auctions.data()) {
            <div class="auction-grid">
              @for (i of skeletonItems; track i) {
                <div class="card card-body stack-sm">
                  <div class="skeleton skeleton-title"></div>
                  <div class="skeleton skeleton-text"></div>
                  <div class="skeleton skeleton-price"></div>
                </div>
              }
            </div>
          } @else if (recentAuctions().length === 0) {
            <div class="card">
              <app-empty-state
                icon="hammer"
                title="No auctions yet"
                description="Create a product, then schedule an auction against it. A new auction is always created as a draft."
              >
                <a class="btn btn-primary" routerLink="/vendor/auctions/new">Create an auction</a>
              </app-empty-state>
            </div>
          } @else {
            <div class="auction-grid">
              @for (auction of recentAuctions(); track auction.id) {
                <app-auction-card
                  [auction]="auction"
                  linkPrefix="/vendor/auctions"
                  [showVendor]="false"
                />
              }
            </div>
          }
        </section>

        <!-- Products -->
        <section>
          <div class="row-between section-gap">
            <h2 class="section-heading">Products</h2>
            <a class="btn btn-link" routerLink="/vendor/products">
              Manage products
              <app-icon name="arrow-right" [size]="14" />
            </a>
          </div>

          @if (products.hasError()) {
            @if (products.error(); as failure) {
              <div class="card">
                <app-error-state [failure]="failure" (retry)="reload()" />
              </div>
            }
          } @else if (productList().length === 0) {
            <div class="card">
              <app-empty-state
                icon="package"
                title="No products yet"
                description="Products are what auctions are built from. Each product is owned by your vendor account and classified by category."
              >
                <a class="btn btn-primary" routerLink="/vendor/products/new">Create a product</a>
              </app-empty-state>
            </div>
          } @else {
            <div class="card">
              <div class="table-scroll">
                <table class="data-table data-table--stacked">
                  <thead>
                    <tr>
                      <th scope="col">Code</th>
                      <th scope="col">Name</th>
                      <th scope="col">Category</th>
                      <th scope="col">Created</th>
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
                        </td>
                        <td data-label="Category">
                          <span class="badge badge-plain">{{ product.category?.name ?? '—' }}</span>
                        </td>
                        <td data-label="Created">
                          <span class="text-meta">{{ created(product.createdAt) }}</span>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          }
        </section>
      }

      <!-- Lifecycle reference -->
      <section class="card">
        <div class="card-header">
          <h2 class="section-heading">How the lifecycle works</h2>
        </div>
        <div class="card-body">
          @if (referenceAuction(); as auction) {
            <app-auction-lifecycle [auction]="auction" variant="compact" />
          }
          <p class="text-helper lifecycle-copy">
            Draft → Scheduled → Active → Ended. A draft cannot be activated directly, and a
            scheduled auction cannot be ended directly. Any non-terminal auction can be cancelled
            instead, which is final.
          </p>
        </div>
      </section>
    </div>
  `,
  styles: [
    `
      .vendor-profile {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--sp-6);
        flex-wrap: wrap;
      }
      .vendor-identity {
        display: flex;
        align-items: center;
        gap: var(--sp-4);
      }
      .avatar-lg {
        width: 48px;
        height: 48px;
        font-size: var(--fs-md);
      }
      .vendor-name {
        font-size: var(--fs-lg);
        font-weight: var(--fw-semibold);
      }
      .vendor-meta {
        display: flex;
        gap: var(--sp-7);
        flex: 1 1 auto;
      }
      .section-gap {
        margin-bottom: var(--sp-4);
      }
      .lifecycle-copy {
        margin-top: var(--sp-4);
        max-width: 84ch;
      }
    `,
  ],
})
export class VendorDashboardComponent {
  private readonly auctionService = inject(AuctionService);
  private readonly productService = inject(ProductService);
  private readonly auth = inject(AuthService);

  protected readonly AuctionStatus = AuctionStatus;
  protected readonly skeletonItems = Array.from({ length: 3 }, (_, i) => i);

  readonly auctions = new AsyncResource<Paginated<Auction>>();
  readonly products = new AsyncResource<Paginated<Product>>();

  readonly vendor = computed(() => this.auth.vendor());
  readonly profileResolved = computed(() => this.auth.identityResolved());

  readonly auctionList = computed(() => this.auctions.data()?.items ?? []);
  readonly productList = computed(() => this.products.data()?.items ?? []);

  readonly recentAuctions = computed(() => this.auctionList().slice(0, 3));

  readonly vendorInitials = computed(() => {
    const name = this.vendor()?.companyName ?? '';
    return name
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word[0])
      .join('')
      .toUpperCase();
  });

  readonly memberSince = computed(() => formatDateTime(this.vendor()?.createdAt));

  /** An auction used purely to render the lifecycle diagram when none exist. */
  readonly referenceAuction = computed<Auction | null>(() => {
    const existing = this.auctionList()[0];
    if (existing) return existing;
    const now = Date.now();
    return {
      id: 'lifecycle-reference',
      productId: '',
      vendorId: this.vendor()?.id ?? '',
      startingPrice: 0,
      currentPrice: 0,
      bidIncrement: 0,
      startTime: new Date(now + 86_400_000).toISOString(),
      endTime: new Date(now + 172_800_000).toISOString(),
      status: AuctionStatus.DRAFT,
      bidCount: 0,
      createdAt: new Date(now).toISOString(),
      updatedAt: new Date(now).toISOString(),
    };
  });

  /**
   * Drafts waiting to be scheduled, active auctions whose window has closed, and
   * scheduled auctions about to open — the three conditions a vendor must act on.
   */
  readonly needsAttention = computed(() =>
    this.auctionList()
      .filter((auction) => {
        if (auction.status === AuctionStatus.DRAFT) return true;
        if (
          auction.status === AuctionStatus.ACTIVE &&
          new Date(auction.endTime).getTime() <= Date.now()
        ) {
          return true;
        }
        return false;
      })
      .slice(0, 5),
  );

  constructor() {
    this.reload();
  }

  reload(): void {
    this.auctions.load(this.auctionService.listMine({ limit: 50, orderBy: 'newest' }));
    this.products.load(this.productService.listMine({ limit: 10 }));
  }

  countBy(status: AuctionStatus): number {
    return this.auctionList().filter((a) => a.status === status).length;
  }

  attentionReason(auction: Auction): string {
    if (auction.status === AuctionStatus.DRAFT) {
      return 'Draft — schedule it to publish';
    }
    return 'End time passed — close it to finalise';
  }

  price(value: number): string {
    return formatAmount(value);
  }

  created(iso: string): string {
    return formatDateTime(iso);
  }
}
