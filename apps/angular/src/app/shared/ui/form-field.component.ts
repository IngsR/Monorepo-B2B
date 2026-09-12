import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { IconComponent } from './icon.component';

/**
 * Form field wrapper.
 *
 * Owns the label, required marker, hint and error presentation so every form in
 * the application renders validation identically. Errors are only shown once the
 * control has been touched, so a pristine form never greets the user with red.
 */
@Component({
  selector: 'app-form-field',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="form-group" [class.has-error]="showError()">
      @if (label()) {
        <label class="form-label" [attr.for]="controlId()">
          <span>{{ label() }}</span>
          @if (required()) {
            <span class="required-marker" aria-hidden="true">*</span>
            <span class="sr-only">required</span>
          }
        </label>
      }

      <ng-content />

      @if (showError()) {
        <p class="form-error" [attr.id]="controlId() + '-error'" role="alert">
          <app-icon name="alert" [size]="13" />
          <span>{{ errorMessage() }}</span>
        </p>
      } @else if (hint()) {
        <p class="form-hint" [attr.id]="controlId() + '-hint'">{{ hint() }}</p>
      }
    </div>
  `,
  imports: [IconComponent],
})
export class FormFieldComponent {
  readonly label = input<string>('');
  readonly hint = input<string>('');
  readonly required = input(false);
  readonly control = input<FormControl | null>(null);
  /** Static message used when the control has no specific error mapping. */
  readonly errorText = input<string>('');
  /** Maps Angular validation keys to human messages for this field. */
  readonly errorMap = input<Record<string, string>>({});
  readonly controlId = input<string>(`field-${Math.random().toString(36).slice(2, 9)}`);

  readonly showError = computed(() => {
    const control = this.control();
    return !!control && control.invalid && (control.touched || control.dirty);
  });

  readonly errorMessage = computed(() => {
    const control = this.control();
    if (!control?.errors) return this.errorText();

    const map = this.errorMap();
    for (const key of Object.keys(control.errors)) {
      if (map[key]) return map[key];
    }
    return this.errorText() || 'This value is not valid';
  });
}

/**
 * Read-only presentation of a server-managed value.
 *
 * Used for fields the client must never submit — currentPrice on an auction is
 * the canonical example. Rendering it as a distinctly styled, disabled block
 * (rather than a normal input) makes it obvious that the value is derived.
 */
@Component({
  selector: 'app-readonly-field',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="form-group">
      <span class="form-label">
        <span>{{ label() }}</span>
        <span class="badge badge-plain">Server-managed</span>
      </span>

      <div class="form-readonly">
        <span class="form-readonly-value">{{ value() }}</span>
      </div>

      @if (hint()) {
        <p class="form-hint">{{ hint() }}</p>
      }
    </div>
  `,
})
export class ReadonlyFieldComponent {
  readonly label = input.required<string>();
  readonly value = input.required<string>();
  readonly hint = input<string>('');
}

/** Search input with a leading icon and a clear action. */
@Component({
  selector: 'app-search-input',
  standalone: true,
  imports: [IconComponent, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="input-affix-wrap">
      <span class="search-prefix">
        <app-icon name="search" [size]="15" />
      </span>
      <input
        type="search"
        class="form-input search-input"
        [placeholder]="placeholder()"
        [value]="value()"
        [attr.aria-label]="placeholder()"
        (input)="onInput($event)"
      />
    </div>
  `,
  styles: [
    `
      .search-prefix {
        position: absolute;
        left: 11px;
        display: flex;
        color: var(--c-text-muted);
        pointer-events: none;
      }
      .search-input {
        padding-left: 34px;
      }
      .search-input::-webkit-search-cancel-button {
        cursor: pointer;
      }
    `,
  ],
})
export class SearchInputComponent {
  readonly value = input<string>('');
  readonly placeholder = input('Search');
  readonly changed = input.required<(value: string) => void>();

  onInput(event: Event): void {
    this.changed()((event.target as HTMLInputElement).value);
  }
}
