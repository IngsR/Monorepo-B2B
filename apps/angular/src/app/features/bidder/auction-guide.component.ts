import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../shared/ui/icon.component';

interface FaqItem {
  question: string;
  answer: string;
  open: boolean;
}

/**
 * Halaman Panduan Lelang Khusus Pengguna Bidder.
 * Menyajikan instruksi komprehensif, alur penawaran, aturan bid increment,
 * dan tips menang lelang dalam Bahasa Indonesia.
 */
@Component({
  selector: 'app-auction-guide',
  standalone: true,
  imports: [RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page guide-page">
      <!-- Hero Header -->
      <section class="guide-hero">
        <div class="guide-hero-content">
          <div class="guide-hero-badge">
            <app-icon name="shield" [size]="14" />
            <span>Pusat Bantuan & Edukasi Bidder</span>
          </div>
          <h1 class="guide-hero-title">Panduan Lengkap Mengikuti Lelang B2B</h1>
          <p class="guide-hero-desc">
            Pelajari tata cara, mekanisme penawaran harga, ketentuan kenaikan tawaran (bid increment),
            hingga proses serah terima aset lelang resmi di BidForge.
          </p>
          <div class="guide-hero-actions">
            <a routerLink="/marketplace" class="btn btn-hero">
              <app-icon name="gavel" [size]="16" />
              <span>Mulai Jelajahi Lelang</span>
            </a>
            <a routerLink="/my-bids" class="btn btn-hero-ghost">
              <app-icon name="trending-up" [size]="16" />
              <span>Lihat Tawaran Saya</span>
            </a>
          </div>
        </div>
      </section>

      <!-- 5 Langkah Mudah Alur Lelang -->
      <section class="guide-section">
        <div class="section-title-wrap">
          <span class="section-tag">Alur Partisipasi</span>
          <h2 class="section-heading">5 Langkah Mudah Mengikuti Lelang</h2>
          <p class="section-subheading">
            Proses lelang di BidForge dirancang transparan, aman, dan langsung tercatat secara real-time.
          </p>
        </div>

        <div class="guide-steps-grid">
          <div class="step-card">
            <div class="step-num-badge">1</div>
            <div class="step-icon-box">
              <app-icon name="search" [size]="24" />
            </div>
            <h3 class="step-title">Pilih Lot Lelang</h3>
            <p class="step-desc">
              Jelajahi marketplace berdasarkan kategori, lokasi gudang, atau kode lot. Periksa spesifikasi
              teknis, kondisi fisik, dan informasi vendor terverifikasi.
            </p>
          </div>

          <div class="step-card">
            <div class="step-num-badge">2</div>
            <div class="step-icon-box">
              <app-icon name="tag" [size]="24" />
            </div>
            <h3 class="step-title">Cek Ketentuan & Harga</h3>
            <p class="step-desc">
              Perhatikan harga awal, kelipatan kenaikan penawaran (bid increment), dan sisa waktu lelang
              pada countdown timer real-time.
            </p>
          </div>

          <div class="step-card">
            <div class="step-num-badge">3</div>
            <div class="step-icon-box">
              <app-icon name="gavel" [size]="24" />
            </div>
            <h3 class="step-title">Pasang Penawaran (Bid)</h3>
            <p class="step-desc">
              Gunakan tombol shortcut nominal cepat atau masukkan nominal Anda. Tawaran minimal adalah
              harga tertinggi saat ini ditambah satu kelipatan kenaikan.
            </p>
          </div>

          <div class="step-card">
            <div class="step-num-badge">4</div>
            <div class="step-icon-box">
              <app-icon name="trending-up" [size]="24" />
            </div>
            <h3 class="step-title">Pantau Status Bidding</h3>
            <p class="step-desc">
              Jika tawaran Anda terlampaui peserta lain (status <strong>Outbid</strong>), Anda dapat
              memasang penawaran baru sebelum batas waktu penutupan berakhir.
            </p>
          </div>

          <div class="step-card">
            <div class="step-num-badge">5</div>
            <div class="step-icon-box">
              <app-icon name="check" [size]="24" />
            </div>
            <h3 class="step-title">Menang & Pelunasan</h3>
            <p class="step-desc">
              Peserta dengan tawaran sah tertinggi saat waktu lelang berakhir dinyatakan sebagai pemenang
              resmi dan akan dihubungi untuk konfirmasi faktur serah terima.
            </p>
          </div>
        </div>
      </section>

      <!-- Aturan Kunci Sistem Lelang -->
      <section class="guide-section">
        <div class="rules-container card">
          <div class="rules-header">
            <div class="rules-icon-wrap">
              <app-icon name="info" [size]="22" />
            </div>
            <div>
              <h2 class="rules-title">Ketentuan Mutlak & Sistem Penawaran</h2>
              <p class="rules-subtitle">
                Prinsip kerja sistem lelang server-authoritative di platform BidForge
              </p>
            </div>
          </div>

          <div class="rules-grid">
            <div class="rule-box">
              <div class="rule-box-header">
                <app-icon name="clock" [size]="18" />
                <h4>Server-Authoritative Timing</h4>
              </div>
              <p>
                Waktu lelang dihitung berdasarkan jam server terpusat. Penawaran dinyatakan sah hanya jika
                paket data berhasil diterima server sebelum hitungan mundur mencapai 00:00:00.
              </p>
            </div>

            <div class="rule-box">
              <div class="rule-box-header">
                <app-icon name="layers" [size]="18" />
                <h4>Kelipatan Tawaran (Bid Increment)</h4>
              </div>
              <p>
                Setiap penawaran baru wajib memenuhi formula:
                <code>Tawaran Minimal = Tawaran Tertinggi Saat Ini + Kelipatan Kenaikan</code>. Sistem akan
                menolak penawaran yang di bawah ambang batas ini.
              </p>
            </div>

            <div class="rule-box">
              <div class="rule-box-header">
                <app-icon name="shield" [size]="18" />
                <h4>Penawaran Bersifat Mengikat</h4>
              </div>
              <p>
                Setiap penawaran yang telah dipasang tidak dapat dibatalkan atau ditarik kembali oleh peserta.
                Pastikan Anda telah memeriksa spesifikasi aset secara menyeluruh sebelum menawar.
              </p>
            </div>

            <div class="rule-box">
              <div class="rule-box-header">
                <app-icon name="building" [size]="18" />
                <h4>Verifikasi Identitas Vendor & Aset</h4>
              </div>
              <p>
                Seluruh lot lelang diunggah oleh vendor institusi resmi yang telah melewati verifikasi legalitas
                perusahaan dan kelayakan aset oleh tim kurator BidForge.
              </p>
            </div>
          </div>
        </div>
      </section>

      <!-- Tips Sukses Menang Lelang -->
      <section class="guide-section">
        <div class="section-title-wrap">
          <span class="section-tag">Strategi Bidding</span>
          <h2 class="section-heading">Tips Sukses Memenangkan Lot Lelang</h2>
        </div>

        <div class="tips-grid">
          <div class="tip-card">
            <span class="tip-icon"><app-icon name="sparkles" [size]="20" /></span>
            <div class="tip-body">
              <h4>Gunakan Tombol Shortcut Kenaikan Cepat</h4>
              <p>
                Saat lelang mendekati menit-menit akhir, gunakan tombol preset (+Rp 50rb, +Rp 100rb, dll.)
                agar dapat merespons penawaran kompetitor dalam hitungan detik.
              </p>
            </div>
          </div>

          <div class="tip-card">
            <span class="tip-icon"><app-icon name="bell" [size]="20" /></span>
            <div class="tip-body">
              <h4>Pantau Halaman "Tawaran Saya"</h4>
              <p>
                Filter tab <strong>Terlampaui (Outbid)</strong> secara rutin untuk langsung mengetahui jika ada
                peserta lain yang menaikkan tawaran di lot yang sedang Anda incar.
              </p>
            </div>
          </div>

          <div class="tip-card">
            <span class="tip-icon"><app-icon name="tag" [size]="20" /></span>
            <div class="tip-body">
              <h4>Tentukan Batas Maksimum Anggaran (Max Cap)</h4>
              <p>
                Tentukan nilai estimasi wajar aset sebelum lelang dimulai, sehingga Anda dapat menawar dengan
                percaya diri dan tetap berada dalam koridor anggaran perusahaan.
              </p>
            </div>
          </div>
        </div>
      </section>

      <!-- FAQ Section -->
      <section class="guide-section">
        <div class="section-title-wrap">
          <span class="section-tag">Tanya Jawab</span>
          <h2 class="section-heading">Pertanyaan yang Sering Diajukan (FAQ)</h2>
        </div>

        <div class="faq-list">
          @for (faq of faqs(); track faq.question; let i = $index) {
            <div class="faq-item card" [class.is-open]="faq.open">
              <button
                type="button"
                class="faq-question-btn"
                (click)="toggleFaq(i)"
                [attr.aria-expanded]="faq.open"
              >
                <span class="faq-q-text">{{ faq.question }}</span>
                <app-icon [name]="faq.open ? 'chevron-up' : 'chevron-down'" [size]="18" />
              </button>
              @if (faq.open) {
                <div class="faq-answer-panel">
                  <p>{{ faq.answer }}</p>
                </div>
              }
            </div>
          }
        </div>
      </section>

      <!-- Bottom Call To Action -->
      <section class="guide-cta-card card">
        <div class="guide-cta-content">
          <h2 class="guide-cta-title">Siap Memulai Penawaran Perdana Anda?</h2>
          <p class="guide-cta-desc">
            Ratusan lot mesin pabrik, peralatan industri, dan kendaraan operasional siap untuk Anda tawar
            dengan harga kompetitif.
          </p>
          <div class="guide-cta-buttons">
            <a routerLink="/marketplace" class="btn btn-primary btn-lg">
              <app-icon name="gavel" [size]="18" />
              <span>Jelajahi Katalog Lelang Sekarang</span>
            </a>
            <a routerLink="/profile/bidder" class="btn btn-secondary btn-lg">
              <app-icon name="user" [size]="18" />
              <span>Periksa Profil Bidder</span>
            </a>
          </div>
        </div>
      </section>
    </div>
  `,
  styles: [
    `
      .guide-page {
        display: flex;
        flex-direction: column;
        gap: var(--sp-8);
      }

      /* Hero */
      .guide-hero {
        position: relative;
        background: linear-gradient(135deg, #00aa5b 0%, #00733d 100%);
        border-radius: var(--r-lg);
        padding: var(--sp-9) var(--sp-8);
        color: #ffffff;
        box-shadow: 0 4px 20px rgba(0, 170, 91, 0.25);
        overflow: hidden;

        &::after {
          content: '';
          position: absolute;
          bottom: -40px;
          right: -40px;
          width: 280px;
          height: 280px;
          border-radius: var(--r-full);
          background: rgba(255, 255, 255, 0.08);
          pointer-events: none;
        }
      }

      .guide-hero-content {
        position: relative;
        z-index: 1;
        max-width: 720px;
        display: flex;
        flex-direction: column;
        gap: var(--sp-4);
      }

      .guide-hero-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: rgba(255, 255, 255, 0.18);
        padding: 4px 12px;
        border-radius: var(--r-full);
        font-size: var(--fs-xs);
        font-weight: var(--fw-semibold);
        color: #ffffff;
        width: fit-content;
      }

      .guide-hero-title {
        font-size: var(--fs-3xl);
        font-weight: var(--fw-bold);
        color: #ffffff;
        line-height: 1.15;
        letter-spacing: -0.02em;

        @media (max-width: 640px) {
          font-size: var(--fs-2xl);
        }
      }

      .guide-hero-desc {
        font-size: var(--fs-md);
        color: #e6f9ef;
        line-height: 1.6;
      }

      .guide-hero-actions {
        display: flex;
        align-items: center;
        gap: var(--sp-4);
        margin-top: var(--sp-2);
        flex-wrap: wrap;
      }

      /* Section Common */
      .guide-section {
        display: flex;
        flex-direction: column;
        gap: var(--sp-5);
      }

      .section-title-wrap {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .section-tag {
        font-size: var(--fs-xs);
        font-weight: var(--fw-bold);
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--c-brand);
      }

      .section-heading {
        font-size: var(--fs-xl);
        font-weight: var(--fw-bold);
        color: var(--c-text);
      }

      .section-subheading {
        font-size: var(--fs-sm);
        color: var(--c-text-secondary);
        max-width: 60ch;
      }

      /* 5 Steps Grid */
      .guide-steps-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: var(--sp-4);
      }

      .step-card {
        position: relative;
        background: var(--c-surface);
        border: 1px solid var(--c-border);
        border-radius: var(--r-lg);
        padding: var(--sp-6) var(--sp-5);
        display: flex;
        flex-direction: column;
        gap: var(--sp-3);
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.03);
        transition: transform var(--dur-fast) var(--ease), border-color var(--dur-fast) var(--ease);

        &:hover {
          transform: translateY(-4px);
          border-color: var(--c-brand-border);
        }
      }

      .step-num-badge {
        position: absolute;
        top: var(--sp-3);
        right: var(--sp-3);
        font-size: var(--fs-2xl);
        font-weight: var(--fw-bold);
        color: var(--c-surface-sunken);
        font-family: var(--font-mono);
        line-height: 1;
      }

      .step-icon-box {
        width: 48px;
        height: 48px;
        border-radius: var(--r-md);
        background: var(--c-brand-soft);
        color: var(--c-brand);
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .step-title {
        font-size: var(--fs-md);
        font-weight: var(--fw-bold);
        color: var(--c-text);
      }

      .step-desc {
        font-size: var(--fs-sm);
        color: var(--c-text-secondary);
        line-height: 1.55;
      }

      /* Rules Card */
      .rules-container {
        padding: var(--sp-6);
        background: var(--c-surface);
        border: 1px solid var(--c-border);
        border-radius: var(--r-lg);
        display: flex;
        flex-direction: column;
        gap: var(--sp-6);
      }

      .rules-header {
        display: flex;
        align-items: center;
        gap: var(--sp-4);
        padding-bottom: var(--sp-4);
        border-bottom: 1px solid var(--c-border);
      }

      .rules-icon-wrap {
        width: 44px;
        height: 44px;
        border-radius: var(--r-full);
        background: var(--c-info-soft);
        color: var(--c-info);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .rules-title {
        font-size: var(--fs-lg);
        font-weight: var(--fw-bold);
        color: var(--c-text);
      }

      .rules-subtitle {
        font-size: var(--fs-sm);
        color: var(--c-text-muted);
      }

      .rules-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
        gap: var(--sp-5);
      }

      .rule-box {
        display: flex;
        flex-direction: column;
        gap: var(--sp-2);
        padding: var(--sp-4);
        border-radius: var(--r-md);
        background: var(--c-canvas);
        border: 1px solid var(--c-border);

        p {
          font-size: var(--fs-sm);
          color: var(--c-text-secondary);
          line-height: 1.5;
        }

        code {
          display: block;
          margin-top: 6px;
          padding: 4px 8px;
          border-radius: var(--r-sm);
          background: var(--c-surface);
          border: 1px solid var(--c-border-strong);
          font-family: var(--font-mono);
          font-size: 0.75rem;
          color: var(--c-brand);
        }
      }

      .rule-box-header {
        display: flex;
        align-items: center;
        gap: var(--sp-2);
        color: var(--c-brand);

        h4 {
          font-size: var(--fs-sm);
          font-weight: var(--fw-bold);
          color: var(--c-text);
        }
      }

      /* Tips Grid */
      .tips-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: var(--sp-4);
      }

      .tip-card {
        display: flex;
        align-items: flex-start;
        gap: var(--sp-4);
        padding: var(--sp-5);
        background: var(--c-surface);
        border: 1px solid var(--c-border);
        border-radius: var(--r-lg);
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
      }

      .tip-icon {
        width: 38px;
        height: 38px;
        border-radius: var(--r-md);
        background: var(--c-brand-soft);
        color: var(--c-brand);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .tip-body {
        display: flex;
        flex-direction: column;
        gap: 4px;

        h4 {
          font-size: var(--fs-base);
          font-weight: var(--fw-bold);
          color: var(--c-text);
        }

        p {
          font-size: var(--fs-sm);
          color: var(--c-text-secondary);
          line-height: 1.5;
        }
      }

      /* FAQ */
      .faq-list {
        display: flex;
        flex-direction: column;
        gap: var(--sp-3);
      }

      .faq-item {
        border: 1px solid var(--c-border);
        border-radius: var(--r-md);
        overflow: hidden;
        transition: border-color var(--dur-fast) var(--ease);

        &.is-open {
          border-color: var(--c-brand-border);
        }
      }

      .faq-question-btn {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--sp-4) var(--sp-5);
        background: var(--c-surface);
        border: none;
        cursor: pointer;
        text-align: left;
        color: var(--c-text);
        font-family: inherit;

        &:hover {
          background: var(--c-surface-hover);
        }
      }

      .faq-q-text {
        font-size: var(--fs-base);
        font-weight: var(--fw-semibold);
      }

      .faq-answer-panel {
        padding: var(--sp-4) var(--sp-5) var(--sp-5);
        background: var(--c-canvas);
        border-top: 1px solid var(--c-border);

        p {
          font-size: var(--fs-sm);
          color: var(--c-text-secondary);
          line-height: 1.6;
        }
      }

      /* Bottom CTA Card */
      .guide-cta-card {
        padding: var(--sp-8);
        background: linear-gradient(180deg, var(--c-surface) 0%, var(--c-brand-soft) 100%);
        border: 1px solid var(--c-brand-border);
        border-radius: var(--r-lg);
        text-align: center;
      }

      .guide-cta-content {
        max-width: 600px;
        margin: 0 auto;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--sp-4);
      }

      .guide-cta-title {
        font-size: var(--fs-2xl);
        font-weight: var(--fw-bold);
        color: var(--c-text);
      }

      .guide-cta-desc {
        font-size: var(--fs-base);
        color: var(--c-text-secondary);
        line-height: 1.5;
      }

      .guide-cta-buttons {
        display: flex;
        gap: var(--sp-4);
        margin-top: var(--sp-2);
        flex-wrap: wrap;
        justify-content: center;
      }
    `,
  ],
})
export class AuctionGuideComponent {
  readonly faqs = signal<FaqItem[]>([
    {
      question: 'Apakah ada biaya pendaftaran untuk menawar di BidForge?',
      answer:
        'Tidak ada biaya pendaftaran. Akun bidder yang telah diverifikasi dapat langsung mengikuti seluruh lelang aktif yang terbuka untuk umum.',
      open: true,
    },
    {
      question: 'Bagaimana jika penawaran saya terlampaui (Outbid)?',
      answer:
        'Anda akan melihat status "Tawaran Terlampaui" di halaman Tawaran Saya. Anda dapat langsung memasang tawaran baru dengan nominal di atas tawaran tertinggi saat ini selama waktu lelang masih berjalan.',
      open: false,
    },
    {
      question: 'Kapan pemenang lelang resmi ditentukan?',
      answer:
        'Pemenang ditentukan secara otomatis oleh sistem pada detik penutupan lelang berakhir. Peserta dengan penawaran tertinggi yang sah di database server akan dinyatakan sebagai pemenang.',
      open: false,
    },
    {
      question: 'Bagaimana proses pembayaran dan serah terima barang setelah menang?',
      answer:
        'Setelah lelang selesai, tim vendor dan platform akan menerbitkan Berita Acara Pemenang dan Faktur Tagihan. Pelunasan dilakukan via transfer bank resmi, dilanjutkan penjadwalan pengambilan barang fisik di gudang vendor.',
      open: false,
    },
    {
      question: 'Dapatkah saya membatalkan tawaran yang tidak sengaja terpasang?',
      answer:
        'Tidak bisa. Setiap penawaran yang diterima oleh server bersifat mengikat secara hukum. Mohon teliti memeriksa nominal tawaran sebelum menekan tombol konfirmasi.',
      open: false,
    },
  ]);

  toggleFaq(index: number): void {
    this.faqs.update((items) =>
      items.map((item, idx) => (idx === index ? { ...item, open: !item.open } : item)),
    );
  }
}
