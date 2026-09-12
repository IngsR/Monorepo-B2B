import { AccountStatus, AuctionStatus, UserRole } from '../domain/enums';
import { Auction, Bid, Bidder, Category, Product, User, Vendor } from '../domain/models';

/**
 * In-memory dataset backing the mock API.
 *
 * Timestamps are generated relative to server start so that "ending soon",
 * "scheduled" and "ended" auction states are always demonstrable regardless of
 * when the app is opened.
 */

const NOW = Date.now();
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
/** Timestamp offset into the future relative to dataset creation. */
const at = (offsetMsFromNow: number) => new Date(NOW + offsetMsFromNow).toISOString();
const isoAgo = (offsetMs: number) => new Date(NOW - offsetMs).toISOString();

export const DEMO_PASSWORD = 'Password123';

/** Credential set advertised on the login screen. */
export const DEMO_ACCOUNTS = [
  { role: UserRole.ADMIN, email: 'admin@bidforge.test', password: DEMO_PASSWORD },
  { role: UserRole.VENDOR, email: 'vendor@bidforge.test', password: DEMO_PASSWORD },
  { role: UserRole.BIDDER, email: 'bidder@bidforge.test', password: DEMO_PASSWORD },
] as const;

/**
 * Token store: accessToken → userId. Populated on login.
 *
 * Backed by `sessionStorage` because this map stands in for server-side session
 * state. A real backend keeps issued tokens valid across a page reload; a plain
 * in-memory Map would be wiped when the module is re-evaluated, which would make
 * every hard refresh log the user out — a behaviour the real API does not have.
 */
const TOKEN_STORE_KEY = 'bidforge.mock.tokens';

function loadTokens(): Map<string, string> {
  try {
    const stored = sessionStorage.getItem(TOKEN_STORE_KEY);
    return stored ? new Map<string, string>(JSON.parse(stored)) : new Map();
  } catch {
    return new Map();
  }
}

export const tokens = loadTokens();

/** Persists the token map so issued tokens survive a page reload. */
export function persistTokens(): void {
  try {
    sessionStorage.setItem(TOKEN_STORE_KEY, JSON.stringify([...tokens]));
  } catch {
    // Storage unavailable (private mode, quota): the session simply will not
    // survive a reload, which is an acceptable degradation for a mock backend.
  }
}

export const users: User[] = [
  {
    id: 'usr_admin_01',
    email: 'admin@bidforge.test',
    firstName: 'Priya',
    lastName: 'Raghavan',
    role: UserRole.ADMIN,
    status: AccountStatus.ACTIVE,
    createdAt: isoAgo(240 * DAY),
    updatedAt: isoAgo(12 * DAY),
  },
  {
    id: 'usr_vendor_01',
    email: 'vendor@bidforge.test',
    firstName: 'Daniel',
    lastName: 'Okonkwo',
    role: UserRole.VENDOR,
    status: AccountStatus.ACTIVE,
    createdAt: isoAgo(180 * DAY),
    updatedAt: isoAgo(9 * DAY),
  },
  {
    id: 'usr_vendor_02',
    email: 'meridian@bidforge.test',
    firstName: 'Sofia',
    lastName: 'Marchetti',
    role: UserRole.VENDOR,
    status: AccountStatus.ACTIVE,
    createdAt: isoAgo(150 * DAY),
    updatedAt: isoAgo(20 * DAY),
  },
  {
    id: 'usr_vendor_03',
    email: 'northgate@bidforge.test',
    firstName: 'Tomas',
    lastName: 'Lindqvist',
    role: UserRole.VENDOR,
    status: AccountStatus.SUSPENDED,
    createdAt: isoAgo(120 * DAY),
    updatedAt: isoAgo(4 * DAY),
  },
  {
    id: 'usr_bidder_01',
    email: 'bidder@bidforge.test',
    firstName: 'Amara',
    lastName: 'Diallo',
    role: UserRole.BIDDER,
    status: AccountStatus.ACTIVE,
    createdAt: isoAgo(96 * DAY),
    updatedAt: isoAgo(3 * DAY),
  },
  {
    id: 'usr_bidder_02',
    email: 'helix@bidforge.test',
    firstName: 'Marcus',
    lastName: 'Brenner',
    role: UserRole.BIDDER,
    status: AccountStatus.ACTIVE,
    createdAt: isoAgo(88 * DAY),
    updatedAt: isoAgo(7 * DAY),
  },
  {
    id: 'usr_bidder_03',
    email: 'orion@bidforge.test',
    firstName: 'Yuki',
    lastName: 'Tanaka',
    role: UserRole.BIDDER,
    status: AccountStatus.ACTIVE,
    createdAt: isoAgo(64 * DAY),
    updatedAt: isoAgo(2 * DAY),
  },
  {
    id: 'usr_bidder_04',
    email: 'atlas@bidforge.test',
    firstName: 'Rohan',
    lastName: 'Mehta',
    role: UserRole.BIDDER,
    status: AccountStatus.INACTIVE,
    createdAt: isoAgo(40 * DAY),
    updatedAt: isoAgo(15 * DAY),
  },
];

