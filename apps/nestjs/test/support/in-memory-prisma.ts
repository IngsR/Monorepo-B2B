import * as bcrypt from 'bcrypt';
import type { UserRole } from '../../src/common/enums/user-role.enum.js';

/**
 * A faithful in-memory stand-in for `PrismaService`, scoped to exactly the
 * queries the auction flow touches. It is NOT a general Prisma emulator.
 *
 * Why hand-rolled instead of a library: the bidding service locks the auction
 * row with `SELECT ... FOR UPDATE` via `$queryRaw`; the mock must implement
 * that tagged-template call and keep the same relations/constraints so the E2E
 * assertions reflect real behaviour (ownership, uniqueness, atomicity).
 */

type Row = Record<string, unknown>;

type SeedUser = { email: string; name: string; role: UserRole };

export class InMemoryPrisma {
  private readonly users: Row[] = [];
  private readonly vendors: Row[] = [];
  private readonly bidders: Row[] = [];
  private readonly categories: Row[] = [];
  private readonly products: Row[] = [];
  private readonly auctions: Row[] = [];
  private readonly bids: Row[] = [];
  private seq = 0;

  private id(prefix: string): string {
    this.seq += 1;
    // Deterministic, UUID-shaped id so ParseUUIDPipe/@IsUUID accept it.
    // Format 8-4-4-4-12 where the first block encodes a numeric prefix.
    const hex = prefix
      .split('')
      .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
      .join('')
      .padEnd(8, '0')
      .slice(0, 8);
    const n = this.seq.toString(16).padStart(12, '0');
    return `${hex}-0000-4000-8000-${n}`;
  }

