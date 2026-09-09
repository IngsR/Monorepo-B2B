import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

export interface TabItem {
  id: string;
  label: string;
  count?: number;
  icon?: string;
}

@Component({
  selector: 'app-animated-tabs',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="tabs-wrapper">
      <div class="tabs-container">
        @for (tab of tabs; track tab.id) {
          <button
            type="button"
            class="tab-btn"
            [class.active]="tab.id === activeTabId"
            (click)="selectTab(tab.id)"
          >
            @if (tab.id === activeTabId) {
              <div class="active-pill"></div>
            }
            <span class="tab-label">{{ tab.label }}</span>
            @if (tab.count !== undefined) {
              <span class="tab-badge" [class.badge-active]="tab.id === activeTabId">
                {{ tab.count }}
              </span>
            }
          </button>
        }
      </div>
    </div>
  `,
  styles: [`
    .tabs-wrapper {
      display: inline-flex;
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
      border-radius: var(--radius-full);
      padding: 4px;
      box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.04);
    }

    .tabs-container {
      display: flex;
      align-items: center;
      gap: 2px;
      position: relative;
    }

    .tab-btn {
      position: relative;
      padding: 6px 16px;
      border-radius: var(--radius-full);
      font-size: 0.875rem;
      font-weight: 600;
      color: #64748b;
      display: flex;
      align-items: center;
      gap: 8px;
      background: transparent;
      z-index: 1;
      transition: color 0.2s ease;

      &:hover {
        color: #0f172a;
      }

      &.active {
        color: #ffffff;
      }
    }

    .active-pill {
      position: absolute;
      inset: 0;
      background: #4338ca;
      border-radius: inherit;
      z-index: -1;
      box-shadow: 0 2px 8px rgba(67, 56, 202, 0.25);
      animation: pill-pop 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes pill-pop {
      0% {
        transform: scale(0.92);
        opacity: 0.8;
      }
      100% {
        transform: scale(1);
        opacity: 1;
      }
    }

    .tab-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 0.75rem;
      font-weight: 700;
      padding: 1px 7px;
      border-radius: var(--radius-full);
      background: #e2e8f0;
      color: #475569;
      transition: all 0.2s ease;

      &.badge-active {
        background: rgba(255, 255, 255, 0.25);
        color: #ffffff;
      }
    }
  `],
})
export class AnimatedTabsComponent {
  @Input({ required: true }) tabs: TabItem[] = [];
  @Input() activeTabId: string = '';
  @Output() tabChange = new EventEmitter<string>();

  selectTab(id: string) {
    if (this.activeTabId === id) return;
    this.activeTabId = id;
    this.tabChange.emit(id);
  }
}
