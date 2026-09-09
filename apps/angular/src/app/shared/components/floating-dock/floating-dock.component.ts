import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

export interface DockItem {
  id: string;
  title: string;
  iconSvg: string;
  badge?: string | number;
}

@Component({
  selector: 'app-floating-dock',
  standalone: true,
  imports: [CommonModule],
  template: `
    <nav class="floating-dock-wrapper">
      <div class="floating-dock-container">
        @for (item of items; track item.id) {
          <div class="dock-item-group" (mouseenter)="hoveredId = item.id" (mouseleave)="hoveredId = null">
            <!-- Tooltip -->
            <div class="dock-tooltip" [class.show]="hoveredId === item.id">
              {{ item.title }}
            </div>

            <!-- Button Icon -->
            <button
              type="button"
              class="dock-button"
              [class.active]="activeId === item.id"
              (click)="onItemClick(item.id)"
              [title]="item.title"
            >
              <div class="dock-icon-inner" [innerHTML]="item.iconSvg"></div>
              @if (item.badge) {
                <span class="dock-badge">{{ item.badge }}</span>
              }
            </button>

            <!-- Active Dot Indicator -->
            @if (activeId === item.id) {
              <div class="active-dot"></div>
            }
          </div>
        }
      </div>
    </nav>
  `,
  styles: [`
    .floating-dock-wrapper {
      position: fixed;
      bottom: 1.5rem;
      left: 50%;
      transform: translateX(-50%);
      z-index: 50;
      pointer-events: none;
    }

    .floating-dock-container {
      pointer-events: auto;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 0.75rem;
      background: rgba(14, 19, 31, 0.85);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: var(--radius-full);
      box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.7), 0 0 20px -5px rgba(99, 102, 241, 0.25);
    }

    .dock-item-group {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .dock-tooltip {
      position: absolute;
      top: -2.25rem;
      padding: 3px 8px;
      font-size: 0.75rem;
      font-weight: 500;
      color: #f8fafc;
      background: rgba(21, 29, 47, 0.95);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: var(--radius-sm);
      white-space: nowrap;
      pointer-events: none;
      opacity: 0;
      transform: translateY(4px);
      transition: all 0.15s ease;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);

      &.show {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .dock-button {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 44px;
      border-radius: var(--radius-full);
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid transparent;
      color: var(--text-secondary);
      transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), background 0.2s ease, color 0.2s ease;

      &:hover {
        transform: scale(1.18);
        background: rgba(255, 255, 255, 0.12);
        color: #ffffff;
      }

      &.active {
        background: rgba(99, 102, 241, 0.25);
        border-color: rgba(99, 102, 241, 0.5);
        color: #ffffff;
        box-shadow: 0 0 12px rgba(99, 102, 241, 0.4);
      }
    }

    .dock-icon-inner {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 22px;
      height: 22px;

      ::ng-deep svg {
        width: 100%;
        height: 100%;
        stroke-width: 2;
      }
    }

    .dock-badge {
      position: absolute;
      top: -2px;
      right: -2px;
      min-width: 16px;
      height: 16px;
      padding: 0 4px;
      border-radius: var(--radius-full);
      background: var(--primary);
      color: #ffffff;
      font-size: 0.65rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1.5px solid var(--bg-app);
    }

    .active-dot {
      width: 4px;
      height: 4px;
      border-radius: 50%;
      background: var(--primary);
      margin-top: 3px;
      box-shadow: 0 0 6px var(--primary);
    }
  `],
})
export class FloatingDockComponent {
  @Input({ required: true }) items: DockItem[] = [];
  @Input() activeId = '';
  @Output() selectItem = new EventEmitter<string>();

  hoveredId: string | null = null;

  onItemClick(id: string) {
    this.selectItem.emit(id);
  }
}
