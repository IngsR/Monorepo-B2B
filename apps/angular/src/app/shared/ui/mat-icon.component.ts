import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';

/**
 * Angular Material Icon component.
 *
 * Implements the standard `<mat-icon>` interface using Google Material Icons & Symbols.
 * Supports both text content projection (`<mat-icon>dashboard</mat-icon>`) and
 * property binding (`<mat-icon fontIcon="people" />` or `<mat-icon [fontIcon]="iconName" />`).
 */
@Component({
  selector: 'mat-icon, app-mat-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="mat-icon-glyph material-icons"
      [class.material-icons-outlined]="outlined()"
      [style.font-size.px]="size()"
      [style.width.px]="size()"
      [style.height.px]="size()"
      [attr.aria-hidden]="ariaHidden()"
      [attr.aria-label]="ariaLabel()"
    >
      {{ glyphName() }}<ng-content />
    </span>
  `,
  styles: [
    `
      :host {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        vertical-align: middle;
        flex-shrink: 0;
        line-height: 1;
        user-select: none;
      }
      .mat-icon-glyph {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-family: 'Material Icons', 'Material Icons Outlined', 'Material Symbols Outlined', sans-serif;
        font-weight: normal;
        font-style: normal;
        line-height: 1;
        text-transform: none;
        letter-spacing: normal;
        word-wrap: normal;
        white-space: nowrap;
        direction: ltr;
        -webkit-font-smoothing: antialiased;
        text-rendering: optimizeLegibility;
        -moz-osx-font-smoothing: grayscale;
        font-feature-settings: 'liga';
        font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
      }
    `,
  ],
})
export class MatIconComponent {
  readonly fontIcon = input<string>('');
  readonly name = input<string>('');
  readonly size = input<number>(20);
  readonly outlined = input<boolean>(false);
  readonly ariaLabel = input<string | null>(null);

  readonly glyphName = computed(() => {
    return this.fontIcon() || this.name() || '';
  });

  readonly ariaHidden = computed(() => {
    return this.ariaLabel() ? null : 'true';
  });
}
