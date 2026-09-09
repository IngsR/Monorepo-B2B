import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.scss',
})
export class ForgotPasswordComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);

  readonly forgotForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  readonly isLoading = signal(false);
  readonly isSubmitted = signal(false);
  readonly errorMessage = signal<string | null>(null);

  onSubmit(): void {
    if (this.forgotForm.invalid) {
      this.forgotForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    const email = this.forgotForm.getRawValue().email;

    this.authService.forgotPassword(email).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.isSubmitted.set(true);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set(
          err.error?.message || 'Failed to send reset link. Please try again.',
        );
      },
    });
  }
}
