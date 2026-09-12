import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs';
import { UserRole } from '../../core/domain/enums';
import { AuthService } from '../../core/services/session.service';
import { IconComponent } from '../ui/icon.component';
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
  imports: [RouterLink, RouterLinkActive, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <aside class="shell-sidebar" [class.is-open]="open()" aria-label="Primary navigation">
      <div class="sidebar-brand">
        <span class="sidebar-brand-mark">
          <app-icon name="gavel" [size]="16" />
        </span>
        <span class="sidebar-brand-text">
          <span class="sidebar-brand-name">BidForge</span>
          <span class="sidebar-brand-tag">B2B Auctions</span>
        </span>
      </div>

      <div class="sidebar-scroll">
        <div class="sidebar-scope">
          <app-icon name="shield" [size]="13" />
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
                <app-icon [name]="item.icon" [size]="16" />
                <span>{{ item.label }}</span>
              </a>
            }
          </nav>
        }
      </div>

      <div class="sidebar-footer">
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
        return 'Vendor';
      case UserRole.BIDDER:
        return 'Bidder';
      default:
        return '';
    }
  });

  readonly initials = computed(() => {
    const user = this.auth.user();
    if (!user) return '?';
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
