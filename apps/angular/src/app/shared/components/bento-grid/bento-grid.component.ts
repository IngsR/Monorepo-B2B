import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-bento-grid',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="bento-grid-container" [ngClass]="customClass">
      <ng-content></ng-content>
    </div>
  `,
  styles: [`
    .bento-grid-container {
      display: grid;
      grid-template-columns: repeat(1, minmax(0, 1fr));
      gap: 1.25rem;
      width: 100%;

      @media (min-width: 768px) {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }

      @media (min-width: 1200px) {
        grid-template-columns: repeat(4, minmax(0, 1fr));
      }
    }
  `],
})
export class BentoGridComponent {
  @Input() customClass = '';
}

@Component({
  selector: 'app-bento-item',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="bento-item"
      [ngClass]="[
        'col-span-' + (colSpan || 1),
        'row-span-' + (rowSpan || 1),
        customClass
      ]"
    >
      <div class="bento-inner">
        <ng-content></ng-content>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: contents;
    }

    .bento-item {
      position: relative;
      border-radius: var(--radius-lg);
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      overflow: hidden;
      transition: transform 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease;

      &:hover {
        border-color: rgba(255, 255, 255, 0.16);
        box-shadow: 0 12px 30px -10px rgba(0, 0, 0, 0.6);
        transform: translateY(-2px);
      }
    }

    .bento-inner {
      height: 100%;
      display: flex;
      flex-direction: column;
    }

    @media (min-width: 768px) {
      .col-span-1 { grid-column: span 1 / span 1; }
      .col-span-2 { grid-column: span 2 / span 2; }
      .col-span-3 { grid-column: span 3 / span 3; }
      .col-span-4 { grid-column: span 4 / span 4; }

      .row-span-1 { grid-row: span 1 / span 1; }
      .row-span-2 { grid-row: span 2 / span 2; }
    }
  `],
})
export class BentoGridItemComponent {
  @Input() colSpan = 1;
  @Input() rowSpan = 1;
  @Input() customClass = '';
}
