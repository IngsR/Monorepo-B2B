import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { UserRole } from '../../core/domain/enums';
import { AuthService } from '../../core/services/session.service';
import { IconComponent } from '../ui/icon.component';

/**
 * Application topbar.
 *
 * Holds the mobile drawer trigger, the current page context slot (pages project
 * their own title and actions here) and the account menu. The account menu is
 * the only place role-switching context is exposed, and it shows the role
 * explicitly so a user working across accounts is never unsure who they are.
 */
@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="shell-topbar">
      <button
        type="button"
        class="topbar-menu-btn"
        aria-label="Open navigation"
        (click)="toggleMenu.emit()"
      >
        <app-icon name="menu" [size]="18" />
      </button>

      <div class="topbar-context">
        <ng-content />
      </div>

      <span class="topbar-spacer"></span>

      <div class="menu-wrapper">
        <button
          type="button"
          class="user-trigger"
          [attr.aria-expanded]="menuOpen()"
          aria-haspopup="menu"
          (click)="menuOpen.set(!menuOpen())"
        >
          <span class="avatar">{{ initials() }}</span>
          <span class="user-trigger-text">
            <span class="user-trigger-name">{{ displayName() }}</span>
            <span class="user-trigger-role">{{ roleLabel() }}</span>
          </span>
          <app-icon name="chevron-down" [size]="14" />
        </button>

        @if (menuOpen()) {
          <div class="menu-panel" role="menu">
            <div class="user-menu-head">
              <p class="user-menu-name">{{ displayName() }}</p>
              <p class="user-menu-email">{{ email() }}</p>
            </div>

            <button type="button" class="menu-item" role="menuitem" (click)="goToProfile()">
              <app-icon name="user" [size]="15" />
              <span>{{ profileLabel() }}</span>
            </button>

            <button type="button" class="menu-item" role="menuitem" (click)="goToPassword()">
              <app-icon name="key" [size]="15" />
              <span>Change password</span>
            </button>

            <div class="menu-separator"></div>

            <button type="button" class="menu-item is-danger" role="menuitem" (click)="signOut()">
              <app-icon name="log-out" [size]="15" />
              <span>Sign out</span>
            </button>
          </div>
        }
      </div>
    </header>
  `,
  styles: [
    `
      .topbar-context {
        display: flex;
        align-items: center;
        gap: var(--sp-3);
        min-width: 0;
      }
    `,
  ],
})
export class TopbarComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly toggleMenu = output<void>();

  readonly menuOpen = signal(false);

  readonly displayName = computed(() => this.auth.displayName() || 'Signed in');
  readonly email = computed(() => this.auth.user()?.email ?? '');

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

  /** The profile screen differs per role, so the menu label reflects that. */
  readonly profileLabel = computed(() => {
    switch (this.auth.role()) {
      case UserRole.VENDOR:
        return 'Vendor profile';
      case UserRole.BIDDER:
        return 'Bidder profile';
      default:
        return 'My profile';
    }
  });

  readonly initials = computed(() => {
    const user = this.auth.user();
    if (!user) return '?';
    const first = user.firstName?.trim()[0] ?? '';
    const last = user.lastName?.trim()[0] ?? '';
    return `${first}${last}`.toUpperCase() || user.email[0]?.toUpperCase() || '?';
  });

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (this.menuOpen() && !target?.closest('.menu-wrapper')) this.menuOpen.set(false);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.menuOpen.set(false);
  }

  goToProfile(): void {
    this.menuOpen.set(false);
    switch (this.auth.role()) {
      case UserRole.VENDOR:
        void this.router.navigate(['/profile/vendor']);
        break;
      case UserRole.BIDDER:
        void this.router.navigate(['/profile/bidder']);
        break;
      default:
        void this.router.navigate(['/profile']);
    }
  }

  goToPassword(): void {
    this.menuOpen.set(false);
    void this.router.navigate(['/profile/security']);
  }

  signOut(): void {
    this.menuOpen.set(false);
    this.auth.logout();
  }
}
