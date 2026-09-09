import { computed, Injectable, signal } from '@angular/core';
import { AuctionLot, LotCategory, LotStatus } from '../models/auction.model';

export interface EnterpriseMember {
  id: string;
  name: string;
  type: 'SELLER' | 'VENDOR';
  companyName: string;
  email: string;
  phone: string;
  status: 'ACTIVE' | 'SUSPENDED';
  joinedDate: string;
}

@Injectable({
  providedIn: 'root',
})
export class AuctionStateService {
  // Master state lelang bersama
  readonly lots = signal<AuctionLot[]>([
    {
      id: 'LOT-101',
      title: 'Besi Tua Scrap Heavy Melting Steel (HMS 1&2)',
      description: 'Potongan balok I-beam, pelat baja konstruksi, dan sisa pipa industri tanpa kontaminasi kotoran.',
      category: 'SCRAP_METAL',
      weightKg: 45000,
      quantity: 45,
      unit: 'Ton',
      startingPrice: 225000000,
      currentPrice: 285000000,
      reservePrice: 260000000,
      status: 'ACTIVE',
      sellerId: 'seller-1',
      sellerName: 'Budi Santoso',
      companyName: 'PT Cilegon Baja Mandiri',
      images: ['https://images.unsplash.com/photo-1504917599217-d4dc5ebe6122?auto=format&fit=crop&w=800&q=80'],
      totalBids: 14,
      timeRemaining: '02h 45m',
      createdAt: '2026-09-08T10:00:00Z',
    },
    {
      id: 'LOT-102',
      title: 'Genset Industri Caterpillar 500 kVA (2 Unit)',
      description: 'Eks operasional pabrik tekstil, kondisi mesin prima, catatan pemeliharaan rutin terlampir.',
      category: 'MACHINERY',
      weightKg: 8200,
      quantity: 2,
      unit: 'Unit',
      startingPrice: 380000000,
      currentPrice: 425000000,
      reservePrice: 400000000,
      status: 'ACTIVE',
      sellerId: 'seller-2',
      sellerName: 'Hendra Gunawan',
      companyName: 'PT Sarana Daya Prima',
      images: ['https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=800&q=80'],
      totalBids: 9,
      timeRemaining: '05h 12m',
      createdAt: '2026-09-08T11:30:00Z',
    },
    {
      id: 'LOT-103',
      title: 'Tembaga Kabel Kupas Kualitas Super (Millberry)',
      description: 'Kabel tembaga substation PLN kupas bersih kemurnian 99.9%, siap lebur industri.',
      category: 'SCRAP_METAL',
      weightKg: 12000,
      quantity: 12,
      unit: 'Ton',
      startingPrice: 840000000,
      currentPrice: 840000000,
      status: 'PENDING_REVIEW', // Menunggu persetujuan Admin
      sellerId: 'seller-1',
      sellerName: 'Budi Santoso',
      companyName: 'PT Cilegon Baja Mandiri',
      images: ['https://images.unsplash.com/photo-1578328819058-b69f3a3b0f6b?auto=format&fit=crop&w=800&q=80'],
      totalBids: 0,
      timeRemaining: 'Menunggu Persetujuan Admin',
      createdAt: '2026-09-09T08:00:00Z',
    },
    {
      id: 'LOT-104',
      title: 'Dump Truck Tambang Mitsubishi Fuso Fighter 220PS (3 Unit)',
      description: 'Armada angkutan tambang peremajaan unit, mesin diesel kering, STNK & BPKB lengkap.',
      category: 'VEHICLE',
      weightKg: 24000,
      quantity: 3,
      unit: 'Unit',
      startingPrice: 520000000,
      currentPrice: 520000000,
      status: 'PENDING_REVIEW', // Menunggu persetujuan Admin
      sellerId: 'seller-3',
      sellerName: 'Agus Pratama',
      companyName: 'PT Tambang Logistik Nusantara',
      images: ['https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?auto=format&fit=crop&w=800&q=80'],
      totalBids: 0,
      timeRemaining: 'Menunggu Persetujuan Admin',
      createdAt: '2026-09-09T09:15:00Z',
    },
    {
      id: 'LOT-105',
      title: 'Transformator Distribusi 1600 kVA Step-Down (Eks Pabrik)',
      description: 'Trafo oli industri bekas gardu induk internal pabrik semen, trafo tembaga berpendingin ONAN.',
      category: 'MACHINERY',
      weightKg: 6400,
      quantity: 1,
      unit: 'Unit',
      startingPrice: 160000000,
      currentPrice: 160000000,
      status: 'CANCELLED',
      sellerId: 'seller-2',
      sellerName: 'Hendra Gunawan',
      companyName: 'PT Sarana Daya Prima',
      images: ['https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=800&q=80'],
      totalBids: 0,
      timeRemaining: 'Dibatalkan oleh Admin',
      createdAt: '2026-09-07T14:20:00Z',
    },
  ]);

