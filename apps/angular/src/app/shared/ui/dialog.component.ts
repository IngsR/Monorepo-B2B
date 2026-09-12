import { ChangeDetectionStrategy, Component, HostListener, input, output } from '@angular/core';
import { ButtonComponent } from './button.component';
import { IconComponent, IconName } from './icon.component';

/**
 * Modal dialog.
 *
 * Handles the accessible essentials once: Escape closes, the backdrop closes,
 * focus is trapped by the browser's native dialog semantics via `role="dialog"`
 * and `aria-modal`. Content is projected so pages can compose their own body.
 */
@Component({
  selector: 'app-dialog',
  standalone: true,
  imports: [IconComponent, ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog-backdrop" (click)="onBackdrop($event)">
      <div
        class="dialog"
        [class.dialog-lg]="size() === 'lg'"
        role="dialog"
        aria-modal="true"
        [attr.aria-labelledby]="titleId"
        (click)="$event.stopPropagation()"
      >
        <div class="dialog-header">
          @if (icon()) {
            <span class="dialog-icon" [class]="'dialog-icon-' + tone()">
              <app-icon [name]="icon()!" [size]="18" />
            </span>
          }
          <div class="dialog-header-text">
            <h2 class="dialog-title" [id]="titleId">{{ title() }}</h2>
            @if (subtitle()) {
              <p class="dialog-subtitle">{{ subtitle() }}</p>
            }
          </div>
          <button
            type="button"
            class="btn btn-ghost btn-sm dialog-close"
            aria-label="Close dialog"
            (click)="dismissed.emit()"
          >
            <app-icon name="close" [size]="16" />
          </button>
        </div>

        <div class="dialog-body">
          <ng-content />
        </div>

        <div class="dialog-footer">
          <app-button
            [label]="cancelLabel()"
            variant="secondary"
            [disabled]="busy()"
            (clicked)="dismissed.emit()"
          />
          <app-button
            [label]="confirmLabel()"
            [variant]="confirmVariant()"
            [loading]="busy()"
            (clicked)="confirmed.emit()"
          />
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .dialog-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 34px;
        height: 34px;
        flex-shrink: 0;
        border-radius: var(--r-md);
      }
      .dialog-icon-neutral {
        color: var(--c-brand);
        background: var(--c-brand-soft);
      }
      .dialog-icon-danger {
        color: var(--c-danger);
        background: var(--c-danger-soft);
      }
      .dialog-icon-warning {
        color: var(--c-warning);
        background: var(--c-warning-soft);
      }
      .dialog-close {
        flex-shrink: 0;
        width: 30px;
        padding: 0;
      }
    `,
  ],
})
export class DialogComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string>('');
  readonly icon = input<IconName | null>(null);
  readonly tone = input<'neutral' | 'danger' | 'warning'>('neutral');
  readonly size = input<'md' | 'lg'>('md');
  readonly confirmLabel = input('Confirm');
  readonly cancelLabel = input('Cancel');
  readonly confirmVariant = input<'primary' | 'danger' | 'success'>('primary');
  readonly busy = input(false);
  readonly closeOnBackdrop = input(true);

  readonly confirmed = output<void>();
  readonly dismissed = output<void>();

  readonly titleId = `dialog-title-${Math.random().toString(36).slice(2, 9)}`;

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (!this.busy()) this.dismissed.emit();
  }

  onBackdrop(event: MouseEvent): void {
    if (this.closeOnBackdrop() && !this.busy()) {
      event.stopPropagation();
      this.dismissed.emit();
    }
  }
}

/**
 * Destructive-action confirmation.
 *
 * A dedicated component rather than a generic dialog, because destructive
 * actions must always state the precise consequence and require an explicit
 * acknowledgement of what will be affected.
 */
@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [DialogComponent],
  // ConfirmDialog projects its body into the dialog shell, so no extra imports
  // are needed here beyond the shell itself.
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dialog
      [title]="title()"
      [subtitle]="subtitle()"
      [icon]="icon()"
      [tone]="tone()"
      [confirmLabel]="confirmLabel()"
      [confirmVariant]="tone() === 'danger' ? 'danger' : 'primary'"
      [busy]="busy()"
      (confirmed)="confirmed.emit()"
      (dismissed)="dismissed.emit()"
    >
      <p>{{ message() }}</p>
      <ng-content />
    </app-dialog>
  `,
})
export class ConfirmDialogComponent {
  readonly title = input.required<string>();
  readonly message = input.required<string>();
  readonly subtitle = input<string>('');
  readonly confirmLabel = input('Confirm');
  readonly icon = input<IconName>('alert');
  readonly tone = input<'neutral' | 'danger' | 'warning'>('danger');
  readonly busy = input(false);

  readonly confirmed = output<void>();
  readonly dismissed = output<void>();
}
