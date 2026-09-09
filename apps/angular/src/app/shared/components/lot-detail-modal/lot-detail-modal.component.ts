import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuctionLot } from '../../../core/models/auction.model';

export type DetailTab = 'SPECS' | 'LOGISTICS' | 'BIDS';

@Component({
  selector: 'app-lot-detail-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-backdrop" *ngIf="lot" (click)="onBackdropClick($event)">
      <div class="modal-container" role="dialog" aria-modal="true">
        <!-- 1. Modal Top Bar -->
        <div class="modal-header">
          <div class="header-left">
            <span class="lot-id-pill">{{ lot.id }}</span>
            <span class="category-pill">{{ getCategoryLabel(lot.category) }}</span>
            <span class="status-pill" [ngClass]="getStatusClass(lot.status)">
              <span class="status-dot"></span>
              {{ getStatusLabel(lot.status) }}
            </span>
          </div>

          <button
            type="button"
            class="btn-close-modal"
            (click)="close()"
            title="Tutup Detail Modal (Esc)"
            aria-label="Tutup"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <!-- 2. Modal Body Scrollable -->
        <div class="modal-body">
          <!-- Title & Description Header -->
          <div class="title-section">
            <h2 class="lot-title">{{ lot.title }}</h2>
            <p class="lot-desc">{{ lot.description }}</p>
          </div>

          <!-- Hero Overview Grid -->
          <div class="overview-grid">
            <!-- Left: High Res Image Gallery Preview -->
            <div class="gallery-wrapper">
              <div class="image-frame">
                <img
                  [src]="activeImage || lot.images[0]"
                  [alt]="lot.title"
                  class="main-asset-image"
                />
                <div class="image-overlay-info">
                  <span class="tonnage-badge">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
                      <line x1="7" y1="7" x2="7.01" y2="7"></line>
                    </svg>
                    {{ lot.quantity }} {{ lot.unit }}
                  </span>
                  <span class="seller-badge">
                    {{ lot.companyName || 'PT Vendor Industri' }}
                  </span>
                </div>
              </div>

              <!-- Thumbnails if multi images -->
              <div class="thumbnail-strip" *ngIf="lot.images.length > 1">
                <button
                  type="button"
                  *ngFor="let img of lot.images; let i = index"
                  class="thumb-btn"
                  [class.active]="(activeImage || lot.images[0]) === img"
                  (click)="activeImage = img"
                >
                  <img [src]="img" [alt]="'Foto ' + (i + 1)" />
                </button>
              </div>
            </div>

            <!-- Right: Pricing & Auction Metric Snapshot -->
            <div class="metrics-card">
              <div class="price-box">
                <div class="price-header">
                  <span class="price-label">TAWARAN TERTINGGI SAAT INI</span>
                  <span class="bid-count-tag">{{ lot.totalBids }} Tawaran Masuk</span>
                </div>
                <div class="current-price-val">
                  Rp {{ lot.currentPrice | number:'1.0-0' }}
                </div>
                <div class="price-sub-meta">
                  <span>Harga Awal: <strong>Rp {{ lot.startingPrice | number:'1.0-0' }}</strong></span>
                  <span *ngIf="lot.highestBidderName" class="top-bidder-meta">
                    Oleh: {{ lot.highestBidderName }}
                  </span>
                </div>
              </div>

              <!-- Countdown & Warehouse Mini Info -->
              <div class="quick-meta-list">
                <div class="meta-item">
                  <div class="meta-icon-box timer-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <circle cx="12" cy="12" r="10"></circle>
                      <polyline points="12 6 12 12 16 14"></polyline>
                    </svg>
                  </div>
                  <div class="meta-content">
                    <span class="meta-title">Sisa Waktu Penawaran</span>
                    <span class="meta-value highlight-time">{{ lot.timeRemaining || '04h 20m' }}</span>
                  </div>
                </div>

                <div class="meta-item">
                  <div class="meta-icon-box location-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                      <circle cx="12" cy="10" r="3"></circle>
                    </svg>
                  </div>
                  <div class="meta-content">
                    <span class="meta-title">Lokasi Fisik Barang</span>
                    <span class="meta-value">{{ lot.warehouseLocation || 'Gudang Konsinyasi Scrap, Cilegon' }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Deep Inspection Tab Navigation -->
          <div class="inspection-tabs-bar">
            <button
              type="button"
              class="tab-link"
              [class.active]="activeTab === 'SPECS'"
              (click)="activeTab = 'SPECS'"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
              </svg>
              <span>Spesifikasi & Manifest</span>
            </button>

            <button
              type="button"
              class="tab-link"
              [class.active]="activeTab === 'LOGISTICS'"
              (click)="activeTab = 'LOGISTICS'"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="1" y="3" width="15" height="13"></rect>
                <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
                <circle cx="5.5" cy="18.5" r="2.5"></circle>
                <circle cx="18.5" cy="18.5" r="2.5"></circle>
              </svg>
              <span>Logistik & Jadwal Survei</span>
            </button>

            <button
              type="button"
              class="tab-link"
              [class.active]="activeTab === 'BIDS'"
              (click)="activeTab = 'BIDS'"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
              </svg>
              <span>Audit Log Penawaran ({{ (lot.bidHistory || []).length }})</span>
            </button>
          </div>

          <!-- Tab 1: Spesifikasi Teknis & Manifest -->
          <div class="tab-pane" *ngIf="activeTab === 'SPECS'">
            <div class="spec-grid">
              <div class="spec-card">
                <span class="spec-k">Grade / Klasifikasi</span>
                <span class="spec-v">{{ lot.specs?.grade || 'ISRI Standard Grade' }}</span>
              </div>
              <div class="spec-card">
                <span class="spec-k">Tingkat Kemurnian</span>
                <span class="spec-v">{{ lot.specs?.purity || 'Baja Karbon Rendah Fe > 98%' }}</span>
              </div>
              <div class="spec-card">
                <span class="spec-k">Toleransi Kontaminasi</span>
                <span class="spec-v">{{ lot.specs?.contamination || '< 0.5% Bebas Non-Ferrous' }}</span>
              </div>
              <div class="spec-card">
                <span class="spec-k">Surat Legalitas & Kepemilikan</span>
                <span class="spec-v">{{ lot.specs?.legality || 'Surat Pelepasan Hak Resmi (SPH)' }}</span>
              </div>
              <div class="spec-card">
                <span class="spec-k">Sertifikat Timbangan</span>
                <span class="spec-v">{{ lot.specs?.scaleCertificate || 'Tera Metrologi Digital 2026' }}</span>
              </div>
              <div class="spec-card">
                <span class="spec-k">Estimasi Berat / Volume</span>
                <span class="spec-v">{{ lot.weightKg ? (lot.weightKg | number) + ' Kg (' + lot.quantity + ' ' + lot.unit + ')' : (lot.quantity + ' ' + lot.unit) }}</span>
              </div>
            </div>
          </div>

          <!-- Tab 2: Logistik & Survei Fisik -->
          <div class="tab-pane" *ngIf="activeTab === 'LOGISTICS'">
            <div class="logistics-box">
              <div class="info-row">
                <div class="info-label">Alamat Gudang Penjemputan:</div>
                <div class="info-value font-medium">{{ lot.warehouseLocation || 'Kawasan Industri Krakatau Steel, Cilegon' }}</div>
              </div>
              <div class="info-row">
                <div class="info-label">Jadwal Kunjungan & Survei Fisik:</div>
                <div class="info-value">{{ lot.specs?.inspectionSchedule || 'Senin - Jumat 09:00 - 15:00 WIB' }}</div>
              </div>
              <div class="info-row">
                <div class="info-label">Ketentuan Armada & Alat Muat:</div>
                <div class="info-value">{{ lot.specs?.loadingTerms || 'FOB Gudang Penjual (Biaya forklift dan truk ditanggung pemenang lelang)' }}</div>
              </div>
            </div>
          </div>

          <!-- Tab 3: Log Riwayat Penawaran -->
          <div class="tab-pane" *ngIf="activeTab === 'BIDS'">
            <div class="bids-log-table-wrap">
              <table class="bids-log-table">
                <thead>
                  <tr>
                    <th>Waktu Penawaran</th>
                    <th>Mitra Vendor</th>
                    <th>Nominal Tawaran</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let bid of lot.bidHistory || []" [class.winning-row]="bid.isWinning">
                    <td>{{ bid.time }}</td>
                    <td class="vendor-name-cell">
                      {{ bid.vendorName }}
                    </td>
                    <td class="amount-cell">Rp {{ bid.amount | number:'1.0-0' }}</td>
                    <td>
                      <span class="bid-status-pill" [class.winner]="bid.isWinning">
                        {{ bid.isWinning ? 'MEMIMPIN' : 'TERLEWATI' }}
                      </span>
                    </td>
                  </tr>
                  <tr *ngIf="!(lot.bidHistory && lot.bidHistory.length)">
                    <td colspan="4" class="empty-bids">Belum ada penawaran masuk untuk lot ini.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- 3. Modal Footer Action Bar (Contextual by Role) -->
        <div class="modal-footer">
          <!-- VENDOR ACTIONS -->
          <div class="vendor-action-bar" *ngIf="activeRole === 'VENDOR' && lot.status === 'ACTIVE'">
            <div class="quick-increment-group">
              <span class="quick-label">Tawaran Cepat:</span>
              <button type="button" class="btn-quick-chip" (click)="applyQuickBid(5000000)">+5 Jt</button>
              <button type="button" class="btn-quick-chip" (click)="applyQuickBid(10000000)">+10 Jt</button>
              <button type="button" class="btn-quick-chip" (click)="applyQuickBid(25000000)">+25 Jt</button>
              <button type="button" class="btn-quick-chip" (click)="applyQuickBid(50000000)">+50 Jt</button>
            </div>

            <div class="bid-submit-form">
              <div class="bid-input-wrap">
                <span class="currency-prefix">Rp</span>
                <input
                  type="number"
                  class="bid-nominal-input"
                  [(ngModel)]="customBidAmount"
                  [placeholder]="(lot.currentPrice + 5000000).toString()"
                  [min]="lot.currentPrice + 1000000"
                />
              </div>
              <button
                type="button"
                class="btn-submit-bid"
                (click)="submitBid()"
                [disabled]="!customBidAmount || customBidAmount <= lot.currentPrice"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                  <line x1="22" y1="2" x2="11" y2="13"></line>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
                <span>Kirim Tawaran</span>
              </button>
            </div>
          </div>

          <!-- ADMIN ACTIONS -->
          <div class="admin-action-bar" *ngIf="activeRole === 'ADMIN'">
            <div class="admin-notice">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              <span>Governance Admin: Pastikan manifest dan sertifikat tera telah valid sebelum diterbitkan.</span>
            </div>

            <div class="admin-btn-group">
              <button
                type="button"
                class="btn-admin-cancel"
                *ngIf="lot.status !== 'CANCELLED' && lot.status !== 'SOLD'"
                (click)="cancelThisLot()"
              >
                Tolak / Batalkan Lot
              </button>

              <button
                type="button"
                class="btn-admin-approve"
                *ngIf="lot.status === 'PENDING_REVIEW'"
                (click)="approveThisLot()"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                <span>Setujui & Publikasikan ke Live Floor</span>
              </button>
            </div>
          </div>

          <!-- SELLER OR GENERAL VIEW -->
          <div class="general-action-bar" *ngIf="activeRole === 'SELLER' || activeRole === 'DASHBOARD'">
            <span class="seller-meta-status">
              Pengajuan oleh <strong>{{ lot.sellerName || lot.companyName }}</strong> • Dibuat pada {{ lot.createdAt | date:'mediumDate' }}
            </span>
            <button type="button" class="btn-close-secondary" (click)="close()">
              Tutup Panel
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .modal-backdrop {
        position: fixed;
        inset: 0;
        z-index: 1200;
        background: rgba(15, 23, 42, 0.65);
        backdrop-filter: blur(4px);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.5rem;
      }

      .modal-container {
        width: 100%;
        max-width: 920px;
        max-height: 90vh;
        background: #ffffff;
        border-radius: 16px;
        border: 1px solid #e2e8f0;
        box-shadow: 0 25px 50px -12px rgba(15, 23, 42, 0.25);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        animation: modalIn 0.22s ease-out forwards;
      }

      @keyframes modalIn {
        from {
          opacity: 0;
          transform: translateY(12px) scale(0.98);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }

      /* Header */
      .modal-header {
        padding: 1rem 1.5rem;
        border-bottom: 1px solid #f1f5f9;
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: #ffffff;
      }

      .header-left {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      .lot-id-pill {
        font-family: monospace;
        font-size: 0.78rem;
        font-weight: 700;
        padding: 0.2rem 0.5rem;
        background: #f1f5f9;
        color: #475569;
        border-radius: 6px;
      }

      .category-pill {
        font-size: 0.72rem;
        font-weight: 600;
        padding: 0.2rem 0.6rem;
        background: #eef2ff;
        color: #4338ca;
        border-radius: 6px;
      }

      .status-pill {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        font-size: 0.72rem;
        font-weight: 700;
        padding: 0.2rem 0.6rem;
        border-radius: 6px;
      }

      .status-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: currentColor;
      }

      .status-active {
        background: #ecfdf5;
        color: #059669;
      }

      .status-pending {
        background: #fef3c7;
        color: #d97706;
      }

      .status-cancelled {
        background: #ffe4e6;
        color: #e11d48;
      }

      .btn-close-modal {
        width: 32px;
        height: 32px;
        border-radius: 8px;
        border: none;
        background: #f8fafc;
        color: #64748b;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.18s ease;
      }

      .btn-close-modal:hover {
        background: #e2e8f0;
        color: #0f172a;
      }

      /* Body */
      .modal-body {
        padding: 1.5rem;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
      }

      .title-section {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
      }

      .lot-title {
        font-size: 1.25rem;
        font-weight: 800;
        color: #0f172a;
        margin: 0;
        line-height: 1.35;
      }

      .lot-desc {
        font-size: 0.85rem;
        color: #475569;
        margin: 0;
        line-height: 1.5;
      }

      /* Overview Grid */
      .overview-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1.25rem;
      }

      .gallery-wrapper {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      .image-frame {
        position: relative;
        width: 100%;
        height: 240px;
        border-radius: 12px;
        overflow: hidden;
        background: #0f172a;
      }

      .main-asset-image {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .image-overlay-info {
        position: absolute;
        bottom: 0.75rem;
        left: 0.75rem;
        right: 0.75rem;
        display: flex;
        justify-content: space-between;
        gap: 0.5rem;
      }

      .tonnage-badge,
      .seller-badge {
        display: flex;
        align-items: center;
        gap: 0.35rem;
        padding: 0.3rem 0.6rem;
        border-radius: 6px;
        font-size: 0.72rem;
        font-weight: 700;
        backdrop-filter: blur(8px);
      }

      .tonnage-badge {
        background: rgba(15, 23, 42, 0.8);
        color: #f8fafc;
      }

      .seller-badge {
        background: rgba(255, 255, 255, 0.9);
        color: #0f172a;
      }

      .thumbnail-strip {
        display: flex;
        gap: 0.5rem;
      }

      .thumb-btn {
        width: 54px;
        height: 42px;
        border-radius: 6px;
        overflow: hidden;
        border: 2px solid transparent;
        padding: 0;
        background: #f1f5f9;
        cursor: pointer;
      }

      .thumb-btn.active {
        border-color: #4338ca;
      }

      .thumb-btn img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      /* Right Metrics */
      .metrics-card {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 1.25rem;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        gap: 1rem;
      }

      .price-box {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
      }

      .price-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .price-label {
        font-size: 0.68rem;
        font-weight: 700;
        color: #64748b;
        letter-spacing: 0.05em;
      }

      .bid-count-tag {
        font-size: 0.72rem;
        font-weight: 700;
        background: #eef2ff;
        color: #4338ca;
        padding: 0.15rem 0.5rem;
        border-radius: 4px;
      }

      .current-price-val {
        font-size: 1.75rem;
        font-weight: 800;
        color: #0f172a;
        letter-spacing: -0.02em;
      }

      .price-sub-meta {
        font-size: 0.76rem;
        color: #64748b;
        display: flex;
        flex-direction: column;
        gap: 0.15rem;
      }

      .top-bidder-meta {
        color: #059669;
        font-weight: 600;
      }

      .quick-meta-list {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        border-top: 1px solid #e2e8f0;
        padding-top: 0.875rem;
      }

      .meta-item {
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }

      .meta-icon-box {
        width: 34px;
        height: 34px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .timer-icon {
        background: #fef3c7;
        color: #d97706;
      }

      .location-icon {
        background: #e0e7ff;
        color: #4338ca;
      }

      .meta-content {
        display: flex;
        flex-direction: column;
      }

      .meta-title {
        font-size: 0.68rem;
        font-weight: 600;
        color: #64748b;
      }

      .meta-value {
        font-size: 0.78rem;
        font-weight: 700;
        color: #0f172a;
      }

      .highlight-time {
        color: #d97706;
      }

      /* Inspection Tabs */
      .inspection-tabs-bar {
        display: flex;
        gap: 0.5rem;
        border-bottom: 2px solid #f1f5f9;
        padding-bottom: 0.25rem;
      }

      .tab-link {
        display: flex;
        align-items: center;
        gap: 0.45rem;
        padding: 0.5rem 0.875rem;
        border: none;
        background: transparent;
        color: #64748b;
        font-size: 0.82rem;
        font-weight: 600;
        cursor: pointer;
        border-radius: 8px;
        transition: all 0.18s ease;
      }

      .tab-link:hover {
        color: #0f172a;
        background: #f8fafc;
      }

      .tab-link.active {
        color: #4338ca;
        background: #eef2ff;
        font-weight: 700;
      }

      /* Tab Content */
      .tab-pane {
        padding: 0.5rem 0;
      }

      .spec-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 0.75rem;
      }

      .spec-card {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        padding: 0.75rem;
        border-radius: 8px;
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }

      .spec-k {
        font-size: 0.68rem;
        font-weight: 600;
        color: #64748b;
      }

      .spec-v {
        font-size: 0.82rem;
        font-weight: 700;
        color: #0f172a;
      }

      .logistics-box {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 1rem;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }

      .info-row {
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
      }

      .info-label {
        font-size: 0.72rem;
        font-weight: 700;
        color: #475569;
      }

      .info-value {
        font-size: 0.82rem;
        color: #0f172a;
      }

      /* Bids Log Table */
      .bids-log-table-wrap {
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        overflow: hidden;
      }

      .bids-log-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.8rem;
      }

      .bids-log-table th {
        background: #f8fafc;
        padding: 0.65rem 0.875rem;
        text-align: left;
        color: #64748b;
        font-weight: 600;
        border-bottom: 1px solid #e2e8f0;
      }

      .bids-log-table td {
        padding: 0.65rem 0.875rem;
        border-bottom: 1px solid #f1f5f9;
        color: #334155;
      }

      .winning-row {
        background: #f0fdf4;
      }

      .vendor-name-cell {
        font-weight: 600;
        color: #0f172a;
      }

      .amount-cell {
        font-weight: 700;
        color: #0f172a;
      }

      .bid-status-pill {
        font-size: 0.68rem;
        font-weight: 700;
        padding: 0.15rem 0.45rem;
        border-radius: 4px;
        background: #f1f5f9;
        color: #64748b;
      }

      .bid-status-pill.winner {
        background: #dcfce7;
        color: #15803d;
      }

      .empty-bids {
        text-align: center;
        padding: 2rem;
        color: #94a3b8;
      }

      /* Footer */
      .modal-footer {
        padding: 1rem 1.5rem;
        border-top: 1px solid #e2e8f0;
        background: #f8fafc;
      }

      /* Vendor action */
      .vendor-action-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
      }

      .quick-increment-group {
        display: flex;
        align-items: center;
        gap: 0.4rem;
      }

      .quick-label {
        font-size: 0.72rem;
        font-weight: 700;
        color: #64748b;
      }

      .btn-quick-chip {
        padding: 0.35rem 0.65rem;
        border: 1px solid #cbd5e1;
        background: #ffffff;
        border-radius: 6px;
        font-size: 0.75rem;
        font-weight: 700;
        color: #334155;
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .btn-quick-chip:hover {
        border-color: #4338ca;
        color: #4338ca;
        background: #eef2ff;
      }

      .bid-submit-form {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      .bid-input-wrap {
        display: flex;
        align-items: center;
        background: #ffffff;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        padding: 0 0.6rem;
      }

      .currency-prefix {
        font-size: 0.75rem;
        font-weight: 700;
        color: #64748b;
      }

      .bid-nominal-input {
        border: none;
        outline: none;
        padding: 0.5rem 0.5rem;
        font-size: 0.85rem;
        font-weight: 700;
        color: #0f172a;
        width: 130px;
      }

      .btn-submit-bid {
        display: flex;
        align-items: center;
        gap: 0.45rem;
        padding: 0.55rem 1rem;
        border-radius: 8px;
        border: none;
        background: #059669;
        color: #ffffff;
        font-size: 0.82rem;
        font-weight: 700;
        cursor: pointer;
        transition: background 0.18s ease;
      }

      .btn-submit-bid:hover:not(:disabled) {
        background: #047857;
      }

      .btn-submit-bid:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      /* Admin action */
      .admin-action-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
      }

      .admin-notice {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.75rem;
        color: #475569;
      }

      .admin-btn-group {
        display: flex;
        gap: 0.5rem;
      }

      .btn-admin-cancel {
        padding: 0.5rem 0.9rem;
        border-radius: 8px;
        border: 1px solid #fecdd3;
        background: #fff1f2;
        color: #e11d48;
        font-size: 0.8rem;
        font-weight: 700;
        cursor: pointer;
      }

      .btn-admin-approve {
        display: flex;
        align-items: center;
        gap: 0.45rem;
        padding: 0.5rem 1.1rem;
        border-radius: 8px;
        border: none;
        background: #059669;
        color: #ffffff;
        font-size: 0.8rem;
        font-weight: 700;
        cursor: pointer;
      }

      /* General */
      .general-action-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .seller-meta-status {
        font-size: 0.78rem;
        color: #64748b;
      }

      .btn-close-secondary {
        padding: 0.45rem 1rem;
        border-radius: 8px;
        border: 1px solid #cbd5e1;
        background: #ffffff;
        color: #475569;
        font-size: 0.8rem;
        font-weight: 600;
        cursor: pointer;
      }

      @media (max-width: 768px) {
        .overview-grid {
          grid-template-columns: 1fr;
        }
        .spec-grid {
          grid-template-columns: 1fr 1fr;
        }
        .vendor-action-bar,
        .admin-action-bar {
          flex-direction: column;
          align-items: flex-start;
        }
      }
    `,
  ],
})
export class LotDetailModalComponent {
  @Input() lot: AuctionLot | null = null;
  @Input() activeRole: 'ADMIN' | 'SELLER' | 'VENDOR' | 'DASHBOARD' = 'VENDOR';

  @Output() closeModal = new EventEmitter<void>();
  @Output() placeBid = new EventEmitter<{ lotId: string; amount: number }>();
  @Output() approveLot = new EventEmitter<string>();
  @Output() cancelLot = new EventEmitter<{ lotId: string; reason?: string }>();

  activeTab: DetailTab = 'SPECS';
  activeImage: string | null = null;
  customBidAmount: number | null = null;

  close(): void {
    this.closeModal.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
      this.close();
    }
  }

  applyQuickBid(increment: number): void {
    if (this.lot) {
      this.customBidAmount = this.lot.currentPrice + increment;
    }
  }

  submitBid(): void {
    if (this.lot && this.customBidAmount && this.customBidAmount > this.lot.currentPrice) {
      this.placeBid.emit({
        lotId: this.lot.id,
        amount: this.customBidAmount,
      });
      this.customBidAmount = null;
    }
  }

  approveThisLot(): void {
    if (this.lot) {
      this.approveLot.emit(this.lot.id);
    }
  }

  cancelThisLot(): void {
    if (this.lot) {
      this.cancelLot.emit({ lotId: this.lot.id });
    }
  }

  getCategoryLabel(cat: string): string {
    switch (cat) {
      case 'SCRAP_METAL':
        return 'Scrap Logam & Baja';
      case 'MACHINERY':
        return 'Mesin & Peralatan Pabrik';
      case 'VEHICLE':
        return 'Armada & Alat Berat';
      case 'ELECTRONICS':
        return 'E-Waste & Kabel Tembaga';
      default:
        return 'Surplus Industri';
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'ACTIVE':
        return 'Lelang Live';
      case 'PENDING_REVIEW':
        return 'Menunggu Review Admin';
      case 'CANCELLED':
        return 'Dibatalkan';
      case 'CLOSED':
      case 'SOLD':
        return 'Selesai / Terjual';
      default:
        return status;
    }
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'ACTIVE':
        return 'status-active';
      case 'PENDING_REVIEW':
        return 'status-pending';
      case 'CANCELLED':
        return 'status-cancelled';
      default:
        return 'status-pending';
    }
  }
}
