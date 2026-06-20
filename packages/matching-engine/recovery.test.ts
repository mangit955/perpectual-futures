import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "bun:test";
import {
  createStoredSnapshot,
  FileSnapshotStore,
  MatchingEngine,
  OrderBook,
  recoverOrderBookFromSnapshot,
  type EngineEvent,
} from "./index";

const MARKET = "BTC-PERP";
const NOW = 1_700_000_000_000;

describe("snapshot and recovery", () => {
  it("writes and reads latest orderbook snapshot from disk", async () => {
    const dir = await mkdtemp(join(tmpdir(), "perp-v3-snapshots-"));
    const store = new FileSnapshotStore(dir);
    const book = new OrderBook(MARKET, () => NOW);

    book.submitOrder({
      commandId: "cmd-1",
      orderId: "bid-1",
      userId: "user-1",
      market: MARKET,
      side: "buy",
      type: "limit",
      qtyLots: 2,
      priceTicks: 99,
      timeInForce: "GTC",
      createdAt: NOW,
    });

    const stored = createStoredSnapshot({
      orderBook: book,
      lastRedisStreamId: "10-0",
      createdAt: NOW,
    });
    const path = await store.write(stored);
    const loaded = await store.readLatest(MARKET);

    expect(path.endsWith(`${MARKET}.snapshot.json`)).toBe(true);
    expect(loaded).toMatchObject({
      market: MARKET,
      engineSequence: 2,
      lastRedisStreamId: "10-0",
      orderBook: {
        bids: [
          {
            priceTicks: 99,
            totalQtyLots: 2,
            orders: [
              {
                orderId: "bid-1",
                remainingQtyLots: 2,
                priceTicks: 99,
              },
            ],
          },
        ],
      },
    });
  });

  it("restores a snapshot and replays events after the snapshot sequence", () => {
    const engine = new MatchingEngine({ clock: () => NOW });

    engine.submitOrder(
      order({
        commandId: "cmd-bid-1",
        orderId: "bid-1",
        userId: "maker",
        side: "buy",
        priceTicks: 99,
        qtyLots: 2,
      }),
    );

    const snapshot = {
      market: MARKET,
      engineSequence: engine.getBookSnapshot(MARKET).sequence,
      lastRedisStreamId: "1-0",
      createdAt: NOW,
      orderBook: engine.getBookSnapshot(MARKET),
    };

    const eventsAfterSnapshot: EngineEvent[] = [
      ...engine.submitOrder(
        order({
          commandId: "cmd-ask-1",
          orderId: "ask-1",
          userId: "taker",
          side: "sell",
          priceTicks: 99,
          qtyLots: 1,
        }),
      ),
      ...engine.cancelOrder({
        commandId: "cmd-cancel-bid-1",
        userId: "maker",
        market: MARKET,
        orderId: "bid-1",
      }),
      ...engine.submitOrder(
        order({
          commandId: "cmd-ask-2",
          orderId: "ask-2",
          userId: "maker-2",
          side: "sell",
          priceTicks: 101,
          qtyLots: 3,
        }),
      ),
    ];

    const recovered = recoverOrderBookFromSnapshot({
      snapshot,
      eventsAfterSnapshot,
      clock: () => NOW,
    });

    expect(recovered.snapshot()).toMatchObject({
      market: MARKET,
      bids: [],
      asks: [
        {
          priceTicks: 101,
          totalQtyLots: 3,
          orders: [
            {
              orderId: "ask-2",
              remainingQtyLots: 3,
            },
          ],
        },
      ],
    });
    expect(recovered.snapshot().sequence).toBe(engine.getBookSnapshot(MARKET).sequence);
  });
});

function order(overrides: {
  commandId: string;
  orderId: string;
  userId: string;
  side: "buy" | "sell";
  priceTicks: number;
  qtyLots: number;
}) {
  return {
    commandId: overrides.commandId,
    orderId: overrides.orderId,
    userId: overrides.userId,
    market: MARKET,
    side: overrides.side,
    type: "limit" as const,
    qtyLots: overrides.qtyLots,
    priceTicks: overrides.priceTicks,
    timeInForce: "GTC" as const,
    createdAt: NOW,
  };
}
