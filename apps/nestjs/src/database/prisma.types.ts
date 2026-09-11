import type { User } from '../../generated/prisma/client.js';

/**
 * Re-export domain types so feature code imports them from one place instead
 * of reaching into the generated client directly.
 *
 * `Prisma` (the namespace) is re-exported as a value+type so callers can use
 * `Prisma.UserSelect`, `Prisma.UserWhereInput`, etc.
 */
export { Prisma } from '../../generated/prisma/client.js';

export type {
  Auction,
  Bid,
  Bidder,
  Category,
  Product,
  User,
  Vendor,
} from '../../generated/prisma/client.js';

export {
  AuctionStatus,
  ProductStatus,
  UserRole,
} from '../../generated/prisma/client.js';

/**
 * A user record without the password hash.
 * This is the shape every API response must use.
 */
export type PublicUser = Omit<User, 'password'>;

/** Strips the password hash from a user record. */
export function toPublicUser(user: User): PublicUser {
  const { password: _password, ...rest } = user;
  return rest;
}