export const vendors: Vendor[] = [
  {
    id: 'vnd_01',
    userId: 'usr_vendor_01',
    companyName: 'Okonkwo Industrial Holdings',
    contactPerson: 'Daniel Okonkwo',
    phone: '+44 20 7946 0311',
    address: 'Unit 14, Thameside Industrial Park, London',
    description: 'Process equipment and surplus plant machinery from European manufacturers.',
    status: AccountStatus.ACTIVE,
    createdAt: isoAgo(180 * DAY),
    updatedAt: isoAgo(9 * DAY),
  },
  {
    id: 'vnd_02',
    userId: 'usr_vendor_02',
    companyName: 'Meridian Metals Trading',
    contactPerson: 'Sofia Marchetti',
    phone: '+39 02 4523 8890',
    address: 'Via Industriale 82, Genoa',
    description: 'Non-ferrous and ferrous scrap brokerage for EU and MENA smelters.',
    status: AccountStatus.ACTIVE,
    createdAt: isoAgo(150 * DAY),
    updatedAt: isoAgo(20 * DAY),
  },
  {
    id: 'vnd_03',
    userId: 'usr_vendor_03',
    companyName: 'Northgate Salvage Ltd',
    contactPerson: 'Tomas Lindqvist',
    phone: '+46 8 522 14 70',
    address: 'Hamnvägen 9, Gothenburg',
    description: 'Marine and heavy vehicle decommissioning.',
    status: AccountStatus.SUSPENDED,
    createdAt: isoAgo(120 * DAY),
    updatedAt: isoAgo(4 * DAY),
  },
];

export const bidders: Bidder[] = [
  {
    id: 'bdr_01',
    userId: 'usr_bidder_01',
    companyName: 'Diallo Recycling Group',
    contactPerson: 'Amara Diallo',
    phone: '+221 33 842 11 09',
    address: 'Zone Industrielle, Dakar',
    status: AccountStatus.ACTIVE,
    createdAt: isoAgo(96 * DAY),
    updatedAt: isoAgo(3 * DAY),
  },
  {
    id: 'bdr_02',
    userId: 'usr_bidder_02',
    companyName: 'Helix Smelting AG',
    contactPerson: 'Marcus Brenner',
    phone: '+49 211 8823 440',
    address: 'Industriestraße 40, Düsseldorf',
    status: AccountStatus.ACTIVE,
    createdAt: isoAgo(88 * DAY),
    updatedAt: isoAgo(7 * DAY),
  },
  {
    id: 'bdr_03',
    userId: 'usr_bidder_03',
    companyName: 'Orion Materials KK',
    contactPerson: 'Yuki Tanaka',
    phone: '+81 3 6821 5500',
    address: 'Shinagawa, Tokyo',
    status: AccountStatus.ACTIVE,
    createdAt: isoAgo(64 * DAY),
    updatedAt: isoAgo(2 * DAY),
  },
  {
    id: 'bdr_04',
    userId: 'usr_bidder_04',
    companyName: 'Atlas Renewables Pvt Ltd',
    contactPerson: 'Rohan Mehta',
    phone: '+91 22 6156 2200',
    address: 'Lower Parel, Mumbai',
    status: AccountStatus.INACTIVE,
    createdAt: isoAgo(40 * DAY),
    updatedAt: isoAgo(15 * DAY),
  },
];

