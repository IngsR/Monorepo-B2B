import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './core/services/session.service';

/**
 * Root component.
 *
 * The only responsibility here is to resolve the session identity once at boot,
 * before any guard or shell renders. A reload with a stored token must not show
 * a login flash or route the user to the wrong workspace, so the identity lookup
 * is kicked off here rather than lazily in a child.
 *
 * The shell itself is a route component and mounts inside `<router-outlet>`.
 */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<router-outlet />',
})
export class App {
  // Session restoration is owned by `sessionGuard`, which awaits
  // `loadIdentity()` before letting any authenticated route activate. Keeping it
  // there means a deep link or hard refresh cannot render a half-resolved
  // session, and there is exactly one place that decides to fetch identity.
  protected readonly auth = inject(AuthService);
}
