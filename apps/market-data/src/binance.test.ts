import { describe, expect, it } from "bun:test";
import { buildStreamUrl, parseBinanceMarkPriceMessage } from "./binance";

const mappings = [{ binanceSymbol: "BTCUSDT", marketId: "BTC-PERP" }];

describe("Binance market-data parser", () => {
  it("parses combined stream mark-price updates", () => {
    const event = parseBinanceMarkPriceMessage(
      JSON.stringify({
        stream: "btcusdt@markPrice",
        data: {
          e: "markPriceUpdate",
          E: 1_700_000_000_000,
          s: "BTCUSDT",
          p: "65000.12",
          i: "64999.99",
          r: "0.0001",
          T: 1_700_028_800_000,
        },
      }),
      mappings,
    );

    expect(event).toEqual({
      type: "price.updated",
      marketId: "BTC-PERP",
      symbol: "BTCUSDT",
      markPrice: 65000.12,
      indexPrice: 64999.99,
      fundingRate: 0.0001,
      eventTime: 1_700_000_000_000,
      nextFundingTime: 1_700_028_800_000,
    });
  });

  it("skips unknown symbols and malformed prices", () => {
    expect(
      parseBinanceMarkPriceMessage(
        JSON.stringify({ s: "ETHUSDT", p: "100", i: "100" }),
        mappings,
      ),
    ).toBeNull();
    expect(
      parseBinanceMarkPriceMessage(
        JSON.stringify({ s: "BTCUSDT", p: "nope", i: "100" }),
        mappings,
      ),
    ).toBeNull();
  });

  it("builds combined stream URLs", () => {
    expect(
      buildStreamUrl("wss://fstream.binance.com", mappings),
    ).toBe("wss://fstream.binance.com/stream?streams=btcusdt@markPrice");
  });
});
