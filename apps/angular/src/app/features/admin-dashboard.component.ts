import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AccountStatus, AuctionStatus, UserRole } from '../core/domain/enums';
import { formatDateTime } from '../core/domain/format';
import { Auction, Bidder, Category, Paginated, User, Vendor } from '../core/domain/models';
import { AsyncResource } from '../core/state/async-resource';
import { AuctionService } from '../core/services/auction.service';
import { CategoryService } from '../core/services/catalogue.service';
import { BidderService, UserService, VendorService } from '../core/services/directory.service';
import { AccountStatusBadgeComponent } from '../shared/ui/badge.component';
import { IconComponent } from '../shared/ui/icon.component';
import { EmptyStateComponent, ErrorStateComponent } from '../shared/ui/state-block.component';
import { AlertComponent } from '../shared/ui/toast.component';

/**
 * Administrator dashboard.
 *
 * An operational overview built only from data the API actually exposes: counts
 * of users by role, vendor and bidder profiles, categories, and the auctions
 * currently needing administrative attention.
 *
 * There is deliberately no revenue chart, no growth metric and no fake activity
 * feed — the backend does not provide those numbers, and inventing them would
 * make the dashboard untrustworthy.
 */
@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [
    RouterLink,
    AccountStatusBadgeComponent,
    IconComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    AlertComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <header class="page-head">
        <div class="page-head-text">
          <h1 class="page-title">Admin dashboard</h1>
          <p class="page-subtitle">
            Platform operations: identities, vendor and bidder records, categories and the auctions
            that need attention.
          </p>
        </div>
        <div class="page-actions">
          <button type="button" class="btn btn-secondary" (click)="reload()">
            <app-icon name="refresh" [size]="15" />
            Refresh
          </button>
        </div>
      </header>

      <!-- Identity counts -->
      <section>
        <h2 class="section-heading section-gap">Identities and records</h2>
        <div class="stat-grid">
          <a class="stat-card stat-card-link" routerLink="/admin/users">
            <span class="stat-label">Users</span>
            <span class="stat-value">{{ userCount() }}</span>
            <span class="stat-foot">
              {{ adminCount() }} admin · {{ vendorUserCount() }} vendor ·
              {{ bidderUserCount() }} bidder
            </span>
          </a>

          <a class="stat-card stat-card-link" routerLink="/admin/vendors">
            <span class="stat-label">Vendor profiles</span>
            <span class="stat-value">{{ vendorCount() }}</span>
            <span class="stat-foot">{{ suspendedVendors() }} suspended</span>
          </a>

          <a class="stat-card stat-card-link" routerLink="/admin/bidders">
            <span class="stat-label">Bidder profiles</span>
            <span class="stat-value">{{ bidderCount() }}</span>
            <span class="stat-foot">{{ inactiveBidders() }} not active</span>
          </a>

          <a class="stat-card stat-card-link" routerLink="/admin/categories">
            <span class="stat-label">Categories</span>
            <span class="stat-value">{{ categoryCount() }}</span>
            <span class="stat-foot">Shared classification for products</span>
          </a>
        </div>
      </section>

      <!-- Auction states -->
      <section>
        <h2 class="section-heading section-gap">Auction states</h2>
        <div class="stat-grid">
          <div class="stat-card">
            <span class="stat-label">Draft</span>
            <span class="stat-value">{{ auctionCount(AuctionStatus.DRAFT) }}</span>
            <span class="stat-foot">Not yet scheduled</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Scheduled</span>
            <span class="stat-value">{{ auctionCount(AuctionStatus.SCHEDULED) }}</span>
            <span class="stat-foot">Awaiting start time</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Active</span>
            <span class="stat-value">{{ auctionCount(AuctionStatus.ACTIVE) }}</span>
            <span class="stat-foot">Open or awaiting close</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Ended</span>
            <span class="stat-value">{{ auctionCount(AuctionStatus.ENDED) }}</span>
            <span class="stat-foot">Result derived from bids</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Cancelled</span>
            <span class="stat-value">{{ auctionCount(AuctionStatus.CANCELLED) }}</span>
            <span class="stat-foot">Terminal</span>
          </div>
        </div>
      </section>

      <!-- Attention -->
      @if (staleActive().length > 0) {
        <section class="card">
          <div class="card-header">
            <h2 class="section-heading">Active auctions past their end time</h2>
            <span class="badge badge-warning">{{ staleActive().length }}</span>
          </div>
          <p class="card-body text-helper stale-note">
            The published end time is authoritative for bidding, so these auctions are already
            closed to bids. They remain recorded as active until closed.
          </p>
          <div class="table-scroll">
            <table class="data-table data-table--stacked">
              <thead>
                <tr>
                  <th scope="col">Lot</th>
                  <th scope="col">Vendor</th>
                  <th scope="col">End time</th>
                  <th scope="col" class="cell-actions">Action</th>
                </tr>
              </thead>
              <tbody>
                @for (auction of staleActive(); track auction.id) {
                  <tr>
                    <td data-label="Lot">
                      <span class="cell-primary">{{ auction.product?.name }}</span>
                      <span class="text-mono-id">{{ auction.product?.code }}</span>
                    </td>
                    <td data-label="Vendor">
                      <span class="text-meta">{{ auction.vendor?.companyName }}</span>
                    </td>
                    <td data-label="End time">
                      <span class="text-meta">{{ dateTime(auction.endTime) }}</span>
                    </td>
                    <td data-label="Action" class="cell-actions">
                      <a
                        class="btn btn-secondary btn-sm"
                        [routerLink]="['/marketplace', auction.id]"
                      >
                        Inspect
                      </a>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>
      }

      <!-- Recent identities -->
      <div class="admin-columns">
        <section class="card">
          <div class="card-header">
            <h2 class="section-heading">Recent users</h2>
            <a class="btn btn-link" routerLink="/admin/users">View all</a>
          </div>
          @if (users.hasError()) {
            @if (users.error(); as failure) {
              <app-error-state [failure]="failure" (retry)="reload()" />
            }
          } @else if (recentUsers().length === 0) {
            <app-empty-state
              icon="users"
              title="No users found"
              description="User accounts will appear here."
            />
          } @else {
            <div class="table-scroll">
              <table class="data-table">
                <thead>
                  <tr>
                    <th scope="col">Name</th>
                    <th scope="col">Email</th>
                    <th scope="col">Role</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  @for (user of recentUsers(); track user.id) {
                    <tr>
                      <td class="cell-primary">{{ name(user) }}</td>
                      <td>
                        <span class="text-meta">{{ user.email }}</span>
                      </td>
                      <td>
                        <span class="badge badge-plain">{{ roleLabel(user.role) }}</span>
                      </td>
                      <td><app-account-status-badge [status]="user.status" /></td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </section>

        <section class="card">
          <div class="card-header">
            <h2 class="section-heading">Categories</h2>
            <a class="btn btn-link" routerLink="/admin/categories">Manage</a>
          </div>
          @if (categories.hasError()) {
            @if (categories.error(); as failure) {
              <app-error-state [failure]="failure" (retry)="reload()" />
            }
          } @else if (categoryList().length === 0) {
            <app-empty-state
              icon="layers"
              title="No categories"
              description="Create a category before vendors can classify products."
            />
          } @else {
            <ul class="category-plain-list">
              @for (category of categoryList(); track category.id) {
                <li class="category-plain-item">
                  <span class="cell-primary">{{ category.name }}</span>
                  <span class="badge badge-plain"> {{ category.productCount ?? 0 }} products </span>
                </li>
              }
            </ul>
          }
        </section>
      </div>

      <app-alert tone="info" title="What administrators control">
        Administrators manage users and the vendor, bidder and category records that support them.
        Auction lifecycle changes are normally made by the owning vendor; an administrator can
        inspect any auction and intervene where required.
      </app-alert>
    </div>
  `,
  styles: [
    `
      .section-gap {
        margin-bottom: var(--sp-4);
      }
      .stat-card-link {
        transition:
          border-color var(--dur-fast) var(--ease),
          box-shadow var(--dur-fast) var(--ease);
      }
      .stat-card-link:hover {
        border-color: var(--c-brand-border);
        box-shadow: var(--sh-md);
      }
      .stale-note {
        padding-top: 0;
        margin-top: calc(var(--sp-2) * -1);
      }
      .admin-columns {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
        gap: var(--sp-5);
        align-items: start;
      }
      @media (max-width: 900px) {
        .admin-columns {
          grid-template-columns: 1fr;
        }
      }
      .category-plain-list {
        display: flex;
        flex-direction: column;
      }
      .category-plain-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--sp-3);
        padding: var(--sp-3) var(--sp-5);
        border-bottom: 1px solid var(--c-border);
      }
      .category-plain-item:last-child {
        border-bottom: none;
      }
    `,
  ],
})
export class AdminDashboardComponent {
  private readonly userService = inject(UserService);
  private readonly vendorService = inject(VendorService);
  private readonly bidderService = inject(BidderService);
  private readonly categoryService = inject(CategoryService);
  private readonly auctionService = inject(AuctionService);

  protected readonly AuctionStatus = AuctionStatus;
  protected readonly UserRole = UserRole;

  readonly users = new AsyncResource<Paginated<User>>();
  readonly vendors = new AsyncResource<Paginated<Vendor>>();
  readonly bidders = new AsyncResource<Paginated<Bidder>>();
  readonly categories = new AsyncResource<Paginated<Category>>();
  readonly auctions = new AsyncResource<Paginated<Auction>>();

  readonly userList = computed(() => this.users.data()?.items ?? []);
  readonly vendorList = computed(() => this.vendors.data()?.items ?? []);
  readonly bidderList = computed(() => this.bidders.data()?.items ?? []);
  readonly categoryList = computed(() => this.categories.data()?.items ?? []);
  readonly auctionList = computed(() => this.auctions.data()?.items ?? []);

  readonly recentUsers = computed(() => this.userList().slice(0, 5));

  readonly userCount = computed(() => this.users.data()?.meta.total ?? 0);
  readonly vendorCount = computed(() => this.vendors.data()?.meta.total ?? 0);
  readonly bidderCount = computed(() => this.bidders.data()?.meta.total ?? 0);
  readonly categoryCount = computed(() => this.categories.data()?.meta.total ?? 0);

  readonly adminCount = computed(
    () => this.userList().filter((u) => u.role === UserRole.ADMIN).length,
  );
  readonly vendorUserCount = computed(
    () => this.userList().filter((u) => u.role === UserRole.VENDOR).length,
  );
  readonly bidderUserCount = computed(
    () => this.userList().filter((u) => u.role === UserRole.BIDDER).length,
  );

  readonly suspendedVendors = computed(
    () => this.vendorList().filter((v) => v.status === AccountStatus.SUSPENDED).length,
  );
  readonly inactiveBidders = computed(
    () => this.bidderList().filter((b) => b.status !== AccountStatus.ACTIVE).length,
  );

  /** ACTIVE auctions whose published end time has already passed. */
  readonly staleActive = computed(() =>
    this.auctionList().filter(
      (a) => a.status === AuctionStatus.ACTIVE && new Date(a.endTime).getTime() <= Date.now(),
    ),
  );

  constructor() {
    this.reload();
  }

  reload(): void {
    this.users.load(this.userService.list({ limit: 100, sort: 'newest' }));
    this.vendors.load(this.vendorService.list({ limit: 100 }));
    this.bidders.load(this.bidderService.list({ limit: 100 }));
    this.categories.load(this.categoryService.list({ limit: 100 }));
    this.auctions.load(this.auctionService.list({ limit: 100, status: 'ALL' }));
  }

  auctionCount(status: AuctionStatus): number {
    return this.auctionList().filter((a) => a.status === status).length;
  }

  name(user: User): string {
    const value = `${user.firstName} ${user.lastName}`.trim();
    return value && value !== '—' ? value : user.email;
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
