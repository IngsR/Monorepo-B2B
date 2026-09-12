import { Injectable, signal } from '@angular/core';
import { ApiFailure, toApiFailure } from '../domain/api-failure';

export type ToastKind = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  message?: string;
}

let toastSeq = 0;

/**
 * Application-wide status feedback.
 *
 * Toasts are for the outcome of an action the user just took. Persistent,
 * page-level conditions (403 on a resource, empty list) are rendered inline by
 * the page itself using the `StateBlock` component — not as toasts.
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly _toasts = signal<Toast[]>([]);
  readonly toasts = this._toasts.asReadonly();

  private readonly timers = new Map<number, ReturnType<typeof setTimeout>>();

  success(title: string, message?: string): void {
    this.push('success', title, message);
  }

  error(title: string, message?: string): void {
    this.push('error', title, message);
  }

  warning(title: string, message?: string): void {
    this.push('warning', title, message);
  }

  info(title: string, message?: string): void {
    this.push('info', title, message);
  }

  /** Surfaces a normalised API failure with a sensible kind and duration. */
  fromFailure(failure: ApiFailure, title?: string): void {
    const kind: ToastKind =
      failure.status === 409
        ? 'warning'
        : failure.status >= 500 || failure.status === 0
          ? 'error'
          : 'error';
    this.push(kind, title ?? failure.message, failure.detail);
  }

  /** Convenience: normalise any thrown HTTP error and surface it. */
  fromError(error: unknown, title?: string): ApiFailure {
    const failure = toApiFailure(error);
    this.fromFailure(failure, title);
    return failure;
  }

  dismiss(id: number): void {
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
    this._toasts.update((list) => list.filter((t) => t.id !== id));
  }

  clear(): void {
    this.timers.forEach((timer) => clearTimeout(timer));
    this.timers.clear();
    this._toasts.set([]);
  }

  private push(kind: ToastKind, title: string, message?: string): void {
    toastSeq += 1;
    const id = toastSeq;
    const toast: Toast = { id, kind, title, message };

    // Cap the stack so a burst of failures cannot cover the interface.
    this._toasts.update((list) => [...list.slice(-3), toast]);

    const duration = kind === 'error' ? 8000 : 4500;
    this.timers.set(
      id,
      setTimeout(() => this.dismiss(id), duration),
    );
  }
}
