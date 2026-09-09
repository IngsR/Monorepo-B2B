import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { AuctionLot } from '../../../core/models/auction.model';
import { CardSpotlightComponent } from '../card-spotlight/card-spotlight.component';
import { HoverBorderGradientComponent } from '../hover-border-gradient/hover-border-gradient.component';

@Component({
  selector: 'app-expandable-auction-card',
  standalone: true,
  imports: [CommonModule, CardSpotlightComponent, HoverBorderGradientComponent],
  template: `
    <app-card-spotlight [spotlightColor]="'rgba(99, 102, 241, 0.16)'">
      <div class="auction-card-container">
        <!-- Card Top Image / Badge Banner -->
        <div class="card-visual-header">
          <div class="image-wrapper">
            <img [src]="lot.images[0] || placeholderImage" [alt]="lot.title" class="lot-image" />
            <div class="image-gradient-overlay"></div>
          </div>

          <div class="status-floating-badge" [ngClass]="'status-' + lot.status.toLowerCase()">
            <span class="status-dot"></span>
            <span>{{ lot.status }}</span>
          </div>

          <div class="category-pill">
            {{ formatCategory(lot.category) }}
          </div>
        </div>

        <!-- Card Core Information -->
        <div class="card-body">
          <div class="title-section">
            <h3 class="lot-title" [title]="lot.title">{{ lot.title }}</h3>
            <p class="lot-desc">{{ lot.description }}</p>
          </div>

          <!-- Specs row -->
          <div class="specs-grid">
            <div class="spec-cell">
              <span class="spec-name">Quantity</span>
              <span class="spec-val">{{ lot.quantity }} {{ lot.unit }}</span>
            </div>
            @if (lot.weightKg) {
              <div class="spec-cell">
                <span class="spec-name">Est. Weight</span>
                <span class="spec-val">{{ lot.weightKg }} kg</span>
              </div>
            }
            <div class="spec-cell">
              <span class="spec-name">Total Bids</span>
              <span class="spec-val highlight-cyan">{{ lot.totalBids }} bids</span>
            </div>
          </div>

          <!-- Price & Timer Section -->
          <div class="price-timer-bar">
            <div>
              <span class="price-caption">Current Highest Bid</span>
              <div class="price-value">
                Rp {{ lot.currentPrice | number:'1.0-0' }}
              </div>
            </div>

            @if (lot.timeRemaining) {
              <div class="timer-box">
                <span class="timer-caption">Time Left</span>
                <div class="timer-val">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                  </svg>
                  <span>{{ lot.timeRemaining }}</span>
                </div>
              </div>
            }
          </div>

          <!-- Expandable Details Accordion -->
          @if (isExpanded) {
            <div class="expanded-details-pane">
              <div class="detail-row">
                <span class="detail-label">Seller / Tenant:</span>
                <span class="detail-val">{{ lot.companyName || 'Verified Corporate Partner' }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Starting Price:</span>
                <span class="detail-val">Rp {{ lot.startingPrice | number:'1.0-0' }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Auction Lot ID:</span>
                <span class="detail-val code-font">{{ lot.id }}</span>
              </div>
            </div>
          }

          <!-- Action Footer -->
          <div class="card-footer">
            <button type="button" class="btn-toggle-expand" (click)="toggleExpand()">
              <span>{{ isExpanded ? 'Hide Info' : 'Inspect Lot' }}</span>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                [style.transform]="isExpanded ? 'rotate(180deg)' : 'rotate(0)'"
              >
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>

            <app-hover-border-gradient (btnClick)="onBidClick()">
              <span>Place Quick Bid</span>
            </app-hover-border-gradient>
          </div>
        </div>
      </div>
    </app-card-spotlight>
  `,
  styles: [`
    .auction-card-container {
      display: flex;
      flex-direction: column;
      height: 100%;
    }

    .card-visual-header {
      position: relative;
      width: 100%;
      height: 180px;
      overflow: hidden;
      border-top-left-radius: inherit;
      border-top-right-radius: inherit;
    }

    .image-wrapper {
      width: 100%;
      height: 100%;
      position: relative;
    }

    .lot-image {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);

      .auction-card-container:hover & {
        transform: scale(1.05);
      }
    }

    .image-gradient-overlay {
      position: absolute;
      inset: 0;
      background: linear-gradient(180deg, rgba(0, 0, 0, 0.1) 0%, rgba(15, 23, 42, 0.6) 100%);
    }

    .status-floating-badge {
      position: absolute;
      top: 12px;
      right: 12px;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 3px 8px;
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border-radius: var(--radius-full);
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);

      &.status-active {
        background: #ecfdf5;
        color: #059669;
        border: 1px solid rgba(5, 150, 105, 0.3);
      }

      &.status-published {
        background: #f0fdf4;
        color: #16a34a;
        border: 1px solid rgba(22, 163, 74, 0.3);
      }

      &.status-draft {
        background: #f1f5f9;
        color: #64748b;
        border: 1px solid #cbd5e1;
      }

      &.status-pending {
        background: #fffbeb;
        color: #d97706;
        border: 1px solid rgba(217, 119, 6, 0.3);
      }
    }

    .status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: currentColor;
    }

    .category-pill {
      position: absolute;
      bottom: 12px;
      left: 14px;
      padding: 3px 8px;
      background: rgba(15, 23, 42, 0.75);
      backdrop-filter: blur(4px);
      border-radius: var(--radius-sm);
      font-size: 0.725rem;
      font-weight: 600;
      color: #ffffff;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .card-body {
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      flex: 1;
      justify-content: space-between;
      gap: 1rem;
      background: #ffffff;
    }

    .lot-title {
      font-size: 1.05rem;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 0.25rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .lot-desc {
      font-size: 0.8125rem;
      color: #64748b;
      line-height: 1.4;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .specs-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.5rem;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: var(--radius-sm);
      padding: 8px 10px;
    }

    .spec-cell {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .spec-name {
      font-size: 0.675rem;
      color: #94a3b8;
      text-transform: uppercase;
    }

    .spec-val {
      font-size: 0.8125rem;
      font-weight: 600;
      color: #1e293b;

      &.highlight-cyan {
        color: #0284c7;
      }
    }

    .price-timer-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-top: 0.5rem;
      border-top: 1px solid #f1f5f9;
    }

    .price-caption {
      font-size: 0.7rem;
      color: #64748b;
      text-transform: uppercase;
    }

    .price-value {
      font-size: 1.25rem;
      font-weight: 800;
      color: #059669;
      letter-spacing: -0.02em;
    }

    .timer-caption {
      font-size: 0.7rem;
      color: #64748b;
      text-transform: uppercase;
      text-align: right;
    }

    .timer-val {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 0.8125rem;
      font-weight: 600;
      color: #d97706;
    }

    .expanded-details-pane {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: var(--radius-sm);
      padding: 0.75rem;
      display: flex;
      flex-direction: column;
      gap: 6px;
      animation: expand-down 0.2s ease-out;
    }

    @keyframes expand-down {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .detail-row {
      display: flex;
      justify-content: space-between;
      font-size: 0.75rem;
    }

    .detail-label {
      color: var(--text-muted);
    }

    .detail-val {
      font-weight: 500;
      color: var(--text-primary);

      &.code-font {
        font-family: monospace;
        font-size: 0.7rem;
        color: var(--text-secondary);
      }
    }

    .card-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      margin-top: 0.25rem;
    }

    .btn-toggle-expand {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 0.75rem;
      font-weight: 500;
      color: var(--text-muted);
      transition: color 0.2s ease;

      &:hover {
        color: var(--text-primary);
      }

      svg {
        transition: transform 0.2s ease;
      }
    }
  `],
})
export class ExpandableAuctionCardComponent {
  @Input({ required: true }) lot!: AuctionLot;
  @Output() placeBid = new EventEmitter<AuctionLot>();

  isExpanded = false;
  readonly placeholderImage = 'https://images.unsplash.com/photo-1578328819058-b69f3a3b0f6b?auto=format&fit=crop&w=600&q=80';

  toggleExpand() {
    this.isExpanded = !this.isExpanded;
  }

  onBidClick() {
    this.placeBid.emit(this.lot);
  }

  formatCategory(cat: string): string {
    return cat.replace('_', ' ');
  }
}
