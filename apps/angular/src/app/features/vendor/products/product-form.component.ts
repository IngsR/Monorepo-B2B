import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { ApiFailure, toApiFailure } from '../../../core/domain/api-failure';
import { Category, CreateProductPayload, Product } from '../../../core/domain/models';
import { CategoryService, ProductService } from '../../../core/services/catalogue.service';
import { NotificationService } from '../../../core/services/notification.service';
import { AuthService } from '../../../core/services/session.service';
import { AsyncResource } from '../../../core/state/async-resource';
import { ButtonComponent } from '../../../shared/ui/button.component';
import {
  FormFieldComponent,
  ReadonlyFieldComponent,
} from '../../../shared/ui/form-field.component';
import { IconComponent } from '../../../shared/ui/icon.component';
import { BreadcrumbsComponent, Crumb } from '../../../shared/ui/pagination.component';
import { ErrorStateComponent } from '../../../shared/ui/state-block.component';
import { AlertComponent } from '../../../shared/ui/toast.component';
import { focusAndShakeFirstInvalid } from '../../../shared/ui/form-utils';

/**
 * Create / edit product.
 *
 * One component serves both modes because the field set is identical; only the
 * title, submit label and the presence of a server-backed record differ.
 *
 * The ownership field is never rendered as an input: the vendor is taken from
 * the authenticated identity by the backend. Where it helps the user confirm
 * what they are editing, it is shown as a read-only block.
 */
