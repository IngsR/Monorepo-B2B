/**
 * `inspect` — detail satu user beserta relasinya (produk, bid, token reset).
 */
import { requireEmail, type CliArgs } from '../lib/args.js';
import type { Db } from '../lib/db.js';
import { color, fail, fmtDate, heading, printTable } from '../lib/output.js';

export async function inspectCommand(db: Db, args: CliArgs): Promise<void> {
  const email = requireEmail(args);
  heading(`DETAIL USER: ${email}`);

  const user = await db.user.findUnique({
    where: { email },
    include: {
      vendor: { include: { products: { include: { auctions: true } } } },
      bidder: { include: { bids: true } },
      passwordResetTokens: true,
    },
  });

  if (!user) fail(`User "${email}" tidak ditemukan.`);

  printTable(
    ['Field', 'Nilai'],
    [
      ['id', user.id],
      ['email', user.email],
      ['name', user.name],
      ['role', user.role],
      ['password (hash)', `${user.password.slice(0, 20)}… (bcrypt)`],
      ['createdAt', fmtDate(user.createdAt)],
      ['updatedAt', fmtDate(user.updatedAt)],
    ],
  );

  if (user.vendor) {
    console.log(`\n  ${color.bold}Vendor Profile${color.reset}`);
    printTable(
      ['Field', 'Nilai'],
      [
        ['companyName', user.vendor.companyName],
        ['companyAddress', user.vendor.companyAddress],
        ['phone', user.vendor.phone],
        ['produk dimiliki', user.vendor.products.length],
      ],
    );

    if (user.vendor.products.length > 0) {
      printTable(
        ['Kode', 'Nama Produk', 'Jumlah Lelang'],
        user.vendor.products.map((product: (typeof user.vendor.products)[number]) => [
          product.code,
          product.name,
          product.auctions.length,
        ]),
      );
    }
  }

  if (user.bidder) {
    console.log(`\n  ${color.bold}Bidder Profile${color.reset}`);
    printTable(
      ['Field', 'Nilai'],
      [
        ['phone', user.bidder.phone],
        ['address', user.bidder.address],
        ['jumlah bid', user.bidder.bids.length],
      ],
    );
  }

  console.log(
    `\n  Password reset token: ${user.passwordResetTokens.length} baris (aktif/terpakai).`,
  );
}
