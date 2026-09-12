import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { ToastKind } from '../../core/services/notification.service';
import { NotificationService } from '../../core/services/notification.service';
import { IconComponent, IconName } from './icon.component';

/**
 * Toast host.
 *
 * Mounted once in the application shell. Renders transient feedback for actions
 * the user just performed. Toasts are announced politely so screen readers pick
 * them up without interrupting, and errors are dismissible because they persist
 * longer.
 */
@Component({
  selector: 'app-toast-host',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (toasts().length) {
      <div class="toast-stack" role="region" aria-label="Notifications">
        @for (toast of toasts(); track toast.id) {
          <div
            class="toast"
            [class]="'toast toast-' + toast.kind"
            [attr.role]="toast.kind === 'error' ? 'alert' : 'status'"
            [attr.aria-live]="toast.kind === 'error' ? 'assertive' : 'polite'"
          >
            <span class="toast-icon">
              <app-icon [name]="iconFor(toast.kind)" [size]="17" />
            </span>
            <div class="toast-content">
              <p class="toast-title">{{ toast.title }}</p>
              @if (toast.message) {
                <p class="toast-message">{{ toast.message }}</p>
              }
            </div>
            <button
              type="button"
              class="toast-close"
              aria-label="Dismiss notification"
              (click)="dismiss(toast.id)"
            >
              <app-icon name="close" [size]="14" />
            </button>
          </div>
        }
      </div>
    }
  `,
})
export class ToastHostComponent {
  private readonly notifications = inject(NotificationService);

  readonly toasts = computed(() => this.notifications.toasts());

  iconFor(kind: ToastKind): IconName {
    switch (kind) {
      case 'success':
        return 'check';
      case 'error':
        return 'alert';
      case 'warning':
        return 'alert';
      default:
        return 'info';
    }
  }

  dismiss(id: number): void {
    this.notifications.dismiss(id);
  }
}

/**
 * Inline alert banner for persistent, page-level conditions.
 *
 * Distinct from a toast: an inline alert stays on screen because it describes
 * the current state of the page rather than the result of an action.
 */
@Component({
  selector: 'app-alert',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="alert" [class]="'alert alert-' + tone()" [attr.role]="role()">
      <app-icon [name]="iconName()" [size]="17" />
      <div>
        @if (title()) {
          <p class="alert-title">{{ title() }}</p>
        }
        <p class="alert-body">
          <ng-content>{{ message() }}</ng-content>
        </p>
      </div>
    </div>
  `,
})
export class AlertComponent {
  readonly tone = input<'success' | 'info' | 'warning' | 'danger' | 'neutral'>('info');
  readonly title = input<string>('');
  readonly message = input<string>('');

  readonly role = computed(() => (this.tone() === 'danger' ? 'alert' : 'status'));

  readonly iconName = computed<IconName>(() => {
    switch (this.tone()) {
      case 'success':
        return 'check';
      case 'danger':
      case 'warning':
        return 'alert';
      default:
        return 'info';
    }
  });
}