@Component({
  selector: 'app-product-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    AlertComponent,
    BreadcrumbsComponent,
    ButtonComponent,
    FormFieldComponent,
    ReadonlyFieldComponent,
    IconComponent,
    ErrorStateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-breadcrumbs [items]="crumbs()" />

      <header class="page-head">
        <div class="page-head-text">
          <h1 class="page-title">{{ isEdit() ? 'Edit Produk' : 'Tambah Produk Baru' }}</h1>
          <p class="page-subtitle">
            Produk adalah data katalog yang menjadi dasar pembuatan lelang. Harga dan jadwal ditentukan saat membuat lelang.
          </p>
        </div>
        <div class="page-actions">
          <a class="btn btn-secondary" routerLink="/vendor/products">
            <app-icon name="chevron-left" [size]="15" />
            Kembali ke Produk
          </a>
        </div>
      </header>

      @if (isEdit() && existing.hasError()) {
        <div class="card">
          @if (existing.error(); as failure) {
            <app-error-state
              [failure]="failure"
              [retrying]="existing.isLoading()"
              (retry)="loadProduct()"
            />
          }
        </div>
      } @else {
        @if (failure(); as f) {
          <app-alert tone="danger" [title]="f.message">{{ f.detail }}</app-alert>
        }

        <form [formGroup]="form" (ngSubmit)="submit()" novalidate class="card">
          <section class="form-section">
            <div class="form-section-head">
              <span class="form-section-index">1</span>
              <div>
                <h2 class="form-section-title">Identifikasi</h2>
                <p class="form-section-desc">
                  Kode internal tim Anda dan nama lot yang akan dilihat peserta lelang.
                </p>
              </div>
            </div>

            <div class="form-grid">
              <app-form-field
                label="Kode Produk"
                [required]="true"
                [control]="code"
                [errorMap]="codeErrors"
                hint="Unik di seluruh platform. Huruf, angka, dan tanda hubung (-)."
                controlId="product-code"
              >
                <input
                  id="product-code"
                  type="text"
                  class="form-input"
                  formControlName="code"
                  placeholder="contoh: HMS-2401"
                  autocomplete="off"
                />
              </app-form-field>

              <app-form-field
                label="Kategori"
                [required]="true"
                [control]="categoryId"
                [errorMap]="categoryErrors"
                hint="Kategori resmi yang terdaftar di platform."
                controlId="product-category"
              >
                <select id="product-category" class="form-select" formControlName="categoryId">
                  <option value="" disabled>Pilih kategori produk</option>
                  @for (category of categories(); track category.id) {
                    <option [value]="category.id">{{ category.name }}</option>
                  }
                </select>
              </app-form-field>

              <div class="form-grid-full">
                <app-form-field
                  label="Nama Produk / Lot"
                  [required]="true"
                  [control]="name"
                  [errorMap]="nameErrors"
                  controlId="product-name"
                >
                  <input
                    id="product-name"
                    type="text"
                    class="form-input"
                    formControlName="name"
                    placeholder="contoh: Scrap Besi Baja HMS 1&2"
                    autocomplete="off"
                  />
                </app-form-field>
              </div>
            </div>
          </section>

          <section class="form-section">
            <div class="form-section-head">
              <span class="form-section-index">2</span>
              <div>
                <h2 class="form-section-title">Deskripsi & Spesifikasi</h2>
                <p class="form-section-desc">
                  Opsional. Jelaskan mutu, kondisi material, ketentuan inspeksi, atau penanganan pengiriman.
                </p>
              </div>
            </div>

            <app-form-field
              label="Deskripsi Lengkap"
              [control]="description"
              controlId="product-description"
            >
              <textarea
                id="product-description"
                class="form-textarea"
                formControlName="description"
                rows="5"
                placeholder="Spesifikasi mutu material, toleransi kontaminasi, jadwal survei/inspeksi, ketentuan pemuatan..."
              ></textarea>
            </app-form-field>
          </section>

          <!-- Ownership is server-determined and displayed read-only -->
          @if (isEdit() && existing.data(); as product) {
            <section class="form-section">
              <div class="form-section-head">
                <span class="form-section-index">3</span>
                <div>
                  <h2 class="form-section-title">Informasi Sistem</h2>
                  <p class="form-section-desc">
                    Nilai ini ditetapkan oleh platform dan tidak dapat diubah langsung.
                  </p>
                </div>
              </div>

              <div class="form-grid">
                <app-readonly-field
                  label="Vendor Pemilik"
                  [value]="vendorLabel()"
                  hint="Sesuai akun vendor Anda yang terautentikasi."
                />
                <app-readonly-field
                  label="ID Produk"
                  [value]="product.id"
                  hint="Ditetapkan otomatis oleh platform."
                />
              </div>
            </section>
          }

          <div class="card-footer">
            <a class="btn btn-secondary" routerLink="/vendor/products">
              <app-icon name="close" [size]="15" />
              Batal
            </a>
            <app-button
              type="submit"
              [label]="isEdit() ? 'Simpan Perubahan' : 'Buat Produk'"
              variant="primary"
              [loading]="saving()"
            />
          </div>
        </form>
      }
    </div>
  `,
})
export class ProductFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly productService = inject(ProductService);
  private readonly categoryService = inject(CategoryService);
  private readonly notifications = inject(NotificationService);
  private readonly auth = inject(AuthService);

  readonly existing = new AsyncResource<Product>();
  readonly categories = signal<Category[]>([]);
  readonly saving = signal(false);
  readonly failure = signal<ApiFailure | null>(null);

  readonly productId = this.route.snapshot.paramMap.get('id');
  readonly isEdit = computed(() => !!this.productId);

  readonly form = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.maxLength(64)]],
    name: ['', [Validators.required, Validators.maxLength(200)]],
    description: [''],
    categoryId: ['', [Validators.required]],
  });

  get code() {
    return this.form.controls.code;
  }
  get name() {
    return this.form.controls.name;
  }
  get description() {
    return this.form.controls.description;
  }
  get categoryId() {
    return this.form.controls.categoryId;
  }

  readonly codeErrors = {
    required: 'Kode produk wajib diisi',
    maxlength: 'Kode produk terlalu panjang (maksimal 64 karakter)',
  };

  readonly nameErrors = {
    required: 'Nama produk wajib diisi',
    maxlength: 'Nama produk terlalu panjang (maksimal 200 karakter)',
  };

  readonly categoryErrors = {
    required: 'Pilih salah satu kategori',
  };

  readonly crumbs = computed<Crumb[]>(() => [
    { label: 'Produk Saya', link: '/vendor/products' },
    { label: this.isEdit() ? 'Edit Produk' : 'Tambah Produk' },
  ]);

  /** Read-only display of the vendor that owns this record. */
  readonly vendorLabel = computed(() => this.auth.vendor()?.companyName ?? '—');

  constructor() {
    this.loadCategories();
    if (this.isEdit()) this.loadProduct();
  }

  private loadCategories(): void {
    this.categoryService.list({ limit: 100 }).subscribe({
      next: (result) => this.categories.set(result.items),
      error: () => this.categories.set([]),
    });
  }

  /** Loads the record being edited and seeds the form once it arrives. */
  loadProduct(): void {
    if (!this.productId) return;

    this.productService.getById(this.productId).subscribe({
      next: (product) => {
        this.existing.set(product);
        this.form.patchValue({
          code: product.code,
          name: product.name,
          description: product.description ?? '',
          categoryId: product.categoryId,
        });
      },
      error: (error: unknown) => {
        // Surface the failure through the resource so the error state renders.
        this.existing.load(new Observable<Product>((subscriber) => subscriber.error(error)));
      },
    });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      setTimeout(() => focusAndShakeFirstInvalid(), 50);
      return;
    }

    this.saving.set(true);
    this.failure.set(null);

    const raw = this.form.getRawValue();
    const payload: CreateProductPayload = {
      code: raw.code.trim(),
      name: raw.name.trim(),
      description: raw.description.trim() || undefined,
      categoryId: raw.categoryId,
    };

    const request$ = this.isEdit()
      ? this.productService.update(this.productId!, payload)
      : this.productService.create(payload);

    request$.subscribe({
      next: (product) => {
        this.saving.set(false);
        this.notifications.success(
          this.isEdit() ? 'Produk diperbarui' : 'Produk berhasil dibuat',
          `${product.code} — ${product.name}`,
        );
        void this.router.navigate(['/vendor/products']);
      },
      error: (error: unknown) => {
        this.saving.set(false);
        const failure = toApiFailure(error);
        this.failure.set(failure);

        // Map field errors from the API onto the form controls.
        if (failure.fieldErrors) {
          if (failure.fieldErrors['code']) {
            this.code.setErrors({ server: true });
            this.code.markAsTouched();
          }
          if (failure.fieldErrors['name']) {
            this.name.setErrors({ server: true });
            this.name.markAsTouched();
          }
          if (failure.fieldErrors['categoryId']) {
            this.categoryId.setErrors({ server: true });
            this.categoryId.markAsTouched();
          }
        }
        setTimeout(() => focusAndShakeFirstInvalid(), 50);
      },
    });
  }
}
