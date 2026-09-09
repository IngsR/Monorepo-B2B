import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuctionLot, LotCategory } from '../../core/models/auction.model';
import { AuctionStateService } from '../../core/services/auction-state.service';
import { AuthService } from '../../core/services/auth.service';
import { AnimatedTabsComponent, TabItem } from '../../shared/components/animated-tabs/animated-tabs.component';
import { ExpandableAuctionCardComponent } from '../../shared/components/expandable-auction-card/expandable-auction-card.component';
import { HoverBorderGradientComponent } from '../../shared/components/hover-border-gradient/hover-border-gradient.component';
import { StatItem, StatsSectionComponent } from '../../shared/components/stats-section/stats-section.component';

@Component({
  selector: 'app-seller',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    AnimatedTabsComponent,
    StatsSectionComponent,
  ],
  templateUrl: './seller.component.html',
  styleUrl: './seller.component.scss',
})
export class SellerComponent {
  protected readonly authService = inject(AuthService);
  protected readonly auctionState = inject(AuctionStateService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  readonly isCreateModalOpen = signal(false);
  readonly selectedFilter = signal<string>('ALL');
  readonly submissionSuccessMsg = signal<string | null>(null);

  // Computed lots submitted by this seller (matching company or general seller lots)
  readonly myLots = computed<AuctionLot[]>(() => {
    return this.auctionState.lots();
  });

  readonly filteredLots = computed<AuctionLot[]>(() => {
    const filter = this.selectedFilter();
    const lots = this.myLots();
    if (filter === 'ALL') return lots;
    if (filter === 'PENDING') return lots.filter((l) => l.status === 'PENDING_REVIEW');
    if (filter === 'ACTIVE') return lots.filter((l) => l.status === 'ACTIVE');
    if (filter === 'CANCELLED') return lots.filter((l) => l.status === 'CANCELLED');
    return lots;
  });

  readonly lotFilterTabs = computed<TabItem[]>(() => [
    { id: 'ALL', label: 'Semua Pengajuan', count: this.myLots().length },
    {
      id: 'PENDING',
      label: 'Menunggu Review Admin',
      count: this.myLots().filter((l) => l.status === 'PENDING_REVIEW').length,
    },
    {
      id: 'ACTIVE',
      label: 'Tayang di Vendor',
      count: this.myLots().filter((l) => l.status === 'ACTIVE').length,
    },
    {
      id: 'CANCELLED',
      label: 'Dibatalkan',
      count: this.myLots().filter((l) => l.status === 'CANCELLED').length,
    },
  ]);

  readonly sellerStats = computed<StatItem[]>(() => {
    const pending = this.myLots().filter((l) => l.status === 'PENDING_REVIEW').length;
    const active = this.myLots().filter((l) => l.status === 'ACTIVE').length;
    const totalGmv = this.myLots()
      .filter((l) => l.status === 'ACTIVE')
      .reduce((sum, l) => sum + l.currentPrice, 0);

    return [
      {
        label: 'Total Pengajuan',
        value: `${this.myLots().length} Barang`,
        subtext: 'Manifest Terdaftar di Sistem',
        trend: 'Scrap & Aset Industri',
        isPositive: true,
        iconSvg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>',
      },
      {
        label: 'Menunggu Review Admin',
        value: `${pending} Barang`,
        subtext: 'Verifikasi Manifest & Limit Harga',
        trend: pending > 0 ? 'Sedang Ditinjau' : 'Semua Disetujui',
        isPositive: pending === 0,
        iconSvg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>',
      },
      {
        label: 'Tayang di Vendor Floor',
        value: `${active} Barang`,
        subtext: 'Sedang Berjalan & Ditawar Vendor',
        trend: 'Live Terbuka',
        isPositive: true,
        iconSvg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 2L2 7l10 5 10-5-10-5z"></path><path d="M2 17l10 5 10-5"></path><path d="M2 12l10 5 10-5"></path></svg>',
      },
      {
        label: 'Total Nilai Aktif',
        value: `Rp ${(totalGmv / 1000000000).toFixed(2)} M`,
        subtext: 'Berdasarkan Penawaran Tertinggi',
        trend: 'Likuiditas Terbuka',
        isPositive: true,
        iconSvg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>',
      },
    ];
  });

  createForm = this.fb.group({
    title: ['', [Validators.required, Validators.maxLength(255)]],
    description: ['', [Validators.required]],
    category: ['SCRAP_METAL' as LotCategory, [Validators.required]],
    quantity: [10, [Validators.required, Validators.min(1)]],
    unit: ['Ton', [Validators.required]],
    weightKg: [10000, [Validators.required, Validators.min(1)]],
    startingPrice: [50000000, [Validators.required, Validators.min(1000000)]],
    locationNotes: ['Gudang Utama Cilegon, Akses Crane Truk Kontainer Siap', [Validators.required]],
    imageUrl: [''],
  });

  openCreateModal() {
    this.isCreateModalOpen.set(true);
  }

  closeCreateModal() {
    this.isCreateModalOpen.set(false);
  }

  submitLot() {
    if (this.createForm.invalid) return;

    const v = this.createForm.value;
    const fullDescription = `${v.description}\nLokasi & Akses: ${v.locationNotes}`;

    // Kirim langsung ke AuctionStateService -> status otomatis PENDING_REVIEW
    this.auctionState.submitNewLot({
      title: v.title!,
      description: fullDescription,
      category: v.category!,
      weightKg: v.weightKg!,
      quantity: v.quantity!,
      unit: v.unit!,
      startingPrice: v.startingPrice!,
      sellerName: 'Budi Santoso',
      companyName: 'PT Cilegon Baja Mandiri',
      imageUrl:
        v.imageUrl ||
        (v.category === 'SCRAP_METAL'
          ? 'https://images.unsplash.com/photo-1504917599217-d4dc5ebe6122?auto=format&fit=crop&w=800&q=80'
          : v.category === 'MACHINERY'
            ? 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=800&q=80'
            : 'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?auto=format&fit=crop&w=800&q=80'),
    });

    this.submissionSuccessMsg.set(
      '✓ Pengajuan penjualan barang lelang berhasil dikirim ke Admin! Barang masuk ke antrean peninjauan sebelum dipublikasikan ke Vendor.'
    );

    this.createForm.reset({
      category: 'SCRAP_METAL',
      unit: 'Ton',
      quantity: 10,
      weightKg: 10000,
      startingPrice: 50000000,
      locationNotes: 'Gudang Utama Cilegon, Akses Crane Truk Kontainer Siap',
    });

    this.closeCreateModal();
    this.selectedFilter.set('PENDING');

    setTimeout(() => {
      this.submissionSuccessMsg.set(null);
    }, 6000);
  }

  onFilterChange(tabId: string) {
    this.selectedFilter.set(tabId);
  }

  navigateTo(path: string) {
    this.router.navigate([path]);
  }

  logout() {
    this.authService.logout();
  }
}
