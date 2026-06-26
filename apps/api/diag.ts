import { PrismaClient } from '@prisma/client';
import { Redis } from '@upstash/redis';

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

// Since the url is rediss://, we'll try to parse it for upstash REST.
// Upstash URLs for REST are usually https://....
// But wait, the REDIS_URL provided is rediss://...
// If @upstash/redis REST client is used, it needs REST URL.
// Let's just use ioredis.
import RedisClient from 'ioredis';

async function main() {
  const r = new RedisClient(process.env.REDIS_URL!);
  
  const pendingOutbox = await prisma.outboxEvent.count({ where: { status: 'PENDING' } });
  const failedOutbox = await prisma.outboxEvent.count({ where: { status: 'FAILED' } });
  const publishedOutbox = await prisma.outboxEvent.count({ where: { status: 'PUBLISHED' } });
  
  console.log(`Outbox Stats: PENDING=${pendingOutbox}, FAILED=${failedOutbox}, PUBLISHED=${publishedOutbox}`);

  try {
    const btcCommands = await r.xlen('engine.commands.BTC-PERP');
    console.log(`engine.commands.BTC-PERP length: ${btcCommands}`);
    
    const btcEvents = await r.xlen('engine.events.BTC-PERP');
    console.log(`engine.events.BTC-PERP length: ${btcEvents}`);
    
    // Check consumer groups
    const cmdGroups = await r.xinfo('GROUPS', 'engine.commands.BTC-PERP').catch(e => e.message);
    console.log(`Commands groups:`, cmdGroups);
  } catch (e) {
    console.log("Redis error:", e);
  }

  r.quit();
}

main().catch(console.error).finally(() => prisma.$disconnect());
