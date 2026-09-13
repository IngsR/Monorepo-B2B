import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { ApiFailure, toApiFailure } from '../../../core/domain/api-failure';
import { AuctionStatus } from '../../../core/domain/enums';
import {
  formatAmount,
  isoToLocalInput,
  localInputToIso,
  parseAmount,
} from '../../../core/domain/format';
import { Auction, CreateAuctionPayload, Paginated, Product } from '../../../core/domain/models';
import { AuctionService } from '../../../core/services/auction.service';
import { ProductService } from '../../../core/services/catalogue.service';
import { NotificationService } from '../../../core/services/notification.service';
import { AuthService } from '../../../core/services/session.service';
import { AsyncResource } from '../../../core/state/async-resource';
import { ButtonComponent } from '../../../shared/ui/button.component';
import {
  FormFieldComponent,
  ReadonlyFieldComponent,
} from '../../../shared/ui/form-field.component';
import { MatIconComponent } from '../../../shared/ui/mat-icon.component';
import { BreadcrumbsComponent, Crumb } from '../../../shared/ui/pagination.component';
import { ErrorStateComponent } from '../../../shared/ui/state-block.component';
import { AlertComponent } from '../../../shared/ui/toast.component';
import { focusAndShakeFirstInvalid } from '../../../shared/ui/form-utils';

/**
 * Create / edit auction.
 *
 * The form contains only what the client is allowed to supply: the product, the
 * starting price, the bid increment and the schedule.
 *
 * Deliberately absent, because the server derives them:
 *   vendorId      — taken from the authenticated vendor identity
 *   currentPrice  — derived from the highest valid bid (equals startingPrice until one exists)
 *   bidderId      — resolved from the JWT when a bid is placed
 *   winner        — derived from the highest valid bid at the end time; not a stored entity
 *
 * Every constraint the backend enforces is stated in the field hint *and*
 * validated client-side, so a rejection is rare and never surprising.
 */
