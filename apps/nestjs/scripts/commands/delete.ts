/**
 * `delete` — hapus user beserta profilnya, dengan pengaman foreign key
 * (relasi Product -> Vendor dan Bid -> Bidder di schema bersifat Restrict).
 */
import { requireEmail, type CliArgs } from '../lib/args.js';
import type { Db } from '../lib/db.js';
import { fail, heading, ok, step } from '../lib/output.js';

export async function deleteCommand(db: Db, args: CliArgs): Promise<void> {
  const email = requireEmail(args);
  heading(`HAPUS USER: ${email}`);

  const user = await db.user.findUnique({
    where: { email },
    include: { vendor: { include: { products: true } }, bidder: true },
  });
  if (!user) fail(`User "${email}" tidak ditemukan.`);

  if (user.vendor?.products.length) {
    fail(
      `User ini punya ${user.vendor.products.length} produk. Hapus produk terkait dulu ` +
        '(relasi Product -> Vendor bersifat Restrict).',
    );
  }

  if (user.vendor) {
    await db.vendor.delete({ where: { userId: user.id } });
    ok('Profil Vendor dihapus.');
  }

  if (user.bidder) {
    const bids = await db.bid.count({ where: { bidderId: user.bidder.id } });
    if (bids > 0) {
      fail(
        `Bidder ini punya ${bids} bid (riwayat historis, Restrict). Batalkan dulu bila perlu.`,
      );
    }

    await db.bidder.delete({ where: { userId: user.id } });
    ok('Profil Bidder dihapus.');
  }

  step('Menghapus token reset password…');
  await db.passwordResetToken.deleteMany({ where: { userId: user.id } });

  await db.user.delete({ where: { id: user.id } });
  ok(`User ${email} dihapus.`);
}
