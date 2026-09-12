import { canTransition, minimumNextBid } from '../domain/auction-lifecycle';
import { AccountStatus, AuctionStatus, UserRole } from '../domain/enums';
import {
  Auction,
  AuctionQuery,
  Bid,
  Bidder,
  BidQuery,
  Category,
  CategoryPayload,
  ChangePasswordPayload,
  CreateAuctionPayload,
  CreateBidderPayload,
  CreateProductPayload,
  CreateUserPayload,
  CreateVendorPayload,
  ListQuery,
  LoginPayload,
  LoginResult,
  PageMeta,
  Paginated,
  PlaceBidPayload,
  Product,
  ProductQuery,
  UpdateAuctionPayload,
  UpdateBidderPayload,
  UpdateProductPayload,
  UpdateProfilePayload,
  UpdateUserPayload,
  UpdateVendorPayload,
  User,
  UserQuery,
  Vendor,
} from '../domain/models';
import {
  auctions,
  bidders,
  bids,
  persistTokens,
  categories,
  DEMO_PASSWORD,
  products,
  resetTokens,
  tokens,
  users,
  vendors,
} from './mock-data';

/* --------------------------------------------------------------------------
   Error type carried through the mock transport
   -------------------------------------------------------------------------- */

export class MockApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = 'MockApiError';
  }
}

/**
 * Throws a typed API error. Declared as a function (not a const arrow) so that
 * TypeScript treats every call site as unreachable code and narrows the values
 * guarded by the preceding `if (!value) fail(...)` checks.
 */
function fail(
  status: number,
  code: string,
  message: string,
  fieldErrors?: Record<string, string>,
): never {
  throw new MockApiError(status, code, message, fieldErrors);
}

/* --------------------------------------------------------------------------
   Small helpers
   -------------------------------------------------------------------------- */

let seq = 1000;
function nextId(prefix: string): string {
  return `${prefix}_${(seq += 1)}`;
}
const nowIso = () => new Date().toISOString();

interface AuthContext {
  user: User;
  role: UserRole;
  vendor?: Vendor;
  bidder?: Bidder;
}

function userById(id: string): User | undefined {
  return users.find((u) => u.id === id);
}

function vendorByUserId(userId: string): Vendor | undefined {
  return vendors.find((v) => v.userId === userId);
}

function bidderByUserId(userId: string): Bidder | undefined {
  return bidders.find((b) => b.userId === userId);
}

/** Resolves the JWT subject into the full authorization context. */
function authenticate(token: string | null): AuthContext {
  if (!token) fail(401, 'UNAUTHORIZED', 'Authentication credentials were not provided.');

  const userId = tokens.get(token);
  if (!userId) fail(401, 'UNAUTHORIZED', 'Your session is no longer valid. Please sign in again.');

  const user = userById(userId);
  if (!user) fail(401, 'UNAUTHORIZED', 'The authenticated account no longer exists.');

  return {
    user,
    role: user.role,
    vendor: vendorByUserId(user.id),
    bidder: bidderByUserId(user.id),
  };
}

function requireRole(ctx: AuthContext, ...roles: UserRole[]): void {
  if (!roles.includes(ctx.role)) {
    fail(403, 'FORBIDDEN', 'Your role is not permitted to perform this action.');
  }
}

/** Expands an auction with its relations and derived highest-bid information. */
function hydrateAuction(a: Auction): Auction {
  const auctionBids = bids.filter((b) => b.auctionId === a.id).sort((x, y) => y.amount - x.amount);
  const top = auctionBids[0];
  const product = products.find((p) => p.id === a.productId);
  const vendor = vendors.find((v) => v.id === a.vendorId);

  return {
    ...a,
    currentPrice: top ? top.amount : a.startingPrice,
    highestBidAmount: top ? top.amount : null,
    highestBidderId: top ? top.bidderId : null,
    highestBidderDisplayName: top ? bidderLabel(top.bidderId).name : null,
    bidCount: auctionBids.length,
    product: product
      ? {
          ...product,
          category: categoryBrief(product.categoryId),
          vendor: vendor ? { id: vendor.id, companyName: vendor.companyName } : undefined,
        }
      : undefined,
    vendor: vendor ? { id: vendor.id, companyName: vendor.companyName } : undefined,
  };
}

function categoryBrief(categoryId: string) {
  const c = categories.find((x) => x.id === categoryId);
  return c ? { id: c.id, name: c.name } : undefined;
}

/**
 * Bidder display label. Full identity is only exposed to the bidder themselves,
 * to their own vendor (for auctions they own) and to administrators. Everyone
 * else sees a masked company label — matching the API's masking behaviour.
 */
function bidderLabel(bidderId: string): { name: string; company: string } {
  const bidder = bidders.find((b) => b.id === bidderId);
  if (!bidder) return { name: 'Bidder', company: 'Bidder' };
  const company = bidder.companyName ?? bidder.contactPerson ?? 'Bidder';
  return { name: bidder.contactPerson, company };
}

/** Masks a company name into a stable anonymous label: "Helix Smelting AG" → "H••• S•••". */
function maskCompany(name: string): string {
  return name
    .split(/\s+/)
    .map((word) =>
      word.length <= 1 ? word : `${word[0]}${'•'.repeat(Math.min(word.length - 1, 6))}`,
    )
    .join(' ');
}

/* --------------------------------------------------------------------------
   Query handling
   -------------------------------------------------------------------------- */

function paginate<T>(items: T[], page = 1, limit = 12): Paginated<T> {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * limit;

  const meta: PageMeta = { total, page: safePage, limit, totalPages };
  return { items: items.slice(start, start + limit), meta };
}

function applySearch<T>(items: T[], search: string | undefined, pick: (item: T) => string[]): T[] {
  const term = (search ?? '').trim().toLowerCase();
  if (!term) return items;
  return items.filter((item) =>
    pick(item).some((value) => (value ?? '').toLowerCase().includes(term)),
  );
}

const byLatest = <T extends { createdAt: string }>(a: T, b: T) =>
  new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();

const byName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name);

/* --------------------------------------------------------------------------
   Resource handlers
   -------------------------------------------------------------------------- */

