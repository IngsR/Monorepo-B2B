import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AuctionLot, BidHistoryItem, LotCategory, LotStatus } from '../models/auction.model';

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
  private readonly http = inject(HttpClient, { optional: true });
  private readonly apiUrl = 'http://localhost:4000/api/v1';

  // Master state lelang bersama dengan data manifest realistis
  readonly lots = signal<AuctionLot[]>([
    {
      id: 'LOT-101',
      title: 'Besi Tua Scrap Heavy Melting Steel (HMS 1&2)',
      description: 'Potongan balok I-beam baja struktur pabrik, pelat konstruksi tebal 8-16mm, dan potongan pipa industri bebas dari kontaminasi plastik, beton, atau minyak.',
      category: 'SCRAP_METAL',
      weightKg: 45000,
      quantity: 45,
      unit: 'Ton',
      startingPrice: 225000000,
      currentPrice: 285000000,
      reservePrice: 260000000,
      status: 'ACTIVE',
      warehouseLocation: 'Kawasan Industri Krakatau Steel, Cilegon, Banten (Gudang Yard B)',
      sellerId: 'seller-1',
      sellerName: 'Budi Santoso (Head of Scrap Asset)',
      companyName: 'PT Cilegon Baja Mandiri',
      highestBidderId: 'vendor-1',
      highestBidderName: 'PT Krakatau Peleburan Logam',
      images: [
        'https://images.unsplash.com/photo-1504917599217-d4dc5ebe6122?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=1200&q=80',
      ],
      totalBids: 14,
      timeRemaining: '02h 45m',
      createdAt: '2026-09-08T10:00:00Z',
      specs: {
        grade: 'HMS 1 & 2 (Standard ISRI 200-206)',
        purity: 'Baja Karbon Rendah (Fe > 98.2%)',
        contamination: 'Toleransi Non-Ferrous < 0.5%',
        legality: 'Surat Pelepasan Hak Aset & BAST Resmi',
        inspectionSchedule: 'Senin - Jumat 09:00 - 15:00 WIB (Perjanjian 1 Hari Sebelumnya)',
        loadingTerms: 'FOB Gudang Penjual (Biaya forklift & armada truk ditanggung Pembeli)',
        scaleCertificate: 'Timbangan Jembatan Elektronik Tera Metrologi 2026',
      },
      bidHistory: [
        {
          id: 'BID-891',
          vendorId: 'vendor-1',
          vendorName: 'PT Krakatau Peleburan Logam',
          amount: 285000000,
          time: '10 menit lalu',
          isWinning: true,
        },
        {
          id: 'BID-890',
          vendorId: 'vendor-2',
          vendorName: 'CV Sinar Logam Abadi',
          amount: 275000000,
          time: '24 menit lalu',
          isWinning: false,
        },
        {
          id: 'BID-889',
          vendorId: 'vendor-3',
          vendorName: 'PT Duta Scrap Metalindo',
          amount: 260000000,
          time: '1 jam lalu',
          isWinning: false,
        },
      ],
    },
    {
      id: 'LOT-102',
      title: 'Genset Industri Caterpillar 500 kVA (2 Unit Silent Type)',
      description: 'Genset cadangan eks operasional pabrik manufaktur otomotif, running hour rendah (1.420 jam), mesin diesel Cat C15, alternator Leroy Somer, panel kontrol digital.',
      category: 'MACHINERY',
      weightKg: 8200,
      quantity: 2,
      unit: 'Unit',
      startingPrice: 380000000,
      currentPrice: 425000000,
      reservePrice: 400000000,
      status: 'ACTIVE',
      warehouseLocation: 'Kawasan Industri GIIC Deltamas, Cikarang Pusat, Bekasi (Blok AB-12)',
      sellerId: 'seller-2',
      sellerName: 'Hendra Gunawan (Facility Manager)',
      companyName: 'PT Sarana Daya Prima',
      highestBidderId: 'vendor-2',
      highestBidderName: 'CV Sinar Logam Abadi',
      images: [
        'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1504917599217-d4dc5ebe6122?auto=format&fit=crop&w=1200&q=80',
      ],
      totalBids: 9,
      timeRemaining: '05h 12m',
      createdAt: '2026-09-08T11:30:00Z',
      specs: {
        grade: 'Operational Surplus Grade A',
        purity: 'Running Hours: 1.420 Jam (Original Logbook)',
        contamination: 'Kondisi Oli & Filter Baru Diganti Q2 2026',
        legality: 'Faktur Pembelian Resmi Traktor Nusantara & Manual Book',
        inspectionSchedule: 'Setiap Hari Kerja 10:00 - 16:00 WIB (Bisa Test Load Bank)',
        loadingTerms: 'Gudang dilengkapi Overhead Crane kapasitas 15 Ton',
        scaleCertificate: 'Sertifikat Kalibrasi Genset Disnaker Aktif',
      },
      bidHistory: [
        {
          id: 'BID-741',
          vendorId: 'vendor-2',
          vendorName: 'CV Sinar Logam Abadi',
          amount: 425000000,
          time: '35 menit lalu',
          isWinning: true,
        },
        {
          id: 'BID-740',
          vendorId: 'vendor-1',
          vendorName: 'PT Krakatau Peleburan Logam',
          amount: 410000000,
          time: '1 jam lalu',
          isWinning: false,
        },
      ],
    },
    {
      id: 'LOT-103',
      title: 'Tembaga Kabel Kupas Kualitas Super (Millberry Cu 99.9%)',
      description: 'Kabel tembaga substation PLN kupas bersih kemurnian 99.9%, diameter kawat 1.8mm - 3.2mm, bebas lapisan timah, bebas oksidasi hijau, siap lebur industri.',
      category: 'SCRAP_METAL',
      weightKg: 12000,
      quantity: 12,
      unit: 'Ton',
      startingPrice: 840000000,
      currentPrice: 840000000,
      status: 'PENDING_REVIEW', // Menunggu persetujuan Admin
      warehouseLocation: 'Logistics Hub Tanjung Priok, Jakarta Utara (Gudang Berikat)',
      sellerId: 'seller-1',
      sellerName: 'Budi Santoso',
      companyName: 'PT Cilegon Baja Mandiri',
      images: [
        'https://images.unsplash.com/photo-1578328819058-b69f3a3b0f6b?auto=format&fit=crop&w=1200&q=80',
      ],
      totalBids: 0,
      timeRemaining: 'Menunggu Persetujuan Admin',
      createdAt: '2026-09-09T08:00:00Z',
      specs: {
        grade: 'Millberry Copper Wire (ISRI Barley/Berry)',
        purity: 'Cu Minimum 99.92% (Spektrometri Terlampir)',
        contamination: 'Bebas timbal, oli, dan isolasi PVC',
        legality: 'Surat Keterangan Asal & Izin Niaga Logam Mulia/Dasar',
        inspectionSchedule: 'Menunggu verifikasi admin sebelum jadwal kunjungan dibuka',
        loadingTerms: 'Pallet kayu standar ekspor, pengikatan strapping baja',
        scaleCertificate: 'Sertifikat Timbang Digital Akreditasi KAN',
      },
      bidHistory: [],
    },
    {
      id: 'LOT-104',
      title: 'Dump Truck Tambang Mitsubishi Fuso Fighter 220PS (3 Unit)',
      description: 'Armada angkutan tambang peremajaan unit, mesin diesel kering 6D16, transmisi prima, dump hidrolik KYB bekerja normal, STNK & BPKB lengkap.',
      category: 'VEHICLE',
      weightKg: 24000,
      quantity: 3,
      unit: 'Unit',
      startingPrice: 520000000,
      currentPrice: 520000000,
      status: 'PENDING_REVIEW', // Menunggu persetujuan Admin
      warehouseLocation: 'Workshop Tambang Samboja, Kutai Kartanegara, Kalimantan Timur',
      sellerId: 'seller-3',
      sellerName: 'Agus Pratama (Fleet Director)',
      companyName: 'PT Tambang Logistik Nusantara',
      images: [
        'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?auto=format&fit=crop&w=1200&q=80',
      ],
      totalBids: 0,
      timeRemaining: 'Menunggu Persetujuan Admin',
      createdAt: '2026-09-09T09:15:00Z',
      specs: {
        grade: 'Heavy Commercial Vehicle Grade B+',
        purity: 'Odometer Rata-rata 185.000 KM (Terawat Bengkel Resmi)',
        contamination: 'Ban cadangan & dongkrak hidrolik lengkap di tiap unit',
        legality: 'BPKB Asli & Faktur Lengkap, Pajak Tahunan Aktif',
        inspectionSchedule: 'Senin - Sabtu 08:00 - 17:00 WITA',
        loadingTerms: 'Unit siap jalan / self-drive atau towing pengangkutan',
        scaleCertificate: 'Hasil Uji Kir Dishub Masih Berlaku',
      },
      bidHistory: [],
    },
    {
      id: 'LOT-105',
      title: 'Transformator Distribusi 1600 kVA Step-Down (Eks Pabrik)',
      description: 'Trafo oli industri bekas gardu induk internal pabrik semen, trafo tembaga berpendingin ONAN, tegangan 20 kV ke 400V, berat oli trafo 1.200 liter.',
      category: 'MACHINERY',
      weightKg: 6400,
      quantity: 1,
      unit: 'Unit',
      startingPrice: 160000000,
      currentPrice: 160000000,
      status: 'CANCELLED',
      warehouseLocation: 'Kawasan Industri Tuban, Jawa Timur',
      sellerId: 'seller-2',
      sellerName: 'Hendra Gunawan',
      companyName: 'PT Sarana Daya Prima',
      images: [
        'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=1200&q=80',
      ],
      totalBids: 0,
      timeRemaining: 'Dibatalkan oleh Admin (Dokumen Legalitas Perlu Diperbarui)',
      createdAt: '2026-09-07T14:20:00Z',
      specs: {
        grade: 'Electrical Asset (Needs Refurbishment)',
        purity: 'Winding Tembaga Murni (Bukan Aluminium)',
        contamination: 'Oli isolasi telah dikuras sesuai SOP Lingkungan B3',
        legality: 'Menunggu revisi berita acara penghapusan aset perseroan',
        inspectionSchedule: 'Ditutup sementara',
        loadingTerms: 'Perlu armada flatbed trailer',
      },
      bidHistory: [],
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

  // Ambil lot detail berdasarkan ID
  getLotById(id: string): AuctionLot | undefined {
    return this.lots().find((l) => l.id === id);
  }

  // --- SELLER ACTION: Mengajukan lelang baru ke Admin & Backend ---
  submitNewLot(payload: {
    title: string;
    description: string;
    category: LotCategory;
    quantity: number;
    unit: string;
    weightKg: number;
    startingPrice: number;
    warehouseLocation?: string;
    sellerName: string;
    companyName: string;
    imageUrl?: string;
    grade?: string;
  }): void {
    const newLotId = `LOT-${Math.floor(100 + Math.random() * 900)}`;
    const newLot: AuctionLot = {
      id: newLotId,
      title: payload.title,
      description: payload.description,
      category: payload.category,
      weightKg: payload.weightKg,
      quantity: payload.quantity,
      unit: payload.unit,
      startingPrice: payload.startingPrice,
      currentPrice: payload.startingPrice,
      status: 'PENDING_REVIEW', // Masuk antrean kurasi Admin
      warehouseLocation:
        payload.warehouseLocation || 'Gudang Konsinyasi Scrap Industri Cilegon, Banten',
      sellerId: 'seller-current',
      sellerName: payload.sellerName,
      companyName: payload.companyName,
      images: [
        payload.imageUrl ||
          'https://images.unsplash.com/photo-1504917599217-d4dc5ebe6122?auto=format&fit=crop&w=1200&q=80',
      ],
      totalBids: 0,
      timeRemaining: 'Menunggu Persetujuan Admin',
      createdAt: new Date().toISOString(),
      specs: {
        grade: payload.grade || 'Industrial Scrap Grade Standar',
        purity: 'Hasil Uji Fisik Sesuai Sampel Pengajuan',
        contamination: 'Toleransi Bebas Kotoran Terlampir',
        legality: 'Surat Pelepasan Hak Pemilik Sah Terdaftar',
        inspectionSchedule: 'Senin - Jumat 09:00 - 15:00 WIB',
        loadingTerms: 'FOB Gudang Penjual (Armada dan alat muat disiapkan pembeli)',
      },
      bidHistory: [],
    };

    // Update state reaktif lokal
    this.lots.update((prev) => [newLot, ...prev]);

    // Sinkronkan ke NestJS backend jika HTTP tersedia
    if (this.http) {
      this.http
        .post(`${this.apiUrl}/auctions`, {
          title: payload.title,
          category: payload.category,
          quantity: payload.quantity,
          unit: payload.unit,
          basePrice: payload.startingPrice,
          warehouseLocation:
            payload.warehouseLocation || 'Gudang Konsinyasi Scrap Industri',
        })
        .subscribe({
          next: () => console.log(`[NestJS] Lot ${newLotId} berhasil tersinkron`),
          error: (err) =>
            console.warn('[NestJS Sync] Server backend offline, tetap aktif di local signals', err),
        });
    }
  }

  // --- ADMIN ACTION: Menyetujui lelang (Publish ke Vendor Live Floor) ---
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

    // Sinkronkan ke NestJS backend
    if (this.http) {
      this.http.patch(`${this.apiUrl}/auctions/${lotId}/approve`, {}).subscribe({
        next: () => console.log(`[NestJS] Lot ${lotId} approved on backend`),
        error: (err) => console.warn('[NestJS Sync] Offline fallback', err),
      });
    }
  }

  // --- ADMIN ACTION: Membatalkan / Menolak lelang ---
  cancelLot(lotId: string, reason?: string): void {
    this.lots.update((prev) =>
      prev.map((lot) =>
        lot.id === lotId
          ? {
              ...lot,
              status: 'CANCELLED',
              timeRemaining: reason || 'Dibatalkan oleh Admin',
            }
          : lot
      )
    );

    // Sinkronkan ke NestJS backend
    if (this.http) {
      this.http.patch(`${this.apiUrl}/auctions/${lotId}/cancel`, {}).subscribe({
        next: () => console.log(`[NestJS] Lot ${lotId} cancelled on backend`),
        error: (err) => console.warn('[NestJS Sync] Offline fallback', err),
      });
    }
  }

  // --- VENDOR ACTION: Menawar harga lelang secara terbuka dengan Riwayat Lengkap ---
  placeBid(
    lotId: string,
    bidIncrementOrTotal: number,
    vendorName = 'PT Krakatau Peleburan Logam (Anda)'
  ): void {
    this.lots.update((prev) =>
      prev.map((lot) => {
        if (lot.id === lotId) {
          const isAbsolute = bidIncrementOrTotal > lot.currentPrice;
          const newPrice = isAbsolute
            ? bidIncrementOrTotal
            : lot.currentPrice + bidIncrementOrTotal;

          const newBidItem: BidHistoryItem = {
            id: `BID-${Math.floor(100 + Math.random() * 900)}`,
            vendorId: 'vendor-current',
            vendorName,
            amount: newPrice,
            time: 'Baru saja',
            isWinning: true,
          };

          // Mark previous bids as not winning
          const updatedHistory = (lot.bidHistory || []).map((b) => ({
            ...b,
            isWinning: false,
          }));

          return {
            ...lot,
            currentPrice: newPrice,
            totalBids: lot.totalBids + 1,
            highestBidderName: vendorName,
            highestBidderId: 'vendor-current',
            bidHistory: [newBidItem, ...updatedHistory],
          };
        }
        return lot;
      })
    );

    // Sinkronkan ke NestJS backend
    if (this.http) {
      const lot = this.getLotById(lotId);
      if (lot) {
        this.http
          .post(`${this.apiUrl}/auctions/${lotId}/bids`, {
            amount: lot.currentPrice,
          })
          .subscribe({
            next: () => console.log(`[NestJS] Bid on ${lotId} placed on backend`),
            error: (err) => console.warn('[NestJS Sync] Offline fallback', err),
          });
      }
    }
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
