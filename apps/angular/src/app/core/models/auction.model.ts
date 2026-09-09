export type LotCategory =
  | 'SCRAP_METAL'
  | 'ELECTRONICS'
  | 'VEHICLE'
  | 'MACHINERY'
  | 'OTHER';

export type LotStatus =
  | 'DRAFT'
  | 'PENDING_REVIEW'
  | 'PUBLISHED'
  | 'ACTIVE'
  | 'SOLD'
  | 'PASSED'
  | 'CANCELLED';

export interface LotTechnicalSpecs {
  grade?: string; // e.g. 'HMS 1&2 (Baja Tebal >6mm)', 'Millberry Cu 99.9%'
  purity?: string; // e.g. '99.5% Kemurnian Teruji Lab'
  contamination?: string; // e.g. 'Maks. 0.5% (Bebas Oli/Limbah B3)'
  legality?: string; // e.g. 'Surat Kepemilikan Resmi & SPH Terlampir'
  inspectionSchedule?: string; // e.g. 'Senin-Jumat 09:00 - 15:30 WIB'
  loadingTerms?: string; // e.g. 'Pengangkutan dan armada crane oleh pemenang tender'
  scaleCertificate?: string; // e.g. 'Sertifikat Tera Metrologi Aktif'
}

export interface BidHistoryItem {
  id: string;
  vendorId: string;
  vendorName: string;
  amount: number;
  time: string;
  isWinning: boolean;
}

export interface AuctionLot {
  id: string;
  title: string;
  description: string;
  category: LotCategory;
  weightKg?: number;
  quantity: number;
  unit: string;
  startingPrice: number;
  currentPrice: number;
  reservePrice?: number;
  status: LotStatus;
  warehouseLocation?: string;
  sellerId: string;
  sellerName?: string;
  companyName?: string;
  highestBidderId?: string | null;
  highestBidderName?: string | null;
  images: string[];
  totalBids: number;
  timeRemaining?: string;
  expiresAt?: string;
  specs?: LotTechnicalSpecs;
  bidHistory?: BidHistoryItem[];
  createdAt: string;
}

export interface AuctionMetrics {
  totalGmv: number;
  activeLotsCount: number;
  totalBidsCount: number;
  activeCompaniesCount: number;
  systemHealth: string;
}
