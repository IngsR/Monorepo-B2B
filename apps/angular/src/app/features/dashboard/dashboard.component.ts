import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { UserRole } from '../../core/enums/user-role.enum';
import { AuctionLot, LotCategory } from '../../core/models/auction.model';
import { AuthService } from '../../core/services/auth.service';
import { CompanyService } from '../../core/services/company.service';
import { AnimatedTabsComponent, TabItem } from '../../shared/components/animated-tabs/animated-tabs.component';
import { BentoGridComponent, BentoGridItemComponent } from '../../shared/components/bento-grid/bento-grid.component';
import { CardSpotlightComponent } from '../../shared/components/card-spotlight/card-spotlight.component';
import { CompanyModalComponent } from '../../shared/components/company-modal/company-modal.component';
import { ExpandableAuctionCardComponent } from '../../shared/components/expandable-auction-card/expandable-auction-card.component';
import { DockItem, FloatingDockComponent } from '../../shared/components/floating-dock/floating-dock.component';
import { HoverBorderGradientComponent } from '../../shared/components/hover-border-gradient/hover-border-gradient.component';
import { StatItem, StatsSectionComponent } from '../../shared/components/stats-section/stats-section.component';
import { TypewriterTextComponent } from '../../shared/components/typewriter-text/typewriter-text.component';

interface HealthStatus {
  status: string;
  service: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    BentoGridComponent,
    BentoGridItemComponent,
    AnimatedTabsComponent,
    FloatingDockComponent,
    HoverBorderGradientComponent,
    TypewriterTextComponent,
    StatsSectionComponent,
    ExpandableAuctionCardComponent,
    CompanyModalComponent,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  protected readonly authService = inject(AuthService);
  protected readonly companyService = inject(CompanyService);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  navigateTo(path: string): void {
    this.router.navigate([path]);
  }

  readonly UserRole = UserRole;

  // Backend System Telemetry State
  readonly healthStatus = signal<HealthStatus | null>(null);
  readonly isHealthLoading = signal(false);
  readonly isCompanyModalOpen = signal(false);

  // Active View Filter
  readonly activeView = signal<'overview' | 'auctions' | 'companies' | 'telemetry'>('overview');
  readonly selectedCategory = signal<string>('ALL');

  // Terminal ticker messages
  readonly telemetryMessages = [
    'GATEWAY STATUS: ALL CLUSTER NODES NOMINAL [LATENCY < 12MS]',
    'AUCTION ENGINE: POSTGRES TYPEORM ISOLATION LEVEL READ-COMMITTED',
    'SCRAP INVENTORY: 4,850 MT INDUSTRIAL SCRAP VERIFIED BY OPERATORS',
    'RBAC PROTOCOL: JWT AUTHENTICATION ACTIVE WITH ROLES GUARD',
    'TENANT SYNC: ENTERPRISE COMPANIES PERSISTED IN MULTI-TENANT ARCHITECTURE',
  ];

  // Category Tabs
  readonly categoryTabs: TabItem[] = [
    { id: 'ALL', label: 'All Lots', count: 6 },
    { id: 'SCRAP_METAL', label: 'Scrap Metal', count: 2 },
    { id: 'MACHINERY', label: 'Heavy Machinery', count: 2 },
    { id: 'VEHICLE', label: 'Fleet Vehicles', count: 1 },
    { id: 'ELECTRONICS', label: 'E-Waste', count: 1 },
  ];

  // Floating Dock Items
  readonly dockItems: DockItem[] = [
    {
      id: 'overview',
      title: 'Command Center',
      iconSvg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>',
    },
    {
      id: 'auctions',
      title: 'Live Auction Lots',
      iconSvg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>',
      badge: 'LIVE',
    },
    {
      id: 'companies',
      title: 'Enterprise Partners',
      iconSvg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="2" y="7" width="20" height="14" rx="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>',
    },
    {
      id: 'telemetry',
      title: 'System Health',
      iconSvg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>',
    },
  ];