  // Master anggota terdaftar (Vendor & Seller)
  readonly members = signal<EnterpriseMember[]>([
    {
      id: 'MEM-01',
      name: 'Budi Santoso',
      type: 'SELLER',
      companyName: 'PT Cilegon Baja Mandiri',
      email: 'budi@cilegonbaja.co.id',
      phone: '0812-3456-7890',
      status: 'ACTIVE',
      joinedDate: '2026-01-15',
    },
    {
      id: 'MEM-02',
      name: 'PT Krakatau Peleburan Logam (Vendor)',
      type: 'VENDOR',
      companyName: 'PT Krakatau Peleburan Logam',
      email: 'procurement@krakataulogam.com',
      phone: '0811-9876-5432',
      status: 'ACTIVE',
      joinedDate: '2026-02-01',
    },
    {
      id: 'MEM-03',
      name: 'CV Sinar Logam Abadi (Vendor)',
      type: 'VENDOR',
      companyName: 'CV Sinar Logam Abadi',
      email: 'tender@sinarlogam.id',
      phone: '0813-2233-4455',
      status: 'ACTIVE',
      joinedDate: '2026-03-10',
    },
    {
      id: 'MEM-04',
      name: 'Agus Pratama',
      type: 'SELLER',
      companyName: 'PT Tambang Logistik Nusantara',
      email: 'agus@tambanglogistik.co.id',
      phone: '0815-6677-8899',
      status: 'ACTIVE',
      joinedDate: '2026-04-12',
    },
    {
      id: 'MEM-05',
      name: 'Hendra Gunawan',
      type: 'SELLER',
      companyName: 'PT Sarana Daya Prima',
      email: 'hendra@saranadaya.co.id',
      phone: '0817-8899-0011',
      status: 'SUSPENDED',
      joinedDate: '2026-05-20',
    },
  ]);

  // Computed signals
  readonly pendingLots = computed(() => this.lots().filter((l) => l.status === 'PENDING_REVIEW'));
  readonly activeLots = computed(() => this.lots().filter((l) => l.status === 'ACTIVE'));
  readonly cancelledLots = computed(() => this.lots().filter((l) => l.status === 'CANCELLED'));

  readonly sellers = computed(() => this.members().filter((m) => m.type === 'SELLER'));
  readonly vendors = computed(() => this.members().filter((m) => m.type === 'VENDOR'));

  // --- SELLER ACTION: Mengajukan lelang baru ke Admin ---
  submitNewLot(payload: {
    title: string;
    description: string;
    category: LotCategory;
    quantity: number;
    unit: string;
    weightKg: number;
    startingPrice: number;
    sellerName: string;
    companyName: string;
    imageUrl?: string;
  }): void {
    const newLot: AuctionLot = {
      id: `LOT-${Math.floor(100 + Math.random() * 900)}`,
      title: payload.title,
      description: payload.description,
      category: payload.category,
      weightKg: payload.weightKg,
      quantity: payload.quantity,
      unit: payload.unit,
      startingPrice: payload.startingPrice,
      currentPrice: payload.startingPrice,
      status: 'PENDING_REVIEW', // Otomatis masuk review Admin
      sellerId: 'seller-current',
      sellerName: payload.sellerName,
      companyName: payload.companyName,
      images: [
        payload.imageUrl ||
          'https://images.unsplash.com/photo-1504917599217-d4dc5ebe6122?auto=format&fit=crop&w=800&q=80',
      ],
      totalBids: 0,
      timeRemaining: 'Menunggu Persetujuan Admin',
      createdAt: new Date().toISOString(),
    };

    this.lots.update((prev) => [newLot, ...prev]);
  }

  // --- ADMIN ACTION: Menyetujui lelang (Publish ke Vendor) ---
  approveAndPublishLot(lotId: string): void {
    this.lots.update((prev) =>
      prev.map((lot) =>
        lot.id === lotId
          ? {
              ...lot,
              status: 'ACTIVE',
              timeRemaining: '06h 00m',
            }
          : lot
      )
    );
  }

  // --- ADMIN ACTION: Membatalkan / Menolak lelang ---
  cancelLot(lotId: string, reason?: string): void {
    this.lots.update((prev) =>
      prev.map((lot) =>
        lot.id === lotId
          ? {
              ...lot,
              status: 'CANCELLED',
              timeRemaining: 'Dibatalkan oleh Admin',
            }
          : lot
      )
    );
  }

  // --- VENDOR ACTION: Menawar harga lelang secara terbuka ---
  placeBid(lotId: string, bidAmount: number): void {
    this.lots.update((prev) =>
      prev.map((lot) => {
        if (lot.id === lotId) {
          const updatedPrice = lot.currentPrice + bidAmount;
          return {
            ...lot,
            currentPrice: updatedPrice,
            totalBids: lot.totalBids + 1,
          };
        }
        return lot;
      })
    );
  }

  // --- ADMIN ACTION: Toggle status anggota (Seller/Vendor) ---
  toggleMemberStatus(memberId: string): void {
    this.members.update((prev) =>
      prev.map((m) =>
        m.id === memberId
          ? { ...m, status: m.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' }
          : m
      )
    );
  }

  // Tambah anggota partner baru
  addMember(member: {
    name: string;
    type: 'SELLER' | 'VENDOR';
    companyName: string;
    email: string;
    phone: string;
  }): void {
    const newMem: EnterpriseMember = {
      id: `MEM-0${this.members().length + 1}`,
      name: member.name,
      type: member.type,
      companyName: member.companyName,
      email: member.email,
      phone: member.phone,
      status: 'ACTIVE',
      joinedDate: new Date().toISOString().split('T')[0],
    };
    this.members.update((prev) => [newMem, ...prev]);
  }
}
