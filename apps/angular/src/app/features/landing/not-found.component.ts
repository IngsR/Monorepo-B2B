import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UserRole } from '../../core/domain/enums';
import { AuthService } from '../../core/services/session.service';
import { IconComponent } from '../../shared/ui/icon.component';

/**
 * Not-found screen.
 *
 * Rendered for any unrecognised path inside the authenticated shell. It offers
 * the routes the current role can actually use rather than a bare apology, and
 * it never redirects silently — a wrong URL should say so, not quietly change
 * the address bar.
 */
@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="card">
        <div class="state-block">
          <div class="state-icon">
            <app-icon name="search" [size]="22" />
          </div>
          <p class="state-title">Page not found</p>
          <p class="state-description">
            The address you followed does not exist, or the record it pointed to has been removed.
            Check the URL, or start from one of the areas below.
          </p>

          <div class="state-actions">
            <a class="btn btn-primary" routerLink="/marketplace">
              <app-icon name="gavel" [size]="15" />
              Auction marketplace
            </a>

            @if (isVendorOrAdmin()) {
              <a class="btn btn-secondary" routerLink="/vendor">
                <app-icon name="dashboard" [size]="15" />
                Vendor workspace
              </a>
            }

            @if (isAdmin()) {
              <a class="btn btn-secondary" routerLink="/admin">
                <app-icon name="shield" [size]="15" />
                Admin dashboard
              </a>
            }
          </div>
        </div>
      </div>
    </div>
  `,
})
export class NotFoundComponent {
  private readonly auth = inject(AuthService);

  readonly isAdmin = computed(() => this.auth.isAdmin());
  readonly isVendorOrAdmin = computed(
    () => this.auth.role() === UserRole.VENDOR || this.auth.isAdmin(),
  );
}