@Component({
  selector: 'app-auction-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    AlertComponent,
    BreadcrumbsComponent,
    ButtonComponent,
    FormFieldComponent,
    ReadonlyFieldComponent,
    MatIconComponent,
    ErrorStateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-breadcrumbs [items]="crumbs()" />

      <header class="page-head">
        <div class="page-head-text">
          <h1 class="page-title">{{ isEdit() ? 'Edit Lelang' : 'Buat Lot Lelang Baru' }}</h1>
          <p class="page-subtitle">
            {{
              isEdit()
                ? 'Ketentuan lelang dapat diubah selama statusnya DRAFT. Setelah lelang Aktif atau Selesai, ketentuan terkunci.'
                : 'Lelang baru dibuat dengan status DRAFT. Jadwalkan lelang setelah ketentuan siap dan tentukan periode waktu penawaran.'
            }}
          </p>
        </div>
        <div class="page-actions">
          <a class="btn btn-secondary" routerLink="/vendor/auctions">
            <mat-icon fontIcon="chevron_left" [size]="16" />
            <span>Kembali ke Lelang</span>
          </a>
        </div>
      </header>

      @if (isEdit() && existing.hasError()) {
        <div class="card">
          @if (existing.error(); as failure) {
            <app-error-state
              [failure]="failure"
              [retrying]="existing.isLoading()"
              (retry)="loadAuction()"
            />
          }
        </div>
      } @else {
        @if (failure(); as f) {
          <app-alert tone="danger" [title]="f.message">{{ f.detail }}</app-alert>
        }

        @if (editingLocked()) {
          <app-alert tone="warning" title="Lelang ini tidak dapat diedit lagi">
            Ketentuan lelang terkunci setelah lelang Aktif atau Selesai. Kelola statusnya melalui halaman Manajemen Lelang.
          </app-alert>
        }

        <form [formGroup]="form" (ngSubmit)="submit()" novalidate class="card">
          <!-- 1. What is being auctioned -->
          <section class="form-section">
            <div class="form-section-head">
              <span class="form-section-index">1</span>
              <div>
                <h2 class="form-section-title">Produk / Lot</h2>
                <p class="form-section-desc">
                  Pilih produk katalog Anda yang akan dilelang.
                </p>
              </div>
            </div>

            @if (productList().length === 0 && !products.isLoading()) {
              <app-alert tone="warning" title="Belum ada produk tersedia">
                Anda memerlukan minimal satu produk sebelum membuat lelang.
                <a routerLink="/vendor/products/new">Tambah produk baru terlebih dahulu.</a>
              </app-alert>
            } @else {
              <app-form-field
                label="Produk / Lot"
                [required]="true"
                [control]="productId"
                [errorMap]="productErrors"
                hint="Hanya produk terdaftar di bawah akun vendor Anda yang ditampilkan."
                controlId="auction-product"
              >
                <select
                  id="auction-product"
                  class="form-select"
                  formControlName="productId"
                  [disabled]="editingLocked()"
                >
                  <option value="" disabled>Pilih produk untuk dilelang</option>
                  @for (product of productList(); track product.id) {
                    <option [value]="product.id">{{ product.code }} — {{ product.name }}</option>
                  }
                </select>
              </app-form-field>
            }
          </section>

          <!-- 2. Pricing -->
          <section class="form-section">
            <div class="form-section-head">
              <span class="form-section-index">2</span>
              <div>
                <h2 class="form-section-title">Penetapan Harga</h2>
                <p class="form-section-desc">
                  Harga awal adalah nilai pembuka lelang. Kelipatan tawaran adalah kenaikan nominal minimum setiap penawaran baru.
                </p>
              </div>
            </div>

            <div class="form-grid">
              <app-form-field
                label="Harga Awal"
                [required]="true"
                [control]="startingPrice"
                [errorMap]="startingPriceErrors"
                hint="Harga minimum saat penawaran dimulai."
                controlId="auction-starting-price"
              >
                <div class="input-prefix">
                  <span class="input-prefix-symbol" aria-hidden="true">Rp</span>
                  <input
                    id="auction-starting-price"
                    type="text"
                    inputmode="numeric"
                    class="form-input currency-field"
                    [value]="startingPriceDisplay()"
                    (input)="onCurrencyInput($event, 'startingPrice')"
                    placeholder="0"
                    [disabled]="editingLocked()"
                    autocomplete="off"
                  />
                </div>
              </app-form-field>

              <app-form-field
                label="Kelipatan Tawaran"
                [required]="true"
                [control]="bidIncrement"
                [errorMap]="bidIncrementErrors"
                hint="Kenaikan minimum untuk setiap tawaran berikutnya."
                controlId="auction-bid-increment"
              >
                <div class="input-prefix">
                  <span class="input-prefix-symbol" aria-hidden="true">Rp</span>
                  <input
                    id="auction-bid-increment"
                    type="text"
                    inputmode="numeric"
                    class="form-input currency-field"
                    [value]="bidIncrementDisplay()"
                    (input)="onCurrencyInput($event, 'bidIncrement')"
                    placeholder="0"
                    [disabled]="editingLocked()"
                    autocomplete="off"
                  />
                </div>
              </app-form-field>

              <!-- Derived, never submitted -->
              <div class="form-grid-full">
                <app-readonly-field
                  label="Tawaran Pertama Minimum"
                  [value]="firstBidLabel()"
                  hint="Harga awal ditambah kelipatan tawaran. Penawar tidak dapat menawar di bawah nilai ini."
                />
              </div>
            </div>
          </section>

          <!-- 3. Schedule -->
          <section class="form-section">
            <div class="form-section-head">
              <span class="form-section-index">3</span>
              <div>
                <h2 class="form-section-title">Jadwal Pelaksanaan</h2>
                <p class="form-section-desc">
                  Waktu selesai bersifat mutlak untuk penawaran — penawaran tidak lagi diterima setelah waktu tersebut berlalu.
                </p>
              </div>
            </div>

            <div class="form-grid">
              <app-form-field
                label="Waktu Mulai"
                [required]="true"
                [control]="startTime"
                [errorMap]="startTimeErrors"
                hint="Waktu lokal perangkat Anda."
                controlId="auction-start-time"
              >
                <input
                  id="auction-start-time"
                  type="datetime-local"
                  class="form-input"
                  formControlName="startTime"
                  [disabled]="editingLocked()"
                />
              </app-form-field>

              <app-form-field
                label="Waktu Selesai"
                [required]="true"
                [control]="endTime"
                [errorMap]="endTimeErrors"
                hint="Harus lebih lambat dari waktu mulai."
                controlId="auction-end-time"
              >
                <input
                  id="auction-end-time"
                  type="datetime-local"
                  class="form-input"
                  formControlName="endTime"
                  [disabled]="editingLocked()"
                />
              </app-form-field>
            </div>

            @if (durationLabel(); as duration) {
              <p class="duration-note">
                <mat-icon fontIcon="schedule" [size]="16" />
                <span
                  >Periode penawaran dibuka selama <strong>{{ duration }}</strong
                  >.</span
                >
              </p>
            }
          </section>

          <!-- Server-managed values: shown, not editable -->
          <section class="form-section">
            <div class="form-section-head">
              <span class="form-section-index">4</span>
              <div>
                <h2 class="form-section-title">Parameter Sistem</h2>
                <p class="form-section-desc">
                  Parameter ini dikelola secara otomatis oleh platform sebagai referensi dan tidak dapat diubah manual.
                </p>
              </div>
            </div>

            <div class="form-grid">
              <app-readonly-field
                label="Vendor Penyelenggara"
                [value]="vendorLabel()"
                hint="Ditetapkan otomatis sesuai akun vendor Anda yang terautentikasi."
              />
              <app-readonly-field
                label="Harga Saat Ini"
                [value]="currentPriceLabel()"
                hint="Sama dengan harga awal sampai ada tawaran sah pertama."
              />
              <app-readonly-field
                label="Status Awal"
                [value]="isEdit() ? (existing.data()?.status ?? '—') : 'DRAFT'"
                hint="Lelang baru selalu dimulai dengan status DRAFT."
              />
              <app-readonly-field
                label="Pemenang Lelang"
                [value]="'Dihitung Otomatis'"
                hint="Pemenang ditentukan dari penawar tertinggi yang sah saat periode lelang berakhir."
              />
            </div>
          </section>

          <div class="card-footer">
            <a class="btn btn-secondary" routerLink="/vendor/auctions">
              <mat-icon fontIcon="close" [size]="16" />
              <span>Batal</span>
            </a>
            <app-button
              type="submit"
              [label]="isEdit() ? 'Simpan Perubahan' : 'Buat Lot Lelang (Draf)'"
              variant="primary"
              [loading]="saving()"
              [disabled]="editingLocked() || productList().length === 0"
            />
          </div>
        </form>
      }
    </div>
  `,
  styles: [
    `
      .duration-note {
        display: flex;
        align-items: center;
        gap: var(--sp-2);
        font-size: var(--fs-sm);
        color: var(--c-text-secondary);
      }
    `,
  ],
})
export class AuctionFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auctionService = inject(AuctionService);
  private readonly productService = inject(ProductService);
  private readonly notifications = inject(NotificationService);
  private readonly auth = inject(AuthService);

  readonly existing = new AsyncResource<Auction>();
  readonly products = new AsyncResource<Paginated<Product>>();
  readonly saving = signal(false);
  readonly failure = signal<ApiFailure | null>(null);

  readonly auctionId = this.route.snapshot.paramMap.get('id');
  readonly isEdit = computed(() => !!this.auctionId);

  readonly form = this.fb.nonNullable.group({
    productId: ['', [Validators.required]],
    startingPrice: [null as number | null, [Validators.required, Validators.min(0.01)]],
    bidIncrement: [null as number | null, [Validators.required, Validators.min(0.01)]],
    startTime: ['', [Validators.required]],
    endTime: ['', [Validators.required]],
  });

  get productId() {
    return this.form.controls.productId;
  }
  get startingPrice() {
    return this.form.controls.startingPrice;
  }
  get bidIncrement() {
    return this.form.controls.bidIncrement;
  }
  get startTime() {
    return this.form.controls.startTime;
  }
  get endTime() {
    return this.form.controls.endTime;
  }

  readonly productErrors = { required: 'Pilih produk untuk dilelang' };

  readonly startingPriceErrors = {
    required: 'Harga awal wajib diisi',
    min: 'Harga awal harus lebih besar dari nol',
  };

  readonly bidIncrementErrors = {
    required: 'Kelipatan tawaran wajib diisi',
    min: 'Kelipatan tawaran harus lebih besar dari nol',
  };

  readonly startTimeErrors = { required: 'Waktu mulai wajib diisi' };
  readonly endTimeErrors = {
    required: 'Waktu selesai wajib diisi',
    order: 'Waktu selesai harus lebih lambat dari waktu mulai',
  };

  readonly productList = computed(() => this.products.data()?.items ?? []);
  readonly vendorLabel = computed(() => this.auth.vendor()?.companyName ?? '—');

  readonly startingPriceDisplay = signal<string>('');
  readonly bidIncrementDisplay = signal<string>('');

  /** Active and ended auctions are read-only for terms. */
  readonly editingLocked = computed(() => {
    const status = this.existing.data()?.status;
    if (!status) return false;
    return (
      status === AuctionStatus.ACTIVE ||
      status === AuctionStatus.ENDED ||
      status === AuctionStatus.CANCELLED
    );
  });

  readonly firstBidLabel = computed(() => {
    const start = this.startingPrice.value;
    const increment = this.bidIncrement.value;
    if (start === null || increment === null) return '—';
    return formatAmount(start + increment);
  });

  readonly currentPriceLabel = computed(() => {
    const existing = this.existing.data();
    if (existing) return formatAmount(existing.currentPrice);
    const start = this.startingPrice.value;
    return start === null ? '—' : formatAmount(start);
  });

  readonly durationLabel = computed(() => {
    const start = this.startTime.value;
    const end = this.endTime.value;
    if (!start || !end) return '';

    const diff = new Date(end).getTime() - new Date(start).getTime();
    if (!Number.isFinite(diff) || diff <= 0) return '';

    const hours = Math.floor(diff / 3_600_000);
    const days = Math.floor(hours / 24);
    const remainder = hours % 24;

    if (days > 0)
      return `${days} hari${remainder ? ` ${remainder} jam` : ''}`;
    const minutes = Math.round((diff % 3_600_000) / 60_000);
    return hours > 0 ? `${hours} jam ${minutes} menit` : `${minutes} menit`;
  });

  readonly crumbs = computed<Crumb[]>(() => [
    { label: 'Lelang Saya', link: '/vendor/auctions' },
    { label: this.isEdit() ? 'Edit Lelang' : 'Buat Lelang' },
  ]);

  constructor() {
    this.loadProducts();
    if (this.isEdit()) this.loadAuction();
    this.watchSchedule();
  }

  onCurrencyInput(event: Event, controlName: 'startingPrice' | 'bidIncrement'): void {
    const input = event.target as HTMLInputElement;
    const digits = input.value.replace(/\D/g, '');

    if (!digits) {
      if (controlName === 'startingPrice') {
        this.startingPriceDisplay.set('');
        this.startingPrice.setValue(null);
      } else {
        this.bidIncrementDisplay.set('');
        this.bidIncrement.setValue(null);
      }
      input.value = '';
      return;
    }

    const num = parseInt(digits, 10);
    const formatted = new Intl.NumberFormat('id-ID').format(num);
    input.value = formatted;

    if (controlName === 'startingPrice') {
      this.startingPriceDisplay.set(formatted);
      this.startingPrice.setValue(num);
      this.startingPrice.markAsDirty();
    } else {
      this.bidIncrementDisplay.set(formatted);
      this.bidIncrement.setValue(num);
      this.bidIncrement.markAsDirty();
    }
  }

  /** Cross-field check so the end-before-start error appears while typing. */
  private watchSchedule(): void {
    this.form.valueChanges.subscribe(() => {
      const start = this.startTime.value;
      const end = this.endTime.value;

      if (start && end && new Date(end).getTime() <= new Date(start).getTime()) {
        this.endTime.setErrors({ ...(this.endTime.errors ?? {}), order: true });
      } else if (this.endTime.errors?.['order']) {
        const { order, ...rest } = this.endTime.errors;
        void order;
        this.endTime.setErrors(Object.keys(rest).length ? rest : null);
      }
    });
  }

  private loadProducts(): void {
    this.products.load(this.productService.listMine({ limit: 100 }));
  }

  loadAuction(): void {
    if (!this.auctionId) return;

    this.auctionService.getById(this.auctionId).subscribe({
      next: (auction) => {
        this.existing.set(auction);
        this.form.patchValue({
          productId: auction.productId,
          startingPrice: auction.startingPrice,
          bidIncrement: auction.bidIncrement,
          startTime: isoToLocalInput(auction.startTime || (auction as any).startAt || ''),
          endTime: isoToLocalInput(auction.endTime || (auction as any).endAt || ''),
        });
        if (auction.startingPrice) {
          this.startingPriceDisplay.set(new Intl.NumberFormat('id-ID').format(auction.startingPrice));
        }
        if (auction.bidIncrement) {
          this.bidIncrementDisplay.set(new Intl.NumberFormat('id-ID').format(auction.bidIncrement));
        }
      },
      error: (error: unknown) => {
        this.existing.load(new Observable<Auction>((subscriber) => subscriber.error(error)));
      },
    });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      setTimeout(() => focusAndShakeFirstInvalid(), 50);
      return;
    }

    const raw = this.form.getRawValue();
    const startIso = localInputToIso(raw.startTime);
    const endIso = localInputToIso(raw.endTime);

    // Final client-side guard before the server sees the payload.
    if (new Date(endIso).getTime() <= new Date(startIso).getTime()) {
      this.endTime.setErrors({ order: true });
      this.endTime.markAsTouched();
      setTimeout(() => focusAndShakeFirstInvalid(), 50);
      return;
    }

    const payload: CreateAuctionPayload = {
      productId: raw.productId,
      startingPrice: parseAmount(raw.startingPrice) ?? 0,
      bidIncrement: parseAmount(raw.bidIncrement) ?? 0,
      startTime: startIso,
      endTime: endIso,
      startAt: startIso,
      endAt: endIso,
    };

    this.saving.set(true);
    this.failure.set(null);

    const request$ = this.isEdit()
      ? this.auctionService.update(this.auctionId!, payload)
      : this.auctionService.create(payload);

    request$.subscribe({
      next: (auction) => {
        this.saving.set(false);
        this.notifications.success(
          this.isEdit() ? 'Lelang berhasil diperbarui' : 'Draft lelang berhasil dibuat',
          this.isEdit()
            ? 'Perubahan ketentuan lelang Anda telah disimpan.'
            : 'Lelang disimpan sebagai Draft. Jadwalkan lelang dari halaman manajemen saat sudah siap.',
        );
        void this.router.navigate(['/vendor/auctions', auction.id]);
      },
      error: (error: unknown) => {
        this.saving.set(false);
        const failure = toApiFailure(error);
        this.failure.set(failure);

        if (failure.fieldErrors) {
          const map: Record<string, { setErrors: (e: object) => void; markAsTouched: () => void }> =
            {
              productId: this.productId,
              startingPrice: this.startingPrice,
              bidIncrement: this.bidIncrement,
              startTime: this.startTime,
              endTime: this.endTime,
              startAt: this.startTime,
              endAt: this.endTime,
            };
          for (const [field, message] of Object.entries(failure.fieldErrors)) {
            const control = map[field];
            if (control) {
              control.setErrors({ server: message });
              control.markAsTouched();
            }
          }
        }
        setTimeout(() => focusAndShakeFirstInvalid(), 50);
      },
    });
  }
}
