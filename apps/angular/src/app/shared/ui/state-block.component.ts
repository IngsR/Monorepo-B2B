import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ApiFailure, failureHeadline } from '../../core/domain/api-failure';
import { ButtonComponent } from './button.component';
import { IconComponent, IconName } from './icon.component';

/**
 * Empty state.
 *
 * Always offers a next step: an empty list with no action is a dead end. The
 * optional `action` slot is for a primary button, `secondary` for a filter reset.
 */
@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="state-block">
      <div class="state-icon">
        <app-icon [name]="icon()" [size]="22" />
      </div>
      <p class="state-title">{{ title() }}</p>
      @if (description()) {
        <p class="state-description">{{ description() }}</p>
      }
      <div class="state-actions">
        <ng-content />
      </div>
    </div>
  `,
})
export class EmptyStateComponent {
  readonly icon = input<IconName>('inbox');
  readonly title = input.required<string>();
  readonly description = input<string>('');
}

/**
 * Error state.
 *
 * Renders a normalised `ApiFailure`. Distinguishes access problems from server
 * problems so the user knows whether retrying is worthwhile, and never exposes
 * backend implementation detail.
 */
@Component({
  selector: 'app-error-state',
  standalone: true,
  imports: [IconComponent, ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="state-block">
      <div class="state-icon state-icon-error">
        <app-icon [name]="icon()" [size]="22" />
      </div>
      <p class="state-title">{{ heading().title }}</p>
      <p class="state-description">{{ heading().description }}</p>

      @if (showReference()) {
        <p class="text-mono-id error-reference">
          Reference: HTTP {{ failure().status }} · {{ failure().code }}
        </p>
      }

      <div class="state-actions">
        @if (retryable()) {
          <app-button
            label="Try again"
            variant="secondary"
            icon="refresh"
            [loading]="retrying()"
            (clicked)="retry.emit()"
          />
        }
        <ng-content />
      </div>
    </div>
  `,
  styles: [
    `
      .error-reference {
        margin-top: calc(var(--sp-2) * -1);
      }
    `,
  ],
})
export class ErrorStateComponent {
  readonly failure = input.required<ApiFailure>();
  readonly retrying = input(false);
  readonly showReference = input(true);

  readonly retry = output<void>();

  readonly heading = computed(() => failureHeadline(this.failure()));

  /** Retrying only makes sense for transient failures. */
  readonly retryable = computed(() => {
    const status = this.failure().status;
    return status === 0 || status >= 500;
  });

  readonly icon = computed<IconName>(() => {
    switch (this.failure().status) {
      case 401:
      case 403:
        return 'lock';
      case 404:
        return 'search';
      default:
        return 'alert';
    }
  });
}

/**
 * Loading skeleton for a card grid.
 * Mirrors the real card geometry so the layout does not jump when data arrives.
 */
@Component({
  selector: 'app-card-skeleton',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card auction-card" aria-hidden="true">
      <div class="auction-card-media skeleton"></div>
      <div class="auction-card-body">
        <div class="skeleton skeleton-text-sm" style="width: 38%"></div>
        <div class="skeleton skeleton-title" style="width: 88%"></div>
        <div class="skeleton skeleton-text" style="width: 64%"></div>
        <div class="auction-card-bid-row">
          <div class="skeleton skeleton-price"></div>
          <div class="skeleton skeleton-badge"></div>
        </div>
      </div>
    </div>
  `,
})
export class CardSkeletonComponent {}

/** Loading skeleton for a data table. */
@Component({
  selector: 'app-table-skeleton',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div aria-hidden="true" aria-busy="true">
      @for (row of rows(); track row) {
        <div class="table-skeleton-row">
          <div class="skeleton skeleton-text" style="width: 18%"></div>
          <div class="skeleton skeleton-text" style="width: 30%"></div>
          <div class="skeleton skeleton-text" style="width: 22%"></div>
          <div class="skeleton skeleton-text" style="width: 14%"></div>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .table-skeleton-row {
        display: grid;
        grid-template-columns: 1.2fr 2fr 1.5fr 1fr;
        gap: var(--sp-4);
        align-items: center;
        padding: var(--sp-4);
        border-bottom: 1px solid var(--c-border);
      }
      .table-skeleton-row:last-child {
        border-bottom: none;
      }
      @media (max-width: 720px) {
        .table-skeleton-row {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class TableSkeletonComponent {
  readonly count = input(6);
  readonly rows = computed(() => Array.from({ length: this.count() }, (_, i) => i));
}

/** Loading skeleton for the auction detail page. */
@Component({
  selector: 'app-detail-skeleton',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="detail-skeleton" aria-hidden="true" aria-busy="true">
      <div class="stack">
        <div class="skeleton" style="aspect-ratio: 16 / 10; border-radius: var(--r-lg)"></div>
        <div class="skeleton skeleton-title" style="width: 60%"></div>
        <div class="skeleton skeleton-text" style="width: 90%"></div>
        <div class="skeleton skeleton-text" style="width: 74%"></div>
      </div>
      <div class="card card-body stack">
        <div class="skeleton skeleton-text-sm" style="width: 40%"></div>
        <div class="skeleton" style="height: 44px; width: 70%"></div>
        <div class="skeleton" style="height: 38px"></div>
        <div class="skeleton skeleton-btn" style="width: 100%"></div>
      </div>
    </div>
  `,
  styles: [
    `
      .detail-skeleton {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 380px;
        gap: var(--sp-6);
        align-items: start;
      }
      @media (max-width: 1180px) {
        .detail-skeleton {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class DetailSkeletonComponent {}
