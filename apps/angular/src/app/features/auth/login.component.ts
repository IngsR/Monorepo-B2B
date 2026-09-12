import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiFailure, toApiFailure } from '../../core/domain/api-failure';
import { UserRole } from '../../core/domain/enums';
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from '../../core/mock/mock-data';
import { homeRouteFor } from '../../core/guards/auth.guard';
import { AuthService } from '../../core/services/session.service';
import { ButtonComponent } from '../../shared/ui/button.component';
import { FormFieldComponent } from '../../shared/ui/form-field.component';
import { IconComponent } from '../../shared/ui/icon.component';
import { AlertComponent } from '../../shared/ui/toast.component';

/**
 * Sign-in screen.
 *
 * A two-column layout: a context rail that states what the platform does and
 * how access is scoped, plus the form. The rail is hidden below 900px so the
 * form is immediately reachable on a phone.
 *
 * Failure handling distinguishes rejected credentials from server problems,
 * because those require different user action.
 */
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    ButtonComponent,
    FormFieldComponent,
    IconComponent,
    AlertComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="auth-shell">
      <aside class="auth-aside">
        <div class="auth-aside-brand">
          <span class="sidebar-brand-mark">
            <app-icon name="gavel" [size]="16" />
          </span>
          <span class="auth-aside-wordmark">BidForge</span>
        </div>

        <div>
          <h1 class="auth-aside-lead">Industrial auction trading, run end to end.</h1>
          <p class="auth-aside-sub">
            Vendors publish products and run auction lifecycles. Bidders compete on live auctions
            against a server-authoritative price.
          </p>

          <div class="auth-aside-points">
            <div class="auth-aside-point">
              <app-icon name="shield" [size]="17" />
              <span class="auth-aside-point-text">
                Access is scoped by role. Administrators, vendors and bidders each see only the
                workspace they are authorized for.
              </span>
            </div>
            <div class="auth-aside-point">
              <app-icon name="trending-up" [size]="17" />
              <span class="auth-aside-point-text">
                Every bid is validated against the current price and increment on the server before
                it is accepted.
              </span>
            </div>
            <div class="auth-aside-point">
              <app-icon name="clock" [size]="17" />
              <span class="auth-aside-point-text">
                The published end time is authoritative for bidding, and the lifecycle is explicit:
                draft, scheduled, active, ended — or cancelled.
              </span>
            </div>
          </div>
        </div>

        <p class="auth-aside-foot">BidForge B2B Auction Platform · Demonstration environment</p>
      </aside>

      <main class="auth-panel">
        <div class="auth-form-wrap">
          <div class="auth-brand">
            <span class="sidebar-brand-mark">
              <app-icon name="gavel" [size]="16" />
            </span>
            <span class="sidebar-brand-name">BidForge</span>
          </div>

          <h2 class="auth-heading">Sign in</h2>
          <p class="auth-subheading">
            Use the account issued to you by your organisation administrator.
          </p>

          @if (failure(); as f) {
            <div class="notice-slot">
              <app-alert tone="danger" [title]="f.message">{{ f.detail }}</app-alert>
            </div>
          }

          @if (resetNotice()) {
            <div class="notice-slot">
              <app-alert tone="success" title="Password updated">
                Your password has been changed. Sign in with your new password.
              </app-alert>
            </div>
          }

          <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
            <app-form-field
              label="Email address"
              [required]="true"
              [control]="email"
              [errorMap]="emailErrors"
              controlId="login-email"
            >
              <input
                id="login-email"
                type="email"
                class="form-input"
                formControlName="email"
                placeholder="you@company.com"
                autocomplete="email"
              />
            </app-form-field>

            <app-form-field
              label="Password"
              [required]="true"
              [control]="password"
              [errorMap]="passwordErrors"
              controlId="login-password"
            >
              <div class="input-affix-wrap">
                <input
                  id="login-password"
                  [type]="showPassword() ? 'text' : 'password'"
                  class="form-input"
                  formControlName="password"
                  placeholder="Your password"
                  autocomplete="current-password"
                />
                <button
                  type="button"
                  class="input-affix-btn"
                  [attr.aria-label]="showPassword() ? 'Hide password' : 'Show password'"
                  (click)="showPassword.set(!showPassword())"
                >
                  <app-icon [name]="showPassword() ? 'eye-off' : 'eye'" [size]="16" />
                </button>
              </div>
            </app-form-field>

            <div class="login-actions">
              <a routerLink="/forgot-password" class="btn btn-link">Forgot your password?</a>
            </div>

            <app-button
              type="submit"
              label="Sign in"
              variant="primary"
              size="lg"
              [block]="true"
              [loading]="submitting()"
            />
          </form>

          <div class="auth-demo">
            <p class="auth-demo-head">
              <app-icon name="info" [size]="13" />
              <span>Demonstration accounts</span>
            </p>
            <div class="auth-demo-list">
              @for (account of demoAccounts; track account.email) {
                <button type="button" class="auth-demo-item" (click)="useAccount(account.email)">
                  <span class="auth-demo-role">{{ roleLabel(account.role) }}</span>
                  <span class="auth-demo-email">{{ account.email }}</span>
                </button>
              }
            </div>
            <p class="form-hint demo-password">
              Password for all demonstration accounts:
              <span class="text-numeric">{{ demoPassword }}</span>
            </p>
          </div>
        </div>
      </main>
    </div>
  `,
  styles: [
    `
      .auth-aside-brand {
        display: flex;
        align-items: center;
        gap: var(--sp-3);
      }
      .auth-aside-wordmark {
        font-size: var(--fs-lg);
        font-weight: var(--fw-bold);
        letter-spacing: var(--tracking-tight);
        color: var(--c-text-inverse);
      }
      .notice-slot {
        margin-bottom: var(--sp-5);
      }
      .login-actions {
        display: flex;
        justify-content: flex-end;
        margin: calc(var(--sp-2) * -1) 0 var(--sp-5);
      }
      .demo-password {
        margin-top: var(--sp-3);
      }
    `,
  ],
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly demoAccounts = DEMO_ACCOUNTS;
  readonly demoPassword = DEMO_PASSWORD;

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  readonly submitting = signal(false);
  readonly showPassword = signal(false);
  readonly failure = signal<ApiFailure | null>(null);
  readonly resetNotice = signal(this.route.snapshot.queryParamMap.get('reset') === '1');

  get email() {
    return this.form.controls.email;
  }

  get password() {
    return this.form.controls.password;
  }

  readonly emailErrors = {
    required: 'Email address is required',
    email: 'Enter a valid email address',
  };

  readonly passwordErrors = {
    required: 'Password is required',
  };

  useAccount(email: string): void {
    this.form.setValue({ email, password: this.demoPassword });
    this.failure.set(null);
  }

  roleLabel(role: UserRole): string {
    return role.charAt(0) + role.slice(1).toLowerCase();
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.failure.set(null);

    const { email, password } = this.form.getRawValue();

    this.auth.login({ email, password }).subscribe({
      next: (user) => {
        this.submitting.set(false);
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
        void this.router.navigateByUrl(returnUrl || homeRouteFor(user?.role ?? null));
      },
      error: (error: unknown) => {
        this.submitting.set(false);
        const failure = toApiFailure(error);

        this.failure.set(
          failure.status === 401
            ? {
                ...failure,
                message: 'Sign-in failed',
                detail:
                  'The email address or password is incorrect. Check your details and try again.',
              }
            : failure,
        );
      },
    });
  }
}
