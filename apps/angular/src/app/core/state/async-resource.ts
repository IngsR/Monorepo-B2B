import { Signal, computed, signal } from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import { ApiFailure, toApiFailure } from '../domain/api-failure';

export type LoadState = 'idle' | 'loading' | 'success' | 'error';

/**
 * Component-level async state container.
 *
 * Every resource-backed screen needs four visible states — loading, success,
 * empty, error — plus the ability to re-run the request. Rather than repeating
 * that wiring in each component, a page owns one `AsyncResource` per piece of
 * server data.
 *
 * Deliberately framework-neutral: it holds signals and subscriptions and is
 * compatible with both the Observable and signal styles used across features.
 *
 * @example
 * readonly auctions = new AsyncResource<Paginated<Auction>>();
 * ngOnInit() { this.auctions.load(this.svc.list()); }
 */
export class AsyncResource<T> {
  private readonly _state = signal<LoadState>('idle');
  private readonly _data = signal<T | null>(null);
  private readonly _error = signal<ApiFailure | null>(null);
  private subscription?: Subscription;

  readonly state: Signal<LoadState> = this._state.asReadonly();
  readonly data: Signal<T | null> = this._data.asReadonly();
  readonly error: Signal<ApiFailure | null> = this._error.asReadonly();

  readonly isLoading = computed(() => this._state() === 'loading');
  /** True only after a successful load that produced an empty collection. */
  readonly isIdle = computed(() => this._state() === 'idle');
  readonly hasError = computed(() => this._state() === 'error');
  readonly isSuccess = computed(() => this._state() === 'success');

  /** Runs a request, cancelling any request already in flight. */
  load(source: Observable<T>, options: { keepData?: boolean } = {}): Subscription {
    this.subscription?.unsubscribe();
    this._state.set('loading');
    this._error.set(null);
    if (!options.keepData) this._data.set(null);

    this.subscription = source.subscribe({
      next: (value) => {
        this._data.set(value);
        this._state.set('success');
      },
      error: (err: unknown) => {
        this._error.set(toApiFailure(err));
        this._state.set('error');
      },
    });

    return this.subscription;
  }

  /** Replaces the cached value without a round trip (after a local mutation). */
  set(value: T): void {
    this._data.set(value);
    this._state.set('success');
    this._error.set(null);
  }

  /** Applies a pure transformation to the current value. */
  update(fn: (value: T) => T): void {
    const current = this._data();
    if (current === null) return;
    this._data.set(fn(current));
  }

  /** Returns to the pre-load state. */
  reset(): void {
    this.subscription?.unsubscribe();
    this._state.set('idle');
    this._data.set(null);
    this._error.set(null);
  }

  dispose(): void {
    this.subscription?.unsubscribe();
  }
}

/** Convenience for collections that render an explicit empty state. */
export function hasItems<T>(value: { items: T[] } | null): boolean {
  return !!value && value.items.length > 0;
}
