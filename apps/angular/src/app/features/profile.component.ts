import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiFailure, toApiFailure } from '../core/domain/api-failure';
import { UserRole } from '../core/domain/enums';
import { formatDateTime } from '../core/domain/format';
import { AuthService } from '../core/services/session.service';
import { NotificationService } from '../core/services/notification.service';
import { BidderService, VendorService } from '../core/services/directory.service';
import { AccountStatusBadgeComponent } from '../shared/ui/badge.component';
import { ButtonComponent } from '../shared/ui/button.component';
import {
  FormFieldComponent,
  ReadonlyFieldComponent,
} from '../shared/ui/form-field.component';
import { BreadcrumbsComponent, Crumb } from '../shared/ui/pagination.component';
import { AlertComponent } from '../shared/ui/toast.component';
import { focusAndShakeFirstInvalid } from '../shared/ui/form-utils';

/**
 * Profil & Akun Pengguna / Vendor.
 *
 * Mengonsolidasikan identitas bisnis (data perusahaan/vendor) dan akun pengguna
 * dalam satu pengalaman yang terstruktur dan mudah dipahami:
 *
 *   1. Profil Bisnis / Vendor (nama perusahaan, kontak, telepon, alamat, deskripsi).
 *   2. Data Akun Pengguna (nama dan email login).
 *   3. Keamanan Akun (penggantian kata sandi).
 */
