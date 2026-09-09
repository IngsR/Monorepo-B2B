import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-hover-border-gradient',
  standalone: true,
  imports: [CommonModule],
  template: `
    <button
      [type]="type"
      class="gradient-border-wrapper"
      [class.disabled]="disabled"
      [disabled]="disabled"
      (click)="onClick($event)"
    >
      <!-- Moving Gradient Border Layer -->
      <div class="gradient-layer"></div>

      <!-- Inner Content Surface -->
      <div class="content-surface">
        <ng-content></ng-content>
      </div>
    </button>
  `,
  styles: [`
    :host {
      display: inline-block;
    }

    .gradient-border-wrapper {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 1.5px;
      border-radius: var(--radius-full);
      overflow: hidden;
      background: transparent;
      cursor: pointer;
      transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease;

      &:hover:not(.disabled) {
        transform: translateY(-1px);
        box-shadow: 0 0 20px -3px rgba(99, 102, 241, 0.5);
      }

      &:active:not(.disabled) {
        transform: translateY(0);
      }

      &.disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }

    .gradient-layer {
      position: absolute;
      inset: -100%;
      background: conic-gradient(
        from 0deg,
        transparent 0deg,
        #6366f1 90deg,
        #06b6d4 180deg,
        #a855f7 270deg,
        transparent 360deg
      );
      animation: rotate-gradient 4s linear infinite;
    }

    @keyframes rotate-gradient {
      from {
        transform: rotate(0deg);
      }
      to {
        transform: rotate(360deg);
      }
    }

    .content-surface {
      position: relative;
      z-index: 1;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 18px;
      background: #4338ca;
      border-radius: inherit;
      color: #ffffff;
      font-size: 0.875rem;
      font-weight: 600;
      transition: background 0.2s ease;

      .gradient-border-wrapper:hover & {
        background: #3730a3;
      }
    }
  `],
})
export class HoverBorderGradientComponent {
  @Input() type: 'button' | 'submit' = 'button';
  @Input() disabled = false;
  @Output() btnClick = new EventEmitter<MouseEvent>();

  onClick(event: MouseEvent) {
    if (!this.disabled) {
      this.btnClick.emit(event);
    }
  }
}
