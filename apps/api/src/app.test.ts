import { describe, expect, it } from "bun:test";
import { createApiApp } from "./app";

describe("api app", () => {
  it("registers users, deposits collateral, submits orders, and exposes fills", async () => {
    const app = createApiApp();

    const maker = await json<{ userId: string }>(
      await app.fetch(post("/auth/register", {
        email: "maker@example.com",
        password: "pw",
      })),
    );
    const taker = await json<{ userId: string }>(
      await app.fetch(post("/auth/register", {
        email: "taker@example.com",
        password: "pw",
      })),
    );
    const makerLogin = await json<{ token: string }>(
      await app.fetch(post("/auth/login", {
        email: "maker@example.com",
        password: "pw",
      })),
    );
    const takerLogin = await json<{ token: string }>(
      await app.fetch(post("/auth/login", {
        email: "taker@example.com",
        password: "pw",
      })),
    );

    expect(maker.userId).not.toBe(taker.userId);

    await app.fetch(authPost("/deposits", makerLogin.token, {
      asset: "USDC",
      amount: 10_000,
    }));
    await app.fetch(authPost("/deposits", takerLogin.token, {
      asset: "USDC",
      amount: 10_000,
    }));
    await app.fetch(authPost("/orders", makerLogin.token, {
      marketId: "BTC-PERP",
      side: "SELL",
      type: "LIMIT",
      quantity: 1,
      price: 100,
      timeInForce: "GTC",
    }));
    await app.fetch(authPost("/orders", takerLogin.token, {
      marketId: "BTC-PERP",
      side: "BUY",
      type: "LIMIT",
      quantity: 1,
      price: 100,
      timeInForce: "GTC",
    }));
    await app.runtime.drain();

    const makerFills = await json<unknown[]>(
      await app.fetch(authGet("/fills", makerLogin.token)),
    );
    const takerPositions = await json<Array<{ quantity: number }>>(
      await app.fetch(authGet("/positions", takerLogin.token)),
    );

    expect(makerFills).toHaveLength(1);
    expect(takerPositions[0]?.quantity).toBe(1);
  });
});

function post(path: string, body: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

function authPost(path: string, token: string, body: unknown): Request {
  const request = post(path, body);
  request.headers.set("authorization", `Bearer ${token}`);
  return request;
}

function authGet(path: string, token: string): Request {
  return new Request(`http://localhost${path}`, {
    headers: { authorization: `Bearer ${token}` },
  });
}

async function json<T>(response: Response): Promise<T> {
  expect(response.status).toBeLessThan(400);
  return (await response.json()) as T;
}
