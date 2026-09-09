import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { CardSpotlightComponent } from '../card-spotlight/card-spotlight.component';

export interface StatItem {
  label: string;
  value: string | number;
  subtext?: string;
  trend?: string;
  isPositive?: boolean;
  iconSvg?: string;
}

@Component({
  selector: 'app-stats-section',
  standalone: true,
  imports: [CommonModule, CardSpotlightComponent],
  template: `
    <div class="stats-grid">
      @for (stat of stats; track stat.label) {
        <app-card-spotlight [spotlightColor]="'rgba(99, 102, 241, 0.12)'">
          <div class="stat-card-inner">
            <div class="stat-header">
              <span class="stat-label">{{ stat.label }}</span>
              @if (stat.iconSvg) {
                <div class="stat-icon" [innerHTML]="stat.iconSvg"></div>
              }
            </div>

            <div class="stat-body">
              <div class="stat-value">{{ stat.value }}</div>
              @if (stat.trend) {
                <div class="stat-trend" [class.trend-positive]="stat.isPositive" [class.trend-neutral]="!stat.isPositive">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    @if (stat.isPositive) {
                      <polyline points="18 15 12 9 6 15"></polyline>
                    } @else {
                      <polyline points="6 9 12 15 18 9"></polyline>
                    }
                  </svg>
                  <span>{{ stat.trend }}</span>
                </div>
              }
            </div>

            @if (stat.subtext) {
              <div class="stat-subtext">{{ stat.subtext }}</div>
            }
          </div>
        </app-card-spotlight>
      }
    </div>
  `,
  styles: [`
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(1, minmax(0, 1fr));
      gap: 1rem;
      width: 100%;

      @media (min-width: 640px) {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      @media (min-width: 1024px) {
        grid-template-columns: repeat(4, minmax(0, 1fr));
      }
    }

    .stat-card-inner {
      padding: 1.25rem 1.5rem;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      height: 100%;
    }

    .stat-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 0.75rem;
    }

    .stat-label {
      font-size: 0.8125rem;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .stat-icon {
      width: 32px;
      height: 32px;
      border-radius: var(--radius-md);
      background: #eef2ff;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #4338ca;

      ::ng-deep svg {
        width: 18px;
        height: 18px;
        stroke-width: 2.2;
      }
    }

    .stat-body {
      display: flex;
      align-items: baseline;
      gap: 0.75rem;
      margin-bottom: 0.25rem;
    }

    .stat-value {
      font-size: 1.85rem;
      font-weight: 800;
      letter-spacing: -0.03em;
      color: #0f172a;
    }

    .stat-trend {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      font-size: 0.75rem;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: var(--radius-full);

      &.trend-positive {
        background: #ecfdf5;
        color: #059669;
      }

      &.trend-neutral {
        background: #fffbeb;
        color: #d97706;
      }
    }

    .stat-subtext {
      font-size: 0.75rem;
      color: #94a3b8;
    }
  `],
})
export class StatsSectionComponent {
  @Input({ required: true }) stats: StatItem[] = [];
}
