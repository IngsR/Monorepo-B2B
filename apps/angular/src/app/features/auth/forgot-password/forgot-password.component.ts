import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiFailure, toApiFailure } from '../../../core/domain/api-failure';
import { AuthService } from '../../../core/services/session.service';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { FormFieldComponent } from '../../../shared/ui/form-field.component';
import { IconComponent } from '../../../shared/ui/icon.component';
import { AlertComponent } from '../../../shared/ui/toast.component';

/**
 * Forgot-password request.
 *
 * The confirmation is deliberately identical whether or not the address exists,
 * matching the endpoint's behaviour: revealing which emails are registered would
 * turn this screen into an account-enumeration oracle.
 */
@Component({
  selector: 'app-forgot-password',
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

          @if (submitted()) {
            <h2 class="auth-heading">Check your email</h2>
            <p class="auth-subheading">{{ confirmation() }}</p>

            <app-alert tone="info" title="Didn't receive it?">
              Check your spam folder, or wait a minute before requesting another link. The link
              expires after 30 minutes.
            </app-alert>

            <div class="auth-footer">
              <a routerLink="/login" class="btn btn-link">Back to sign in</a>
            </div>
          } @else {
            <h2 class="auth-heading">Reset your password</h2>
            <p class="auth-subheading">
              Enter the email address for your account and we will send a reset link.
            </p>

            @if (failure(); as f) {
              <div class="notice-slot">
                <app-alert tone="danger" [title]="f.message">{{ f.detail }}</app-alert>
              </div>
            }

            <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
              <app-form-field
                label="Email address"
                [required]="true"
                [control]="email"
                [errorMap]="emailErrors"
                hint="Use the address your organisation registered for you."
                controlId="forgot-email"
              >
                <input
                  id="forgot-email"
                  type="email"
                  class="form-input"
                  formControlName="email"
                  placeholder="you@company.com"
                  autocomplete="email"
                />
              </app-form-field>

              <app-button
                type="submit"
                label="Send reset link"
                variant="primary"
                size="lg"
                [block]="true"
                [loading]="submitting()"
              />
            </form>

            <div class="auth-footer">
              Remembered your password?
              <a routerLink="/login">Back to sign in</a>
            </div>
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
export class ForgotPasswordComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  readonly submitting = signal(false);
  readonly submitted = signal(false);
  readonly confirmation = signal('');
  readonly failure = signal<ApiFailure | null>(null);

  get email() {
    return this.form.controls.email;
  }

  readonly emailErrors = {
    required: 'Email address is required',
    email: 'Enter a valid email address',
  };

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.failure.set(null);

    this.auth.forgotPassword(this.form.getRawValue().email).subscribe({
      next: (message) => {
        this.submitting.set(false);
        this.confirmation.set(message);
        this.submitted.set(true);
      },
      error: (error: unknown) => {
        this.submitting.set(false);
        this.failure.set(toApiFailure(error));
      },
    });
  }
}
