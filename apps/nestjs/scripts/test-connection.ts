import { createPrismaClient, prismaClientPath, maskConnectionString, resolveConnectionString } from './lib/db.js';

async function main() {
  const rawUrl = resolveConnectionString();
  const masked = maskConnectionString(rawUrl);
  console.log(`Testing connection to: ${masked}`);

  const prisma = await createPrismaClient(prismaClientPath());
  try {
    await prisma.$connect();
    console.log('Prisma $connect: SUCCESS');

    const result = await prisma.$queryRawUnsafe('SELECT current_database(), current_user, version()');
    console.log('Raw query check: SUCCESS');

    // Count records in User table to confirm schema exists in DB
    const userCount = await prisma.user.count();
    console.log(`User table query check: SUCCESS (found ${userCount} users)`);
    
    await prisma.$disconnect();
    console.log('Database test completed successfully!');
    process.exit(0);
  } catch (err: any) {
    console.error('Database connection test FAILED:');
    console.error(err?.message || err);
    await prisma.$disconnect().catch(() => {});
    process.exit(1);
  }
}

main();
