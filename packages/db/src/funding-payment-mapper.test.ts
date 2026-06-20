import { describe, expect, it } from "bun:test";
import { toFundingPaymentWrite } from "./funding-payment-mapper";

describe("toFundingPaymentWrite", () => {
  it("maps numeric funding payments to decimal-string persistence records", () => {
    const record = toFundingPaymentWrite(
      {
        id: "funding-1:long:BTC-PERP",
        eventId: "funding-1",
        userId: "long",
        marketId: "BTC-PERP",
        positionQuantity: 2,
        markPrice: 101,
        indexPrice: 100,
        fundingRate: 0.00375,
        paymentAmount: -0.7575,
        fundingTime: 1_700_000_000_000,
      },
      new Date(1_700_000_000_500),
    );

    expect(record).toEqual({
      id: "funding-1:long:BTC-PERP",
      eventId: "funding-1",
      userId: "long",
      marketId: "BTC-PERP",
      positionQuantity: "2",
      markPrice: "101",
      indexPrice: "100",
      fundingRate: "0.00375",
      paymentAmount: "-0.7575",
      fundingTime: new Date(1_700_000_000_000),
      createdAt: new Date(1_700_000_000_500),
    });
  });
});
