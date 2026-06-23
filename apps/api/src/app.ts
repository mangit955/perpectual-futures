import { ExchangeRuntime, type SubmitOrderInput } from "../../../packages/runtime/src/index";
import {
  InMemoryApiRuntime,
  type ApiRuntime,
} from "../../../packages/runtime/src/index";

export interface ApiAppOptions {
  runtime?: ExchangeRuntime;
  apiRuntime?: ApiRuntime;
}

export function createApiApp(options: ApiAppOptions = {}) {
  const runtime =
    options.apiRuntime ??
    new InMemoryApiRuntime(options.runtime ?? new ExchangeRuntime());

  const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
  };

  async function fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method.toUpperCase();

    // Handle CORS preflight
    if (method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    try {
      if (method === "GET" && url.pathname === "/health") {
        return json({ ok: true });
      }

      if (method === "POST" && url.pathname === "/auth/register") {
        const body = await readJson<{ email: string; password: string }>(request);
        const user = await runtime.register(body.email, body.password);
        return json({ userId: user.id }, 201);
      }

      if (method === "POST" && url.pathname === "/auth/login") {
        const body = await readJson<{ email: string; password: string }>(request);
        return json(await runtime.login(body.email, body.password));
      }

      if (method === "GET" && url.pathname === "/markets") {
        return json(await runtime.listMarkets());
      }

      const marketMatch = url.pathname.match(/^\/markets\/([^/]+)$/);
      if (method === "GET" && marketMatch) {
        const market = await runtime.getMarket(marketMatch[1] ?? "");
        return market ? json(market) : jsonError("MARKET_NOT_FOUND", 404);
      }

      if (method === "POST" && url.pathname === "/deposits") {
        const user = await runtime.authenticate(authToken(request));
        const body = await readJson<{ asset: string; amount: number | string }>(request);
        return json(await runtime.deposit(user.id, body.asset, Number(body.amount)), 201);
      }

      if (method === "POST" && url.pathname === "/orders") {
        const user = await runtime.authenticate(authToken(request));
        const body = normalizeOrderInput(
          await readJson<Omit<SubmitOrderInput, "userId"> & {
            quantity: number | string;
            price?: number | string;
            leverage?: number | string;
          }>(request),
        );
        const order = await runtime.submitOrder({
          ...body,
          userId: user.id,
        });
        return json(order, order.status === "REJECTED" ? 400 : 202);
      }

      const cancelMatch = url.pathname.match(/^\/orders\/([^/]+)$/);
      if (method === "DELETE" && cancelMatch) {
        const user = await runtime.authenticate(authToken(request));
        const orderId = cancelMatch[1] ?? "";
        const order = await runtime.getOrder(user.id, orderId);

        if (!order) {
          return jsonError("ORDER_NOT_FOUND", 404);
        }

        await runtime.cancelOrder(user.id, order.marketId, orderId);
        return json({ orderId, status: "PENDING_CANCEL" }, 202);
      }

      if (method === "GET" && url.pathname === "/balances") {
        const user = await runtime.authenticate(authToken(request));
        return json(await runtime.listBalances(user.id));
      }

      if (method === "GET" && url.pathname === "/positions") {
        const user = await runtime.authenticate(authToken(request));
        return json(await runtime.listPositions(user.id));
      }

      if (method === "GET" && url.pathname === "/orders") {
        const user = await runtime.authenticate(authToken(request));
        return json(await runtime.listOrders(user.id));
      }

      if (method === "GET" && cancelMatch) {
        const user = await runtime.authenticate(authToken(request));
        const order = await runtime.getOrder(user.id, cancelMatch[1] ?? "");
        return order ? json(order) : jsonError("ORDER_NOT_FOUND", 404);
      }

      if (method === "GET" && url.pathname === "/fills") {
        const user = await runtime.authenticate(authToken(request));
        return json(await runtime.listFills(user.id));
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

  function withCors(res: Response): Response {
    for (const [key, value] of Object.entries(CORS_HEADERS)) {
      res.headers.set(key, value);
    }
    return res;
  }

  const originalFetch = fetch;
  const fetchWithCors: typeof fetch = async (request) => {
    const res = await originalFetch(request);
    return withCors(res);
  };

  return { fetch: fetchWithCors, runtime };
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

function normalizeOrderInput(
  body: Omit<SubmitOrderInput, "userId"> & {
    quantity: number | string;
    price?: number | string;
    leverage?: number | string;
  },
): Omit<SubmitOrderInput, "userId"> {
  return {
    ...body,
    quantity: Number(body.quantity),
    price: body.price == null ? undefined : Number(body.price),
    leverage: body.leverage == null ? undefined : Number(body.leverage),
  };
}
