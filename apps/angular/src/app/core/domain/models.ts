import { AccountStatus, AuctionStatus, UserRole } from './enums';

/**
 * API envelope types — every endpoint returns one of these shapes.
 * See the backend contract: { success, data, message } / { success, message, code }.
 */
export interface ApiSuccess<T> {
  success: true;
  data: T;
  message?: string;
}

export interface ApiError {
  success: false;
  message: string;
  code: string;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

/** Standard paginated payload. */
export interface Paginated<T> {
  items: T[];
  meta: PageMeta;
}

export interface PageMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** Common list query parameters accepted by the collection endpoints. */
export interface ListQuery {
  page?: number;
  limit?: number;
  search?: string;
  sort?: string;
}

/* --------------------------------------------------------------------------
   IDENTITY & OWNERSHIP
   User is the auth identity. A Vendor or Bidder profile is linked to exactly
   one User. Vendors own Products; Products are classified by Category.
   -------------------------------------------------------------------------- */

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  status: AccountStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Vendor {
  id: string;
  userId: string;
  companyName: string;
  contactPerson: string;
  phone: string;
  address?: string;
  description?: string;
  status: AccountStatus;
  createdAt: string;
  updatedAt: string;
  /** Present when the API joins the owning user (admin listings). */
  user?: Pick<User, 'id' | 'email' | 'firstName' | 'lastName' | 'status'>;
  productCount?: number;
}

export interface Bidder {
  id: string;
  userId: string;
  companyName?: string;
  contactPerson: string;
  phone: string;
  address?: string;
  status: AccountStatus;
  createdAt: string;
  updatedAt: string;
  user?: Pick<User, 'id' | 'email' | 'firstName' | 'lastName' | 'status'>;
  bidCount?: number;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  /** Derived by the API from the products attached to this category. */
  productCount?: number;
}

/* --------------------------------------------------------------------------
   PRODUCT
   Owned by exactly one Vendor, belongs to exactly one Category.
   A product may be used by several Auctions over time.
   -------------------------------------------------------------------------- */

export interface Product {
  id: string;
  code: string;
  name: string;
  description?: string;
  categoryId: string;
  vendorId: string;
  createdAt: string;
  updatedAt: string;
  /** Expanded relations returned on read endpoints. */
  category?: Pick<Category, 'id' | 'name'>;
  vendor?: Pick<Vendor, 'id' | 'companyName'>;
  auctionCount?: number;
}

/* --------------------------------------------------------------------------
   AUCTION
   currentPrice is server-managed: it is derived from the highest valid bid and
   must never be submitted by the client.
   -------------------------------------------------------------------------- */

export interface Auction {
  id: string;
  productId: string;
  vendorId: string;
  startingPrice: number;
  currentPrice: number;
  bidIncrement: number;
  startTime: string;
  endTime: string;
  status: AuctionStatus;
  /** Highest bid amount, or null when no valid bid has been placed. */
  highestBidAmount?: number | null;
  highestBidderId?: string | null;
  highestBidderDisplayName?: string | null;
  bidCount: number;
  createdAt: string;
  updatedAt: string;
  /** Expanded relations returned on read endpoints. */
  product?: Product;
  vendor?: Pick<Vendor, 'id' | 'companyName'>;
}

export interface Bid {
  id: string;
  auctionId: string;
  bidderId: string;
  amount: number;
  createdAt: string;
  /** True when this bid is the current highest valid bid for the auction. */
  isHighest?: boolean;
  /** Bidder display information — only exposed where the API permits it. */
  bidderDisplayName?: string | null;
  bidderCompanyName?: string | null;
  /** Present on GET /bids/mine so the bidder can see auction context. */
  auction?: Auction;
}

/* --------------------------------------------------------------------------
   REQUEST PAYLOADS
   Deliberately omit every server-managed or derived value.
   -------------------------------------------------------------------------- */

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginResult {
  accessToken: string;
}

export interface CreateProductPayload {
  code: string;
  name: string;
  description?: string;
  categoryId: string;
}

export type UpdateProductPayload = Partial<CreateProductPayload>;

export interface CreateAuctionPayload {
  productId: string;
  startingPrice: number;
  bidIncrement: number;
  startTime: string;
  endTime: string;
}

export type UpdateAuctionPayload = Partial<CreateAuctionPayload>;

export interface PlaceBidPayload {
  /** Only the amount is client-supplied; the bidder is resolved from the JWT. */
  amount: number;
}

export interface CreateUserPayload {
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  password?: string;
  status?: AccountStatus;
}

export type UpdateUserPayload = Partial<Omit<CreateUserPayload, 'password'>>;

export interface CreateVendorPayload {
  userId?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  companyName: string;
  contactPerson: string;
  phone: string;
  address?: string;
  description?: string;
}

export type UpdateVendorPayload = Partial<CreateVendorPayload>;

export interface CreateBidderPayload {
  userId?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  contactPerson: string;
  phone: string;
  address?: string;
}

export type UpdateBidderPayload = Partial<CreateBidderPayload>;

export interface CategoryPayload {
  name: string;
  description?: string;
}

export interface UpdateProfilePayload {
  firstName?: string;
  lastName?: string;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

export interface ForgotPasswordPayload {
  email: string;
}

export interface ResetPasswordPayload {
  token: string;
  newPassword: string;
}

/* --------------------------------------------------------------------------
   QUERY FILTERS
   -------------------------------------------------------------------------- */

export interface AuctionQuery extends ListQuery {
  status?: AuctionStatus | 'ALL';
  categoryId?: string | 'ALL';
  vendorId?: string;
  /** Price range applied to currentPrice on the marketplace. */
  minPrice?: number;
  maxPrice?: number;
  endingSoonMinutes?: number;
  /** Marketplace ordering: urgency first by default. */
  orderBy?: 'endingSoon' | 'newest' | 'priceAsc' | 'priceDesc' | 'mostBids';
}

export interface ProductQuery extends ListQuery {
  categoryId?: string | 'ALL';
}

export interface BidQuery extends ListQuery {
  auctionId?: string;
}

export interface UserQuery extends ListQuery {
  role?: UserRole | 'ALL';
  status?: AccountStatus | 'ALL';
}