  async seed(input: { users: SeedUser[]; password: string }): Promise<void> {
    const passwordHash = await bcrypt.hash(input.password, 4);

    for (const u of input.users) {
      const user: Row = {
        id: this.id('u'),
        email: u.email,
        name: u.name,
        role: u.role,
        password: passwordHash,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.users.push(user);

      // Each non-admin user gets the matching profile, mirroring the domain
      // model (VENDOR → Vendor profile, BIDDER → Bidder profile).
      if (u.role === 'VENDOR') {
        this.vendors.push({
          id: this.id('v'),
          userId: user.id,
          companyName: `${u.name} Co.`,
          companyAddress: null,
          phone: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      if (u.role === 'BIDDER') {
        this.bidders.push({
          id: this.id('b'),
          userId: user.id,
          phone: null,
          address: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }
  }

  // ─── delegates used by the services ─────────────────────────
  user = {
    findUnique: async ({
      where,
      select,
    }: {
      where: Row;
      select?: Row;
    }): Promise<Row | null> => {
      const row = this.find(this.users, where);
      if (!row) return null;
      return select ? pick(row, select) : row;
    },
    create: async ({
      data,
      select,
    }: {
      data: Row;
      select?: Row;
    }): Promise<Row> => this.createRow(this.users, data, select),
    update: async ({
      where,
      data,
      select,
    }: {
      where: Row;
      data: Row;
      select?: Row;
    }): Promise<Row> => this.updateRow(this.users, where, data, select),
    count: async ({ where }: { where?: Row } = {}): Promise<number> =>
      this.countRows(this.users, where),
    findMany: async (args?: RecordsArgs): Promise<Row[]> => {
      const rows = this.filterRows(this.users, args?.where);
      const sorted = this.sortRows(rows, args?.orderBy);
      const paged = this.applyPaging(sorted, args);
      return args?.select ? paged.map((row) => pick(row, args.select!)) : paged;
    },
    delete: async ({ where }: { where: Row }): Promise<Row> =>
      this.deleteRow(this.users, where),
  };

  vendor = {
    findUnique: async ({ where }: { where: Row }): Promise<Row | null> =>
      this.find(this.vendors, where),
    create: async ({ data }: { data: Row }): Promise<Row> =>
      this.createRow(this.vendors, data),
    update: async ({ where, data }: { where: Row; data: Row }): Promise<Row> =>
      this.updateRow(this.vendors, where, data),
    findMany: async (args?: RecordsArgs): Promise<Row[]> => {
      const rows = this.filterRows(this.vendors, args?.where);
      const sorted = this.sortRows(rows, args?.orderBy);
      return this.applyPaging(sorted, args);
    },
    count: async ({ where }: { where?: Row } = {}): Promise<number> =>
      this.countRows(this.vendors, where),
  };

  bidder = {
    findUnique: async ({ where }: { where: Row }): Promise<Row | null> =>
      this.find(this.bidders, where),
    create: async ({ data }: { data: Row }): Promise<Row> =>
      this.createRow(this.bidders, data),
    update: async ({ where, data }: { where: Row; data: Row }): Promise<Row> =>
      this.updateRow(this.bidders, where, data),
    findMany: async (args?: RecordsArgs): Promise<Row[]> => {
      const rows = this.filterRows(this.bidders, args?.where);
      const sorted = this.sortRows(rows, args?.orderBy);
      return this.applyPaging(sorted, args);
    },
    count: async ({ where }: { where?: Row } = {}): Promise<number> =>
      this.countRows(this.bidders, where),
  };

  category = {
    findUnique: async ({ where }: { where: Row }): Promise<Row | null> => {
      if (where.id) return this.find(this.categories, { id: where.id });
      if (where.name) return this.find(this.categories, { name: where.name });
      return null;
    },
    create: async ({ data }: { data: Row }): Promise<Row> => {
      if (this.categories.some((c) => c.name === data.name)) {
        throw knownRequestError('P2002');
      }
      return this.createRow(this.categories, data);
    },
    update: async ({
      where,
      data,
    }: {
      where: Row;
      data: Row;
    }): Promise<Row> => {
      if (
        data.name !== undefined &&
        this.categories.some((c) => c.name === data.name && c.id !== where.id)
      ) {
        throw knownRequestError('P2002');
      }
      return this.updateRow(this.categories, where, data);
    },
    delete: async ({ where }: { where: Row }): Promise<Row> =>
      this.deleteRow(this.categories, where),
    findMany: async (args?: RecordsArgs): Promise<Row[]> => {
      const rows = this.filterRows(this.categories, args?.where);
      const sorted = this.sortRows(rows, args?.orderBy);
      return this.applyPaging(sorted, args);
    },
    count: async ({ where }: { where?: Row } = {}): Promise<number> =>
      this.countRows(this.categories, where),
  };

  product = {
    findUnique: async ({ where }: { where: Row }): Promise<Row | null> => {
      if (where.id) return this.find(this.products, { id: where.id });
      if (where.code) return this.find(this.products, { code: where.code });
      return null;
    },
    findMany: async (args?: RecordsArgs): Promise<Row[]> => {
      const rows = this.filterRows(this.products, args?.where);
      const sorted = this.sortRows(rows, args?.orderBy);
      return this.applyPaging(sorted, args);
    },
    count: async ({ where }: { where?: Row } = {}): Promise<number> =>
      this.countRows(this.products, where),
    create: async ({ data }: { data: Row }): Promise<Row> => {
      // Enforce the @unique code constraint (P2002 semantics).
      if (this.products.some((p) => p.code === data.code)) {
        throw knownRequestError('P2002');
      }
      return this.createRow(this.products, data);
    },
    update: async ({ where, data }: { where: Row; data: Row }): Promise<Row> =>
      this.updateRow(this.products, where, data),
    delete: async ({ where }: { where: Row }): Promise<Row> =>
      this.deleteRow(this.products, where),
  };

  auction = {
    findUnique: async ({ where }: { where: Row }): Promise<Row | null> => {
      if (where.id) return this.find(this.auctions, { id: where.id });
      if (where.code) return this.find(this.auctions, { code: where.code });
      return null;
    },
    findMany: async (args?: RecordsArgs): Promise<Row[]> => {
      const rows = this.filterRows(this.auctions, args?.where);
      const sorted = this.sortRows(rows, args?.orderBy);
      return this.applyPaging(sorted, args);
    },
    count: async ({ where }: { where?: Row } = {}): Promise<number> =>
      this.countRows(this.auctions, where),
    create: async ({ data }: { data: Row }): Promise<Row> => {
      if (this.auctions.some((a) => a.code === data.code)) {
        throw knownRequestError('P2002');
      }
      return this.createRow(this.auctions, data);
    },
    update: async ({ where, data }: { where: Row; data: Row }): Promise<Row> =>
      this.updateRow(this.auctions, where, data),
  };

  bid = {
    findUnique: async ({ where }: { where: Row }): Promise<Row | null> =>
      this.find(this.bids, where),
    findMany: async (args?: RecordsArgs): Promise<Row[]> => {
      const rows = this.filterRows(this.bids, args?.where);
      const sorted = this.sortRows(rows, args?.orderBy);
      return this.applyPaging(sorted, args);
    },
    count: async ({ where }: { where?: Row } = {}): Promise<number> =>
      this.countRows(this.bids, where),
    create: async ({ data }: { data: Row }): Promise<Row> => {
      const row = this.createRow(this.bids, data);
      // Mirror the DB default ordering helper used by winner derivation.
      return row;
    },
    findFirst: async ({
      where,
      orderBy,
    }: {
      where?: Row;
      orderBy?: unknown;
    }): Promise<Row | null> => {
      const rows = this.bids.filter((b) => this.matches(b, where));
      return this.sortRows(rows, orderBy)[0] ?? null;
    },
  };

  passwordResetToken = {
    create: async ({ data }: { data: Row }): Promise<Row> => data,
    findFirst: async (): Promise<Row | null> => null,
    update: async (): Promise<Row> => ({}),
  };

  // ─── $transaction / $queryRaw ───────────────────────────────
  // Array form (batched reads) and interactive callback form.
  $transaction = async (arg: unknown): Promise<unknown> => {
    if (typeof arg === 'function') {
      return (arg as (tx: InMemoryPrisma) => unknown)(this);
    }
    return Promise.all(arg as Promise<unknown>[]);
  };

  // Only the auction-lock query is emulated; it returns the locked row.
  $queryRaw = async (
    _strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<Row[]> => {
    const auctionId = values[0];
    const auction = this.auctions.find((a) => a.id === auctionId);
    if (!auction) return [];

    // Expose columns exactly as they would come back from the DB.
    return [
      {
        current_price: String(auction.currentPrice),
        bid_increment: String(auction.bidIncrement),
        status: auction.status,
        start_at: auction.startAt,
        end_at: auction.endAt,
      },
    ];
  };

  // ─── helpers ────────────────────────────────
  private find(table: Row[], where: Row): Row | null {
    return table.find((row) => this.matches(row, where)) ?? null;
  }

  /**
   * Evaluate a Prisma `where` subset: plain equality plus the relation/search
   * shapes the services actually use (contains+insensitive, OR, relation
   * filters, and `in` lists). Deliberately not a full Prisma emulator.
   */
  private matches(row: Row, where?: Row): boolean {
    if (!where) return true;

    return Object.entries(where).every(([key, condition]) => {
      if (key === 'OR') {
        const clauses = condition as Row[];
        return clauses.some((clause) => this.matches(row, clause));
      }

      const value = row[key];

      if (
        condition !== null &&
        typeof condition === 'object' &&
        !Array.isArray(condition) &&
        !(condition instanceof Date)
      ) {
        const c = condition as Record<string, unknown>;
        if ('contains' in c) {
          const needle = String(c.contains).toLowerCase();
          const hay =
            value === null || value === undefined ? '' : String(value);
          return hay.toLowerCase().includes(needle);
        }
        if ('in' in c) {
          return (c.in as unknown[]).includes(value);
        }
        // Relation filter (e.g. `product: { vendorId }`).
        return false;
      }

      return value === condition;
    });
  }

  private filterRows(table: Row[], where?: Row): Row[] {
    if (!where) return [...table];

    // Support relation filters the services use: product.vendorId for auctions.
    if (where.product && typeof where.product === 'object') {
      const rel = where.product as Row;
      const rest = { ...where };
      delete rest.product;
      return table.filter((row) => {
        const product = this.products.find((p) => p.id === row.productId);
        return (
          !!product && this.matches(product, rel) && this.matches(row, rest)
        );
      });
    }

    return table.filter((row) => this.matches(row, where));
  }

  private applyPaging(rows: Row[], args?: RecordsArgs): Row[] {
    const skip = typeof args?.skip === 'number' ? args.skip : 0;
    const take = typeof args?.take === 'number' ? args.take : rows.length;
    return rows.slice(skip, skip + take);
  }

  private countRows(table: Row[], where?: Row): number {
    return this.filterRows(table, where).length;
  }

  private deleteRow(table: Row[], where: Row): Row {
    const idx = table.findIndex((row) => this.matches(row, where));
    if (idx === -1) throw knownRequestError('P2025');
    return table.splice(idx, 1)[0];
  }

  private createRow(table: Row[], data: Row, select?: Row): Row {
    const row: Row = { ...data };
    if (!row.id) row.id = this.id('r');
    if (!row.createdAt) row.createdAt = new Date();
    if (!row.updatedAt) row.updatedAt = new Date();
    if (row.status === undefined) row.status = 'ACTIVE';
    table.push(row);
    return select ? pick(row, select) : row;
  }

  private updateRow(table: Row[], where: Row, data: Row, select?: Row): Row {
    const row = this.find(table, where);
    if (!row) throw knownRequestError('P2025');
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) row[key] = value;
    }
    row.updatedAt = new Date();
    return select ? pick(row, select) : row;
  }

  private sortRows(rows: Row[], orderBy: unknown): Row[] {
    if (rows.length === 0) return rows;

    // Prisma accepts both `{ createdAt: 'desc' }` and `[{ amount: 'desc' }]`.
    const clauses: Array<Record<string, string>> = Array.isArray(orderBy)
      ? (orderBy as Array<Record<string, string>>)
      : orderBy && typeof orderBy === 'object'
        ? [orderBy as Record<string, string>]
        : [];

    if (clauses.length === 0) return rows;

    return [...rows].sort((a, b) => {
      for (const clause of clauses) {
        const [field, direction] = Object.entries(clause)[0];
        const av = toComparable(a[field]);
        const bv = toComparable(b[field]);
        if (av === bv) continue;
        const cmp = av < bv ? -1 : 1;
        return direction === 'desc' ? -cmp : cmp;
      }
      return 0;
    });
  }
}

/** Shape of the Prisma `findMany` argument subset this mock understands. */
type RecordsArgs = {
  where?: Row;
  orderBy?: unknown;
  skip?: number;
  take?: number;
  select?: Row;
};

function pick(row: Row, select: Row): Row {
  const out: Row = {};
  for (const key of Object.keys(select)) out[key] = row[key];
  return out;
}

function toComparable(value: unknown): number | string {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string' && /^\d+(\.\d+)?$/.test(value)) {
    return Number(value);
  }
  if (typeof value === 'number') return value;
  return String(value);
}

/** Shape-compatible Prisma known-request error (detected by toPublicError). */
function knownRequestError(code: string): Error {
  return Object.assign(new Error(`Prisma error ${code}`), {
    name: 'PrismaClientKnownRequestError',
    code,
  });
}