export const mockApi = {
  /* ---------------------------------------------------------------- AUTH */

  login(payload: LoginPayload): LoginResult {
    const email = (payload?.email ?? '').trim().toLowerCase();
    const password = payload?.password ?? '';

    if (!email || !password) {
      fail(400, 'VALIDATION_ERROR', 'Email and password are required.', {
        ...(email ? {} : { email: 'Email is required' }),
        ...(password ? {} : { password: 'Password is required' }),
      });
    }

    const user = users.find((u) => u.email.toLowerCase() === email);
    if (!user || password !== DEMO_PASSWORD) {
      fail(401, 'UNAUTHORIZED', 'The email address or password is incorrect.');
    }

    if (user.status !== AccountStatus.ACTIVE) {
      fail(403, 'FORBIDDEN', 'This account is not active. Contact your administrator.');
    }

    const accessToken = `mock.${btoa(`${user.id}:${Date.now()}`)}.${nextId('sig')}`;
    tokens.set(accessToken, user.id);
    persistTokens();
    return { accessToken };
  },

  me(token: string | null): User {
    return authenticate(token).user;
  },

  /** Invalidates a token, mirroring a server-side logout. */
  logout(token: string | null): { message: string } {
    if (token) {
      tokens.delete(token);
      persistTokens();
    }
    return { message: 'Signed out.' };
  },

  forgotPassword(email: string): { message: string } {
    const user = users.find((u) => u.email.toLowerCase() === (email ?? '').trim().toLowerCase());

    // Always respond identically so the endpoint cannot be used to enumerate accounts.
    if (user) {
      const resetToken = nextId('rst');
      resetTokens.set(resetToken, user.id);
      // eslint-disable-next-line no-console
      console.info(
        `[mock api] password reset link for ${user.email}: /reset-password?token=${resetToken}`,
      );
    }

    return {
      message:
        'If an account exists for that address, a password reset link has been sent. The link expires in 30 minutes.',
    };
  },

  resetPassword(token: string, newPassword: string): { message: string } {
    if (!token || !resetTokens.has(token)) {
      fail(400, 'VALIDATION_ERROR', 'This password reset link is invalid or has expired.', {
        token: 'The reset token is invalid or has expired',
      });
    }
    if (!newPassword || newPassword.length < 8) {
      fail(400, 'VALIDATION_ERROR', 'The new password does not meet the requirements.', {
        newPassword: 'Password must be at least 8 characters',
      });
    }

    resetTokens.delete(token);
    return { message: 'Your password has been updated. You can now sign in.' };
  },

  /* --------------------------------------------------------------- USERS */

  listUsers(token: string | null, query: UserQuery = {}): Paginated<User> {
    const ctx = authenticate(token);
    requireRole(ctx, UserRole.ADMIN);

    let items = [...users];
    if (query.role && query.role !== 'ALL') items = items.filter((u) => u.role === query.role);
    if (query.status && query.status !== 'ALL')
      items = items.filter((u) => u.status === query.status);
    items = applySearch(items, query.search, (u) => [u.firstName, u.lastName, u.email, u.role]);

    const sort = query.sort ?? 'newest';
    if (sort === 'oldest') items.sort((a, b) => byLatest(b, a));
    else items.sort(byLatest);

    return paginate(items, query.page, query.limit);
  },

  getUser(token: string | null, id: string): User {
    const ctx = authenticate(token);
    if (ctx.role !== UserRole.ADMIN && ctx.user.id !== id) {
      fail(403, 'FORBIDDEN', 'You may only view your own account.');
    }
    const user = userById(id);
    if (!user) fail(404, 'NOT_FOUND', 'User not found.');
    return user;
  },

  createUser(token: string | null, payload: CreateUserPayload): User {
    const ctx = authenticate(token);
    requireRole(ctx, UserRole.ADMIN);

    const errors: Record<string, string> = {};
    const email = (payload.email ?? '').trim().toLowerCase();
    if (!email) errors['email'] = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      errors['email'] = 'Enter a valid email address';
    else if (users.some((u) => u.email.toLowerCase() === email)) {
      fail(409, 'CONFLICT', 'A user with this email address already exists.', {
        email: 'This email address is already registered',
      });
    }
    if (!payload.firstName?.trim()) errors['firstName'] = 'First name is required';
    if (!payload.lastName?.trim()) errors['lastName'] = 'Last name is required';
    if (!payload.role) errors['role'] = 'Select a role';

    if (Object.keys(errors).length) {
      fail(400, 'VALIDATION_ERROR', 'Please check the highlighted fields.', errors);
    }

    const user: User = {
      id: nextId('usr'),
      email,
      firstName: payload.firstName.trim(),
      lastName: payload.lastName.trim(),
      role: payload.role,
      status: payload.status ?? AccountStatus.ACTIVE,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    users.unshift(user);
    return user;
  },

  updateUser(token: string | null, id: string, payload: UpdateUserPayload): User {
    const ctx = authenticate(token);

    if (ctx.role !== UserRole.ADMIN && ctx.user.id !== id) {
      fail(403, 'FORBIDDEN', 'You may only update your own account.');
    }
    const user = userById(id);
    if (!user) fail(404, 'NOT_FOUND', 'User not found.');

    // Role and status are administrative fields.
    if (ctx.role !== UserRole.ADMIN && (payload.role || payload.status)) {
      fail(403, 'FORBIDDEN', 'Only administrators may change roles or account status.');
    }

    if (payload.email) {
      const email = payload.email.trim().toLowerCase();
      if (users.some((u) => u.id !== id && u.email.toLowerCase() === email)) {
        fail(409, 'CONFLICT', 'A user with this email address already exists.', {
          email: 'This email address is already registered',
        });
      }
      user.email = email;
    }
    if (payload.firstName !== undefined) user.firstName = payload.firstName;
    if (payload.lastName !== undefined) user.lastName = payload.lastName;
    if (payload.role !== undefined) user.role = payload.role;
    if (payload.status !== undefined) user.status = payload.status;
    user.updatedAt = nowIso();
    return user;
  },

  updateMyProfile(token: string | null, payload: UpdateProfilePayload): User {
    const ctx = authenticate(token);
    const user = ctx.user;
    if (payload.firstName !== undefined) user.firstName = payload.firstName;
    if (payload.lastName !== undefined) user.lastName = payload.lastName;
    user.updatedAt = nowIso();
    return user;
  },

  changeMyPassword(token: string | null, payload: ChangePasswordPayload): { message: string } {
    authenticate(token);

    if (!payload.currentPassword) {
      fail(400, 'VALIDATION_ERROR', 'Your current password is required.', {
        currentPassword: 'Enter your current password',
      });
    }
    if (payload.currentPassword !== DEMO_PASSWORD) {
      fail(400, 'VALIDATION_ERROR', 'Your current password is incorrect.', {
        currentPassword: 'This password does not match our records',
      });
    }
    if (!payload.newPassword || payload.newPassword.length < 8) {
      fail(400, 'VALIDATION_ERROR', 'The new password does not meet the requirements.', {
        newPassword: 'Password must be at least 8 characters',
      });
    }

    return { message: 'Your password has been changed.' };
  },

  /* ------------------------------------------------------------- VENDORS */

  listVendors(token: string | null, query: ListQuery = {}): Paginated<Vendor> {
    const ctx = authenticate(token);
    requireRole(ctx, UserRole.ADMIN);

    let items = vendors.map((v) => withVendorMeta(v));
    items = applySearch(items, query.search, (v) => [
      v.companyName,
      v.contactPerson,
      v.phone,
      v.user?.email ?? '',
    ]);
    items.sort((a, b) => a.companyName.localeCompare(b.companyName));
    return paginate(items, query.page, query.limit);
  },

  getMyVendorProfile(token: string | null): Vendor {
    const ctx = authenticate(token);
    requireRole(ctx, UserRole.VENDOR, UserRole.ADMIN);
    if (!ctx.vendor) fail(404, 'NOT_FOUND', 'No vendor profile is linked to this account.');
    return withVendorMeta(ctx.vendor);
  },

  getVendor(token: string | null, id: string): Vendor {
    const ctx = authenticate(token);
    const vendor = vendors.find((v) => v.id === id);
    if (!vendor) fail(404, 'NOT_FOUND', 'Vendor not found.');

    const isOwner = ctx.vendor?.id === vendor.id;
    if (ctx.role !== UserRole.ADMIN && !isOwner) {
      fail(403, 'FORBIDDEN', 'This vendor profile belongs to another account.');
    }
    return withVendorMeta(vendor);
  },

  updateVendor(token: string | null, id: string, payload: UpdateVendorPayload): Vendor {
    const ctx = authenticate(token);
    const vendor = vendors.find((v) => v.id === id);
    if (!vendor) fail(404, 'NOT_FOUND', 'Vendor not found.');

    const isOwner = ctx.vendor?.id === vendor.id;
    if (ctx.role !== UserRole.ADMIN && !isOwner) {
      fail(403, 'FORBIDDEN', 'You may only update your own vendor profile.');
    }

    if (payload.companyName !== undefined && !payload.companyName.trim()) {
      fail(400, 'VALIDATION_ERROR', 'Company name cannot be empty.', {
        companyName: 'Company name is required',
      });
    }

    Object.assign(vendor, {
      ...(payload.companyName !== undefined ? { companyName: payload.companyName.trim() } : {}),
      ...(payload.contactPerson !== undefined ? { contactPerson: payload.contactPerson } : {}),
      ...(payload.phone !== undefined ? { phone: payload.phone } : {}),
      ...(payload.address !== undefined ? { address: payload.address } : {}),
      ...(payload.description !== undefined ? { description: payload.description } : {}),
      updatedAt: nowIso(),
    });
    return withVendorMeta(vendor);
  },

  updateMyVendorProfile(token: string | null, payload: UpdateVendorPayload): Vendor {
    const ctx = authenticate(token);
    requireRole(ctx, UserRole.VENDOR, UserRole.ADMIN);
    if (!ctx.vendor) fail(404, 'NOT_FOUND', 'No vendor profile is linked to this account.');
    return mockApi.updateVendor(token, ctx.vendor.id, payload);
  },

  createVendor(token: string | null, payload: CreateVendorPayload): Vendor {
    const ctx = authenticate(token);
    requireRole(ctx, UserRole.ADMIN);

    const errors: Record<string, string> = {};
    if (!payload.companyName?.trim()) errors['companyName'] = 'Company name is required';
    if (!payload.contactPerson?.trim()) errors['contactPerson'] = 'Contact person is required';
    if (!payload.phone?.trim()) errors['phone'] = 'Phone number is required';
    if (Object.keys(errors).length) {
      fail(400, 'VALIDATION_ERROR', 'Please check the highlighted fields.', errors);
    }

    // Either link to an existing vendor user, or create the login alongside the profile.
    let userId = payload.userId;
    if (!userId) {
      const email = (payload.email ?? '').trim().toLowerCase();
      if (!email) {
        fail(400, 'VALIDATION_ERROR', 'An email address is required for the vendor login.', {
          email: 'Email is required',
        });
      }
      const existing = users.find((u) => u.email.toLowerCase() === email);
      if (existing) {
        fail(409, 'CONFLICT', 'A user with this email address already exists.', {
          email: 'This email address is already registered',
        });
      }
      const newUser: User = {
        id: nextId('usr'),
        email,
        firstName: payload.firstName?.trim() || payload.contactPerson.trim(),
        lastName: payload.lastName?.trim() || '—',
        role: UserRole.VENDOR,
        status: AccountStatus.ACTIVE,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      users.unshift(newUser);
      userId = newUser.id;
    } else if (users.some((u) => u.id === userId && vendors.some((v) => v.userId === userId))) {
      fail(409, 'CONFLICT', 'That user already has a vendor profile.');
    }

    const vendor: Vendor = {
      id: nextId('vnd'),
      userId,
      companyName: payload.companyName.trim(),
      contactPerson: payload.contactPerson.trim(),
      phone: payload.phone.trim(),
      address: payload.address,
      description: payload.description,
      status: AccountStatus.ACTIVE,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    vendors.unshift(vendor);
    return withVendorMeta(vendor);
  },

  /* ------------------------------------------------------------- BIDDERS */

  listBidders(token: string | null, query: ListQuery = {}): Paginated<Bidder> {
    const ctx = authenticate(token);
    requireRole(ctx, UserRole.ADMIN);

    let items = bidders.map((b) => withBidderMeta(b));
    items = applySearch(items, query.search, (b) => [
      b.companyName ?? '',
      b.contactPerson,
      b.phone,
      b.user?.email ?? '',
    ]);
    items.sort((a, b) => a.contactPerson.localeCompare(b.contactPerson));
    return paginate(items, query.page, query.limit);
  },

  getMyBidderProfile(token: string | null): Bidder {
    const ctx = authenticate(token);
    requireRole(ctx, UserRole.BIDDER, UserRole.ADMIN);
    if (!ctx.bidder) fail(404, 'NOT_FOUND', 'No bidder profile is linked to this account.');
    return withBidderMeta(ctx.bidder);
  },

  getBidder(token: string | null, id: string): Bidder {
    const ctx = authenticate(token);
    const bidder = bidders.find((b) => b.id === id);
    if (!bidder) fail(404, 'NOT_FOUND', 'Bidder not found.');

    const isOwner = ctx.bidder?.id === bidder.id;
    if (ctx.role !== UserRole.ADMIN && !isOwner) {
      fail(403, 'FORBIDDEN', 'This bidder profile belongs to another account.');
    }
    return withBidderMeta(bidder);
  },

  updateBidder(token: string | null, id: string, payload: UpdateBidderPayload): Bidder {
    const ctx = authenticate(token);
    const bidder = bidders.find((b) => b.id === id);
    if (!bidder) fail(404, 'NOT_FOUND', 'Bidder not found.');

    const isOwner = ctx.bidder?.id === bidder.id;
    if (ctx.role !== UserRole.ADMIN && !isOwner) {
      fail(403, 'FORBIDDEN', 'You may only update your own bidder profile.');
    }

    Object.assign(bidder, {
      ...(payload.companyName !== undefined ? { companyName: payload.companyName } : {}),
      ...(payload.contactPerson !== undefined ? { contactPerson: payload.contactPerson } : {}),
      ...(payload.phone !== undefined ? { phone: payload.phone } : {}),
      ...(payload.address !== undefined ? { address: payload.address } : {}),
      updatedAt: nowIso(),
    });
    return withBidderMeta(bidder);
  },

  updateMyBidderProfile(token: string | null, payload: UpdateBidderPayload): Bidder {
    const ctx = authenticate(token);
    requireRole(ctx, UserRole.BIDDER, UserRole.ADMIN);
    if (!ctx.bidder) fail(404, 'NOT_FOUND', 'No bidder profile is linked to this account.');
    return mockApi.updateBidder(token, ctx.bidder.id, payload);
  },

  createBidder(token: string | null, payload: CreateBidderPayload): Bidder {
    const ctx = authenticate(token);
    requireRole(ctx, UserRole.ADMIN);

    const errors: Record<string, string> = {};
    if (!payload.contactPerson?.trim()) errors['contactPerson'] = 'Contact person is required';
    if (!payload.phone?.trim()) errors['phone'] = 'Phone number is required';
    if (Object.keys(errors).length) {
      fail(400, 'VALIDATION_ERROR', 'Please check the highlighted fields.', errors);
    }

    let userId = payload.userId;
    if (!userId) {
      const email = (payload.email ?? '').trim().toLowerCase();
      if (!email) {
        fail(400, 'VALIDATION_ERROR', 'An email address is required for the bidder login.', {
          email: 'Email is required',
        });
      }
      const existing = users.find((u) => u.email.toLowerCase() === email);
      if (existing) {
        fail(409, 'CONFLICT', 'A user with this email address already exists.', {
          email: 'This email address is already registered',
        });
      }
      const newUser: User = {
        id: nextId('usr'),
        email,
        firstName: payload.firstName?.trim() || payload.contactPerson.trim(),
        lastName: payload.lastName?.trim() || '—',
        role: UserRole.BIDDER,
        status: AccountStatus.ACTIVE,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      users.unshift(newUser);
      userId = newUser.id;
    }

    const bidder: Bidder = {
      id: nextId('bdr'),
      userId,
      companyName: payload.companyName,
      contactPerson: payload.contactPerson.trim(),
      phone: payload.phone.trim(),
      address: payload.address,
      status: AccountStatus.ACTIVE,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    bidders.unshift(bidder);
    return withBidderMeta(bidder);
  },

  /* ---------------------------------------------------------- CATEGORIES */

  listCategories(token: string | null, query: ListQuery = {}): Paginated<Category> {
    authenticate(token);
    let items = categories.map((c) => ({
      ...c,
      productCount: products.filter((p) => p.categoryId === c.id).length,
    }));
    items = applySearch(items, query.search, (c) => [c.name, c.slug, c.description ?? '']);
    items.sort(byName);
    // Category selectors need the full set; the management table paginates.
    return paginate(items, query.page, query.limit ?? 50);
  },

  getCategory(token: string | null, id: string): Category {
    authenticate(token);
    const category = categories.find((c) => c.id === id);
    if (!category) fail(404, 'NOT_FOUND', 'Category not found.');
    return {
      ...category,
      productCount: products.filter((p) => p.categoryId === id).length,
    };
  },

  createCategory(token: string | null, payload: CategoryPayload): Category {
    const ctx = authenticate(token);
    requireRole(ctx, UserRole.ADMIN);

    const name = (payload.name ?? '').trim();
    if (!name) {
      fail(400, 'VALIDATION_ERROR', 'Category name is required.', {
        name: 'Category name is required',
      });
    }
    if (categories.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      fail(409, 'CONFLICT', 'A category with this name already exists.', {
        name: 'This category name is already in use',
      });
    }

    const category: Category = {
      id: nextId('cat'),
      name,
      slug: name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, ''),
      description: payload.description,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    categories.push(category);
    return { ...category, productCount: 0 };
  },

  updateCategory(token: string | null, id: string, payload: CategoryPayload): Category {
    const ctx = authenticate(token);
    requireRole(ctx, UserRole.ADMIN);

    const category = categories.find((c) => c.id === id);
    if (!category) fail(404, 'NOT_FOUND', 'Category not found.');

    if (payload.name !== undefined) {
      const name = payload.name.trim();
      if (!name) {
        fail(400, 'VALIDATION_ERROR', 'Category name is required.', {
          name: 'Category name is required',
        });
      }
      if (categories.some((c) => c.id !== id && c.name.toLowerCase() === name.toLowerCase())) {
        fail(409, 'CONFLICT', 'A category with this name already exists.', {
          name: 'This category name is already in use',
        });
      }
      category.name = name;
      category.slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    }
    if (payload.description !== undefined) category.description = payload.description;
    category.updatedAt = nowIso();

    return { ...category, productCount: products.filter((p) => p.categoryId === id).length };
  },

  deleteCategory(token: string | null, id: string): { message: string } {
    const ctx = authenticate(token);
    requireRole(ctx, UserRole.ADMIN);

    const index = categories.findIndex((c) => c.id === id);
    if (index === -1) fail(404, 'NOT_FOUND', 'Category not found.');

    // Referential integrity: a category in use by products cannot be removed.
    const inUse = products.filter((p) => p.categoryId === id);
    if (inUse.length > 0) {
      fail(
        409,
        'CONFLICT',
        `This category is assigned to ${inUse.length} product${inUse.length === 1 ? '' : 's'} and cannot be deleted. Reassign those products first.`,
      );
    }

    categories.splice(index, 1);
    return { message: 'Category deleted.' };
  },

  /* ------------------------------------------------------------ PRODUCTS */

  listMyProducts(token: string | null, query: ProductQuery = {}): Paginated<Product> {
    const ctx = authenticate(token);
    requireRole(ctx, UserRole.VENDOR, UserRole.ADMIN);
    if (!ctx.vendor) fail(404, 'NOT_FOUND', 'No vendor profile is linked to this account.');

    let items = products.filter((p) => p.vendorId === ctx.vendor!.id).map((p) => hydrateProduct(p));
    items = applySearch(items, query.search, (p) => [p.name, p.code, p.description ?? '']);
    if (query.categoryId && query.categoryId !== 'ALL') {
      items = items.filter((p) => p.categoryId === query.categoryId);
    }
    items.sort(byLatest);
    return paginate(items, query.page, query.limit);
  },

  listProducts(token: string | null, query: ProductQuery = {}): Paginated<Product> {
    authenticate(token);
    let items = products.map((p) => hydrateProduct(p));
    items = applySearch(items, query.search, (p) => [p.name, p.code, p.description ?? '']);
    if (query.categoryId && query.categoryId !== 'ALL') {
      items = items.filter((p) => p.categoryId === query.categoryId);
    }
    items.sort(byLatest);
    return paginate(items, query.page, query.limit);
  },

  getProduct(token: string | null, id: string): Product {
    authenticate(token);
    const product = products.find((p) => p.id === id);
    if (!product) fail(404, 'NOT_FOUND', 'Product not found.');
    return hydrateProduct(product);
  },

  createProduct(token: string | null, payload: CreateProductPayload): Product {
    const ctx = authenticate(token);
    requireRole(ctx, UserRole.VENDOR, UserRole.ADMIN);

    if (!ctx.vendor) {
      fail(403, 'FORBIDDEN', 'Only users with a vendor profile can create products.');
    }

    const errors: Record<string, string> = {};
    const code = (payload.code ?? '').trim();
    const name = (payload.name ?? '').trim();
    if (!code) errors['code'] = 'Product code is required';
    else if (products.some((p) => p.code.toLowerCase() === code.toLowerCase())) {
      fail(409, 'CONFLICT', 'A product with this code already exists.', {
        code: 'This product code is already in use',
      });
    }
    if (!name) errors['name'] = 'Product name is required';
    if (!payload.categoryId) errors['categoryId'] = 'Select a category';
    else if (!categories.some((c) => c.id === payload.categoryId)) {
      errors['categoryId'] = 'Select a valid category';
    }
    if (Object.keys(errors).length) {
      fail(400, 'VALIDATION_ERROR', 'Please check the highlighted fields.', errors);
    }

    const product: Product = {
      id: nextId('prd'),
      code,
      name,
      description: payload.description?.trim() || undefined,
      categoryId: payload.categoryId,
      // Ownership is taken from the authenticated identity, never from the client.
      vendorId: ctx.vendor.id,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    products.unshift(product);
    return hydrateProduct(product);
  },

  updateProduct(token: string | null, id: string, payload: UpdateProductPayload): Product {
    const ctx = authenticate(token);
    requireRole(ctx, UserRole.VENDOR, UserRole.ADMIN);

    const product = products.find((p) => p.id === id);
    if (!product) fail(404, 'NOT_FOUND', 'Product not found.');

    if (ctx.role !== UserRole.ADMIN && product.vendorId !== ctx.vendor?.id) {
      fail(403, 'FORBIDDEN', 'You may only modify products owned by your vendor account.');
    }

    if (payload.code !== undefined) {
      const code = payload.code.trim();
      if (!code) {
        fail(400, 'VALIDATION_ERROR', 'Product code is required.', {
          code: 'Product code is required',
        });
      }
      if (products.some((p) => p.id !== id && p.code.toLowerCase() === code.toLowerCase())) {
        fail(409, 'CONFLICT', 'A product with this code already exists.', {
          code: 'This product code is already in use',
        });
      }
      product.code = code;
    }
    if (payload.name !== undefined) {
      const name = payload.name.trim();
      if (!name) {
        fail(400, 'VALIDATION_ERROR', 'Product name is required.', {
          name: 'Product name is required',
        });
      }
      product.name = name;
    }
    if (payload.categoryId !== undefined) {
      if (!categories.some((c) => c.id === payload.categoryId)) {
        fail(400, 'VALIDATION_ERROR', 'Select a valid category.', {
          categoryId: 'Select a valid category',
        });
      }
      product.categoryId = payload.categoryId;
    }
    if (payload.description !== undefined)
      product.description = payload.description.trim() || undefined;
    product.updatedAt = nowIso();

    return hydrateProduct(product);
  },

  deleteProduct(token: string | null, id: string): { message: string } {
    const ctx = authenticate(token);
    requireRole(ctx, UserRole.VENDOR, UserRole.ADMIN);

    const index = products.findIndex((p) => p.id === id);
    if (index === -1) fail(404, 'NOT_FOUND', 'Product not found.');

    const product = products[index];
    if (ctx.role !== UserRole.ADMIN && product.vendorId !== ctx.vendor?.id) {
      fail(403, 'FORBIDDEN', 'You may only delete products owned by your vendor account.');
    }

    // A product referenced by an auction must not be removed.
    const linked = auctions.filter((a) => a.productId === id);
    if (linked.length > 0) {
      fail(
        409,
        'CONFLICT',
        `This product is used by ${linked.length} auction${linked.length === 1 ? '' : 's'} and cannot be deleted.`,
      );
    }

    products.splice(index, 1);
    return { message: 'Product deleted.' };
  },

  /* ------------------------------------------------------------ AUCTIONS */

  listAuctions(token: string | null, query: AuctionQuery = {}): Paginated<Auction> {
    authenticate(token);

    let items = auctions.map(hydrateAuction);

    if (query.status && query.status !== 'ALL') {
      items = items.filter((a) => a.status === query.status);
    }
    if (query.categoryId && query.categoryId !== 'ALL') {
      items = items.filter((a) => a.product?.categoryId === query.categoryId);
    }
    if (query.vendorId) {
      items = items.filter((a) => a.vendorId === query.vendorId);
    }
    if (query.search?.trim()) {
      const raw = query.search.trim().toLowerCase();
      items = items.filter((a) =>
        [a.product?.name ?? '', a.product?.code ?? '', a.vendor?.companyName ?? '', a.id].some(
          (v) => v.toLowerCase().includes(raw),
        ),
      );
    }
    if (query.minPrice !== undefined && query.minPrice !== null) {
      items = items.filter((a) => a.currentPrice >= query.minPrice!);
    }
    if (query.maxPrice !== undefined && query.maxPrice !== null) {
      items = items.filter((a) => a.currentPrice <= query.maxPrice!);
    }

    // Default ordering prioritises what a bidder can act on: auctions that are
    // live and closing soonest first, then upcoming, then everything else.
    const order = query.orderBy ?? 'endingSoon';
    const rank = (a: Auction) => {
      const timing =
        a.status === AuctionStatus.ACTIVE && new Date(a.endTime).getTime() > Date.now();
      if (timing) return 0;
      if (a.status === AuctionStatus.ACTIVE) return 1; // window closed, awaiting manual close
      if (a.status === AuctionStatus.SCHEDULED) return 2;
      if (a.status === AuctionStatus.DRAFT) return 3;
      return 4; // terminal
    };

    switch (order) {
      case 'newest':
        items.sort(byLatest);
        break;
      case 'priceAsc':
        items.sort((a, b) => a.currentPrice - b.currentPrice);
        break;
      case 'priceDesc':
        items.sort((a, b) => b.currentPrice - a.currentPrice);
        break;
      case 'mostBids':
        items.sort((a, b) => b.bidCount - a.bidCount);
        break;
      case 'endingSoon':
      default:
        items.sort((a, b) => {
          const byRank = rank(a) - rank(b);
          if (byRank !== 0) return byRank;
          if (rank(a) === 0) {
            return new Date(a.endTime).getTime() - new Date(b.endTime).getTime();
          }
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
        break;
    }

    return paginate(items, query.page, query.limit);
  },

  listMyAuctions(token: string | null, query: AuctionQuery = {}): Paginated<Auction> {
    const ctx = authenticate(token);
    requireRole(ctx, UserRole.VENDOR, UserRole.ADMIN);

    if (ctx.role === UserRole.ADMIN && !ctx.vendor) {
      // Administrators without a vendor profile see the whole catalogue read-only.
      return mockApi.listAuctions(token, query);
    }
    if (!ctx.vendor) fail(404, 'NOT_FOUND', 'No vendor profile is linked to this account.');

    const scoped: AuctionQuery = { ...query, vendorId: ctx.vendor.id };
    return mockApi.listAuctions(token, scoped);
  },

  getAuction(token: string | null, id: string): Auction {
    authenticate(token);
    const auction = auctions.find((a) => a.id === id);
    if (!auction) fail(404, 'NOT_FOUND', 'Auction not found.');
    return hydrateAuction(auction);
  },

  createAuction(token: string | null, payload: CreateAuctionPayload): Auction {
    const ctx = authenticate(token);
    requireRole(ctx, UserRole.VENDOR, UserRole.ADMIN);
    if (!ctx.vendor)
      fail(403, 'FORBIDDEN', 'Only users with a vendor profile can create auctions.');

    const errors = validateAuctionFields(payload);
    const product = products.find((p) => p.id === payload.productId);
    if (!product) {
      errors['productId'] = 'Select a product';
    } else if (ctx.role !== UserRole.ADMIN && product.vendorId !== ctx.vendor.id) {
      fail(403, 'FORBIDDEN', 'You may only create auctions for products you own.', {
        productId: 'This product belongs to another vendor',
      });
    }

    if (Object.keys(errors).length) {
      fail(400, 'VALIDATION_ERROR', 'Please check the highlighted fields.', errors);
    }

    const auction: Auction = {
      id: nextId('auc'),
      productId: payload.productId,
      // Ownership and current price are derived server-side.
      vendorId: ctx.vendor.id,
      startingPrice: payload.startingPrice,
      currentPrice: payload.startingPrice,
      bidIncrement: payload.bidIncrement,
      startTime: new Date(payload.startTime).toISOString(),
      endTime: new Date(payload.endTime).toISOString(),
      status: AuctionStatus.DRAFT,
      bidCount: 0,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    auctions.unshift(auction);
    return hydrateAuction(auction);
  },

  updateAuction(token: string | null, id: string, payload: UpdateAuctionPayload): Auction {
    const ctx = authenticate(token);
    requireRole(ctx, UserRole.VENDOR, UserRole.ADMIN);

    const auction = auctions.find((a) => a.id === id);
    if (!auction) fail(404, 'NOT_FOUND', 'Auction not found.');

    if (ctx.role !== UserRole.ADMIN && auction.vendorId !== ctx.vendor?.id) {
      fail(403, 'FORBIDDEN', 'You may only modify auctions owned by your vendor account.');
    }

    // Editing terms after the auction is live would invalidate existing bids.
    if (auction.status === AuctionStatus.ACTIVE || auction.status === AuctionStatus.ENDED) {
      fail(
        409,
        'CONFLICT',
        `An auction in ${auction.status} status can no longer be edited. Only draft and scheduled auctions can be modified.`,
      );
    }
    if (auction.status === AuctionStatus.CANCELLED) {
      fail(409, 'CONFLICT', 'A cancelled auction cannot be edited.');
    }

    const merged: CreateAuctionPayload = {
      productId: payload.productId ?? auction.productId,
      startingPrice: payload.startingPrice ?? auction.startingPrice,
      bidIncrement: payload.bidIncrement ?? auction.bidIncrement,
      startTime: payload.startTime ?? auction.startTime,
      endTime: payload.endTime ?? auction.endTime,
    };
    const errors = validateAuctionFields(merged);

    if (payload.productId && payload.productId !== auction.productId) {
      const product = products.find((p) => p.id === payload.productId);
      if (!product) errors['productId'] = 'Select a product';
      else if (ctx.role !== UserRole.ADMIN && product.vendorId !== ctx.vendor?.id) {
        fail(403, 'FORBIDDEN', 'You may only attach products you own.', {
          productId: 'This product belongs to another vendor',
        });
      }
    }

    if (Object.keys(errors).length) {
      fail(400, 'VALIDATION_ERROR', 'Please check the highlighted fields.', errors);
    }

    auction.productId = merged.productId;
    auction.startingPrice = merged.startingPrice;
    auction.bidIncrement = merged.bidIncrement;
    auction.startTime = new Date(merged.startTime).toISOString();
    auction.endTime = new Date(merged.endTime).toISOString();
    auction.updatedAt = nowIso();

    return hydrateAuction(auction);
  },

  updateAuctionStatus(token: string | null, id: string, status: AuctionStatus): Auction {
    const ctx = authenticate(token);
    requireRole(ctx, UserRole.VENDOR, UserRole.ADMIN);

    const auction = auctions.find((a) => a.id === id);
    if (!auction) fail(404, 'NOT_FOUND', 'Auction not found.');

    if (ctx.role !== UserRole.ADMIN && auction.vendorId !== ctx.vendor?.id) {
      fail(403, 'FORBIDDEN', 'You may only manage auctions owned by your vendor account.');
    }

    if (auction.status === status) {
      fail(409, 'CONFLICT', `This auction is already ${status}.`);
    }

    if (!canTransition(auction.status, status)) {
      fail(409, 'CONFLICT', `An auction cannot move from ${auction.status} directly to ${status}.`);
    }

    // Guard against an end time that has already passed when activating.
    if (status === AuctionStatus.ACTIVE && new Date(auction.endTime).getTime() <= Date.now()) {
      fail(
        409,
        'CONFLICT',
        'The end time has already passed. Update the schedule before activating.',
      );
    }

    auction.status = status;
    auction.updatedAt = nowIso();
    return hydrateAuction(auction);
  },

  /* ---------------------------------------------------------------- BIDS */

  listAuctionBids(token: string | null, auctionId: string, query: BidQuery = {}): Paginated<Bid> {
    const ctx = authenticate(token);
    const auction = auctions.find((a) => a.id === auctionId);
    if (!auction) fail(404, 'NOT_FOUND', 'Auction not found.');

    const order = query.sort ?? 'highest';
    const all = bids.filter((b) => b.auctionId === auctionId);
    const highestId = highestBidFor(auctionId)?.id ?? null;

    // Identity exposure: bidders see their own bids in full; the auction owner
    // and administrators see bidder companies; other bidders see masked labels.
    const isAdmin = ctx.role === UserRole.ADMIN;
    const isOwner = ctx.vendor?.id === auction.vendorId;
    const canSeeCompanies = isAdmin || isOwner;

    let items: Bid[] = all.map((b) => {
      const label = bidderLabel(b.bidderId);
      const isSelf = ctx.bidder?.id === b.bidderId;
      return {
        ...b,
        isHighest: b.id === highestId,
        bidderId: isSelf || canSeeCompanies ? b.bidderId : 'hidden',
        bidderDisplayName: isSelf || canSeeCompanies ? label.name : null,
        bidderCompanyName:
          isSelf || canSeeCompanies ? label.company : `${maskCompany(label.company)}`,
      };
    });

    if (order === 'oldest' || order === 'newest') {
      items.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      if (order === 'newest') items.reverse();
    } else if (order === 'amount') {
      items.sort((a, b) => a.amount - b.amount);
    } else {
      items.sort((a, b) => b.amount - a.amount);
    }

    // Bid history is not paginated in the UI, but the endpoint honours the contract.
    return paginate(items, query.page ?? 1, query.limit ?? 100);
  },

  highestBid(token: string | null, auctionId: string): Bid | null {
    authenticate(token);
    const auction = auctions.find((a) => a.id === auctionId);
    if (!auction) fail(404, 'NOT_FOUND', 'Auction not found.');

    const top = highestBidFor(auctionId);
    if (!top) return null;

    const label = bidderLabel(top.bidderId);
    return {
      ...top,
      isHighest: true,
      bidderDisplayName: label.name,
      bidderCompanyName: label.company,
    };
  },

  placeBid(token: string | null, auctionId: string, payload: PlaceBidPayload): Bid {
    const ctx = authenticate(token);
    requireRole(ctx, UserRole.BIDDER);

    if (!ctx.bidder) {
      fail(403, 'FORBIDDEN', 'Only bidder accounts may place bids.');
    }
    if (ctx.bidder.status !== AccountStatus.ACTIVE) {
      fail(403, 'FORBIDDEN', 'This bidder account is not active and cannot place bids.');
    }

    const auction = auctions.find((a) => a.id === auctionId);
    if (!auction) fail(404, 'NOT_FOUND', 'Auction not found.');

    // Lifecycle gate.
    if (auction.status !== AuctionStatus.ACTIVE) {
      fail(
        409,
        'CONFLICT',
        auction.status === AuctionStatus.SCHEDULED
          ? 'This auction has not started yet.'
          : `Bidding is closed. This auction is ${auction.status}.`,
      );
    }

    // The end time is authoritative for bidding.
    if (new Date(auction.endTime).getTime() <= Date.now()) {
      fail(409, 'CONFLICT', 'Bidding for this auction has closed.');
    }

    const amount = Number(payload?.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      fail(400, 'VALIDATION_ERROR', 'Enter a valid bid amount.', {
        amount: 'Enter a valid bid amount',
      });
    }

    const current = hydrateAuction(auction);
    const minimum = minimumNextBid(current);

    if (amount < minimum) {
      fail(
        409,
        'CONFLICT',
        `Your bid of ${amount.toLocaleString('en-US')} is below the minimum next bid of ${minimum.toLocaleString('en-US')}. The price may have changed since this page loaded.`,
        { amount: `Minimum next bid is ${minimum.toLocaleString('en-US')}` },
      );
    }

    const bid: Bid = {
      id: nextId('bid'),
      auctionId,
      // The bidder is resolved from the authenticated identity, never from the client.
      bidderId: ctx.bidder.id,
      amount,
      createdAt: nowIso(),
    };
    bids.unshift(bid);

    auction.currentPrice = amount;
    auction.updatedAt = nowIso();

    const label = bidderLabel(ctx.bidder.id);
    return {
      ...bid,
      isHighest: true,
      bidderDisplayName: label.name,
      bidderCompanyName: label.company,
    };
  },

  listMyBids(token: string | null, query: BidQuery = {}): Paginated<Bid> {
    const ctx = authenticate(token);
    requireRole(ctx, UserRole.BIDDER, UserRole.ADMIN);
    if (!ctx.bidder) fail(404, 'NOT_FOUND', 'No bidder profile is linked to this account.');

    const mine = bids
      .filter((b) => b.bidderId === ctx.bidder!.id)
      .map((b) => {
        const auction = auctions.find((a) => a.id === b.auctionId);
        const top = highestBidFor(b.auctionId);
        return {
          ...b,
          isHighest: top?.id === b.id,
          auction: auction ? hydrateAuction(auction) : undefined,
        } satisfies Bid;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const filtered = query.auctionId ? mine.filter((b) => b.auctionId === query.auctionId) : mine;
    return paginate(filtered, query.page, query.limit ?? 50);
  },

  getBid(token: string | null, id: string): Bid {
    const ctx = authenticate(token);
    const bid = bids.find((b) => b.id === id);
    if (!bid) fail(404, 'NOT_FOUND', 'Bid not found.');

    const auction = auctions.find((a) => a.id === bid.auctionId);
    const isSelf = ctx.bidder?.id === bid.bidderId;
    const isOwner = ctx.vendor?.id === auction?.vendorId;

    if (ctx.role !== UserRole.ADMIN && !isSelf && !isOwner) {
      fail(403, 'FORBIDDEN', 'You may only view bids you placed or bids on your own auctions.');
    }

    const label = bidderLabel(bid.bidderId);
    return {
      ...bid,
      isHighest: highestBidFor(bid.auctionId)?.id === bid.id,
      bidderDisplayName: isSelf || isOwner || ctx.role === UserRole.ADMIN ? label.name : null,
      bidderCompanyName: label.company,
      auction: auction ? hydrateAuction(auction) : undefined,
    };
  },

  /* -------------------------------------------------------------- HEALTH */

  health(): { status: string; service: string; timestamp: string } {
    return { status: 'ok', service: 'bidforge-api', timestamp: nowIso() };
  },
};

/* --------------------------------------------------------------------------
   Shared internals
   -------------------------------------------------------------------------- */

function highestBidFor(auctionId: string): Bid | undefined {
  return bids
    .filter((b) => b.auctionId === auctionId)
    .sort(
      (x, y) =>
        y.amount - x.amount || new Date(x.createdAt).getTime() - new Date(y.createdAt).getTime(),
    )[0];
}

function hydrateProduct(p: Product): Product {
  const category = categories.find((c) => c.id === p.categoryId);
  const vendor = vendors.find((v) => v.id === p.vendorId);
  return {
    ...p,
    category: category ? { id: category.id, name: category.name } : undefined,
    vendor: vendor ? { id: vendor.id, companyName: vendor.companyName } : undefined,
    auctionCount: auctions.filter((a) => a.productId === p.id).length,
  };
}

function withVendorMeta(v: Vendor): Vendor {
  const user = userById(v.userId);
  return {
    ...v,
    user: user
      ? {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          status: user.status,
        }
      : undefined,
    productCount: products.filter((p) => p.vendorId === v.id).length,
  };
}

function withBidderMeta(b: Bidder): Bidder {
  const user = userById(b.userId);
  return {
    ...b,
    user: user
      ? {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          status: user.status,
        }
      : undefined,
    bidCount: bids.filter((x) => x.bidderId === b.id).length,
  };
}

/**
 * Shared auction field validation, mirroring the constraints the server enforces
 * and the same rules the create/edit forms display inline.
 */
function validateAuctionFields(payload: CreateAuctionPayload): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!payload.productId) {
    errors['productId'] = 'Select a product';
  }
  if (!Number.isFinite(payload.startingPrice) || payload.startingPrice <= 0) {
    errors['startingPrice'] = 'Starting price must be greater than zero';
  }
  if (!Number.isFinite(payload.bidIncrement) || payload.bidIncrement <= 0) {
    errors['bidIncrement'] = 'Bid increment must be greater than zero';
  }

  const start = new Date(payload.startTime).getTime();
  const end = new Date(payload.endTime).getTime();
  if (!payload.startTime || Number.isNaN(start))
    errors['startTime'] = 'Enter a valid start date and time';
  if (!payload.endTime || Number.isNaN(end)) errors['endTime'] = 'Enter a valid end date and time';
  if (!Number.isNaN(start) && !Number.isNaN(end) && end <= start) {
    errors['endTime'] = 'End time must be later than the start time';
  }
  if (
    Number.isFinite(payload.bidIncrement) &&
    Number.isFinite(payload.startingPrice) &&
    payload.bidIncrement > payload.startingPrice
  ) {
    errors['bidIncrement'] = 'Bid increment should not exceed the starting price';
  }

  return errors;
}
