import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconComponent } from '../../shared/ui/mat-icon.component';

interface WorkflowStep {
  step: string;
  title: string;
  icon: string;
  badge: string;
  summary: string;
  keyPoints: string[];
}

/**
 * Panduan Penjualan — Vendor Operational Guide.
 *
 * Explains the formal 4-stage B2B auction lifecycle based strictly on actual
 * NestJS backend domain rules: Product Registration -> Auction Draft ->
 * Scheduled / Active -> Ended & Winner Derivation.
 */
@Component({
  selector: 'app-vendor-guide',
  standalone: true,
  imports: [RouterLink, MatIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page vendor-guide-page">
      <!-- Header -->
      <header class="page-head">
        <div class="page-head-text">
          <div class="guide-eyebrow">
            <span class="guide-eyebrow-tag">SOP OPERASIONAL PENJUAL</span>
            <span class="guide-eyebrow-id">ScrapBid Core Flow</span>
          </div>
          <h1 class="page-title">Panduan Penjualan Lot Lelang</h1>
          <p class="page-subtitle">
            Alur kerja resmi pengadaan dan pelelangan barang industri dari inventaris hingga penetapan pemenang lot.
          </p>
        </div>
        <div class="page-actions">
          <a class="btn btn-secondary" routerLink="/vendor">
            <mat-icon fontIcon="dashboard" [size]="16" />
            <span>Kembali ke Ringkasan</span>
          </a>
          <a class="btn btn-seller" routerLink="/vendor/products/new">
            <mat-icon fontIcon="add" [size]="16" />
            <span>Tambah Barang Baru</span>
          </a>
        </div>
      </header>

      <!-- Horizontal Process Tracker (Desktop) / Vertical Timeline (Mobile) -->
      <section class="guide-workflow-container" aria-label="Alur Tahapan Penjualan">
        <div class="workflow-header-strip">
          <h2 class="workflow-heading">Tahapan Operasional Penjualan (01 — 04)</h2>
          <span class="workflow-rule-note">Siklus status terikat pada aturan lifecycle backend</span>
        </div>

        <div class="workflow-track">
          @for (item of steps; track item.step) {
            <article class="workflow-card">
              <div class="workflow-card-head">
                <span class="workflow-step-num">{{ item.step }}</span>
                <span class="workflow-step-badge">{{ item.badge }}</span>
              </div>

              <div class="workflow-icon-box">
                <mat-icon [fontIcon]="item.icon" [size]="22" />
              </div>

              <h3 class="workflow-step-title">{{ item.title }}</h3>
              <p class="workflow-step-desc">{{ item.summary }}</p>

              <ul class="workflow-points-list" role="list">
                @for (point of item.keyPoints; track point) {
                  <li class="workflow-point-item">
                    <mat-icon fontIcon="check" [size]="14" class="point-check-icon" />
                    <span>{{ point }}</span>
                  </li>
                }
              </ul>
            </article>
          }
        </div>
      </section>

      <!-- Key Operational Principles -->
      <section class="guide-principles-section" aria-label="Ketentuan Penting Operasional">
        <div class="principles-grid">
          <div class="principle-card">
            <div class="principle-icon-wrap">
              <mat-icon fontIcon="lock" [size]="20" />
            </div>
            <div class="principle-body">
              <h3 class="principle-title">Integritas Ketentuan Lelang</h3>
              <p class="principle-text">
                Harga buka dan kelipatan penawaran hanya dapat diubah saat lelang berstatus <strong>DRAFT</strong>.
                Setelah lelang dijadwalkan atau aktif, parameter terkunci untuk menjamin kepastian bagi seluruh peserta.
              </p>
            </div>
          </div>

          <div class="principle-card">
            <div class="principle-icon-wrap">
              <mat-icon fontIcon="schedule" [size]="20" />
            </div>
            <div class="principle-body">
              <h3 class="principle-title">Batas Waktu Penawaran Sah</h3>
              <p class="principle-text">
                Penawaran hanya diterima selama jendela waktu aktif (antara waktu mulai dan berakhir).
                Ketika waktu berakhir tercapai, sistem secara otomatis menolak tawaran baru sebelum lot ditutup resmi.
              </p>
            </div>
          </div>

          <div class="principle-card">
            <div class="principle-icon-wrap">
              <mat-icon fontIcon="emoji_events" [size]="20" />
            </div>
            <div class="principle-body">
              <h3 class="principle-title">Penetapan Pemenang Otomatis</h3>
              <p class="principle-text">
                Pemenang lelang secara otomatis ditentukan oleh server dari penawaran tertinggi yang tercatat sah saat lot
                ditutup menjadi <strong>SELESAI (ENDED)</strong>.
              </p>
            </div>
          </div>
        </div>
      </section>

      <!-- Quick Action Footer -->
      <section class="guide-footer-cta">
        <div class="cta-inner">
          <div class="cta-text-block">
            <h3 class="cta-title">Siap memulai penjualan lelang?</h3>
            <p class="cta-desc">
              Daftarkan inventaris barang Anda sekarang atau susun draf lelang baru untuk dipublikasikan.
            </p>
          </div>
          <div class="cta-actions">
            <a class="btn btn-secondary" routerLink="/vendor/products">
              <mat-icon fontIcon="inventory_2" [size]="16" />
              <span>Katalog Barang Saya</span>
            </a>
            <a class="btn btn-seller" routerLink="/vendor/auctions/new">
              <mat-icon fontIcon="gavel" [size]="16" />
              <span>Buat Lot Lelang</span>
            </a>
          </div>
        </div>
      </section>
    </div>
  `,
  styles: [
    `
      .vendor-guide-page {
        display: flex;
        flex-direction: column;
        gap: var(--sp-6);
      }

      .guide-eyebrow {
        display: flex;
        align-items: center;
        gap: var(--sp-2);
        margin-bottom: var(--sp-1);
      }

      .guide-eyebrow-tag {
        font-size: 0.65rem;
        font-weight: var(--fw-bold);
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--c-seller);
        background: var(--c-seller-soft);
        border: 1px solid var(--c-seller-border);
        padding: 2px 7px;
        border-radius: var(--r-xs);
      }

      .guide-eyebrow-id {
        font-family: var(--font-mono);
        font-size: var(--fs-xs);
        color: var(--c-text-muted);
      }

      /* Workflow Tracker */
      .guide-workflow-container {
        background: var(--c-surface);
        border: 1px solid var(--c-border);
        border-radius: var(--r-md);
        padding: var(--sp-5);
        display: flex;
        flex-direction: column;
        gap: var(--sp-5);
      }

      .workflow-header-strip {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: var(--sp-2);
        padding-bottom: var(--sp-3);
        border-bottom: 1px solid var(--c-border);
      }

      .workflow-heading {
        font-size: var(--fs-base);
        font-weight: var(--fw-bold);
        color: var(--c-text);
        margin: 0;
      }

      .workflow-rule-note {
        font-size: var(--fs-xs);
        color: var(--c-text-muted);
      }

      .workflow-track {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: var(--sp-4);
      }

      .workflow-card {
        background: #faf9f6;
        border: 1px solid var(--c-border);
        border-radius: var(--r-sm);
        padding: var(--sp-4);
        display: flex;
        flex-direction: column;
        gap: var(--sp-3);
        position: relative;
        transition: border-color var(--dur-fast);

        &:hover {
          border-color: var(--c-seller);
        }
      }

      .workflow-card-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .workflow-step-num {
        font-family: var(--font-mono);
        font-size: var(--fs-xs);
        font-weight: var(--fw-bold);
        color: var(--c-seller);
        background: var(--c-seller-soft);
        border: 1px solid var(--c-seller-border);
        padding: 2px 6px;
        border-radius: var(--r-xs);
      }

      .workflow-step-badge {
        font-size: 0.65rem;
        font-weight: var(--fw-semibold);
        text-transform: uppercase;
        color: var(--c-text-muted);
      }

      .workflow-icon-box {
        width: 38px;
        height: 38px;
        border-radius: var(--r-sm);
        background: var(--c-surface);
        border: 1px solid var(--c-border);
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--c-seller);
      }

      .workflow-step-title {
        font-size: var(--fs-sm);
        font-weight: var(--fw-bold);
        color: var(--c-text);
        margin: 0;
        line-height: var(--lh-snug);
      }

      .workflow-step-desc {
        font-size: var(--fs-xs);
        color: var(--c-text-secondary);
        margin: 0;
        line-height: var(--lh-normal);
      }

      .workflow-points-list {
        list-style: none;
        padding: 0;
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: 6px;
        border-top: 1px solid var(--c-border);
        padding-top: var(--sp-2);
      }

      .workflow-point-item {
        display: flex;
        align-items: flex-start;
        gap: 6px;
        font-size: 0.725rem;
        color: var(--c-text-secondary);
        line-height: 1.35;
      }

      .point-check-icon {
        color: var(--c-success);
        margin-top: 1px;
        flex-shrink: 0;
      }

      /* Principles Section */
      .principles-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: var(--sp-4);
      }

      .principle-card {
        background: var(--c-surface);
        border: 1px solid var(--c-border);
        border-radius: var(--r-md);
        padding: var(--sp-4);
        display: flex;
        gap: var(--sp-3);
      }

      .principle-icon-wrap {
        width: 36px;
        height: 36px;
        border-radius: var(--r-sm);
        background: var(--c-seller-soft);
        color: var(--c-seller);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .principle-title {
        font-size: var(--fs-sm);
        font-weight: var(--fw-bold);
        color: var(--c-text);
        margin: 0 0 4px 0;
      }

      .principle-text {
        font-size: var(--fs-xs);
        color: var(--c-text-secondary);
        margin: 0;
        line-height: var(--lh-normal);
      }

      /* Footer CTA */
      .guide-footer-cta {
        background: var(--c-surface);
        border: 1px solid var(--c-border);
        border-radius: var(--r-md);
        padding: var(--sp-5);
      }

      .cta-inner {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: var(--sp-4);
      }

      .cta-title {
        font-size: var(--fs-base);
        font-weight: var(--fw-bold);
        color: var(--c-text);
        margin: 0 0 4px 0;
      }

      .cta-desc {
        font-size: var(--fs-sm);
        color: var(--c-text-muted);
        margin: 0;
      }

      .cta-actions {
        display: flex;
        align-items: center;
        gap: var(--sp-3);
      }

      @media (max-width: 1024px) {
        .workflow-track {
          grid-template-columns: repeat(2, 1fr);
        }

        .principles-grid {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 640px) {
        .workflow-track {
          grid-template-columns: 1fr;
        }

        .cta-inner {
          flex-direction: column;
          align-items: flex-start;
        }

        .cta-actions {
          width: 100%;
          flex-direction: column;

          .btn {
            width: 100%;
            justify-content: center;
          }
        }
      }
    `,
  ],
})
export class VendorGuideComponent {
  readonly steps: WorkflowStep[] = [
    {
      step: '01',
      title: 'Pendaftaran Barang',
      icon: 'inventory_2',
      badge: 'Katalog',
      summary: 'Daftarkan data inventaris barang industri Anda ke dalam katalog.',
      keyPoints: [
        'Tetapkan kode produk unik internal',
        'Lengkapi nama dan deskripsi teknis',
        'Pilih kategori barang yang sesuai',
      ],
    },
    {
      step: '02',
      title: 'Penyusunan Lot Lelang',
      icon: 'note_add',
      badge: 'Status: Draf',
      summary: 'Buat lelang baru berbasis produk terdaftar dengan status awal Draf.',
      keyPoints: [
        'Pilih produk dari katalog inventaris',
        'Tentukan harga buka (starting price)',
        'Tetapkan kelipatan penawaran (increment)',
        'Tentukan tanggal mulai dan selesai',
      ],
    },
    {
      step: '03',
      title: 'Jadwal & Pelaksanaan',
      icon: 'gavel',
      badge: 'Status: Aktif',
      summary: 'Publikasikan lelang ke peserta. Sistem membuka lot pada jadwal mulai.',
      keyPoints: [
        'Transisi status DRAFT ke SCHEDULED',
        'Lot otomatis AKTIF saat waktu mulai tiba',
        'Peserta mengajukan penawaran sah di pasar',
        'Pantau pergerakan harga secara berkala',
      ],
    },
    {
      step: '04',
      title: 'Penutupan & Pemenang',
      icon: 'verified',
      badge: 'Status: Selesai',
      summary: 'Tutup lot setelah waktu habis untuk menetapkan pemenang lelang.',
      keyPoints: [
        'Penawaran otomatis ditutup sesuai jadwal',
        'Vendor melakukan konfirmasi penutupan ENDED',
        'Server menetapkan penawar tertinggi sah',
      ],
    },
  ];
}
