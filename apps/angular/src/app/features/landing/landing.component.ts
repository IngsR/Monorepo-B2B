import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { Router } from '@angular/router';
import { homeRouteFor } from '../../core/guards/auth.guard';
import { AuthService } from '../../core/services/session.service';
import { IconComponent } from '../../shared/ui/icon.component';

/**
 * Root landing route.
 *
 * Every role needs a different home, and which one applies is only known after
 * the identity lookup resolves. Rather than duplicating that logic in a guard,
 * this component performs the redirect reactively and renders a brief loading
 * state, so there is never a flash of the wrong workspace.
 */
@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page landing">
      <div class="state-block">
        <div class="state-icon">
          <app-icon name="gavel" [size]="22" />
        </div>
        <p class="state-title">Preparing your workspace</p>
        <p class="state-description">Determining which area of the platform you have access to.</p>
      </div>
    </div>
  `,
  styles: [
    `
      .landing {
        min-height: 60vh;
        justify-content: center;
      }
    `,
  ],
})
export class LandingComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  constructor() {
    effect(() => {
      // Wait until the identity is resolved before choosing a destination.
      if (!this.auth.identityResolved()) return;

      const target = homeRouteFor(this.auth.role());
      // Navigating to '' would re-enter this component, so send an explicit path.
      void this.router.navigateByUrl(target === '/' ? '/marketplace' : target, {
        replaceUrl: true,
      });
    });
  }
}
