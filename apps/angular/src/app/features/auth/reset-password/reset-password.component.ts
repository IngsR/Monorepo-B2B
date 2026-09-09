import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

const passwordMatchValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const password = control.get('newPassword')?.value;
  const confirm = control.get('confirmPassword')?.value;
  return password && confirm && password !== confirm ? { passwordMismatch: true } : null;
};

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.scss',
})
export class ResetPasswordComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);

  readonly resetForm = this.fb.nonNullable.group(
    {
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: [passwordMatchValidator] },
  );

  readonly token = signal<string | null>(null);
  readonly isLoading = signal(false);
  readonly isSuccess = signal(false);
  readonly errorMessage = signal<string | null>(null);

  ngOnInit(): void {
    const tokenParam = this.route.snapshot.queryParams['token'];
    if (tokenParam) {
      this.token.set(tokenParam);
    } else {
      this.errorMessage.set('Reset token is missing from the URL. Please request a new link.');
    }
  }

  onSubmit(): void {
    if (this.resetForm.invalid || !this.token()) {
      this.resetForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    const { newPassword } = this.resetForm.getRawValue();

    this.authService.resetPassword(this.token()!, newPassword).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.isSuccess.set(true);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set(
          err.error?.message || 'Invalid or expired token. Please request a new reset link.',
        );
      },
    });
  }
}
