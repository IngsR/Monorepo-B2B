export type LotCategory = 'SCRAP_METAL' | 'ELECTRONICS' | 'VEHICLE' | 'MACHINERY' | 'OTHER';
export type LotStatus = 'DRAFT' | 'PENDING_REVIEW' | 'PUBLISHED' | 'ACTIVE' | 'SOLD' | 'PASSED' | 'CANCELLED';

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
  sellerId: string;
  sellerName?: string;
  companyName?: string;
  images: string[];
  totalBids: number;
  timeRemaining?: string;
  createdAt: string;
}

export interface AuctionMetrics {
  totalGmv: number;
  activeLotsCount: number;
  totalBidsCount: number;
  activeCompaniesCount: number;
  systemHealth: string;
}
