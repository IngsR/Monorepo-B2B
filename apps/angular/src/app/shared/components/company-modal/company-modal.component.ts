import { CommonModule } from '@angular/common';
import { Component, EventEmitter, inject, Input, Output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CompanyService } from '../../../core/services/company.service';

@Component({
  selector: 'app-company-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="modal-backdrop" (click)="close()">
      <div class="modal-dialog glass-panel" (click)="$event.stopPropagation()">
        <!-- Header -->
        <div class="modal-header">
          <div class="modal-title-wrap">
            <div class="modal-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
              </svg>
            </div>
            <div>
              <h3>Register Enterprise Partner</h3>
              <p>Add an auction partner or scrap seller tenant to the system.</p>
            </div>
          </div>
          <button type="button" class="btn-close" (click)="close()">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <!-- Body Form -->
        <form [formGroup]="form" (ngSubmit)="onSubmit()" class="modal-body">
          @if (errorMessage) {
            <div class="error-banner">
              {{ errorMessage }}
            </div>
          }

          <div class="form-row">
            <div class="form-group flex-2">
              <label>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:inline; margin-right:4px;">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
                Nama Perusahaan *
              </label>
              <input type="text" formControlName="name" placeholder="PT Krakatau Steelindo Utama" class="form-input" />
            </div>

            <div class="form-group flex-1">
              <label>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:inline; margin-right:4px;">
                  <polyline points="16 18 22 12 16 6"></polyline>
                  <polyline points="8 6 2 12 8 18"></polyline>
                </svg>
                Kode Unik *
              </label>
              <input type="text" formControlName="code" placeholder="KSU-01" class="form-input text-uppercase" />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group flex-1">
              <label>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:inline; margin-right:4px;">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                  <polyline points="22,6 12,13 2,6"></polyline>
                </svg>
                Email Korporat
              </label>
              <input type="email" formControlName="email" placeholder="contact@krakatau.co.id" class="form-input" />
            </div>

            <div class="form-group flex-1">
              <label>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:inline; margin-right:4px;">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                </svg>
                Telepon Kantor
              </label>
              <input type="text" formControlName="phone" placeholder="021-8899-000" class="form-input" />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group flex-1">
              <label>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:inline; margin-right:4px;">
                  <circle cx="12" cy="10" r="3"></circle>
                  <path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z"></path>
                </svg>
                Kota Operasional
              </label>
              <input type="text" formControlName="city" placeholder="Cilegon / Jakarta" class="form-input" />
            </div>
            <div class="form-group flex-1">
              <label>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:inline; margin-right:4px;">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                  <polyline points="9 22 9 12 15 12 15 22"></polyline>
                </svg>
                Alamat Kantor / Gudang
              </label>
              <input type="text" formControlName="address" placeholder="Kawasan Industri Estate No. 12" class="form-input" />
            </div>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn-cancel" (click)="close()">
              Batal
            </button>

            <button type="submit" class="btn-action btn-primary" [disabled]="form.invalid || isSubmitting">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              <span>{{ isSubmitting ? 'Mendaftarkan...' : 'Simpan Partner' }}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(4, 7, 12, 0.75);
      backdrop-filter: blur(8px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100;
      padding: 1rem;
      animation: fade-in 0.2s ease-out;
    }

    @keyframes fade-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .modal-dialog {
      width: 100%;
      max-width: 560px;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      border: 1px solid #e2e8f0;
      background: #ffffff;
      border-radius: var(--radius-xl);
      box-shadow: 0 20px 50px -10px rgba(15, 23, 42, 0.18);
      overflow: hidden;
      animation: scale-up 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes scale-up {
      from { transform: scale(0.95); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }

    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1.25rem 1.5rem;
      border-bottom: 1px solid #f1f5f9;
      flex-shrink: 0;
    }

    .modal-title-wrap {
      display: flex;
      align-items: center;
      gap: 12px;

      h3 {
        font-size: 1.125rem;
        font-weight: 700;
        color: #0f172a;
      }

      p {
        font-size: 0.8125rem;
        color: #64748b;
      }
    }

    .modal-icon {
      width: 36px;
      height: 36px;
      border-radius: var(--radius-md);
      background: #eef2ff;
      color: #4338ca;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .btn-close {
      color: #94a3b8;
      padding: 6px;
      border-radius: var(--radius-sm);

      &:hover {
        color: #0f172a;
        background: #f1f5f9;
      }
    }

    .modal-body {
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1.1rem;
      overflow-y: auto;
      flex: 1;
      min-height: 0;
    }

    .error-banner {
      background: #fff1f2;
      border: 1px solid #fecdd3;
      color: #e11d48;
      padding: 0.75rem;
      border-radius: var(--radius-md);
      font-size: 0.8125rem;
    }

    .form-row {
      display: flex;
      gap: 1rem;
      width: 100%;

      @media (max-width: 600px) {
        flex-direction: column;
      }
    }

    .flex-1 { flex: 1; min-width: 0; }
    .flex-2 { flex: 2; min-width: 0; }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-width: 0;

      label {
        font-size: 0.75rem;
        font-weight: 700;
        color: #475569;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
    }

    .form-input {
      width: 100%;
      box-sizing: border-box;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: var(--radius-md);
      padding: 0.625rem 0.875rem;
      color: #0f172a;
      font-size: 0.875rem;
      outline: none;
      transition: border-color 0.2s ease, box-shadow 0.2s ease;

      &:focus {
        border-color: #4338ca;
        box-shadow: 0 0 0 2px rgba(67, 56, 202, 0.15);
        background: #ffffff;
      }
    }

    .text-uppercase {
      text-transform: uppercase;
    }

    .modal-footer {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 1rem;
      margin-top: 1rem;
      padding-top: 1rem;
      border-top: 1px solid var(--border-subtle);
    }

    .btn-cancel {
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--text-secondary);
      padding: 8px 16px;
      border-radius: var(--radius-full);

      &:hover {
        color: #0f172a;
        background: #f1f5f9;
      }
    }
  `],
})
export class CompanyModalComponent {
  private readonly fb = inject(FormBuilder);
  private readonly companyService = inject(CompanyService);

  @Output() closed = new EventEmitter<void>();
  @Output() created = new EventEmitter<void>();

  isSubmitting = false;
  errorMessage: string | null = null;

  form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(255)]],
    code: ['', [Validators.required, Validators.maxLength(50)]],
    email: ['', [Validators.email]],
    phone: [''],
    city: [''],
    address: [''],
  });

  close() {
    this.closed.emit();
  }

  onSubmit() {
    if (this.form.invalid) return;

    this.isSubmitting = true;
    this.errorMessage = null;

    const val = this.form.value;
    this.companyService
      .createCompany({
        name: val.name!,
        code: val.code!.toUpperCase(),
        email: val.email || undefined,
        phone: val.phone || undefined,
        city: val.city || undefined,
        address: val.address || undefined,
      })
      .subscribe({
        next: () => {
          this.isSubmitting = false;
          this.created.emit();
          this.close();
        },
        error: (err) => {
          this.isSubmitting = false;
          this.errorMessage = err?.error?.message || 'Error registering company';
        },
      });
  }
}
