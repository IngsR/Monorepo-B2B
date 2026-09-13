import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconComponent } from '../../shared/ui/mat-icon.component';

interface FaqItem {
  question: string;
  answer: string;
  open: boolean;
}

/**
 * Halaman Panduan Lelang Khusus Pengguna Bidder.
 * Menyajikan instruksi komprehensif, alur penawaran, aturan bid increment,
 * dan tips menang lelang dalam Bahasa Indonesia dengan format institusional B2B.
 */
@Component({
  selector: 'app-auction-guide',
  standalone: true,
  imports: [RouterLink, MatIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page guide-page">
      <!-- 1. Hero Header -->
      <section class="guide-hero">
        <div class="guide-hero-content">
          <div class="guide-hero-badge">
            <mat-icon fontIcon="verified_user" [size]="14" />
            <span>Pusat Informasi & Tata Tertib Penawar B2B</span>
          </div>
          <h1 class="guide-hero-title">Panduan Resmi Mengikuti Lelang Pengadaan</h1>
          <p class="guide-hero-desc">
            Pelajari tata cara partisipasi, formulasi penawaran sah (bid increment), validasi waktu
            server-authoritative, hingga prosedur serah terima aset resmi di platform BidForge.
          </p>
          <div class="guide-hero-actions">
            <a routerLink="/marketplace" class="btn btn-primary">
              <mat-icon fontIcon="storefront" [size]="16" />
              <span>Jelajahi Lantai Lelang</span>
            </a>
            <a routerLink="/my-bids" class="btn btn-secondary">
              <mat-icon fontIcon="history" [size]="16" />
              <span>Lihat Penawaran Saya</span>
            </a>
          </div>
        </div>
      </section>

      <!-- 2. 5 Langkah Alur Partisipasi -->
      <section class="guide-section">
        <div class="section-title-wrap">
          <span class="section-tag">Alur Pengadaan</span>
          <h2 class="section-heading">5 Tahapan Mengikuti Lelang B2B</h2>
          <p class="section-subheading">
            Setiap tahapan penawaran dirancang transparan, aman, dan tercatat otomatis pada buku besar server.
          </p>
        </div>

        <div class="guide-steps-grid">
          <div class="step-card">
            <div class="step-num-badge">01</div>
            <div class="step-icon-box">
              <mat-icon fontIcon="search" [size]="22" />
            </div>
            <h3 class="step-title">Pilih Lot Lelang</h3>
            <p class="step-desc">
              Jelajahi katalog lelang berdasarkan kategori atau kode lot. Periksa spesifikasi
              teknis aset dan legalitas vendor penyedia.
            </p>
          </div>

          <div class="step-card">
            <div class="step-num-badge">02</div>
            <div class="step-icon-box">
              <mat-icon fontIcon="sell" [size]="22" />
            </div>
            <h3 class="step-title">Periksa Syarat & Harga</h3>
            <p class="step-desc">
              Ketahui harga awal, kelipatan kenaikan tawaran minimal (bid increment), serta jadwal
              penutupan lelang resmi.
            </p>
          </div>

          <div class="step-card">
            <div class="step-num-badge">03</div>
            <div class="step-icon-box">
              <mat-icon fontIcon="gavel" [size]="22" />
            </div>
            <h3 class="step-title">Kirim Penawaran (Bid)</h3>
            <p class="step-desc">
              Kirim tawaran sah melalui formulir bidding panel. Sistem server memvalidasi kelayakan
              nominal secara instan.
            </p>
          </div>

          <div class="step-card">
            <div class="step-num-badge">04</div>
            <div class="step-icon-box">
              <mat-icon fontIcon="trending_up" [size]="22" />
            </div>
            <h3 class="step-title">Pantau Peringkat Tawaran</h3>
            <p class="step-desc">
              Pantau status penawaran Anda. Jika posisi terlampaui (Outbid), pasang penawaran baru
              sebelum waktu lelang ditutup.
            </p>
          </div>

          <div class="step-card">
            <div class="step-num-badge">05</div>
            <div class="step-icon-box">
              <mat-icon fontIcon="task_alt" [size]="22" />
            </div>
            <h3 class="step-title">Penetapan Pemenang</h3>
            <p class="step-desc">
              Penawar sah tertinggi pada detik penutupan ditetapkan sebagai pemenang untuk proses
              faktur dan serah terima fisik aset.
            </p>
          </div>
        </div>
      </section>

      <!-- 3. Aturan Kunci Sistem Lelang -->
      <section class="guide-section">
        <div class="rules-container">
          <div class="rules-header">
            <div class="rules-icon-wrap">
              <mat-icon fontIcon="balance" [size]="22" />
            </div>
            <div>
              <h2 class="rules-title">Prinsip & Ketentuan Sistem Lelang</h2>
              <p class="rules-subtitle">
                Aturan baku sistem lelang server-authoritative yang berlaku mengikat bagi seluruh peserta
              </p>
            </div>
          </div>

          <div class="rules-grid">
            <div class="rule-box">
              <div class="rule-box-header">
                <mat-icon fontIcon="schedule" [size]="18" />
                <h4>Waktu Server-Authoritative</h4>
              </div>
              <p>
                Waktu lelang mengacu pada jam server terpusat. Penawaran dinyatakan sah apabila paket data
                berhasil divalidasi server sebelum waktu penutupan berakhir.
              </p>
            </div>

            <div class="rule-box">
              <div class="rule-box-header">
                <mat-icon fontIcon="calculate" [size]="18" />
                <h4>Kelipatan Kenaikan (Bid Increment)</h4>
              </div>
              <p>
                Setiap penawaran baru wajib memenuhi formula:
                <code>Tawaran Minimal = Tawaran Tertinggi + Kelipatan Kenaikan</code>. Sistem server
                menolak penawaran yang tidak memenuhi ambang batas ini.
              </p>
            </div>

            <div class="rule-box">
              <div class="rule-box-header">
                <mat-icon fontIcon="gavel" [size]="18" />
                <h4>Penawaran Bersifat Mengikat</h4>
              </div>
              <p>
                Penawaran yang telah diverifikasi dan masuk ke database tidak dapat ditarik kembali atau
                dibatalkan. Pastikan Anda telah meninjau spesifikasi lot secara teliti.
              </p>
            </div>

            <div class="rule-box">
              <div class="rule-box-header">
                <mat-icon fontIcon="verified" [size]="18" />
                <h4>Legalitas Vendor & Aset</h4>
              </div>
              <p>
                Semua vendor penyedia aset di platform telah melewati verifikasi dokumen legalitas resmi
                sebelum diizinkan menerbitkan lot lelang.
              </p>
            </div>
          </div>
        </div>
      </section>

      <!-- 4. Tips Sukses Bidding -->
      <section class="guide-section">
        <div class="section-title-wrap">
          <span class="section-tag">Strategi Pengadaan</span>
          <h2 class="section-heading">Rekomendasi Bidding untuk Penawar</h2>
        </div>

        <div class="tips-grid">
          <div class="tip-card">
            <span class="tip-icon"><mat-icon fontIcon="bolt" [size]="20" /></span>
            <div class="tip-body">
              <h4>Gunakan Tombol Shortcut Nominal Cepat</h4>
              <p>
                Manfaatkan tombol nominal cepat (+1 kelipatan, +2 kelipatan, dll.) pada panel penawaran
                untuk merespons kompetitor dalam hitungan detik saat lelang mendekati penutupan.
              </p>
            </div>
          </div>

          <div class="tip-card">
            <span class="tip-icon"><mat-icon fontIcon="notifications_active" [size]="20" /></span>
            <div class="tip-body">
              <h4>Pantau Tab "Terlampaui (Outbid)"</h4>
              <p>
                Periksa halaman <strong>Penawaran Saya</strong> secara berkala untuk memonitor apakah
                ada peserta lain yang memasang tawaran lebih tinggi pada lot yang Anda incar.
              </p>
            </div>
          </div>

          <div class="tip-card">
            <span class="tip-icon"><mat-icon fontIcon="account_balance_wallet" [size]="20" /></span>
            <div class="tip-body">
              <h4>Tentukan Batas Plafon Anggaran (Max Cap)</h4>
              <p>
                Tentukan nilai batas wajar aset sebelum penawaran dimulai agar pengadaan tetap berada
                dalam efisiensi anggaran perusahaan Anda.
              </p>
            </div>
          </div>
        </div>
      </section>

      <!-- 5. FAQ Accordion -->
      <section class="guide-section">
        <div class="section-title-wrap">
          <span class="section-tag">Tanya Jawab</span>
          <h2 class="section-heading">Pertanyaan Umum (FAQ)</h2>
        </div>

        <div class="faq-list">
          @for (faq of faqs(); track faq.question; let i = $index) {
            <div class="faq-item" [class.is-open]="faq.open">
              <button
                type="button"
                class="faq-question-btn"
                (click)="toggleFaq(i)"
                [attr.aria-expanded]="faq.open"
              >
                <span class="faq-q-text">{{ faq.question }}</span>
                <mat-icon [fontIcon]="faq.open ? 'expand_less' : 'expand_more'" [size]="20" />
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

      <!-- 6. Bottom CTA Card -->
      <section class="guide-cta-card">
        <div class="guide-cta-content">
          <h2 class="guide-cta-title">Siap Berpartisipasi di Lantai Lelang?</h2>
          <p class="guide-cta-desc">
            Ratusan lot mesin industri, peralatan pabrik, dan surplus komersial siap ditawar dengan
            transparansi penawaran penuh.
          </p>
          <div class="guide-cta-buttons">
            <a routerLink="/marketplace" class="btn btn-primary btn-lg">
              <mat-icon fontIcon="storefront" [size]="18" />
              <span>Jelajahi Lantai Lelang Sekarang</span>
            </a>
            <a routerLink="/profile/bidder" class="btn btn-secondary btn-lg">
              <mat-icon fontIcon="business" [size]="18" />
              <span>Periksa Profil Perusahaan Penawar</span>
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
        background: var(--c-surface);
        border: 1px solid var(--c-border);
        border-radius: var(--r-md);
        padding: var(--sp-7) var(--sp-8);
        box-shadow: var(--sh-xs);
      }

      .guide-hero-content {
        max-width: 780px;
        display: flex;
        flex-direction: column;
        gap: var(--sp-3);
      }

      .guide-hero-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: var(--fs-xs);
        font-weight: var(--fw-semibold);
        letter-spacing: var(--tracking-caps);
        text-transform: uppercase;
        color: var(--c-brand);
      }

      .guide-hero-title {
        font-size: var(--fs-3xl);
        font-weight: var(--fw-bold);
        color: var(--c-text);
        letter-spacing: -0.025em;
        line-height: var(--lh-tight);
      }

      .guide-hero-desc {
        font-size: var(--fs-base);
        color: var(--c-text-secondary);
        line-height: var(--lh-normal);
      }

      .guide-hero-actions {
        display: flex;
        align-items: center;
        gap: var(--sp-3);
        margin-top: var(--sp-3);
        flex-wrap: wrap;
      }

      /* Sections */
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
        font-size: var(--fs-2xs);
        font-weight: var(--fw-bold);
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--c-brand);
      }

      .section-heading {
        font-size: var(--fs-xl);
        font-weight: var(--fw-bold);
        color: var(--c-text);
        letter-spacing: -0.015em;
      }

      .section-subheading {
        font-size: var(--fs-sm);
        color: var(--c-text-muted);
        max-width: 70ch;
      }

      /* 5 Steps Grid */
      .guide-steps-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
        gap: var(--sp-4);
      }

      .step-card {
        background: var(--c-surface);
        border: 1px solid var(--c-border);
        border-radius: var(--r-md);
        padding: var(--sp-5);
        display: flex;
        flex-direction: column;
        gap: var(--sp-3);
        position: relative;
        transition: border-color var(--dur-fast) var(--ease);

        &:hover {
          border-color: var(--c-border-strong);
        }
      }

      .step-num-badge {
        font-family: var(--font-mono);
        font-size: var(--fs-xs);
        font-weight: var(--fw-bold);
        color: var(--c-brand);
        background: var(--c-brand-soft);
        border: 1px solid var(--c-brand-border);
        padding: 2px 6px;
        border-radius: var(--r-xs);
        width: fit-content;
      }

      .step-icon-box {
        width: 40px;
        height: 40px;
        border-radius: var(--r-sm);
        background: var(--c-canvas);
        color: var(--c-text);
        display: flex;
        align-items: center;
        justify-content: center;
        border: 1px solid var(--c-border);
      }

      .step-title {
        font-size: var(--fs-sm);
        font-weight: var(--fw-bold);
        color: var(--c-text);
        margin: 0;
      }

      .step-desc {
        font-size: var(--fs-xs);
        color: var(--c-text-muted);
        line-height: 1.5;
        margin: 0;
      }

      /* Rules Box */
      .rules-container {
        background: var(--c-surface);
        border: 1px solid var(--c-border);
        border-radius: var(--r-md);
        padding: var(--sp-6);
        display: flex;
        flex-direction: column;
        gap: var(--sp-5);
      }

      .rules-header {
        display: flex;
        align-items: center;
        gap: var(--sp-4);
      }

      .rules-icon-wrap {
        width: 44px;
        height: 44px;
        border-radius: var(--r-sm);
        background: var(--c-brand-soft);
        color: var(--c-brand);
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
        font-size: var(--fs-xs);
        color: var(--c-text-muted);
      }

      .rules-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
        gap: var(--sp-4);
      }

      .rule-box {
        background: var(--c-canvas);
        border: 1px solid var(--c-border);
        border-radius: var(--r-sm);
        padding: var(--sp-4);
        display: flex;
        flex-direction: column;
        gap: var(--sp-2);

        p {
          font-size: var(--fs-xs);
          color: var(--c-text-secondary);
          line-height: 1.55;
          margin: 0;
        }

        code {
          font-family: var(--font-mono);
          font-size: 0.72rem;
          background: var(--c-surface-sunken);
          padding: 2px 4px;
          border-radius: var(--r-xs);
        }
      }

      .rule-box-header {
        display: flex;
        align-items: center;
        gap: var(--sp-2);
        color: var(--c-brand);

        h4 {
          font-size: var(--fs-xs);
          font-weight: var(--fw-bold);
          color: var(--c-text);
          margin: 0;
        }
      }

      /* Tips */
      .tips-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: var(--sp-4);
      }

      .tip-card {
        background: var(--c-surface);
        border: 1px solid var(--c-border);
        border-radius: var(--r-md);
        padding: var(--sp-5);
        display: flex;
        gap: var(--sp-4);
      }

      .tip-icon {
        width: 36px;
        height: 36px;
        border-radius: var(--r-sm);
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
        gap: var(--sp-1);

        h4 {
          font-size: var(--fs-sm);
          font-weight: var(--fw-bold);
          color: var(--c-text);
          margin: 0;
        }

        p {
          font-size: var(--fs-xs);
          color: var(--c-text-muted);
          line-height: 1.5;
          margin: 0;
        }
      }

      /* FAQ */
      .faq-list {
        display: flex;
        flex-direction: column;
        gap: var(--sp-3);
      }

      .faq-item {
        background: var(--c-surface);
        border: 1px solid var(--c-border);
        border-radius: var(--r-md);
        overflow: hidden;
        transition: border-color var(--dur-fast) var(--ease);

        &.is-open {
          border-color: var(--c-border-strong);
        }
      }

      .faq-question-btn {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--sp-4) var(--sp-5);
        background: transparent;
        border: none;
        cursor: pointer;
        text-align: left;
        color: var(--c-text);
        font-size: var(--fs-sm);
        font-weight: var(--fw-semibold);

        &:hover {
          background: var(--c-canvas);
        }
      }

      .faq-answer-panel {
        padding: 0 var(--sp-5) var(--sp-4);
        font-size: var(--fs-xs);
        color: var(--c-text-secondary);
        line-height: 1.6;
        border-top: 1px solid var(--c-border);
        background: var(--c-canvas);
        padding-top: var(--sp-3);

        p {
          margin: 0;
        }
      }

      /* Bottom CTA Card */
      .guide-cta-card {
        background: var(--c-surface);
        border: 1px solid var(--c-border);
        border-radius: var(--r-md);
        padding: var(--sp-7);
        text-align: center;
      }

      .guide-cta-content {
        max-width: 620px;
        margin: 0 auto;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--sp-3);
      }

      .guide-cta-title {
        font-size: var(--fs-2xl);
        font-weight: var(--fw-bold);
        color: var(--c-text);
        letter-spacing: -0.02em;
      }

      .guide-cta-desc {
        font-size: var(--fs-sm);
        color: var(--c-text-muted);
        line-height: 1.55;
      }

      .guide-cta-buttons {
        display: flex;
        gap: var(--sp-3);
        margin-top: var(--sp-3);
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
        'Status lot lelang Anda akan otomatis beralih ke "Tawaran Terlampaui" di halaman Penawaran Saya. Anda dapat langsung memasang tawaran baru dengan nominal di atas tawaran tertinggi saat ini selama waktu lelang masih berjalan.',
      open: false,
    },
    {
      question: 'Kapan pemenang lelang resmi ditentukan?',
      answer:
        'Pemenang ditentukan secara otomatis oleh sistem server pada detik penutupan lelang. Peserta dengan penawaran tertinggi yang sah di database server akan ditetapkan sebagai pemenang.',
      open: false,
    },
    {
      question: 'Bagaimana proses pembayaran dan serah terima barang setelah menang?',
      answer:
        'Setelah lelang selesai, pihak vendor dan platform akan menerbitkan Berita Acara Pemenang serta Faktur Tagihan resmi. Pelunasan dilakukan via transfer perbankan terverifikasi, dilanjutkan penjadwalan serah terima fisik aset di gudang vendor.',
      open: false,
    },
    {
      question: 'Dapatkah saya membatalkan tawaran yang tidak sengaja terpasang?',
      answer:
        'Tidak bisa. Setiap penawaran yang diterima oleh server bersifat mengikat secara hukum dalam platform lelang B2B. Mohon teliti memeriksa nominal tawaran sebelum menekan tombol konfirmasi.',
      open: false,
    },
  ]);

  toggleFaq(index: number): void {
    this.faqs.update((items) =>
      items.map((item, idx) => (idx === index ? { ...item, open: !item.open } : item)),
    );
  }
}
