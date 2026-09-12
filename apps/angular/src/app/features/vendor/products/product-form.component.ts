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
          <h1 class="page-title">{{ isEdit() ? 'Edit product' : 'Create product' }}</h1>
          <p class="page-subtitle">
            A product is a catalogue record — the thing auctions are created from. It does not hold
            a price; pricing lives on the auction.
          </p>
        </div>
        <div class="page-actions">
          <a class="btn btn-secondary" routerLink="/vendor/products">
            <app-icon name="chevron-left" [size]="15" />
            Back to products
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
                <h2 class="form-section-title">Identification</h2>
                <p class="form-section-desc">
                  A code your team recognises and the name bidders will see on the auction.
                </p>
              </div>
            </div>

            <div class="form-grid">
              <app-form-field
                label="Product code"
                [required]="true"
                [control]="code"
                [errorMap]="codeErrors"
                hint="Unique across the platform. Letters, digits and dashes."
                controlId="product-code"
              >
                <input
                  id="product-code"
                  type="text"
                  class="form-input"
                  formControlName="code"
                  placeholder="e.g. HMS-2401"
                  autocomplete="off"
                />
              </app-form-field>

              <app-form-field
                label="Category"
                [required]="true"
                [control]="categoryId"
                [errorMap]="categoryErrors"
                hint="Categories are managed by administrators."
                controlId="product-category"
              >
                <select id="product-category" class="form-select" formControlName="categoryId">
                  <option value="" disabled>Select a category</option>
                  @for (category of categories(); track category.id) {
                    <option [value]="category.id">{{ category.name }}</option>
                  }
                </select>
              </app-form-field>

              <div class="form-grid-full">
                <app-form-field
                  label="Product name"
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
                    placeholder="e.g. HMS 1&2 Heavy Melting Steel Scrap"
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
                <h2 class="form-section-title">Description</h2>
                <p class="form-section-desc">
                  Optional. Describe grade, condition, handling requirements or documentation. This
                  is shown to bidders on the auction page.
                </p>
              </div>
            </div>

            <app-form-field
              label="Description"
              [control]="description"
              controlId="product-description"
            >
              <textarea
                id="product-description"
                class="form-textarea"
                formControlName="description"
                rows="5"
                placeholder="Material grade, contamination tolerances, inspection arrangements, loading terms…"
              ></textarea>
            </app-form-field>
          </section>

          <!-- Ownership is server-determined and displayed read-only -->
          @if (isEdit() && existing.data(); as product) {
            <section class="form-section">
              <div class="form-section-head">
                <span class="form-section-index">3</span>
                <div>
                  <h2 class="form-section-title">Record ownership</h2>
                  <p class="form-section-desc">
                    These values are set by the platform and cannot be edited.
                  </p>
                </div>
              </div>

              <div class="form-grid">
                <app-readonly-field
                  label="Owning vendor"
                  [value]="vendorLabel()"
                  hint="Taken from your authenticated vendor account."
                />
                <app-readonly-field
                  label="Product ID"
                  [value]="product.id"
                  hint="Assigned by the platform."
                />
              </div>
            </section>
          }

          <div class="card-footer">
            <a class="btn btn-secondary" routerLink="/vendor/products">Cancel</a>
            <app-button
              type="submit"
              [label]="isEdit() ? 'Save changes' : 'Create product'"
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
    required: 'Product code is required',
    maxlength: 'Product code is too long (maximum 64 characters)',
  };

  readonly nameErrors = {
    required: 'Product name is required',
    maxlength: 'Product name is too long (maximum 200 characters)',
  };

  readonly categoryErrors = {
    required: 'Select a category',
  };

  readonly crumbs = computed<Crumb[]>(() => [
    { label: 'My products', link: '/vendor/products' },
    { label: this.isEdit() ? 'Edit product' : 'Create product' },
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
          this.isEdit() ? 'Product updated' : 'Product created',
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
      },
    });
  }
}