export const categories: Category[] = [
  {
    id: 'cat_01',
    name: 'Ferrous Scrap',
    slug: 'ferrous-scrap',
    description: 'Heavy melting steel, plate and structural offcuts.',
    createdAt: isoAgo(240 * DAY),
    updatedAt: isoAgo(30 * DAY),
  },
  {
    id: 'cat_02',
    name: 'Non-Ferrous Metals',
    slug: 'non-ferrous-metals',
    description: 'Copper, aluminium, brass and mixed non-ferrous grades.',
    createdAt: isoAgo(240 * DAY),
    updatedAt: isoAgo(28 * DAY),
  },
  {
    id: 'cat_03',
    name: 'Industrial Machinery',
    slug: 'industrial-machinery',
    description: 'Process equipment, generators, compressors and tooling.',
    createdAt: isoAgo(210 * DAY),
    updatedAt: isoAgo(14 * DAY),
  },
  {
    id: 'cat_04',
    name: 'Heavy Vehicles',
    slug: 'heavy-vehicles',
    description: 'Trucks, trailers, plant vehicles and fleet disposals.',
    createdAt: isoAgo(190 * DAY),
    updatedAt: isoAgo(11 * DAY),
  },
  {
    id: 'cat_05',
    name: 'Electronic Waste',
    slug: 'electronic-waste',
    description: 'Server hardware, telecom boards and datacentre decommissioning.',
    createdAt: isoAgo(160 * DAY),
    updatedAt: isoAgo(6 * DAY),
  },
  {
    id: 'cat_06',
    name: 'Electrical Equipment',
    slug: 'electrical-equipment',
    description: 'Transformers, switchgear, cable and substation assets.',
    createdAt: isoAgo(140 * DAY),
    updatedAt: isoAgo(5 * DAY),
  },
];

export const products: Product[] = [
  {
    id: 'prd_01',
    code: 'OKN-HMS-2401',
    name: 'HMS 1&2 Heavy Melting Steel Scrap — 42t',
    description:
      'Structural beams, plate and pipe offcuts from a decommissioned fabrication hall. Cut to furnace length, free of concrete and non-ferrous contamination.',
    categoryId: 'cat_01',
    vendorId: 'vnd_01',
    createdAt: isoAgo(26 * DAY),
    updatedAt: isoAgo(6 * DAY),
  },
  {
    id: 'prd_02',
    code: 'OKN-GEN-5000',
    name: 'Caterpillar 500 kVA Diesel Generator (2 units)',
    description:
      'Standby generators retired from a petrochemical site. Full service history, low running hours, load-bank tested prior to release.',
    categoryId: 'cat_03',
    vendorId: 'vnd_01',
    createdAt: isoAgo(22 * DAY),
    updatedAt: isoAgo(5 * DAY),
  },
  {
    id: 'prd_03',
    code: 'OKN-CNC-1109',
    name: 'CNC Turning and Milling Cell',
    description:
      'Six-axis turning centre with two vertical machining centres, tooling package and control documentation included.',
    categoryId: 'cat_03',
    vendorId: 'vnd_01',
    createdAt: isoAgo(18 * DAY),
    updatedAt: isoAgo(4 * DAY),
  },
  {
    id: 'prd_04',
    code: 'OKN-EWS-0071',
    name: 'Datacentre Rack and PCB Lot',
    description:
      'Decommissioned tier-3 server racks with populated backplanes. Gold-plated connectors, mixed circuit boards, enclosures included.',
    categoryId: 'cat_05',
    vendorId: 'vnd_01',
    createdAt: isoAgo(12 * DAY),
    updatedAt: isoAgo(2 * DAY),
  },
  {
    id: 'prd_05',
    code: 'MDM-CU-9920',
    name: 'Millberry Copper Wire Scrap — 12t',
    description:
      'Stripped substation conductor, verified 99.9% purity by laboratory assay. Baled and strapped on export pallets.',
    categoryId: 'cat_02',
    vendorId: 'vnd_02',
    createdAt: isoAgo(14 * DAY),
    updatedAt: isoAgo(7 * DAY),
  },
  {
    id: 'prd_06',
    code: 'MDM-TRF-1600',
    name: '1600 kVA Distribution Transformer',
    description:
      'Oil-filled ONAN transformer removed from an internal plant substation. Copper windings, oil drained to environmental procedure.',
    categoryId: 'cat_06',
    vendorId: 'vnd_02',
    createdAt: isoAgo(16 * DAY),
    updatedAt: isoAgo(7 * DAY),
  },
  {
    id: 'prd_07',
    code: 'NGT-TRK-0225',
    name: 'Fleet Dump Trucks — 5 Units',
    description:
      'Off-lease quarry trucks sold as a package. Diesel turbo, serviceable hydraulics, full documentation per unit.',
    categoryId: 'cat_04',
    vendorId: 'vnd_03',
    createdAt: isoAgo(30 * DAY),
    updatedAt: isoAgo(16 * DAY),
  },
];

