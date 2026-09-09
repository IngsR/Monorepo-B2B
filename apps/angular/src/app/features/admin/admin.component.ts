import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { UserRole } from '../../core/enums/user-role.enum';
import { AuctionLot } from '../../core/models/auction.model';
import { AuctionStateService, EnterpriseMember } from '../../core/services/auction-state.service';
import { AuthService } from '../../core/services/auth.service';
import { CompanyService } from '../../core/services/company.service';
import { UserService } from '../../core/services/user.service';
import { AnimatedTabsComponent, TabItem } from '../../shared/components/animated-tabs/animated-tabs.component';
import { BentoGridComponent, BentoGridItemComponent } from '../../shared/components/bento-grid/bento-grid.component';
import { CompanyModalComponent } from '../../shared/components/company-modal/company-modal.component';
import { HoverBorderGradientComponent } from '../../shared/components/hover-border-gradient/hover-border-gradient.component';
import { StatItem, StatsSectionComponent } from '../../shared/components/stats-section/stats-section.component';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [
    CommonModule,
    BentoGridComponent,
    BentoGridItemComponent,
    AnimatedTabsComponent,
    StatsSectionComponent,
    CompanyModalComponent,
  ],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.scss',
})
export class AdminComponent implements OnInit {
  protected readonly authService = inject(AuthService);
  protected readonly companyService = inject(CompanyService);
  protected readonly userService = inject(UserService);
  protected readonly auctionState = inject(AuctionStateService);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  readonly isCompanyModalOpen = signal(false);
  readonly healthStatus = signal<{ status: string; service: string } | null>(null);
  readonly activeSection = signal<'auctions' | 'members' | 'companies' | 'users' | 'telemetry'>('auctions');
  readonly notificationMsg = signal<string | null>(null);

  // Subfilters
  readonly auctionSubFilter = signal<'PENDING' | 'ACTIVE' | 'CANCELLED' | 'ALL'>('PENDING');
  readonly memberSubFilter = signal<'ALL' | 'SELLER' | 'VENDOR'>('ALL');

  // Filtered Auction Lots
  readonly filteredLots = computed<AuctionLot[]>(() => {
    const filter = this.auctionSubFilter();
    const all = this.auctionState.lots();
    if (filter === 'ALL') return all;
    if (filter === 'PENDING') return all.filter((l) => l.status === 'PENDING_REVIEW');
    if (filter === 'ACTIVE') return all.filter((l) => l.status === 'ACTIVE');
    if (filter === 'CANCELLED') return all.filter((l) => l.status === 'CANCELLED');
    return all;
  });

  // Filtered Members
  readonly filteredMembers = computed<EnterpriseMember[]>(() => {
    const filter = this.memberSubFilter();
    const members = this.auctionState.members();
    if (filter === 'ALL') return members;
    return members.filter((m) => m.type === filter);
  });

  // Computed GMV for telemetry tab
  readonly totalActiveGmv = computed<string>(() => {
    const gmv = this.auctionState
      .activeLots()
      .reduce((sum, l) => sum + Number(l.currentPrice), 0);
    return (gmv / 1000000000).toFixed(2);
  });

  readonly sectionTabs = computed<TabItem[]>(() => [
    {
      id: 'auctions',
      label: 'Kelola Lelang & Approval',
      count: this.auctionState.pendingLots().length,
    },
    {
      id: 'members',
      label: 'Vendor & Seller Directory',
      count: this.auctionState.members().length,
    },
    {
      id: 'companies',
      label: 'Enterprise Tenants',
      count: this.companyService.companies().length || 12,
    },
    {
      id: 'users',
      label: 'User Directory',
      count: this.userService.users().length || 48,
    },
    { id: 'telemetry', label: 'Microservice Telemetry' },
  ]);

  readonly adminStats = computed<StatItem[]>(() => [
    {
      label: 'Menunggu Persetujuan',
      value: `${this.auctionState.pendingLots().length} Lot`,
      subtext: 'Pengajuan Baru dari Seller',
      trend: this.auctionState.pendingLots().length > 0 ? 'Perlu Ditinjau' : 'Semua Bersih',
      isPositive: this.auctionState.pendingLots().length === 0,
      iconSvg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>',
    },
    {
      label: 'Lelang Sedang Aktif',
      value: `${this.auctionState.activeLots().length} Lot`,
      subtext: 'Sedang Tayang di Vendor Floor',
      trend: 'Live Open Bidding',
      isPositive: true,
      iconSvg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 2L2 7l10 5 10-5-10-5z"></path><path d="M2 17l10 5 10-5"></path><path d="M2 12l10 5 10-5"></path></svg>',
    },
    {
      label: 'Mitra Terverifikasi',
      value: `${this.auctionState.members().length} Mitra`,
      subtext: `${this.auctionState.sellers().length} Seller • ${this.auctionState.vendors().length} Vendor`,
      trend: 'Terkurasi',
      isPositive: true,
      iconSvg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>',
    },
    {
      label: 'Platform Status',
      value: '99.98%',
      subtext: 'NestJS Gateway + PostgreSQL DB',
      trend: 'Optimal (8ms)',
      isPositive: true,
      iconSvg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>',
    },
  ]);

  ngOnInit(): void {
    this.checkHealth();
    this.refreshData();
  }

  checkHealth(): void {
    this.http.get<{ status: string; service: string }>(`${environment.apiUrl}/health`).subscribe({
      next: (res) => this.healthStatus.set(res),
      error: () => this.healthStatus.set(null),
    });
  }

  refreshData(): void {
    this.companyService.getCompanies(1, 20).subscribe();
    this.userService.getUsers(1, 20).subscribe();
  }

  onTabChange(tabId: string): void {
    this.activeSection.set(tabId as any);
  }

  setAuctionSubFilter(filter: 'PENDING' | 'ACTIVE' | 'CANCELLED' | 'ALL'): void {
    this.auctionSubFilter.set(filter);
  }

  setMemberSubFilter(filter: 'ALL' | 'SELLER' | 'VENDOR'): void {
    this.memberSubFilter.set(filter);
  }

  // Admin Actions on Auctions
  approveLot(lotId: string): void {
    this.auctionState.approveAndPublishLot(lotId);
    this.showNotification('✓ Sukses: Barang lelang telah disetujui dan langsung diterbitkan ke portal Vendor!');
  }

  cancelLot(lotId: string): void {
    if (confirm('Apakah Anda yakin ingin membatalkan lelang ini? Barang akan ditarik dari antrean atau lantai lelang.')) {
      this.auctionState.cancelLot(lotId);
      this.showNotification('Barang lelang telah dibatalkan oleh Admin.');
    }
  }

  // Admin Actions on Members
  toggleMember(memberId: string): void {
    this.auctionState.toggleMemberStatus(memberId);
    this.showNotification('Status keanggotaan mitra berhasil diperbarui.');
  }

  showNotification(msg: string): void {
    this.notificationMsg.set(msg);
    setTimeout(() => this.notificationMsg.set(null), 4000);
  }

  openCompanyModal(): void {
    this.isCompanyModalOpen.set(true);
  }

  closeCompanyModal(): void {
    this.isCompanyModalOpen.set(false);
  }

  deactivateCompany(id: string): void {
    if (confirm('Nonaktifkan perusahaan tenant ini?')) {
      this.companyService.deactivateCompany(id).subscribe(() => this.refreshData());
    }
  }

  navigateTo(path: string): void {
    this.router.navigate([path]);
  }

  logout(): void {
    this.authService.logout();
  }
}
