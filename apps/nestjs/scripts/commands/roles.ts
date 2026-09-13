/**
 * `roles` — ringkasan jumlah user per role dan jumlah profilnya.
 * Berguna untuk mendeteksi user VENDOR / BIDDER yang belum punya profil.
 */
import type { Db } from '../lib/db.js';
import { color, heading, ok, printTable, warn } from '../lib/output.js';

export async function rolesCommand(db: Db): Promise<void> {
  heading('RINGKASAN ROLE');

  const [admin, vendors, bidders, vendorProfiles, bidderProfiles] =
    await Promise.all([
      db.user.count({ where: { role: 'ADMIN' } }),
      db.user.count({ where: { role: 'VENDOR' } }),
      db.user.count({ where: { role: 'BIDDER' } }),
      db.vendor.count(),
      db.bidder.count(),
    ]);

  printTable(
    ['Role', 'Jumlah User', 'Jumlah Profil'],
    [
      ['ADMIN', admin, '-'],
      ['VENDOR', vendors, vendorProfiles],
      ['BIDDER', bidders, bidderProfiles],
    ],
  );

  if (vendors !== vendorProfiles) {
    warn(
      `${vendors - vendorProfiles} user VENDOR belum punya baris profil Vendor.`,
    );
  }
  if (bidders !== bidderProfiles) {
    warn(
      `${bidders - bidderProfiles} user BIDDER belum punya baris profil Bidder.`,
    );
  }
  if (vendors === vendorProfiles && bidders === bidderProfiles) {
    ok('Semua user VENDOR & BIDDER sudah punya profil yang sesuai.');
  }
}
