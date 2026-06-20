import { describe, expect, it } from "bun:test";
import { toLiquidationWrite } from "./liquidation-mapper";

describe("toLiquidationWrite", () => {
  it("maps liquidation risk records to decimal-string persistence records", () => {
    const record = toLiquidationWrite(
      {
        eventId: "liq-1:BTC-PERP",
        userId: "user-1",
        marketId: "BTC-PERP",
        positionQuantity: 2,
        markPrice: 94,
        maintenanceMargin: 0.94,
        accountEquity: -12.5,
        status: "TRIGGERED",
        createdAt: 1_700_000_000_000,
      },
      {
        insuranceFundUsed: 50,
        adlUsed: 25,
        status: "ADL_USED",
      },
    );

    expect(record).toEqual({
      id: "liq-1:BTC-PERP",
      userId: "user-1",
      marketId: "BTC-PERP",
      positionQuantity: "2",
      markPrice: "94",
      maintenanceMargin: "0.94",
      accountEquity: "-12.5",
      status: "ADL_USED",
      insuranceFundUsed: "50",
      adlUsed: "25",
      eventId: "liq-1:BTC-PERP",
      createdAt: new Date(1_700_000_000_000),
      updatedAt: new Date(1_700_000_000_000),
    });
  });
});
