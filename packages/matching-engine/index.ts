import type { NewOrderCommand } from "./types/command";
import type { OrderRejectedReason } from "./types/event";

function validateOrder(
  command: NewOrderCommand,
  ordersById: Map<string, unknown>,
): OrderRejectedReason | null {
  if (command.qtyLots <= 0) {
    return "INVALID_QUANTITY";
  }

  if (command.type === "market" && command.priceTicks != null) {
    return "MARKET_ORDER_HAS_PRICE";
  }

  if (command.type === "limit" && command.priceTicks == null) {
    return "LIMIT_ORDER_MISSING_PRICE";
  }

  if (ordersById.has(command.orderId)) {
    return "DUPLICATE_ORDER_ID";
  }

  return null;
}
