import { ExchangeRuntime, type SubmitOrderInput } from "../../../packages/runtime/src/index";

export interface ApiAppOptions {
  runtime?: ExchangeRuntime;
}

export function createApiApp(options: ApiAppOptions = {}) {
  const runtime = options.runtime ?? new ExchangeRuntime();

  async function fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method.toUpperCase();

    try {
      if (method === "GET" && url.pathname === "/health") {
        return json({ ok: true });
      }

      if (method === "POST" && url.pathname === "/auth/register") {
        const body = await readJson<{ email: string; password: string }>(request);
        const user = runtime.register(body.email, body.password);
        return json({ userId: user.id }, 201);
      }

      if (method === "POST" && url.pathname === "/auth/login") {
        const body = await readJson<{ email: string; password: string }>(request);
        return json(runtime.login(body.email, body.password));
      }

      if (method === "GET" && url.pathname === "/markets") {
        return json([...runtime.store.markets.values()]);
      }

      const marketMatch = url.pathname.match(/^\/markets\/([^/]+)$/);
      if (method === "GET" && marketMatch) {
        const market = runtime.store.markets.get(marketMatch[1] ?? "");
        return market ? json(market) : jsonError("MARKET_NOT_FOUND", 404);
      }

      if (method === "POST" && url.pathname === "/deposits") {
        const user = runtime.store.requireUser(authToken(request));
        const body = await readJson<{ asset: string; amount: number }>(request);
        return json(runtime.deposit(user.id, body.asset, body.amount), 201);
      }

      if (method === "POST" && url.pathname === "/orders") {
        const user = runtime.store.requireUser(authToken(request));
        const body = await readJson<Omit<SubmitOrderInput, "userId">>(request);
        const order = await runtime.submitOrder({
          ...body,
          userId: user.id,
        });
        return json(order, order.status === "REJECTED" ? 400 : 202);
      }

      const cancelMatch = url.pathname.match(/^\/orders\/([^/]+)$/);
      if (method === "DELETE" && cancelMatch) {
        const user = runtime.store.requireUser(authToken(request));
        const orderId = cancelMatch[1] ?? "";
        const order = runtime.store.orders.get(orderId);

        if (!order) {
          return jsonError("ORDER_NOT_FOUND", 404);
        }

        await runtime.cancelOrder(user.id, order.marketId, orderId);
        return json({ orderId, status: "PENDING_CANCEL" }, 202);
      }

      if (method === "GET" && url.pathname === "/balances") {
        const user = runtime.store.requireUser(authToken(request));
        return json(
          [...runtime.store.balances.values()].filter((balance) => balance.userId === user.id),
        );
      }

      if (method === "GET" && url.pathname === "/positions") {
        const user = runtime.store.requireUser(authToken(request));
        return json(
          [...runtime.store.positions.values()].filter((position) => position.userId === user.id),
        );
      }

      if (method === "GET" && url.pathname === "/orders") {
        const user = runtime.store.requireUser(authToken(request));
        return json(
          [...runtime.store.orders.values()].filter((order) => order.userId === user.id),
        );
      }

      if (method === "GET" && cancelMatch) {
        const user = runtime.store.requireUser(authToken(request));
        const order = runtime.store.orders.get(cancelMatch[1] ?? "");
        return order && order.userId === user.id
          ? json(order)
          : jsonError("ORDER_NOT_FOUND", 404);
      }

      if (method === "GET" && url.pathname === "/fills") {
        const user = runtime.store.requireUser(authToken(request));
        return json(
          [...runtime.store.fills.values()].filter((fill) => fill.userId === user.id),
        );
      }

      if (method === "POST" && url.pathname === "/admin/drain") {
        const processed = await runtime.drain();
        return json({ processed });
      }

      return jsonError("NOT_FOUND", 404);
    } catch (error) {
      const message = error instanceof Error ? error.message : "internal error";
      const status = message === "unauthenticated" ? 401 : 400;
      return jsonError(message.toUpperCase().replaceAll(" ", "_"), status, message);
    }
  }

  return { fetch, runtime };
}

function authToken(request: Request): string | undefined {
  const header = request.headers.get("authorization");
  return header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;
}

async function readJson<T>(request: Request): Promise<T> {
  return (await request.json()) as T;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function jsonError(code: string, status: number, message = code): Response {
  return json({ error: { code, message } }, status);
}