export const auctions: Auction[] = [
  // --- ACTIVE, ending soon -------------------------------------------------
  {
    id: 'auc_01',
    productId: 'prd_01',
    vendorId: 'vnd_01',
    startingPrice: 92_000,
    currentPrice: 118_500,
    bidIncrement: 2_500,
    startTime: isoAgo(3 * DAY),
    endTime: at(42 * 60_000),
    status: AuctionStatus.ACTIVE,
    bidCount: 14,
    createdAt: isoAgo(26 * DAY),
    updatedAt: isoAgo(20 * 60_000),
  },
  // --- ACTIVE, running normally -------------------------------------------
  {
    id: 'auc_02',
    productId: 'prd_02',
    vendorId: 'vnd_01',
    startingPrice: 240_000,
    currentPrice: 268_000,
    bidIncrement: 5_000,
    startTime: isoAgo(2 * DAY),
    endTime: at(5 * HOUR + 12 * 60_000),
    status: AuctionStatus.ACTIVE,
    bidCount: 9,
    createdAt: isoAgo(22 * DAY),
    updatedAt: isoAgo(95 * 60_000),
  },
  {
    id: 'auc_03',
    productId: 'prd_05',
    vendorId: 'vnd_02',
    startingPrice: 610_000,
    currentPrice: 610_000,
    bidIncrement: 10_000,
    startTime: isoAgo(6 * HOUR),
    endTime: at(26 * HOUR),
    status: AuctionStatus.ACTIVE,
    bidCount: 0,
    createdAt: isoAgo(20 * DAY),
    updatedAt: isoAgo(6 * HOUR),
  },
  {
    id: 'auc_04',
    productId: 'prd_04',
    vendorId: 'vnd_01',
    startingPrice: 82_000,
    currentPrice: 104_000,
    bidIncrement: 2_000,
    startTime: isoAgo(1 * DAY),
    endTime: at(21 * HOUR),
    status: AuctionStatus.ACTIVE,
    bidCount: 11,
    createdAt: isoAgo(12 * DAY),
    updatedAt: isoAgo(3 * HOUR),
  },
  // --- ACTIVE but the recorded end time has passed -------------------------
  // Demonstrates the split between recorded status and the bidding window.
  {
    id: 'auc_05',
    productId: 'prd_03',
    vendorId: 'vnd_01',
    startingPrice: 175_000,
    currentPrice: 188_000,
    bidIncrement: 3_000,
    startTime: isoAgo(8 * DAY),
    endTime: isoAgo(4 * HOUR),
    status: AuctionStatus.ACTIVE,
    bidCount: 7,
    createdAt: isoAgo(18 * DAY),
    updatedAt: isoAgo(4 * HOUR),
  },
  // --- SCHEDULED ----------------------------------------------------------
  {
    id: 'auc_06',
    productId: 'prd_06',
    vendorId: 'vnd_02',
    startingPrice: 145_000,
    currentPrice: 145_000,
    bidIncrement: 2_500,
    startTime: at(2 * DAY),
    endTime: at(5 * DAY),
    status: AuctionStatus.SCHEDULED,
    bidCount: 0,
    createdAt: isoAgo(16 * DAY),
    updatedAt: isoAgo(16 * DAY),
  },
  {
    id: 'auc_07',
    productId: 'prd_07',
    vendorId: 'vnd_03',
    startingPrice: 310_000,
    currentPrice: 310_000,
    bidIncrement: 5_000,
    startTime: at(18 * HOUR),
    endTime: at(4 * DAY),
    status: AuctionStatus.SCHEDULED,
    bidCount: 0,
    createdAt: isoAgo(30 * DAY),
    updatedAt: isoAgo(16 * DAY),
  },
  // --- DRAFT --------------------------------------------------------------
  {
    id: 'auc_08',
    productId: 'prd_01',
    vendorId: 'vnd_01',
    startingPrice: 88_000,
    currentPrice: 88_000,
    bidIncrement: 2_000,
    startTime: at(4 * DAY),
    endTime: at(9 * DAY),
    status: AuctionStatus.DRAFT,
    bidCount: 0,
    createdAt: isoAgo(5 * DAY),
    updatedAt: isoAgo(5 * DAY),
  },
  // --- ENDED (winner derived from the highest bid, no winner entity) -------
  {
    id: 'auc_09',
    productId: 'prd_02',
    vendorId: 'vnd_01',
    startingPrice: 210_000,
    currentPrice: 246_000,
    bidIncrement: 4_000,
    startTime: isoAgo(14 * DAY),
    endTime: isoAgo(7 * DAY),
    status: AuctionStatus.ENDED,
    bidCount: 18,
    createdAt: isoAgo(40 * DAY),
    updatedAt: isoAgo(7 * DAY),
  },
  // --- CANCELLED ----------------------------------------------------------
  {
    id: 'auc_10',
    productId: 'prd_06',
    vendorId: 'vnd_02',
    startingPrice: 130_000,
    currentPrice: 130_000,
    bidIncrement: 2_500,
    startTime: isoAgo(20 * DAY),
    endTime: isoAgo(13 * DAY),
    status: AuctionStatus.CANCELLED,
    bidCount: 2,
    createdAt: isoAgo(28 * DAY),
    updatedAt: isoAgo(18 * DAY),
  },
];

