import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuctionLot } from '../../core/models/auction.model';
import { AuctionStateService } from '../../core/services/auction-state.service';
import { AuthService } from '../../core/services/auth.service';
import { AnimatedTabsComponent, TabItem } from '../../shared/components/animated-tabs/animated-tabs.component';
import { ExpandableAuctionCardComponent } from '../../shared/components/expandable-auction-card/expandable-auction-card.component';
import { HoverBorderGradientComponent } from '../../shared/components/hover-border-gradient/hover-border-gradient.component';
import { StatItem, StatsSectionComponent } from '../../shared/components/stats-section/stats-section.component';

interface ActiveBidRecord {
  lotId: string;
  lotTitle: string;
  myBidAmount: number;
  highestBidAmount: number;
  isWinning: boolean;
  timeRemaining: string;
}

@Component({
  selector: 'app-vendor',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    AnimatedTabsComponent,
    StatsSectionComponent,
  ],
  templateUrl: './vendor.component.html',
  styleUrl: './vendor.component.scss',
})
export class VendorComponent {
  protected readonly authService = inject(AuthService);
  protected readonly auctionState = inject(AuctionStateService);
  private readonly router = inject(Router);

  readonly selectedCategory = signal<string>('ALL');
  readonly searchQuery = signal<string>('');
  readonly selectedLotForBid = signal<AuctionLot | null>(null);
  readonly chosenIncrement = signal<number>(5000000);
  readonly quickBidSuccess = signal<string | null>(null);

  // Active Floor Lots connected directly to AuctionStateService (only ACTIVE lots)
  readonly activeFloorLots = computed<AuctionLot[]>(() => {
    return this.auctionState.activeLots();
  });

  readonly myBids = signal<ActiveBidRecord[]>([
    {
      lotId: 'LOT-101',
      lotTitle: 'Besi Tua Scrap Heavy Melting Steel (HMS 1&2)',
      myBidAmount: 285000000,
      highestBidAmount: 285000000,
      isWinning: true,
      timeRemaining: '02h 45m',
    },
    {
      lotId: 'LOT-102',
      lotTitle: 'Genset Industri Caterpillar 500 kVA (2 Unit)',
      myBidAmount: 410000000,
      highestBidAmount: 425000000,
      isWinning: false,
      timeRemaining: '05h 12m',
    },
  ]);

  readonly vendorTabs = computed<TabItem[]>(() => {
    const active = this.activeFloorLots();
    const scrapCount = active.filter((l) => l.category === 'SCRAP_METAL').length;
    const machineryCount = active.filter((l) => l.category === 'MACHINERY').length;
    const vehicleCount = active.filter((l) => l.category === 'VEHICLE').length;

    return [
      { id: 'ALL', label: 'Semua Lot di Lantai', count: active.length },
      { id: 'SCRAP_METAL', label: 'Besi Tua & Logam', count: scrapCount },
      { id: 'MACHINERY', label: 'Mesin & Genset Industri', count: machineryCount },
      { id: 'VEHICLE', label: 'Armada Truk & Alat Berat', count: vehicleCount },
    ];
  });

  readonly vendorStats = computed<StatItem[]>(() => {
    const winningCount = this.myBids().filter((b) => b.isWinning).length;
    return [
      {
        label: 'Lot Aktif di Lantai',
        value: `${this.activeFloorLots().length} Lot`,
        subtext: 'Terbuka untuk Penawaran Langsung',
        trend: 'Lelang Berjalan',
        isPositive: true,
        iconSvg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"></circle><polygon points="10 8 16 12 10 16 10 8"></polygon></svg>',
      },
      {
        label: 'Tawaran Memimpin Saya',
        value: `${winningCount} Lot`,
        subtext: `Dari total ${this.myBids().length} lot yang diikuti`,
        trend: winningCount > 0 ? 'Posisi Tertinggi' : 'Perlu Penawaran',
        isPositive: winningCount > 0,
        iconSvg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="20 6 9 17 4 12"></polyline></svg>',
      },
      {
        label: 'Partisipasi Lelang',
        value: `${this.myBids().length} Lot`,
        subtext: 'Aktivitas Terbuka Real-Time',
        trend: 'Aktif Menawar',
        isPositive: true,
        iconSvg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>',
      },
      {
        label: 'Kategori Scrap Siap Angkut',
        value: '4 Sektor',
        subtext: 'Besi, Tembaga, Alat Berat, Genset',
        trend: 'Terkurasi',
        isPositive: true,
        iconSvg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="2" y="7" width="20" height="14" rx="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>',
      },
    ];
  });

  readonly filteredFloorLots = computed(() => {
    const cat = this.selectedCategory();
    const q = this.searchQuery().trim().toLowerCase();
    let lots = this.activeFloorLots();

    if (cat !== 'ALL') {
      lots = lots.filter((l) => l.category === cat);
    }

    if (q) {
      lots = lots.filter(
        (l) =>
          l.title.toLowerCase().includes(q) ||
          l.description.toLowerCase().includes(q) ||
          (l.companyName && l.companyName.toLowerCase().includes(q))
      );
    }

    return lots;
  });

  onCategoryChange(catId: string) {
    this.selectedCategory.set(catId);
  }

  setIncrement(amount: number) {
    this.chosenIncrement.set(amount);
  }

  openBidModal(lot: AuctionLot) {
    this.selectedLotForBid.set(lot);
    this.quickBidSuccess.set(null);
  }

  closeBidModal() {
    this.selectedLotForBid.set(null);
    this.quickBidSuccess.set(null);
  }

  placeConfirmedBid() {
    const lot = this.selectedLotForBid();
    if (!lot) return;

    const increment = this.chosenIncrement();
    const newHighest = lot.currentPrice + increment;

    // Call AuctionStateService -> directly updates price & bids in shared state!
    this.auctionState.placeBid(lot.id, increment);

    // Update Vendor's local active bids tracker
    this.myBids.update((bids) => {
      const idx = bids.findIndex((b) => b.lotId === lot.id);
      const newRecord: ActiveBidRecord = {
        lotId: lot.id,
        lotTitle: lot.title,
        myBidAmount: newHighest,
        highestBidAmount: newHighest,
        isWinning: true,
        timeRemaining: lot.timeRemaining || 'Live',
      };

      if (idx >= 0) {
        return bids.map((b, i) => (i === idx ? newRecord : b));
      }
      return [newRecord, ...bids];
    });

    this.quickBidSuccess.set(
      `✓ Penawaran Rp ${newHighest.toLocaleString('id-ID')} berhasil diajukan! Anda memimpin lelang ini.`
    );

    setTimeout(() => {
      this.closeBidModal();
    }, 1400);
  }

  navigateTo(path: string) {
    this.router.navigate([path]);
  }

  logout() {
    this.authService.logout();
  }
}
