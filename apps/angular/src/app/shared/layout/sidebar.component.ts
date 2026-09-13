import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs';
import { UserRole } from '../../core/domain/enums';
import { AuthService } from '../../core/services/session.service';
import { IconComponent } from '../ui/icon.component';
import { MatIconComponent } from '../ui/mat-icon.component';
import { ROLE_SCOPE_SUMMARY, navigationFor } from './navigation';

/**
 * Primary navigation sidebar.
 *
 * Contents are derived from the signed-in role, so a bidder never sees a vendor
 * workspace link and a vendor never sees administration. The scope chip under
 * the brand restates what the current role can do, which makes an authorization
 * boundary visible rather than something the user discovers by being refused.
 *
 * Below 1024px it slides in as an overlay drawer and closes on navigation.
 */
@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, IconComponent, MatIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <aside
      class="shell-sidebar"
      [class.is-open]="open()"
      [class.vendor-sidebar]="isVendor()"
      [class.admin-sidebar]="isAdmin()"
      aria-label="Primary navigation"
    >
      <div class="sidebar-brand">
        <span class="sidebar-brand-mark">
          @if (isAdmin()) {
            <mat-icon fontIcon="security" [size]="16" />
          } @else {
            <app-icon name="gavel" [size]="16" />
          }
        </span>
        <span class="sidebar-brand-text">
          <span class="sidebar-brand-name">BidForge</span>
          <span class="sidebar-brand-tag">
            @if (isAdmin()) {
              Admin Console
            } @else {
              B2B Auctions
            }
          </span>
        </span>
      </div>

      <div class="sidebar-scroll">
        <div class="sidebar-scope">
          @if (isAdmin()) {
            <mat-icon fontIcon="verified_user" [size]="14" />
          } @else {
            <app-icon name="shield" [size]="13" />
          }
          <span class="sidebar-scope-text">{{ scopeSummary() }}</span>
        </div>

        @for (group of groups(); track group.label) {
          <nav class="sidebar-nav-group" [attr.aria-label]="group.label">
            <p class="sidebar-nav-label">{{ group.label }}</p>
            @for (item of group.items; track item.path) {
              <a
                class="sidebar-link"
                [routerLink]="item.path"
                routerLinkActive="is-active"
                [routerLinkActiveOptions]="{ exact: !!item.exact }"
                (click)="navigated.emit()"
              >
                @if (item.matIcon) {
                  <mat-icon [fontIcon]="item.matIcon" [size]="18" />
                } @else {
                  <app-icon [name]="item.icon" [size]="16" />
                }
                <span>{{ item.label }}</span>
              </a>
            }
          </nav>
        }
      </div>

      <div class="sidebar-footer">
        @if (isVendor()) {
          <div class="sidebar-portal-chip">
            <app-icon name="hammer" [size]="12" />
            <span>Portal Penjual</span>
          </div>
        }
        <div class="sidebar-user">
          <span class="avatar avatar-sm">{{ initials() }}</span>
          <span class="sidebar-user-text">
            <span class="sidebar-user-name">{{ displayName() }}</span>
            <span class="sidebar-user-role">{{ roleLabel() }}</span>
          </span>
        </div>
      </div>
    </aside>
  `,
  styles: [
    `
      .sidebar-scope-text {
        font-size: var(--fs-xs);
        font-weight: var(--fw-medium);
        color: var(--c-text-secondary);
        line-height: 1.3;
      }
      .sidebar-user {
        display: flex;
        align-items: center;
        gap: var(--sp-3);
        padding: var(--sp-2);
        min-width: 0;
      }
      .sidebar-user-text {
        display: flex;
        flex-direction: column;
        min-width: 0;
        line-height: 1.3;
      }
      .sidebar-user-name {
        font-size: var(--fs-sm);
        font-weight: var(--fw-semibold);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .sidebar-user-role {
        font-size: var(--fs-2xs);
        font-weight: var(--fw-bold);
        text-transform: uppercase;
        letter-spacing: var(--tracking-caps);
        color: var(--c-text-muted);
      }

      /* =========================================================================
         ADMIN SIDEBAR: 30% Deep Navy (#172033) with Champagne Gold (#C6A15B) accents
         ========================================================================= */
      .admin-sidebar {
        background: #172033;
        border-right: 1px solid rgba(255, 255, 255, 0.08);

        .sidebar-brand {
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .sidebar-brand-name {
          color: #ffffff;
        }

        .sidebar-brand-mark {
          background: #c6a15b;
          color: #172033;
        }

        .sidebar-brand-tag {
          color: #c6a15b;
        }

        .sidebar-scope {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.08);

          mat-icon {
            color: #c6a15b;
          }

          .sidebar-scope-text {
            color: #98a2b3;
          }
        }

        .sidebar-nav-label {
          color: #667085;
          letter-spacing: 0.08em;
        }

        .sidebar-link {
          color: #98a2b3;

          mat-icon,
          app-icon {
            color: #667085;
            transition: color var(--dur-fast) var(--ease);
          }

          &:hover {
            background: rgba(255, 255, 255, 0.06);
            color: #ffffff;

            mat-icon,
            app-icon {
              color: #c6a15b;
            }
          }

          &.is-active {
            background: rgba(198, 161, 91, 0.14);
            color: #ffffff;
            font-weight: var(--fw-semibold);
            border-left: 3px solid #c6a15b;
            padding-left: calc(var(--sp-3) - 3px);

            mat-icon,
            app-icon {
              color: #c6a15b;
            }
          }
        }

        .sidebar-footer {
          border-top: 1px solid rgba(255, 255, 255, 0.08);

          .avatar {
            background: rgba(198, 161, 91, 0.2);
            color: #c6a15b;
            border: 1px solid rgba(198, 161, 91, 0.4);
          }

          .sidebar-user-name {
            color: #ffffff;
          }

          .sidebar-user-role {
            color: #c6a15b;
          }
        }
      }
    `,
  ],
})
export class SidebarComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly open = input(false);
  readonly navigated = output<void>();

  readonly groups = computed(() => navigationFor(this.auth.role()));

  readonly scopeSummary = computed(() => {
    const role = this.auth.role();
    return role ? ROLE_SCOPE_SUMMARY[role] : 'Browsing';
  });

  readonly displayName = computed(() => this.auth.displayName() || 'Signed in');

  readonly roleLabel = computed(() => {
    switch (this.auth.role()) {
      case UserRole.ADMIN:
        return 'Administrator';
      case UserRole.VENDOR:
        return 'Penjual';
      case UserRole.BIDDER:
        return 'Penawar';
      default:
        return '';
    }
  });

  readonly isVendor = computed(() => this.auth.role() === UserRole.VENDOR);
  readonly isAdmin = computed(() => this.auth.role() === UserRole.ADMIN);

  readonly initials = computed(() => {
    const user = this.auth.user();
    if (!user) return '?';
    if (user.name) {
      const parts = user.name.trim().split(/\s+/);
      if (parts.length > 1) {
        return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
      }
      return parts[0][0]?.toUpperCase() || '?';
    }
    const first = user.firstName?.trim()[0] ?? '';
    const last = user.lastName?.trim()[0] ?? '';
    const value = `${first}${last}`.toUpperCase();
    return value || user.email[0]?.toUpperCase() || '?';
  });

  constructor() {
    // Close the mobile drawer whenever navigation completes.
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(() => this.navigated.emit());
  }
}
