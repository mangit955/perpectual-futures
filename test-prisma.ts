import { PrismaClient } from "@prisma/client";

const client = new PrismaClient();

async function run() {
  try {
    console.log("Updating...");
    await client.outboxEvent.update({
      where: { id: "223266bd-b6a7-48bc-9cce-cd9611e7cf78" },
      data: {
        status: "PUBLISHED",
        publishedAt: new Date(),
        lastError: null,
      },
    });
    console.log("Done");
  } catch (e) {
    console.error("Update error:", e);
  }
  process.exit(0);
}

run();