export const bids: Bid[] = [
  // auc_01 — competitive, 42 minutes left
  {
    id: 'bid_0101',
    auctionId: 'auc_01',
    bidderId: 'bdr_02',
    amount: 118_500,
    createdAt: isoAgo(20 * 60_000),
  },
  {
    id: 'bid_0102',
    auctionId: 'auc_01',
    bidderId: 'bdr_03',
    amount: 116_000,
    createdAt: isoAgo(48 * 60_000),
  },
  {
    id: 'bid_0103',
    auctionId: 'auc_01',
    bidderId: 'bdr_01',
    amount: 113_500,
    createdAt: isoAgo(2 * HOUR),
  },
  {
    id: 'bid_0104',
    auctionId: 'auc_01',
    bidderId: 'bdr_02',
    amount: 111_000,
    createdAt: isoAgo(5 * HOUR),
  },
  {
    id: 'bid_0105',
    auctionId: 'auc_01',
    bidderId: 'bdr_03',
    amount: 108_500,
    createdAt: isoAgo(9 * HOUR),
  },
  {
    id: 'bid_0106',
    auctionId: 'auc_01',
    bidderId: 'bdr_01',
    amount: 106_000,
    createdAt: isoAgo(1 * DAY),
  },
  {
    id: 'bid_0107',
    auctionId: 'auc_01',
    bidderId: 'bdr_02',
    amount: 103_500,
    createdAt: isoAgo(28 * HOUR),
  },
  {
    id: 'bid_0108',
    auctionId: 'auc_01',
    bidderId: 'bdr_01',
    amount: 101_000,
    createdAt: isoAgo(30 * HOUR),
  },
  {
    id: 'bid_0109',
    auctionId: 'auc_01',
    bidderId: 'bdr_03',
    amount: 98_500,
    createdAt: isoAgo(40 * HOUR),
  },
  {
    id: 'bid_0110',
    auctionId: 'auc_01',
    bidderId: 'bdr_02',
    amount: 96_000,
    createdAt: isoAgo(2 * DAY),
  },

  // auc_02 — running
  {
    id: 'bid_0201',
    auctionId: 'auc_02',
    bidderId: 'bdr_03',
    amount: 268_000,
    createdAt: isoAgo(95 * 60_000),
  },
  {
    id: 'bid_0202',
    auctionId: 'auc_02',
    bidderId: 'bdr_02',
    amount: 263_000,
    createdAt: isoAgo(4 * HOUR),
  },
  {
    id: 'bid_0203',
    auctionId: 'auc_02',
    bidderId: 'bdr_01',
    amount: 258_000,
    createdAt: isoAgo(11 * HOUR),
  },
  {
    id: 'bid_0204',
    auctionId: 'auc_02',
    bidderId: 'bdr_03',
    amount: 253_000,
    createdAt: isoAgo(1 * DAY),
  },
  {
    id: 'bid_0205',
    auctionId: 'auc_02',
    bidderId: 'bdr_01',
    amount: 248_000,
    createdAt: isoAgo(2 * DAY),
  },

  // auc_03 — active with no bids yet
  // auc_04 — active
  {
    id: 'bid_0401',
    auctionId: 'auc_04',
    bidderId: 'bdr_01',
    amount: 104_000,
    createdAt: isoAgo(3 * HOUR),
  },
  {
    id: 'bid_0402',
    auctionId: 'auc_04',
    bidderId: 'bdr_04',
    amount: 102_000,
    createdAt: isoAgo(8 * HOUR),
  },
  {
    id: 'bid_0403',
    auctionId: 'auc_04',
    bidderId: 'bdr_02',
    amount: 100_000,
    createdAt: isoAgo(20 * HOUR),
  },
  {
    id: 'bid_0404',
    auctionId: 'auc_04',
    bidderId: 'bdr_01',
    amount: 98_000,
    createdAt: isoAgo(1 * DAY),
  },

  // auc_05 — clock expired, status still ACTIVE
  {
    id: 'bid_0501',
    auctionId: 'auc_05',
    bidderId: 'bdr_02',
    amount: 188_000,
    createdAt: isoAgo(5 * HOUR),
  },
  {
    id: 'bid_0502',
    auctionId: 'auc_05',
    bidderId: 'bdr_03',
    amount: 185_000,
    createdAt: isoAgo(12 * HOUR),
  },
  {
    id: 'bid_0503',
    auctionId: 'auc_05',
    bidderId: 'bdr_01',
    amount: 182_000,
    createdAt: isoAgo(2 * DAY),
  },

  // auc_09 — ended
  {
    id: 'bid_0901',
    auctionId: 'auc_09',
    bidderId: 'bdr_02',
    amount: 246_000,
    createdAt: isoAgo(7 * DAY + 2 * HOUR),
  },
  {
    id: 'bid_0902',
    auctionId: 'auc_09',
    bidderId: 'bdr_01',
    amount: 242_000,
    createdAt: isoAgo(8 * DAY),
  },
  {
    id: 'bid_0903',
    auctionId: 'auc_09',
    bidderId: 'bdr_03',
    amount: 234_000,
    createdAt: isoAgo(9 * DAY),
  },
  {
    id: 'bid_0904',
    auctionId: 'auc_09',
    bidderId: 'bdr_02',
    amount: 226_000,
    createdAt: isoAgo(10 * DAY),
  },
  {
    id: 'bid_0905',
    auctionId: 'auc_09',
    bidderId: 'bdr_01',
    amount: 218_000,
    createdAt: isoAgo(12 * DAY),
  },

  // auc_10 — cancelled after two bids were placed
  {
    id: 'bid_1001',
    auctionId: 'auc_10',
    bidderId: 'bdr_03',
    amount: 135_000,
    createdAt: isoAgo(21 * DAY),
  },
  {
    id: 'bid_1002',
    auctionId: 'auc_10',
    bidderId: 'bdr_01',
    amount: 132_500,
    createdAt: isoAgo(22 * DAY),
  },
];

/** Password reset tokens: token → userId. */
export const resetTokens = new Map<string, string>();
