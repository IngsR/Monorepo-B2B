import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { PageMeta } from '../../core/domain/models';
import { IconComponent } from './icon.component';

/**
 * Pagination.
 *
 * Shows a compact window of page numbers with first/last available, plus a
 * textual range so the user always knows how many records exist — not just
 * which page they are on. Hides itself entirely for a single page of results.
 */
@Component({
  selector: 'app-pagination',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (meta().total > 0) {
      <nav class="pagination" aria-label="Pagination">
        <p class="pagination-info">
          @if (meta().total === 0) {
            No results
          } @else {
            <span class="text-numeric">{{ rangeStart() }}–{{ rangeEnd() }}</span>
            of <span class="text-numeric">{{ meta().total }}</span>
            {{ meta().total === 1 ? 'result' : 'results' }}
          }
        </p>

        @if (meta().totalPages > 1) {
          <div class="pagination-controls">
            <button
              type="button"
              class="pagination-btn"
              [disabled]="meta().page <= 1"
              aria-label="Previous page"
              (click)="go(meta().page - 1)"
            >
              <app-icon name="chevron-left" [size]="15" />
            </button>

            @for (p of pages(); track p) {
              @if (p === -1) {
                <span class="pagination-ellipsis" aria-hidden="true">…</span>
              } @else {
                <button
                  type="button"
                  class="pagination-btn"
                  [class.is-active]="p === meta().page"
                  [attr.aria-current]="p === meta().page ? 'page' : null"
                  [attr.aria-label]="'Page ' + p"
                  (click)="go(p)"
                >
                  {{ p }}
                </button>
              }
            }

            <button
              type="button"
              class="pagination-btn"
              [disabled]="meta().page >= meta().totalPages"
              aria-label="Next page"
              (click)="go(meta().page + 1)"
            >
              <app-icon name="chevron-right" [size]="15" />
            </button>
          </div>
        }
      </nav>
    }
  `,
  styles: [
    `
      .pagination-ellipsis {
        padding: 0 var(--sp-1);
        color: var(--c-text-muted);
      }
    `,
  ],
})
export class PaginationComponent {
  readonly meta = input.required<PageMeta>();
  readonly pageChange = output<number>();

  readonly rangeStart = computed(() =>
    this.meta().total === 0 ? 0 : (this.meta().page - 1) * this.meta().limit + 1,
  );

  readonly rangeEnd = computed(() =>
    Math.min(this.meta().page * this.meta().limit, this.meta().total),
  );

  /**
   * Windowed page list: always the first and last page, plus a sliding window
   * around the current page. `-1` marks an ellipsis.
   */
  readonly pages = computed<number[]>(() => {
    const { page, totalPages } = this.meta();
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const result = new Set<number>([1, totalPages, page]);
    if (page - 1 > 1) result.add(page - 1);
    if (page + 1 < totalPages) result.add(page + 1);

    const sorted = [...result].sort((a, b) => a - b);
    const withGaps: number[] = [];
    let previous = 0;

    for (const p of sorted) {
      if (previous && p - previous > 1) withGaps.push(-1);
      withGaps.push(p);
      previous = p;
    }

    return withGaps;
  });

  go(page: number): void {
    if (page < 1 || page > this.meta().totalPages || page === this.meta().page) return;
    this.pageChange.emit(page);
  }
}

export interface Crumb {
  label: string;
  /** Omitted on the final crumb, which represents the current page. */
  link?: string;
}

/** Breadcrumbs. The last crumb is never a link and is marked as the current page. */
@Component({
  selector: 'app-breadcrumbs',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="breadcrumbs" aria-label="Breadcrumb">
      @for (crumb of items(); track crumb.label; let last = $last) {
        @if (!last && crumb.link) {
          <a class="breadcrumb-link" [href]="crumb.link">{{ crumb.label }}</a>
          <span class="breadcrumb-sep" aria-hidden="true">
            <app-icon name="chevron-right" [size]="13" />
          </span>
        } @else {
          <span class="breadcrumb-current" [attr.aria-current]="last ? 'page' : null">
            {{ crumb.label }}
          </span>
          @if (!last) {
            <span class="breadcrumb-sep" aria-hidden="true">
              <app-icon name="chevron-right" [size]="13" />
            </span>
          }
        }
      }
    </nav>
  `,
})
export class BreadcrumbsComponent {
  readonly items = input.required<Crumb[]>();
}
