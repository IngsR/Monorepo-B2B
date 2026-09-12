import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from './sidebar.component';
import { TopbarComponent } from './topbar.component';
import { ToastHostComponent } from '../ui/toast.component';

/**
 * Authenticated application shell.
 *
 * Layout: fixed sidebar, sticky topbar, scrolling content region.
 * Below 1024px the sidebar becomes a navigation drawer with a scrim, and the
 * content region takes the full width.
 *
 * The toast host lives here so notifications survive route changes and are
 * announced from a single, stable place in the accessibility tree.
 */
@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, TopbarComponent, ToastHostComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="shell">
      <app-sidebar [open]="drawerOpen()" (navigated)="closeDrawer()" />

      @if (drawerOpen()) {
        <div class="shell-scrim" (click)="closeDrawer()" aria-hidden="true"></div>
      }

      <div class="shell-main">
        <app-topbar (toggleMenu)="toggleDrawer()" />
        <main class="shell-content" id="main-content">
          <router-outlet />
        </main>
      </div>

      <app-toast-host />
    </div>
  `,
})
export class ShellComponent {
  readonly drawerOpen = signal(false);

  toggleDrawer(): void {
    this.drawerOpen.update((open) => !open);
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
  }
}
