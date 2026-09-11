const fs = require('fs');
const f = 'src/auctions/auctions.service.spec.ts';
let c = fs.readFileSync(f, 'utf8');

// Replace the whole assertion block with a simpler, unambiguous one.
const lines = c.split('\n');

const startIdx = lines.findIndex((l) =>
  l.includes('expect.objectContaining({ where: { product:'),
);

if (startIdx === -1) {
  console.log('NOT_FOUND');
  process.exit(0);
}

// The block is 3 lines: expect(...findMany).toHaveBeenCalledWith( / objectContaining(...) / );
lines[startIdx - 1] =
  '      const call = prisma.auction.findMany.mock.calls[0][0];';
lines[startIdx] =
  "      expect(call.where).toEqual({ product: { vendorId: 'v-a' });";
lines.splice(startIdx + 1, 1); // remove the old `);` line

fs.writeFileSync(f, lines.join('\n'));
console.log('PATCHED');
