import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiFailure, toApiFailure } from '../../../core/domain/api-failure';
import { AuthService } from '../../../core/services/session.service';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { FormFieldComponent } from '../../../shared/ui/form-field.component';
import { IconComponent } from '../../../shared/ui/icon.component';
import { AlertComponent } from '../../../shared/ui/toast.component';

/**
 * Reset password with a token from the emailed link.
 *
 * The token travels in the query string. When it is missing or rejected the
 * screen explains how to obtain a new link rather than presenting a dead form.
 *
 * The new password confirmation is checked client-side as a convenience; the
 * length requirement is also enforced by the server, which remains authoritative.
 */
@Component({
  selector: 'app-reset-password',
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
    <div class="auth-shell auth-shell-single">
      <main class="auth-panel">
        <div class="auth-form-wrap">
          <div class="auth-brand">
            <span class="sidebar-brand-mark">
              <app-icon name="gavel" [size]="16" />
            </span>
            <span class="sidebar-brand-name">BidForge</span>
          </div>

          @if (!token()) {
            <h2 class="auth-heading">Reset link required</h2>
            <p class="auth-subheading">
              This page needs a valid reset link. Request a new one and open it from your email.
            </p>
            <app-alert tone="warning" title="No reset token found">
              Reset links expire after 30 minutes and can only be used once.
            </app-alert>
            <div class="auth-footer">
              <a routerLink="/forgot-password">Request a new reset link</a>
            </div>
          } @else if (succeeded()) {
            <h2 class="auth-heading">Password updated</h2>
            <p class="auth-subheading">
              Your password has been changed. Sign in with your new password.
            </p>
            <app-button
              label="Continue to sign in"
              variant="primary"
              size="lg"
              [block]="true"
              (clicked)="goToLogin()"
            />
          } @else {
            <h2 class="auth-heading">Choose a new password</h2>
            <p class="auth-subheading">
              Pick a password you have not used before. It must be at least 8 characters.
            </p>

            @if (failure(); as f) {
              <div class="notice-slot">
                <app-alert tone="danger" [title]="f.message">{{ f.detail }}</app-alert>
              </div>
            }

            <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
              <app-form-field
                label="New password"
                [required]="true"
                [control]="newPassword"
                [errorMap]="passwordErrors"
                hint="At least 8 characters."
                controlId="reset-password"
              >
                <div class="input-affix-wrap">
                  <input
                    id="reset-password"
                    [type]="show() ? 'text' : 'password'"
                    class="form-input"
                    formControlName="newPassword"
                    autocomplete="new-password"
                  />
                  <button
                    type="button"
                    class="input-affix-btn"
                    [attr.aria-label]="show() ? 'Hide password' : 'Show password'"
                    (click)="show.set(!show())"
                  >
                    <app-icon [name]="show() ? 'eye-off' : 'eye'" [size]="16" />
                  </button>
                </div>
              </app-form-field>

              <app-form-field
                label="Confirm new password"
                [required]="true"
                [control]="confirmPassword"
                errorText="Passwords do not match"
                controlId="reset-password-confirm"
              >
                <input
                  id="reset-password-confirm"
                  type="password"
                  class="form-input"
                  formControlName="confirmPassword"
                  autocomplete="new-password"
                />
              </app-form-field>

              <app-button
                type="submit"
                label="Update password"
                variant="primary"
                size="lg"
                [block]="true"
                [loading]="submitting()"
              />
            </form>
          }
        </div>
      </main>
    </div>
  `,
  styles: [
    `
      .auth-shell-single {
        grid-template-columns: 1fr;
      }
      .auth-shell-single .auth-panel {
        min-height: 100vh;
      }
      .notice-slot {
        margin-bottom: var(--sp-5);
      }
    `,
  ],
})
export class ResetPasswordComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly token = signal(this.route.snapshot.queryParamMap.get('token') ?? '');
  readonly submitting = signal(false);
  readonly succeeded = signal(false);
  readonly show = signal(false);
  readonly failure = signal<ApiFailure | null>(null);

  readonly form = this.fb.nonNullable.group(
    {
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: [passwordsMatch] },
  );

  get newPassword() {
    return this.form.controls.newPassword;
  }

  get confirmPassword() {
    return this.form.controls.confirmPassword;
  }

  readonly passwordErrors = {
    required: 'A new password is required',
    minlength: 'Password must be at least 8 characters',
  };

  readonly canSubmit = computed(() => this.form.valid && !!this.token());

  submit(): void {
    if (this.form.invalid || !this.token()) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.failure.set(null);

    const { newPassword } = this.form.getRawValue();

    this.auth.resetPassword(this.token(), newPassword).subscribe({
      next: () => {
        this.submitting.set(false);
        this.succeeded.set(true);
      },
      error: (error: unknown) => {
        this.submitting.set(false);
        this.failure.set(toApiFailure(error));
      },
    });
  }

  goToLogin(): void {
    void this.router.navigate(['/login'], { queryParams: { reset: '1' } });
  }
}

/** Cross-field validator: both entries must be identical. */
function passwordsMatch(group: import('@angular/forms').AbstractControl) {
  const password = group.get('newPassword')?.value;
  const confirm = group.get('confirmPassword')?.value;
  if (!password || !confirm) return null;
  return password === confirm ? null : { mismatch: true };
}