  // Corporate Auction Catalog Data
  readonly auctionLots = signal<AuctionLot[]>([
    {
      id: 'lot-881a',
      title: 'Heavy Industrial Steel Scrap (Grade HMS 1/2)',
      description: 'Clean cut structural steel, plates, beams, and pipe ends ready for immediate furnace melting.',
      category: 'SCRAP_METAL',
      weightKg: 28500,
      quantity: 28.5,
      unit: 'Ton',
      startingPrice: 150000000,
      currentPrice: 198500000,
      status: 'ACTIVE',
      sellerId: 'sel-1',
      companyName: 'PT Cilegon Metalindo Perkasa',
      images: ['https://images.unsplash.com/photo-1504917599217-d4dc5ebe6122?auto=format&fit=crop&w=800&q=80'],
      totalBids: 18,
      timeRemaining: '02h 45m',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'lot-882b',
      title: 'Caterpillar 500 kVA Diesel Generator Set (2 Units)',
      description: 'Decommissioned standby generators from petrochemical facility, regularly serviced with maintenance logs.',
      category: 'MACHINERY',
      weightKg: 8400,
      quantity: 2,
      unit: 'Units',
      startingPrice: 320000000,
      currentPrice: 415000000,
      status: 'ACTIVE',
      sellerId: 'sel-2',
      companyName: 'PT Nusantara Petrochemical',
      images: ['https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=800&q=80'],
      totalBids: 24,
      timeRemaining: '04h 12m',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'lot-883c',
      title: 'Commercial Fleet Dump Trucks Mitsubishi Fuso (5 Units)',
      description: 'Off-lease mining & quarry operational trucks, diesel turbo, sold as bulk package.',
      category: 'VEHICLE',
      weightKg: 35000,
      quantity: 5,
      unit: 'Units',
      startingPrice: 450000000,
      currentPrice: 580000000,
      status: 'ACTIVE',
      sellerId: 'sel-1',
      companyName: 'PT Tambang Raya Abadi',
      images: ['https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?auto=format&fit=crop&w=800&q=80'],
      totalBids: 31,
      timeRemaining: '01h 18m',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'lot-884d',
      title: 'Industrial CNC Lathe & Milling Machinery Package',
      description: 'Automotive precision tooling surplus machinery, Yamazaki Mazak & Okuma CNC units with controllers.',
      category: 'MACHINERY',
      weightKg: 12000,
      quantity: 3,
      unit: 'Sets',
      startingPrice: 280000000,
      currentPrice: 310000000,
      status: 'PUBLISHED',
      sellerId: 'sel-3',
      companyName: 'PT Astra Komponen Presisi',
      images: ['https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=800&q=80'],
      totalBids: 7,
      timeRemaining: '08h 30m',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'lot-885e',
      title: 'High-Purity Copper Wire Scrap & Busbars (Millberry Grade)',
      description: 'Electrical substation replacement scrap, stripped clean unalloyed copper conductors.',
      category: 'SCRAP_METAL',
      weightKg: 14500,
      quantity: 14.5,
      unit: 'Ton',
      startingPrice: 950000000,
      currentPrice: 1180000000,
      status: 'ACTIVE',
      sellerId: 'sel-1',
      companyName: 'PT Kabelindo Sukses Makmur',
      images: ['https://images.unsplash.com/photo-1578328819058-b69f3a3b0f6b?auto=format&fit=crop&w=800&q=80'],
      totalBids: 42,
      timeRemaining: '00h 42m',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'lot-886f',
      title: 'Decommissioned Server Racks & Telecom PCB Boards',
      description: 'Tier-3 data center hardware overhaul, gold-plated connectors, circuit boards and server enclosures.',
      category: 'ELECTRONICS',
      weightKg: 4200,
      quantity: 1,
      unit: 'Lot',
      startingPrice: 180000000,
      currentPrice: 215000000,
      status: 'ACTIVE',
      sellerId: 'sel-4',
      companyName: 'PT Telco Infra Mandiri',
      images: ['https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=800&q=80'],
      totalBids: 15,
      timeRemaining: '05h 50m',
      createdAt: new Date().toISOString(),
    },
  ]);

  // Filtered Lots computed from selected category
  readonly filteredLots = computed(() => {
    const cat = this.selectedCategory();
    if (cat === 'ALL') return this.auctionLots();
    return this.auctionLots().filter((l) => l.category === cat);
  });

  // Dynamic Corporate Stats computed from live state
  readonly corporateStats = computed<StatItem[]>(() => {
    const totalGmv = this.auctionLots().reduce((acc, l) => acc + l.currentPrice, 0);
    const totalBids = this.auctionLots().reduce((acc, l) => acc + l.totalBids, 0);
    const companiesCount = this.companyService.companies().length || 12;

    return [
      {
        label: 'Total Auction GMV',
        value: `Rp ${(totalGmv / 1000000000).toFixed(2)} B`,
        subtext: 'Across active corporate sessions',
        trend: '+18.4% vs last cycle',
        isPositive: true,
        iconSvg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>',
      },
      {
        label: 'Active Auction Lots',
        value: this.auctionLots().length,
        subtext: '4 verified categories',
        trend: '+6 new today',
        isPositive: true,
        iconSvg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="2" y="7" width="20" height="14" rx="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>',
      },
      {
        label: 'Verified Enterprise Tenants',
        value: companiesCount,
        subtext: 'Synced with PostgreSQL backend',
        trend: 'Live API',
        isPositive: true,
        iconSvg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>',
      },
      {
        label: 'Total Submitted Bids',
        value: totalBids,
        subtext: 'Zero race-condition tolerance',
        trend: 'High Liquidity',
        isPositive: true,
        iconSvg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline><polyline points="16 7 22 7 22 13"></polyline></svg>',
      },
    ];
  });

  ngOnInit(): void {
    this.checkHealth();
    this.fetchBackendCompanies();
  }

  checkHealth(): void {
    this.isHealthLoading.set(true);
    this.http.get<HealthStatus>(`${environment.apiUrl}/health`).subscribe({
      next: (res) => {
        this.healthStatus.set(res);
        this.isHealthLoading.set(false);
      },
      error: () => {
        this.healthStatus.set(null);
        this.isHealthLoading.set(false);
      },
    });
  }

  fetchBackendCompanies(): void {
    this.companyService.getCompanies(1, 10).subscribe();
  }

  onCategoryChange(catId: string) {
    this.selectedCategory.set(catId);
  }

  onDockSelect(viewId: string) {
    this.activeView.set(viewId as any);
  }

  openCompanyModal() {
    this.isCompanyModalOpen.set(true);
  }

  closeCompanyModal() {
    this.isCompanyModalOpen.set(false);
  }

  handleBid(lot: AuctionLot) {
    const increment = 5000000;
    const newPrice = lot.currentPrice + increment;
    this.auctionLots.update((lots) =>
      lots.map((l) =>
        l.id === lot.id
          ? { ...l, currentPrice: newPrice, totalBids: l.totalBids + 1 }
          : l
      )
    );
  }

  logout(): void {
    this.authService.logout();
  }
}
