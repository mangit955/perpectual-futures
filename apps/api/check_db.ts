import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});
async function main() {
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20
  });
  console.log("Recent 20 orders:");
  for (const o of orders) {
    console.log(`- ${o.id}: status=${o.status}, side=${o.side}, type=${o.type}, qty=${o.quantity}, remaining=${o.remainingQuantity}`);
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
