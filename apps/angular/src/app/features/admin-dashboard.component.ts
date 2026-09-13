import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuctionStatus, UserRole } from '../core/domain/enums';
import { formatDateTime } from '../core/domain/format';
import { Auction, Bidder, Category, Paginated, User, Vendor } from '../core/domain/models';
import { AsyncResource } from '../core/state/async-resource';
import { AuctionService } from '../core/services/auction.service';
import { CategoryService } from '../core/services/catalogue.service';
import { BidderService, UserService, VendorService } from '../core/services/directory.service';
import { MatIconComponent } from '../shared/ui/mat-icon.component';
import { EmptyStateComponent, ErrorStateComponent } from '../shared/ui/state-block.component';

/**
 * Administrator Dashboard.
 *
 * Operational executive summary aligned 100% with real NestJS backend contracts.
 * Displays authoritative record counts, auction lifecycle states, overdue active auctions,
 * and latest user identities without fictitious fields.
 */
@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [
    RouterLink,
    MatIconComponent,
    EmptyStateComponent,
    ErrorStateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="admin-page">
      <!-- Top Page Header -->
      <header class="admin-header">
        <div class="admin-header-main">
          <div class="admin-badge-strip">
            <span class="admin-console-pill">
              <mat-icon fontIcon="shield" [size]="14" />
              B2B Administration
            </span>
            <span class="admin-time-pill">
              <mat-icon fontIcon="schedule" [size]="14" />
              Live System Status
            </span>
          </div>
          <h1 class="admin-title">Platform Operations Overview</h1>
          <p class="admin-subtitle">
            Centralized monitoring for authentication identities, vendor and bidder directory records, product categories, and auction lifecycles.
          </p>
        </div>
        <div class="admin-actions">
          <button
            type="button"
            class="btn-admin-secondary"
            (click)="reload()"
            [disabled]="isLoading()"
          >
            <mat-icon fontIcon="refresh" [size]="16" [class.spin]="isLoading()" />
            <span>Refresh Overview</span>
          </button>
        </div>
      </header>

      <!-- Section: Directory & Identities -->
      <section class="admin-section">
        <div class="section-title-bar">
          <h2 class="section-title">
            <mat-icon fontIcon="badge" [size]="18" />
            <span>Identities & Directory Records</span>
          </h2>
          <span class="section-hint">Total registered accounts and profile records</span>
        </div>

        <div class="admin-stat-grid">
          <a class="admin-stat-card" routerLink="/admin/users">
            <div class="stat-card-top">
              <span class="stat-card-label">User Accounts</span>
              <span class="stat-card-icon user-icon">
                <mat-icon fontIcon="people" [size]="20" />
              </span>
            </div>
            <div class="stat-card-metric">{{ userCount() }}</div>
            <div class="stat-card-meta">
              <span class="meta-tag admin-tag">{{ adminCount() }} Admin</span>
              <span class="meta-dot">·</span>
              <span class="meta-tag vendor-tag">{{ vendorUserCount() }} Vendor</span>
              <span class="meta-dot">·</span>
              <span class="meta-tag bidder-tag">{{ bidderUserCount() }} Bidder</span>
            </div>
            <div class="stat-card-link-foot">
              <span>Manage User Directory</span>
              <mat-icon fontIcon="arrow_forward" [size]="14" />
            </div>
          </a>

          <a class="admin-stat-card" routerLink="/admin/vendors">
            <div class="stat-card-top">
              <span class="stat-card-label">Vendor Profiles</span>
              <span class="stat-card-icon vendor-icon">
                <mat-icon fontIcon="storefront" [size]="20" />
              </span>
            </div>
            <div class="stat-card-metric">{{ vendorCount() }}</div>
            <div class="stat-card-meta">
              <span class="meta-desc">Authorized product providers</span>
            </div>
            <div class="stat-card-link-foot">
              <span>View Vendor Directory</span>
              <mat-icon fontIcon="arrow_forward" [size]="14" />
            </div>
          </a>

          <a class="admin-stat-card" routerLink="/admin/bidders">
            <div class="stat-card-top">
              <span class="stat-card-label">Bidder Profiles</span>
              <span class="stat-card-icon bidder-icon">
                <mat-icon fontIcon="assignment_ind" [size]="20" />
              </span>
            </div>
            <div class="stat-card-metric">{{ bidderCount() }}</div>
            <div class="stat-card-meta">
              <span class="meta-desc">Verified auction participants</span>
            </div>
            <div class="stat-card-link-foot">
              <span>View Bidder Directory</span>
              <mat-icon fontIcon="arrow_forward" [size]="14" />
            </div>
          </a>

          <a class="admin-stat-card" routerLink="/admin/categories">
            <div class="stat-card-top">
              <span class="stat-card-label">Product Categories</span>
              <span class="stat-card-icon category-icon">
                <mat-icon fontIcon="category" [size]="20" />
              </span>
            </div>
            <div class="stat-card-metric">{{ categoryCount() }}</div>
            <div class="stat-card-meta">
              <span class="meta-desc">Lot classifications catalog</span>
            </div>
            <div class="stat-card-link-foot">
              <span>Manage Taxonomy</span>
              <mat-icon fontIcon="arrow_forward" [size]="14" />
            </div>
          </a>
        </div>
      </section>

      <!-- Section: Auction States Breakdown -->
      <section class="admin-section">
        <div class="section-title-bar">
          <h2 class="section-title">
            <mat-icon fontIcon="gavel" [size]="18" />
            <span>Auction Lifecycle Stages</span>
          </h2>
          <span class="section-hint">Distribution across operational states</span>
        </div>

        <div class="auction-status-grid">
          <div class="auction-status-box status-draft">
            <div class="status-box-header">
              <span class="status-indicator-dot dot-draft"></span>
              <span class="status-box-label">Draft</span>
            </div>
            <div class="status-box-metric">{{ auctionCount(AuctionStatus.DRAFT) }}</div>
            <span class="status-box-sub">Created, unscheduled</span>
          </div>

          <div class="auction-status-box status-scheduled">
            <div class="status-box-header">
              <span class="status-indicator-dot dot-scheduled"></span>
              <span class="status-box-label">Scheduled</span>
            </div>
            <div class="status-box-metric">{{ auctionCount(AuctionStatus.SCHEDULED) }}</div>
            <span class="status-box-sub">Awaiting start time</span>
          </div>

          <div class="auction-status-box status-active">
            <div class="status-box-header">
              <span class="status-indicator-dot dot-active"></span>
              <span class="status-box-label">Active</span>
            </div>
            <div class="status-box-metric">{{ auctionCount(AuctionStatus.ACTIVE) }}</div>
            <span class="status-box-sub">Open for live bidding</span>
          </div>

          <div class="auction-status-box status-ended">
            <div class="status-box-header">
              <span class="status-indicator-dot dot-ended"></span>
              <span class="status-box-label">Ended</span>
            </div>
            <div class="status-box-metric">{{ auctionCount(AuctionStatus.ENDED) }}</div>
            <span class="status-box-sub">Derived settlement</span>
          </div>

          <div class="auction-status-box status-cancelled">
            <div class="status-box-header">
              <span class="status-indicator-dot dot-cancelled"></span>
              <span class="status-box-label">Cancelled</span>
            </div>
            <div class="status-box-metric">{{ auctionCount(AuctionStatus.CANCELLED) }}</div>
            <span class="status-box-sub">Terminal cancellation</span>
          </div>
        </div>
      </section>

      <!-- Section: Attention / Overdue Active Auctions -->
      @if (staleActive().length > 0) {
        <section class="admin-card attention-card">
          <div class="admin-card-header">
            <div class="attention-head-left">
              <span class="attention-badge-icon">
                <mat-icon fontIcon="warning_amber" [size]="18" />
              </span>
              <div>
                <h2 class="attention-card-title">Auctions Requiring Closure Attention</h2>
                <p class="attention-card-desc">
                  These active auctions have passed their published end time. While the server blocks bids after the end time, an administrator or vendor should inspect and settle the state.
                </p>
              </div>
            </div>
            <span class="attention-count-badge">{{ staleActive().length }} Overdue</span>
          </div>

          <div class="admin-table-container">
            <table class="admin-data-table">
              <thead>
                <tr>
                  <th scope="col">Lot Code & Product</th>
                  <th scope="col">Vendor Company</th>
                  <th scope="col">Published End Time</th>
                  <th scope="col" class="cell-action-col">Action</th>
                </tr>
              </thead>
              <tbody>
                @for (auction of staleActive(); track auction.id) {
                  <tr>
                    <td>
                      <div class="cell-main-title">{{ auction.product?.name ?? 'Auction Lot' }}</div>
                      <div class="cell-sub-mono">{{ auction.product?.code ?? auction.id }}</div>
                    </td>
                    <td>
                      <span class="cell-text-secondary">{{ auction.product?.vendor?.companyName ?? auction.vendor?.companyName ?? '—' }}</span>
                    </td>
                    <td>
                      <span class="cell-time-expired">
                        <mat-icon fontIcon="access_time" [size]="14" />
                        {{ dateTime(auction.endTime || auction.endAt) }}
                      </span>
                    </td>
                    <td class="cell-action-col">
                      <a
                        class="btn-admin-table-action"
                        [routerLink]="['/marketplace', auction.id]"
                        target="_blank"
                      >
                        <span>Inspect Lot</span>
                        <mat-icon fontIcon="open_in_new" [size]="14" />
                      </a>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>
      }

      <!-- Section: Two Column Content (Recent Users & Categories) -->
      <div class="admin-grid-columns">
        <!-- Recent Users Card -->
        <section class="admin-card">
          <div class="admin-card-header">
            <div class="card-header-left">
              <mat-icon fontIcon="history" [size]="18" />
              <h2 class="admin-card-title">Recent User Registrations</h2>
            </div>
            <a class="admin-card-link" routerLink="/admin/users">
              <span>View All Directory</span>
              <mat-icon fontIcon="chevron_right" [size]="16" />
            </a>
          </div>

          @if (users.hasError()) {
            @if (users.error(); as failure) {
              <div class="card-inner-padding">
                <app-error-state [failure]="failure" (retry)="reload()" />
              </div>
            }
          } @else if (recentUsers().length === 0) {
            <div class="card-inner-padding">
              <app-empty-state
                icon="users"
                title="No users found"
                description="Registered user accounts will appear here."
              />
            </div>
          } @else {
            <div class="admin-table-container">
              <table class="admin-data-table">
                <thead>
                  <tr>
                    <th scope="col">Account Name</th>
                    <th scope="col">Email Address</th>
                    <th scope="col">Role</th>
                    <th scope="col">Registration Date</th>
                  </tr>
                </thead>
                <tbody>
                  @for (user of recentUsers(); track user.id) {
                    <tr>
                      <td class="cell-bold-navy">
                        {{ userName(user) }}
                      </td>
                      <td class="cell-text-secondary">
                        {{ user.email }}
                      </td>
                      <td>
                        <span class="role-pill" [class]="'role-pill-' + user.role.toLowerCase()">
                          {{ roleLabel(user.role) }}
                        </span>
                      </td>
                      <td class="cell-text-muted">
                        {{ dateTime(user.createdAt) }}
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </section>

        <!-- Categories List Card -->
        <section class="admin-card">
          <div class="admin-card-header">
            <div class="card-header-left">
              <mat-icon fontIcon="folder_open" [size]="18" />
              <h2 class="admin-card-title">Product Classification</h2>
            </div>
            <a class="admin-card-link" routerLink="/admin/categories">
              <span>Manage Categories</span>
              <mat-icon fontIcon="chevron_right" [size]="16" />
            </a>
          </div>

          @if (categories.hasError()) {
            @if (categories.error(); as failure) {
              <div class="card-inner-padding">
                <app-error-state [failure]="failure" (retry)="reload()" />
              </div>
            }
          } @else if (categoryList().length === 0) {
            <div class="card-inner-padding">
              <app-empty-state
                icon="layers"
                title="No categories configured"
                description="Add catalog categories to allow vendors to classify product lots."
              />
            </div>
          } @else {
            <ul class="admin-category-list">
              @for (category of categoryList().slice(0, 6); track category.id) {
                <li class="admin-category-item">
                  <div class="category-item-info">
                    <span class="category-icon-box">
                      <mat-icon fontIcon="label" [size]="16" />
                    </span>
                    <span class="category-item-name">{{ category.name }}</span>
                  </div>
                  <span class="category-item-date">
                    Added {{ dateTime(category.createdAt) }}
                  </span>
                </li>
              }
            </ul>
          }
        </section>
      </div>

      <!-- Informational Footer Note -->
      <div class="admin-info-banner">
        <span class="info-banner-icon">
          <mat-icon fontIcon="info" [size]="20" />
        </span>
        <div class="info-banner-content">
          <h3 class="info-banner-title">Administrative Authority & Scope</h3>
          <p class="info-banner-text">
            Administrators hold platform-wide authority over user identities, directory attachments (Vendor & Bidder records), and global product taxonomies. Auction lifecycle events remain owned by the publishing vendor, while administrators maintain continuous oversight and inspection access.
          </p>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      /* =========================================================================
         ADMIN CONSOLE: 60% Warm Neutral (#F5F3EF), 30% Deep Navy (#172033), 10% Gold (#C6A15B)
         ========================================================================= */
      .admin-page {
        display: flex;
        flex-direction: column;
        gap: 28px;
        padding: 24px 28px 48px;
        max-width: 1400px;
        margin: 0 auto;
        color: #172033;
      }

      /* Header */
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
        margin-bottom: 10px;
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

      .admin-time-pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px;
        font-size: 0.75rem;
        font-weight: 500;
        background: #ffffff;
        border: 1px solid #ddd9d0;
        color: #667085;
        border-radius: 4px;
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

      /* Sections */
      .admin-section {
        display: flex;
        flex-direction: column;
        gap: 14px;
      }

      .section-title-bar {
        display: flex;
        align-items: baseline;
        gap: 12px;
      }

      .section-title {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-size: 1rem;
        font-weight: 700;
        color: #172033;
        letter-spacing: -0.01em;
        margin: 0;

        mat-icon {
          color: #c6a15b;
        }
      }

      .section-hint {
        font-size: 0.8125rem;
        color: #98a2b3;
      }

      /* Stat Cards (Directory) */
      .admin-stat-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
        gap: 16px;
      }

      .admin-stat-card {
        display: flex;
        flex-direction: column;
        padding: 18px 20px;
        background: #ffffff;
        border: 1px solid #ddd9d0;
        border-radius: 8px;
        text-decoration: none;
        color: inherit;
        transition: all 0.2s ease;

        &:hover {
          border-color: #c6a15b;
          box-shadow: 0 6px 18px rgba(23, 32, 51, 0.06);
          transform: translateY(-2px);

          .stat-card-link-foot {
            color: #172033;

            mat-icon {
              transform: translateX(3px);
            }
          }
        }
      }

      .stat-card-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 10px;
      }

      .stat-card-label {
        font-size: 0.8125rem;
        font-weight: 600;
        color: #667085;
      }

      .stat-card-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        border-radius: 6px;
        background: #fcfbf8;
        border: 1px solid #ddd9d0;

        &.user-icon mat-icon {
          color: #172033;
        }
        &.vendor-icon mat-icon {
          color: #2f6b57;
        }
        &.bidder-icon mat-icon {
          color: #3f668c;
        }
        &.category-icon mat-icon {
          color: #b7791f;
        }
      }

      .stat-card-metric {
        font-size: 2rem;
        font-weight: 700;
        color: #172033;
        line-height: 1.1;
        margin-bottom: 10px;
        font-feature-settings: 'tnum';
      }

      .stat-card-meta {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 6px;
        font-size: 0.75rem;
        color: #667085;
        margin-bottom: 14px;
        min-height: 20px;
      }

      .meta-tag {
        font-weight: 600;
      }

      .meta-dot {
        color: #ddd9d0;
      }

      .meta-desc {
        color: #98a2b3;
      }

      .stat-card-link-foot {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding-top: 12px;
        border-top: 1px solid #f5f3ef;
        font-size: 0.75rem;
        font-weight: 600;
        color: #c6a15b;
        transition: color 0.15s ease;

        mat-icon {
          transition: transform 0.15s ease;
        }
      }

      /* Auction Status Boxes */
      .auction-status-grid {
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        gap: 12px;

        @media (max-width: 960px) {
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
        }
      }

      .auction-status-box {
        display: flex;
        flex-direction: column;
        padding: 16px 18px;
        background: #ffffff;
        border: 1px solid #ddd9d0;
        border-radius: 8px;
      }

      .status-box-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
      }

      .status-indicator-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;

        &.dot-draft {
          background: #98a2b3;
        }
        &.dot-scheduled {
          background: #3f668c;
        }
        &.dot-active {
          background: #2f6b57;
          box-shadow: 0 0 0 3px rgba(47, 107, 87, 0.15);
        }
        &.dot-ended {
          background: #172033;
        }
        &.dot-cancelled {
          background: #b94a48;
        }
      }

      .status-box-label {
        font-size: 0.75rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: #667085;
      }

      .status-box-metric {
        font-size: 1.5rem;
        font-weight: 700;
        color: #172033;
        line-height: 1.2;
        margin-bottom: 4px;
        font-feature-settings: 'tnum';
      }

      .status-box-sub {
        font-size: 0.6875rem;
        color: #98a2b3;
      }

      /* Card generic */
      .admin-card {
        background: #ffffff;
        border: 1px solid #ddd9d0;
        border-radius: 8px;
        overflow: hidden;
      }

      .admin-card-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding: 16px 20px;
        border-bottom: 1px solid #ddd9d0;
        background: #fcfbf8;
      }

      .card-header-left {
        display: inline-flex;
        align-items: center;
        gap: 8px;

        mat-icon {
          color: #c6a15b;
        }
      }

      .admin-card-title {
        font-size: 0.9375rem;
        font-weight: 700;
        color: #172033;
        margin: 0;
      }

      .admin-card-link {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 0.8125rem;
        font-weight: 600;
        color: #172033;
        text-decoration: none;

        mat-icon {
          color: #c6a15b;
        }

        &:hover {
          color: #c6a15b;
        }
      }

      .card-inner-padding {
        padding: 24px;
      }

      /* Attention Card */
      .attention-card {
        border-color: #edd3a8;
        background: #ffffff;

        .admin-card-header {
          background: #fbf4e9;
          border-bottom-color: #edd3a8;
        }
      }

      .attention-head-left {
        display: flex;
        align-items: flex-start;
        gap: 12px;
      }

      .attention-badge-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        background: #edd3a8;
        color: #b7791f;
        border-radius: 6px;
        flex-shrink: 0;
      }

      .attention-card-title {
        font-size: 0.9375rem;
        font-weight: 700;
        color: #b7791f;
        margin: 0 0 4px 0;
      }

      .attention-card-desc {
        font-size: 0.8125rem;
        color: #667085;
        margin: 0;
        line-height: 1.4;
      }

      .attention-count-badge {
        display: inline-flex;
        padding: 4px 10px;
        font-size: 0.75rem;
        font-weight: 700;
        background: #b7791f;
        color: #ffffff;
        border-radius: 4px;
        white-space: nowrap;
      }

      .cell-time-expired {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        color: #b7791f;
        font-weight: 600;
        font-size: 0.8125rem;
      }

      /* Tables */
      .admin-table-container {
        overflow-x: auto;
      }

      .admin-data-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.8125rem;

        th {
          padding: 10px 18px;
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

      .cell-main-title {
        font-weight: 600;
        color: #172033;
      }

      .cell-sub-mono {
        font-family: var(--font-mono, monospace);
        font-size: 0.6875rem;
        color: #98a2b3;
      }

      .cell-bold-navy {
        font-weight: 600;
        color: #172033;
      }

      .cell-text-secondary {
        color: #667085;
      }

      .cell-text-muted {
        color: #98a2b3;
      }

      .cell-action-col {
        text-align: right;
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
        text-decoration: none;
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

      /* Role badges */
      .role-pill {
        display: inline-flex;
        padding: 2px 8px;
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

      /* 2-Column Grid */
      .admin-grid-columns {
        display: grid;
        grid-template-columns: 1.2fr 1fr;
        gap: 20px;
        align-items: start;

        @media (max-width: 900px) {
          grid-template-columns: 1fr;
        }
      }

      /* Category list */
      .admin-category-list {
        list-style: none;
        padding: 0;
        margin: 0;
        display: flex;
        flex-direction: column;
      }

      .admin-category-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding: 12px 20px;
        border-bottom: 1px solid #f5f3ef;

        &:last-child {
          border-bottom: none;
        }

        &:hover {
          background: #faf8f5;
        }
      }

      .category-item-info {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .category-icon-box {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        background: #fcfbf8;
        border: 1px solid #ddd9d0;
        border-radius: 4px;
        color: #c6a15b;
      }

      .category-item-name {
        font-weight: 600;
        font-size: 0.8125rem;
        color: #172033;
      }

      .category-item-date {
        font-size: 0.75rem;
        color: #98a2b3;
      }

      /* Info Banner */
      .admin-info-banner {
        display: flex;
        align-items: flex-start;
        gap: 16px;
        padding: 18px 20px;
        background: #ffffff;
        border: 1px solid #ddd9d0;
        border-left: 4px solid #172033;
        border-radius: 6px;
      }

      .info-banner-icon {
        color: #c6a15b;
        margin-top: 2px;
      }

      .info-banner-title {
        font-size: 0.875rem;
        font-weight: 700;
        color: #172033;
        margin: 0 0 4px 0;
      }

      .info-banner-text {
        font-size: 0.8125rem;
        color: #667085;
        margin: 0;
        line-height: 1.5;
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

  /** ACTIVE auctions whose published end time has passed */
  readonly staleActive = computed(() =>
    this.auctionList().filter((a) => {
      const t = a.endTime || a.endAt;
      return a.status === AuctionStatus.ACTIVE && !!t && new Date(t).getTime() <= Date.now();
    }),
  );

  readonly isLoading = computed(
    () =>
      this.users.isLoading() ||
      this.vendors.isLoading() ||
      this.bidders.isLoading() ||
      this.categories.isLoading() ||
      this.auctions.isLoading(),
  );

  constructor() {
    this.reload();
  }

  reload(): void {
    this.users.load(this.userService.list({ limit: 100, page: 1 }));
    this.vendors.load(this.vendorService.list({ limit: 100, page: 1 }));
    this.bidders.load(this.bidderService.list({ limit: 100, page: 1 }));
    this.categories.load(this.categoryService.list({ limit: 100, page: 1 }));
    this.auctions.load(this.auctionService.list({ limit: 100, status: 'ALL' }));
  }

  auctionCount(status: AuctionStatus): number {
    return this.auctionList().filter((a) => a.status === status).length;
  }

  userName(user: User): string {
    return user.name?.trim() || `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email;
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