@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    AccountStatusBadgeComponent,
    ButtonComponent,
    FormFieldComponent,
    ReadonlyFieldComponent,
    BreadcrumbsComponent,
    AlertComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-breadcrumbs [items]="crumbs()" />

      <header class="page-head">
        <div class="page-head-text">
          <h1 class="page-title">Profil & Akun</h1>
          <p class="page-subtitle">
            Kelola data identitas bisnis resmi Anda, informasi akun login, serta keamanan kata sandi.
          </p>
        </div>
      </header>

      <div class="profile-grid">
        <!-- 1. Role / Business Profile (Vendor or Bidder details) -->
        @if (roleProfileForm(); as form) {
          <section class="card profile-card">
            <div class="card-header">
              <div>
                <h2 class="section-heading">{{ isVendor() ? 'Profil Perusahaan / Vendor' : 'Profil Peserta Lelang' }}</h2>
                <p class="section-subtext">Informasi resmi yang terdaftar dan ditampilkan pada sistem lelang.</p>
              </div>
              <span class="badge badge-brand">Terverifikasi</span>
            </div>
            <div class="card-body">
              @if (profileFailure(); as f) {
                <div class="notice-slot">
                  <app-alert tone="danger" [title]="f.message" [message]="f.detail ?? ''" />
                </div>
              }

              <form [formGroup]="form" (ngSubmit)="saveRoleProfile()" novalidate>
                @if (isVendor()) {
                  <div class="form-grid">
                    <div class="form-grid-full">
                      <app-form-field
                        label="Nama Perusahaan / Entitas Bisnis"
                        [required]="true"
                        [control]="companyName"
                        [errorMap]="companyErrors"
                        controlId="profile-company"
                      >
                        <input
                          id="profile-company"
                          type="text"
                          class="form-input"
                          formControlName="companyName"
                          placeholder="PT / CV Nama Perusahaan"
                        />
                      </app-form-field>
                    </div>

                    <app-form-field
                      label="Kontak Penanggung Jawab"
                      [required]="true"
                      [control]="contactPerson"
                      [errorMap]="contactErrors"
                      controlId="profile-contact"
                    >
                      <input
                        id="profile-contact"
                        type="text"
                        class="form-input"
                        formControlName="contactPerson"
                        placeholder="Nama lengkap kontak resmi"
                      />
                    </app-form-field>

                    <app-form-field
                      label="Nomor Telepon Operasional"
                      [required]="true"
                      [control]="phone"
                      [errorMap]="phoneErrors"
                      controlId="profile-phone"
                    >
                      <input
                        id="profile-phone"
                        type="tel"
                        class="form-input"
                        formControlName="phone"
                        placeholder="08xxxxxxxxxx atau 021-xxxxxxx"
                      />
                    </app-form-field>

                    <div class="form-grid-full">
                      <app-form-field
                        label="Alamat Kantor / Fasilitas Penyimpanan"
                        [control]="address"
                        controlId="profile-address"
                      >
                        <textarea
                          id="profile-address"
                          class="form-textarea"
                          rows="2"
                          formControlName="address"
                          placeholder="Alamat lengkap kantor pusat atau gudang penyimpanan lot"
                        ></textarea>
                      </app-form-field>
                    </div>

                    <div class="form-grid-full">
                      <app-form-field
                        label="Deskripsi Bisnis & Portofolio Lot"
                        [control]="description"
                        controlId="profile-description"
                      >
                        <textarea
                          id="profile-description"
                          class="form-textarea"
                          rows="3"
                          formControlName="description"
                          placeholder="Gambaran umum spesialisasi material atau produk yang biasa Anda sediakan untuk lelang"
                        ></textarea>
                      </app-form-field>
                    </div>
                  </div>
                } @else {
                  <div class="form-grid">
                    <div class="form-grid-full">
                      <app-form-field
                        label="Nama Perusahaan (Opsional)"
                        [control]="companyName"
                        controlId="profile-company"
                      >
                        <input
                          id="profile-company"
                          type="text"
                          class="form-input"
                          formControlName="companyName"
                          placeholder="Nama entitas bisnis bila ada"
                        />
                      </app-form-field>
                    </div>

                    <app-form-field
                      label="Nama Lengkap Kontak"
                      [required]="true"
                      [control]="contactPerson"
                      [errorMap]="contactErrors"
                      controlId="profile-contact"
                    >
                      <input
                        id="profile-contact"
                        type="text"
                        class="form-input"
                        formControlName="contactPerson"
                      />
                    </app-form-field>

                    <app-form-field
                      label="Nomor Telepon"
                      [required]="true"
                      [control]="phone"
                      [errorMap]="phoneErrors"
                      controlId="profile-phone"
                    >
                      <input
                        id="profile-phone"
                        type="tel"
                        class="form-input"
                        formControlName="phone"
                      />
                    </app-form-field>

                    <div class="form-grid-full">
                      <app-form-field
                        label="Alamat"
                        [control]="address"
                        controlId="profile-address"
                      >
                        <textarea
                          id="profile-address"
                          class="form-textarea"
                          rows="2"
                          formControlName="address"
                        ></textarea>
                      </app-form-field>
                    </div>
                  </div>
                }

                <div class="form-grid">
                  <app-readonly-field
                    label="ID Profil {{ isVendor() ? 'Vendor' : 'Peserta' }}"
                    [value]="ownerId() ?? '—'"
                    hint="Identitas resmi kepemilikan lot dan lelang pada platform."
                  />
                  <app-readonly-field
                    label="Tanggal Terdaftar"
                    [value]="profileCreated()"
                    hint="Dikelola otomatis oleh platform."
                  />
                </div>

                <div class="card-footer card-footer-flush">
                  <app-button
                    type="submit"
                    label="Simpan Profil Bisnis"
                    icon="check"
                    variant="primary"
                    [loading]="savingProfile()"
                  />
                </div>
              </form>
            </div>
          </section>
        }

        <!-- 2. Account Information -->
        <section class="card profile-card">
          <div class="card-header">
            <div>
              <h2 class="section-heading">Data Akun Pengguna</h2>
              <p class="section-subtext">Informasi akun personal Anda untuk masuk ke sistem.</p>
            </div>
            @if (user()?.status; as st) {
              <app-account-status-badge [status]="st" />
            }
          </div>
          <div class="card-body">
            @if (accountFailure(); as f) {
              <div class="notice-slot">
                <app-alert [tone]="'danger'" [title]="f.message" [message]="f.detail ?? ''" />
              </div>
            }

            <form [formGroup]="accountForm" (ngSubmit)="saveAccount()" novalidate>
              <div class="form-grid">
                <app-form-field
                  label="Nama Depan"
                  [required]="true"
                  [control]="firstName"
                  [errorMap]="nameErrors"
                  controlId="profile-first-name"
                >
                  <input
                    id="profile-first-name"
                    type="text"
                    class="form-input"
                    formControlName="firstName"
                  />
                </app-form-field>

                <app-form-field
                  label="Nama Belakang"
                  [required]="true"
                  [control]="lastName"
                  [errorMap]="nameErrors"
                  controlId="profile-last-name"
                >
                  <input
                    id="profile-last-name"
                    type="text"
                    class="form-input"
                    formControlName="lastName"
                  />
                </app-form-field>
              </div>

              <app-readonly-field
                label="Alamat Email Akun"
                [value]="user()?.email ?? '—'"
                hint="Hubungi administrator sistem jika perlu memperbarui alamat email terdaftar."
              />

              <div class="form-grid">
                <app-readonly-field
                  label="Peran Pengguna"
                  [value]="roleLabel()"
                  hint="Ditetapkan oleh sistem administrasi."
                />
                <app-readonly-field
                  label="ID Akun Pengguna"
                  [value]="user()?.id ?? '—'"
                  hint="Pengenal unik akun pada platform."
                />
              </div>

              <div class="card-footer card-footer-flush">
                <app-button
                  type="submit"
                  label="Simpan Perubahan Akun"
                  icon="check"
                  variant="primary"
                  [loading]="savingAccount()"
                />
              </div>
            </form>
          </div>
        </section>

        <!-- 3. Security & Password -->
        <section class="card profile-card" id="security">
          <div class="card-header">
            <div>
              <h2 class="section-heading">Keamanan & Kata Sandi</h2>
              <p class="section-subtext">Perbarui kata sandi secara berkala untuk melindungi akun Anda.</p>
            </div>
          </div>
          <div class="card-body">
            @if (passwordFailure(); as f) {
              <div class="notice-slot">
                <app-alert tone="danger" [title]="f.message" [message]="f.detail ?? ''" />
              </div>
            }

            @if (passwordSuccess()) {
              <div class="notice-slot">
                <app-alert tone="success" title="Kata sandi berhasil diubah">
                  Kata sandi Anda telah diperbarui. Gunakan kata sandi baru untuk login berikutnya.
                </app-alert>
              </div>
            }

            <form [formGroup]="passwordForm" (ngSubmit)="savePassword()" novalidate>
              <app-form-field
                label="Kata Sandi Saat Ini"
                [required]="true"
                [control]="currentPassword"
                [errorMap]="requiredPasswordErrors"
                controlId="profile-current-password"
              >
                <input
                  id="profile-current-password"
                  type="password"
                  class="form-input"
                  formControlName="currentPassword"
                  autocomplete="current-password"
                />
              </app-form-field>

              <app-form-field
                label="Kata Sandi Baru"
                [required]="true"
                [control]="newPassword"
                [errorMap]="newPasswordErrors"
                hint="Minimal 8 karakter."
                controlId="profile-new-password"
              >
                <input
                  id="profile-new-password"
                  type="password"
                  class="form-input"
                  formControlName="newPassword"
                  autocomplete="new-password"
                />
              </app-form-field>

              <app-form-field
                label="Konfirmasi Kata Sandi Baru"
                [required]="true"
                [control]="confirmPassword"
                errorText="Kata sandi konfirmasi tidak cocok"
                controlId="profile-confirm-password"
              >
                <input
                  id="profile-confirm-password"
                  type="password"
                  class="form-input"
                  formControlName="confirmPassword"
                  autocomplete="new-password"
                />
              </app-form-field>

              <div class="card-footer card-footer-flush">
                <app-button
                  type="submit"
                  label="Perbarui Kata Sandi"
                  icon="lock"
                  variant="primary"
                  [loading]="savingPassword()"
                />
              </div>
            </form>
          </div>
        </section>
      </div>
    </div>
  `,
  styles: [
    `
      .profile-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(380px, 1fr));
        gap: var(--sp-6);
        align-items: start;
      }

      .profile-card {
        border-radius: var(--r-md);
      }

      .section-subtext {
        font-size: var(--fs-xs);
        color: var(--c-text-muted);
        margin: 2px 0 0;
      }

      @media (max-width: 900px) {
        .profile-grid {
          grid-template-columns: 1fr;
        }
      }

      .notice-slot {
        margin-bottom: var(--sp-4);
      }

      .card-footer-flush {
        margin: var(--sp-5) calc(var(--sp-5) * -1) calc(var(--sp-5) * -1);
        padding: var(--sp-3) var(--sp-5);
        background: var(--c-surface-sunken);
        border-top: 1px solid var(--c-border);
        border-radius: 0 0 var(--r-md) var(--r-md);
        display: flex;
        justify-content: flex-end;
      }
    `,
  ],
})
export class ProfileComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly vendorService = inject(VendorService);
  private readonly bidderService = inject(BidderService);
  private readonly notifications = inject(NotificationService);

  readonly user = computed(() => this.auth.user());
  readonly ownerId = computed(() => this.auth.ownerId());
  readonly isVendor = computed(() => this.auth.isVendor());

  readonly savingAccount = signal(false);
  readonly savingProfile = signal(false);
  readonly savingPassword = signal(false);
  readonly accountFailure = signal<ApiFailure | null>(null);
  readonly profileFailure = signal<ApiFailure | null>(null);
  readonly passwordFailure = signal<ApiFailure | null>(null);
  readonly passwordSuccess = signal(false);

  readonly accountForm = this.fb.nonNullable.group({
    firstName: ['', [Validators.required]],
    lastName: ['', [Validators.required]],
  });

  readonly passwordForm = this.fb.nonNullable.group(
    {
      currentPassword: ['', [Validators.required]],
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]],
    },
    {
      validators: (group) => {
        const next = group.get('newPassword')?.value;
        const confirm = group.get('confirmPassword')?.value;
        return next && confirm && next !== confirm ? { mismatch: true } : null;
      },
    },
  );

  readonly vendorForm = this.fb.nonNullable.group({
    companyName: ['', [Validators.required]],
    contactPerson: ['', [Validators.required]],
    phone: ['', [Validators.required]],
    address: [''],
    description: [''],
  });

  readonly bidderForm = this.fb.nonNullable.group({
    companyName: [''],
    contactPerson: ['', [Validators.required]],
    phone: ['', [Validators.required]],
    address: [''],
  });

  get firstName() {
    return this.accountForm.controls.firstName;
  }
  get lastName() {
    return this.accountForm.controls.lastName;
  }
  get currentPassword() {
    return this.passwordForm.controls.currentPassword;
  }
  get newPassword() {
    return this.passwordForm.controls.newPassword;
  }
  get confirmPassword() {
    return this.passwordForm.controls.confirmPassword;
  }

  get companyName() {
    return this.isVendor()
      ? this.vendorForm.controls.companyName
      : this.bidderForm.controls.companyName;
  }
  get contactPerson() {
    return this.isVendor()
      ? this.vendorForm.controls.contactPerson
      : this.bidderForm.controls.contactPerson;
  }
  get phone() {
    return this.isVendor() ? this.vendorForm.controls.phone : this.bidderForm.controls.phone;
  }
  get address() {
    return this.isVendor() ? this.vendorForm.controls.address : this.bidderForm.controls.address;
  }
  get description() {
    return this.vendorForm.controls.description;
  }

  readonly nameErrors = { required: 'Kolom ini wajib diisi' };
  readonly companyErrors = { required: 'Nama perusahaan wajib diisi' };
  readonly contactErrors = { required: 'Nama kontak penanggung jawab wajib diisi' };
  readonly phoneErrors = { required: 'Nomor telepon operasional wajib diisi' };
  readonly requiredPasswordErrors = { required: 'Kata sandi saat ini wajib diisi' };
  readonly newPasswordErrors = {
    required: 'Kata sandi baru wajib diisi',
    minlength: 'Kata sandi baru minimal 8 karakter',
  };

  readonly roleLabel = computed(() => {
    switch (this.auth.role()) {
      case UserRole.ADMIN:
        return 'Administrator';
      case UserRole.VENDOR:
        return 'Penjual (Vendor)';
      case UserRole.BIDDER:
        return 'Peserta Lelang (Bidder)';
      default:
        return '—';
    }
  });

  readonly roleNoun = computed(() => this.roleLabel().toLowerCase());

  readonly roleProfileTitle = computed(() =>
    this.isVendor() ? 'Profil Perusahaan / Vendor' : 'Profil Peserta Lelang',
  );

  readonly profileCreated = computed(() => {
    const record = this.isVendor() ? this.auth.vendor() : this.auth.bidder();
    return formatDateTime(record?.createdAt);
  });

  /** The form for the current role, or null when no role profile exists. */
  readonly roleProfileForm = computed(() =>
    this.isVendor() && this.auth.vendor()
      ? this.vendorForm
      : !this.isVendor() && this.auth.bidder()
        ? this.bidderForm
        : null,
  );

  readonly crumbs = computed<Crumb[]>(() => [{ label: 'Profil & Akun' }]);

  constructor() {
    this.seedForms();
  }

  private seedForms(): void {
    const user = this.auth.user();
    if (user) {
      this.accountForm.patchValue({
        firstName: user.firstName ?? '',
        lastName: user.lastName ?? '',
      });
    }

    const vendor = this.auth.vendor();
    if (vendor) {
      this.vendorForm.patchValue({
        companyName: vendor.companyName,
        contactPerson: vendor.contactPerson ?? '',
        phone: vendor.phone ?? '',
        address: vendor.address ?? vendor.companyAddress ?? '',
        description: vendor.description ?? '',
      });
    }

    const bidder = this.auth.bidder();
    if (bidder) {
      this.bidderForm.patchValue({
        companyName: bidder.companyName ?? '',
        contactPerson: bidder.contactPerson ?? '',
        phone: bidder.phone ?? '',
        address: bidder.address ?? '',
      });
    }
  }

  saveAccount(): void {
    if (this.accountForm.invalid) {
      this.accountForm.markAllAsTouched();
      setTimeout(() => focusAndShakeFirstInvalid(), 50);
      return;
    }

    this.savingAccount.set(true);
    this.accountFailure.set(null);

    const value = this.accountForm.getRawValue();

    this.auth.updateProfile({ firstName: value.firstName, lastName: value.lastName }).subscribe({
      next: (user) => {
        this.savingAccount.set(false);
        this.auth.applyUser(user);
        this.notifications.success('Profil Akun Diperbarui', 'Data akun pengguna Anda telah disimpan.');
      },
      error: (error: unknown) => {
        this.savingAccount.set(false);
        const failure = toApiFailure(error);
        this.accountFailure.set(failure);
        this.notifications.fromFailure(failure, 'Gagal memperbarui profil akun');
        setTimeout(() => focusAndShakeFirstInvalid(), 50);
      },
    });
  }

  saveRoleProfile(): void {
    const form = this.roleProfileForm();
    if (!form) return;

    if (form.invalid) {
      form.markAllAsTouched();
      setTimeout(() => focusAndShakeFirstInvalid(), 50);
      return;
    }

    this.savingProfile.set(true);
    this.profileFailure.set(null);

    if (this.isVendor()) {
      const value = this.vendorForm.getRawValue();
      this.vendorService
        .updateMine({
          companyName: value.companyName,
          contactPerson: value.contactPerson,
          phone: value.phone,
          address: value.address,
          description: value.description,
        })
        .subscribe({
          next: (vendor) => {
            this.savingProfile.set(false);
            this.auth.applyVendor(vendor);
            this.notifications.success('Profil Bisnis Diperbarui', 'Data profil vendor/perusahaan berhasil diperbarui.');
          },
          error: (error: unknown) => this.handleProfileError(error),
        });
    } else {
      const value = this.bidderForm.getRawValue();
      this.bidderService
        .updateMine({
          companyName: value.companyName,
          contactPerson: value.contactPerson,
          phone: value.phone,
          address: value.address,
        })
        .subscribe({
          next: (bidder) => {
            this.savingProfile.set(false);
            this.auth.applyBidder(bidder);
            this.notifications.success('Profil Peserta Diperbarui', 'Data profil peserta berhasil diperbarui.');
          },
          error: (error: unknown) => this.handleProfileError(error),
        });
    }
  }

  savePassword(): void {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      setTimeout(() => focusAndShakeFirstInvalid(), 50);
      return;
    }

    this.savingPassword.set(true);
    this.passwordFailure.set(null);
    this.passwordSuccess.set(false);

    const value = this.passwordForm.getRawValue();

    this.auth
      .changePassword({
        currentPassword: value.currentPassword,
        newPassword: value.newPassword,
      })
      .subscribe({
        next: () => {
          this.savingPassword.set(false);
          this.passwordSuccess.set(true);
          this.passwordForm.reset();
          this.notifications.success('Kata Sandi Diperbarui', 'Kata sandi akun Anda berhasil diganti.');
        },
        error: (error: unknown) => {
          this.savingPassword.set(false);
          const failure = toApiFailure(error);
          this.passwordFailure.set(failure);

          if (failure.fieldErrors?.['currentPassword']) {
            this.currentPassword.setErrors({ server: failure.fieldErrors['currentPassword'] });
            this.currentPassword.markAsTouched();
          }
          setTimeout(() => focusAndShakeFirstInvalid(), 50);
        },
      });
  }

  private handleProfileError(error: unknown): void {
    this.savingProfile.set(false);
    const failure = toApiFailure(error);
    this.profileFailure.set(failure);
    this.notifications.fromFailure(failure, 'Gagal memperbarui profil');

    if (failure.fieldErrors) {
      for (const [field, message] of Object.entries(failure.fieldErrors)) {
        const control = this.isVendor()
          ? this.vendorForm.get(field)
          : this.bidderForm.get(field);
        if (control) {
          control.setErrors({ server: message });
          control.markAsTouched();
        }
      }
    }
    setTimeout(() => focusAndShakeFirstInvalid(), 50);
  }
}
