import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { IconComponent, IconName } from './icon.component';

export type ButtonVariant =
  'primary' | 'secondary' | 'ghost' | 'success' | 'danger' | 'danger-outline' | 'link';

export type ButtonSize = 'sm' | 'md' | 'lg';

/**
 * Button.
 *
 * Renders as `<button>` by default and as an `<a>` when `routerLink` is set, so
 * navigation actions are real links (middle-click, new tab, accessible) while
 * actions remain buttons. Visual styling is entirely from the design system.
 */
@Component({
  selector: 'app-button',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      [class]="classes()"
      [type]="type()"
      [disabled]="disabled() || loading()"
      [attr.aria-busy]="loading() ? 'true' : null"
      (click)="clicked.emit($event)"
    >
      @if (loading()) {
        <span class="spinner" aria-hidden="true"></span>
      } @else if (icon()) {
        <app-icon [name]="icon()!" [size]="iconSize()" />
      }
      <span>{{ label() }}</span>
      @if (trailingIcon()) {
        <app-icon [name]="trailingIcon()!" [size]="iconSize()" />
      }
    </button>
  `,
})
export class ButtonComponent {
  readonly label = input<string>('');
  readonly variant = input<ButtonVariant>('secondary');
  readonly size = input<ButtonSize>('md');
  readonly icon = input<IconName | null>(null);
  readonly trailingIcon = input<IconName | null>(null);
  readonly type = input<'button' | 'submit' | 'reset'>('button');
  readonly disabled = input(false);
  readonly loading = input(false);
  readonly block = input(false);

  readonly clicked = output<MouseEvent>();

  readonly classes = computed(() => {
    const parts = ['btn', `btn-${this.variant()}`];
    if (this.size() === 'sm') parts.push('btn-sm');
    if (this.size() === 'lg') parts.push('btn-lg');
    if (this.block()) parts.push('btn-block');
    return parts.join(' ');
  });

  readonly iconSize = computed(() => (this.size() === 'sm' ? 14 : this.size() === 'lg' ? 18 : 16));
}

export type IconButtonVariant = 'ghost' | 'secondary';

/** Compact square icon-only button for toolbars and row actions. */
@Component({
  selector: 'app-icon-button',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      class="btn"
      [class.btn-ghost]="variant() === 'ghost'"
      [class.btn-secondary]="variant() === 'secondary'"
      [class.btn-sm]="size() === 'sm'"
      [class.icon-button-square]="true"
      [type]="type()"
      [disabled]="disabled()"
      [attr.aria-label]="ariaLabel()"
      [attr.title]="ariaLabel()"
      (click)="clicked.emit($event)"
    >
      @if (loading()) {
        <span class="spinner" aria-hidden="true"></span>
      } @else {
        <app-icon [name]="icon()" [size]="iconSize()" />
      }
    </button>
  `,
  styles: [
    `
      .icon-button-square {
        width: 34px;
        padding: 0;
      }
      .icon-button-square.btn-sm {
        width: 30px;
      }
    `,
  ],
})
export class IconButtonComponent {
  readonly icon = input.required<IconName>();
  readonly ariaLabel = input.required<string>();
  readonly variant = input<IconButtonVariant>('ghost');
  readonly size = input<ButtonSize>('md');
  readonly type = input<'button' | 'submit'>('button');
  readonly disabled = input(false);
  readonly loading = input(false);

  readonly clicked = output<MouseEvent>();

  readonly iconSize = computed(() => (this.size() === 'sm' ? 14 : 16));
}
