/**
 * Domain enumerations shared across the whole application.
 * These mirror the backend contract exactly — never invent client-side values.
 */

/** Authenticated user roles. Authorization is enforced server-side; the client
 *  only uses this to decide which controls to render. */
export enum UserRole {
  ADMIN = 'ADMIN',
  VENDOR = 'VENDOR',
  BIDDER = 'BIDDER',
}

/** Auction lifecycle. Terminal states are ENDED and CANCELLED. */
export enum AuctionStatus {
  DRAFT = 'DRAFT',
  SCHEDULED = 'SCHEDULED',
  ACTIVE = 'ACTIVE',
  ENDED = 'ENDED',
  CANCELLED = 'CANCELLED',
}

/** Account status for users, vendors and bidders. */
export enum AccountStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
}

/** Machine-readable error codes returned by the API envelope. */
export enum ApiErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  DATABASE_UNAVAILABLE = 'DATABASE_UNAVAILABLE',
}

/** Display labels for roles — used in badges, tables and the sidebar scope chip. */
export const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.ADMIN]: 'Administrator',
  [UserRole.VENDOR]: 'Vendor',
  [UserRole.BIDDER]: 'Bidder',
};

/** Display labels for auction statuses. */
export const AUCTION_STATUS_LABELS: Record<AuctionStatus, string> = {
  [AuctionStatus.DRAFT]: 'Draft',
  [AuctionStatus.SCHEDULED]: 'Scheduled',
  [AuctionStatus.ACTIVE]: 'Active',
  [AuctionStatus.ENDED]: 'Ended',
  [AuctionStatus.CANCELLED]: 'Cancelled',
};

/** Display labels for account statuses. */
export const ACCOUNT_STATUS_LABELS: Record<AccountStatus, string> = {
  [AccountStatus.ACTIVE]: 'Active',
  [AccountStatus.INACTIVE]: 'Inactive',
  [AccountStatus.SUSPENDED]: 'Suspended',
};

export const DEFAULT_PAGE_SIZE = 12;
export const PAGE_SIZE_OPTIONS = [12, 24, 48] as const;
