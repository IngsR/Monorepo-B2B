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
import { IconComponent } from '../shared/ui/icon.component';
import { BreadcrumbsComponent, Crumb } from '../shared/ui/pagination.component';
import { AlertComponent } from '../shared/ui/toast.component';

/**
 * Profile.
 *
 * Three related things live on one screen, because they all answer "who am I on
 * this platform":
 *
 *   1. The account itself (name and email) — shared by every role.
 *   2. The role profile — a vendor's company details or a bidder's details. This
 *      is the record ownership hangs off, so it is presented as a distinct card.
 *   3. Security — password change.
 *
 * Read-only fields are shown as read-only blocks: the account id, role and
 * status are platform-managed and are never editable inputs.
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
    IconComponent,
    BreadcrumbsComponent,
    AlertComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-breadcrumbs [items]="crumbs()" />

      <header class="page-head">
        <div class="page-head-text">
          <h1 class="page-title">My profile</h1>
          <p class="page-subtitle">
            Your account details, your {{ roleNoun() }} profile, and your sign-in credentials.
          </p>
        </div>
      </header>

      <div class="profile-grid">
        <!-- Account -->
        <section class="card">
          <div class="card-header">
            <h2 class="section-heading">Account</h2>
            @if (user(); as u) {
              <app-account-status-badge [status]="u.status" />
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
                  label="First name"
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
                  label="Last name"
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
                label="Email address"
                [value]="user()?.email ?? '—'"
                hint="Contact an administrator to change the email address on your account."
              />

              <div class="form-grid">
                <app-readonly-field
                  label="Role"
                  [value]="roleLabel()"
                  hint="Set by an administrator."
                />
                <app-readonly-field
                  label="Account ID"
                  [value]="user()?.id ?? '—'"
                  hint="Platform-assigned identifier."
                />
              </div>

              <div class="card-footer card-footer-flush">
                <app-button
                  type="submit"
                  label="Save changes"
                  variant="primary"
                  [loading]="savingAccount()"
                />
              </div>
            </form>
          </div>
        </section>

        <!-- Role profile -->
        @if (roleProfileForm(); as form) {
          <section class="card">
            <div class="card-header">
              <h2 class="section-heading">{{ roleProfileTitle() }}</h2>
              <span class="badge badge-brand">Owned by you</span>
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
                        label="Company name"
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
                        />
                      </app-form-field>
                    </div>

                    <app-form-field
                      label="Contact person"
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
                      label="Phone"
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
                        label="Address"
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

                    <div class="form-grid-full">
                      <app-form-field
                        label="Description"
                        [control]="description"
                        controlId="profile-description"
                      >
                        <textarea
                          id="profile-description"
                          class="form-textarea"
                          rows="3"
                          formControlName="description"
                        ></textarea>
                      </app-form-field>
                    </div>
                  </div>
                } @else {
                  <div class="form-grid">
                    <div class="form-grid-full">
                      <app-form-field
                        label="Company name"
                        [control]="companyName"
                        controlId="profile-company"
                      >
                        <input
                          id="profile-company"
                          type="text"
                          class="form-input"
                          formControlName="companyName"
                        />
                      </app-form-field>
                    </div>

                    <app-form-field
                      label="Contact person"
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
                      label="Phone"
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
                        label="Address"
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
                    label="{{ isVendor() ? 'Vendor' : 'Bidder' }} profile ID"
                    [value]="ownerId() ?? '—'"
                    hint="Ownership of your products and auctions is recorded against this identifier."
                  />
                  <app-readonly-field
                    label="Profile created"
                    [value]="profileCreated()"
                    hint="Platform-managed."
                  />
                </div>

                <div class="card-footer card-footer-flush">
                  <app-button
                    type="submit"
                    label="Save profile"
                    variant="primary"
                    [loading]="savingProfile()"
                  />
                </div>
              </form>
            </div>
          </section>
        }

        <!-- Security -->
        <section class="card" id="security">
          <div class="card-header">
            <h2 class="section-heading">Security</h2>
          </div>
          <div class="card-body">
            @if (passwordFailure(); as f) {
              <div class="notice-slot">
                <app-alert tone="danger" [title]="f.message" [message]="f.detail ?? ''" />
              </div>
            }

            @if (passwordSuccess()) {
              <div class="notice-slot">
                <app-alert tone="success" title="Password changed">
                  Your password has been updated. Use it the next time you sign in.
                </app-alert>
              </div>
            }

            <form [formGroup]="passwordForm" (ngSubmit)="savePassword()" novalidate>
              <app-form-field
                label="Current password"
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
                label="New password"
                [required]="true"
                [control]="newPassword"
                [errorMap]="newPasswordErrors"
                hint="At least 8 characters."
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
                label="Confirm new password"
                [required]="true"
                [control]="confirmPassword"
                errorText="Passwords do not match"
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
                  label="Change password"
                  variant="secondary"
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
        grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
        gap: var(--sp-5);
        align-items: start;
      }
      @media (max-width: 900px) {
        .profile-grid {
          grid-template-columns: 1fr;
        }
      }
      .notice-slot {
        margin-bottom: var(--sp-5);
      }
      .card-footer-flush {
        margin: var(--sp-5) calc(var(--sp-5) * -1) calc(var(--sp-5) * -1);
        border-radius: 0 0 var(--r-lg) var(--r-lg);
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
    { validators: [passwordsMatch] },
  );

  /** Vendor fields; unused in bidder mode but kept in one typed group. */
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

  readonly nameErrors = { required: 'This field is required' };
  readonly companyErrors = { required: 'Company name is required' };
  readonly contactErrors = { required: 'Contact person is required' };
  readonly phoneErrors = { required: 'A phone number is required' };
  readonly requiredPasswordErrors = { required: 'Current password is required' };
  readonly newPasswordErrors = {
    required: 'A new password is required',
    minlength: 'Password must be at least 8 characters',
  };

  readonly roleLabel = computed(() => {
    switch (this.auth.role()) {
      case UserRole.ADMIN:
        return 'Administrator';
      case UserRole.VENDOR:
        return 'Vendor';
      case UserRole.BIDDER:
        return 'Bidder';
      default:
        return '—';
    }
  });

  readonly roleNoun = computed(() => this.roleLabel().toLowerCase());

  readonly roleProfileTitle = computed(() =>
    this.isVendor() ? 'Vendor profile' : 'Bidder profile',
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

  readonly crumbs = computed<Crumb[]>(() => [{ label: 'My profile' }]);

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
        contactPerson: vendor.contactPerson,
        phone: vendor.phone,
        address: vendor.address ?? '',
        description: vendor.description ?? '',
      });
    }

    const bidder = this.auth.bidder();
    if (bidder) {
      this.bidderForm.patchValue({
        companyName: bidder.companyName ?? '',
        contactPerson: bidder.contactPerson,
        phone: bidder.phone,
        address: bidder.address ?? '',
      });
    }
  }

  saveAccount(): void {
    if (this.accountForm.invalid) {
      this.accountForm.markAllAsTouched();
      return;
    }

    this.savingAccount.set(true);
    this.accountFailure.set(null);

    const value = this.accountForm.getRawValue();

    this.auth.updateProfile({ firstName: value.firstName, lastName: value.lastName }).subscribe({
      next: (user) => {
        this.savingAccount.set(false);
        this.auth.applyUser(user);
        this.notifications.success('Profile updated', 'Your account details have been saved.');
      },
      error: (error: unknown) => {
        this.savingAccount.set(false);
        const failure = toApiFailure(error);
        this.accountFailure.set(failure);
        this.notifications.fromFailure(failure, 'Could not update profile');
      },
    });
  }

  saveRoleProfile(): void {
    const form = this.roleProfileForm();
    if (!form) return;

    if (form.invalid) {
      form.markAllAsTouched();
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
            this.notifications.success('Vendor profile updated');
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
            this.notifications.success('Bidder profile updated');
          },
          error: (error: unknown) => this.handleProfileError(error),
        });
    }
  }

  private handleProfileError(error: unknown): void {
    this.savingProfile.set(false);
    const failure = toApiFailure(error);
    this.profileFailure.set(failure);
    this.notifications.fromFailure(failure, 'Could not update profile');
  }

  savePassword(): void {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    this.savingPassword.set(true);
    this.passwordFailure.set(null);
    this.passwordSuccess.set(false);

    const { currentPassword, newPassword } = this.passwordForm.getRawValue();

    this.auth.changePassword({ currentPassword, newPassword }).subscribe({
      next: () => {
        this.savingPassword.set(false);
        this.passwordSuccess.set(true);
        this.passwordForm.reset();
        this.notifications.success('Password changed');
      },
      error: (error: unknown) => {
        this.savingPassword.set(false);
        const failure = toApiFailure(error);
        this.passwordFailure.set(failure);

        if (failure.fieldErrors?.['currentPassword']) {
          this.currentPassword.setErrors({ server: true });
          this.currentPassword.markAsTouched();
        }
        if (failure.fieldErrors?.['newPassword']) {
          this.newPassword.setErrors({ server: true });
          this.newPassword.markAsTouched();
        }
      },
    });
  }
}

function passwordsMatch(group: import('@angular/forms').AbstractControl) {
  const password = group.get('newPassword')?.value;
  const confirm = group.get('confirmPassword')?.value;
  if (!password || !confirm) return null;
  return password === confirm ? null : { mismatch: true };
}
