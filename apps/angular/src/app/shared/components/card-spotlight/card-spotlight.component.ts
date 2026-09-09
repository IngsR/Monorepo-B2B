import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, Input, ViewChild } from '@angular/core';

@Component({
  selector: 'app-card-spotlight',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      #cardRef
      class="spotlight-card"
      [ngClass]="customClass"
      [style.--spotlight-color]="spotlightColor"
      [style.--spotlight-size]="spotlightSize + 'px'"
    >
      <!-- Cursor Follower Spotlight Layer -->
      <div class="spotlight-overlay"></div>
      
      <!-- Border Glow Follower Layer -->
      <div class="spotlight-border-overlay"></div>

      <!-- Card Content -->
      <div class="card-content">
        <ng-content></ng-content>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
    }

    .spotlight-card {
      position: relative;
      height: 100%;
      border-radius: var(--radius-lg);
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      overflow: hidden;
      transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s ease;
      --mouse-x: 50%;
      --mouse-y: 50%;
      --spotlight-color: rgba(67, 56, 202, 0.08);
      --spotlight-size: 350px;
      box-shadow: var(--shadow-sm);

      &:hover {
        border-color: #cbd5e1;
        box-shadow: var(--shadow-card);
      }
    }

    .spotlight-overlay {
      position: absolute;
      inset: 0;
      border-radius: inherit;
      pointer-events: none;
      z-index: 1;
      opacity: 0;
      transition: opacity 0.3s ease;
      background: radial-gradient(
        var(--spotlight-size) circle at var(--mouse-x) var(--mouse-y),
        var(--spotlight-color),
        transparent 80%
      );
    }

    .spotlight-border-overlay {
      position: absolute;
      inset: -1px;
      border-radius: inherit;
      pointer-events: none;
      z-index: 1;
      opacity: 0;
      transition: opacity 0.3s ease;
      background: radial-gradient(
        var(--spotlight-size) circle at var(--mouse-x) var(--mouse-y),
        rgba(99, 102, 241, 0.55),
        transparent 70%
      );
      mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
      -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
      -webkit-mask-composite: xor;
      mask-composite: exclude;
      padding: 1px;
    }

    .spotlight-card:hover .spotlight-overlay,
    .spotlight-card:hover .spotlight-border-overlay {
      opacity: 1;
    }

    .card-content {
      position: relative;
      z-index: 2;
      height: 100%;
    }
  `],
})
export class CardSpotlightComponent {
  @Input() spotlightColor = 'rgba(99, 102, 241, 0.15)';
  @Input() spotlightSize = 320;
  @Input() customClass = '';

  @ViewChild('cardRef') cardRef!: ElementRef<HTMLDivElement>;

  @HostListener('mousemove', ['$event'])
  onMouseMove(event: MouseEvent) {
    if (!this.cardRef) return;
    const rect = this.cardRef.nativeElement.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    this.cardRef.nativeElement.style.setProperty('--mouse-x', `${x}px`);
    this.cardRef.nativeElement.style.setProperty('--mouse-y', `${y}px`);
  }
}
