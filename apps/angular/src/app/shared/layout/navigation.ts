import { UserRole } from '../../core/domain/enums';
import { IconName } from '../ui/icon.component';

export interface NavItem {
  label: string;
  path: string;
  icon: IconName;
  /** Exact match required (used for index-style routes). */
  exact?: boolean;
  description?: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/**
 * Navigation model.
 *
 * The sidebar is generated from this table filtered by role, which keeps the
 * authorization boundary in one place: if a link is not listed for a role, that
 * role has no navigation affordance for the screen at all. Route guards enforce
 * the same rule independently, so neither layer is load-bearing on its own.
 */
const MARKETPLACE_GROUP: NavGroup = {
  label: 'Auction floor',
  items: [{ label: 'Marketplace', path: '/marketplace', icon: 'gavel', exact: true }],
};

const BIDDER_GROUP: NavGroup = {
  label: 'Bidding',
  items: [
    { label: 'My bids', path: '/my-bids', icon: 'trending-up' },
    { label: 'Bidder profile', path: '/profile/bidder', icon: 'building' },
  ],
};

const VENDOR_GROUP: NavGroup = {
  label: 'Vendor workspace',
  items: [
    { label: 'Vendor dashboard', path: '/vendor', icon: 'dashboard', exact: true },
    { label: 'My products', path: '/vendor/products', icon: 'package' },
    { label: 'My auctions', path: '/vendor/auctions', icon: 'hammer' },
  ],
};

const VENDOR_ACCOUNT_GROUP: NavGroup = {
  label: 'Account',
  items: [
    { label: 'Vendor profile', path: '/profile/vendor', icon: 'building' },
    { label: 'My bids', path: '/my-bids', icon: 'trending-up' },
  ],
};

const ADMIN_GROUP: NavGroup = {
  label: 'Administration',
  items: [
    { label: 'Admin dashboard', path: '/admin', icon: 'dashboard', exact: true },
    { label: 'Users', path: '/admin/users', icon: 'users' },
    { label: 'Vendors', path: '/admin/vendors', icon: 'building' },
    { label: 'Bidders', path: '/admin/bidders', icon: 'user' },
    { label: 'Categories', path: '/admin/categories', icon: 'layers' },
  ],
};

const ACCOUNT_GROUP: NavGroup = {
  label: 'Account',
  items: [{ label: 'My profile', path: '/profile', icon: 'user' }],
};

/**
 * Returns the navigation groups visible to a role.
 *
 * A bidder sees the marketplace and their own bidding activity — never vendor
 * or administrative management. A vendor sees their own product and auction
 * workspace, never another vendor's resources. An administrator sees the
 * operational management areas.
 */
export function navigationFor(role: UserRole | null): NavGroup[] {
  switch (role) {
    case UserRole.ADMIN:
      return [ADMIN_GROUP, MARKETPLACE_GROUP, ACCOUNT_GROUP];
    case UserRole.VENDOR:
      return [VENDOR_GROUP, MARKETPLACE_GROUP, VENDOR_ACCOUNT_GROUP, ACCOUNT_GROUP];
    case UserRole.BIDDER:
      return [MARKETPLACE_GROUP, BIDDER_GROUP, ACCOUNT_GROUP];
    default:
      return [MARKETPLACE_GROUP];
  }
}

/** Short description of what the current role is permitted to do. */
export const ROLE_SCOPE_SUMMARY: Record<UserRole, string> = {
  [UserRole.ADMIN]: 'Full platform administration',
  [UserRole.VENDOR]: 'Your products and auctions',
  [UserRole.BIDDER]: 'Browse and bid',
};
