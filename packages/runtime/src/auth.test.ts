import { describe, expect, it } from "bun:test";
import { issueJwt, verifyJwt } from "./auth";

describe("jwt auth helpers", () => {
  it("issues and verifies HS256 tokens", async () => {
    const token = await issueJwt({
      userId: "user-1",
      email: "trader@example.com",
      secret: "test-secret",
      now: 1_700_000_000_000,
    });
    const claims = await verifyJwt(token, "test-secret", 1_700_000_001_000);

    expect(claims.sub).toBe("user-1");
    expect(claims.email).toBe("trader@example.com");
  });

  it("rejects tokens signed with another secret", async () => {
    const token = await issueJwt({
      userId: "user-1",
      secret: "test-secret",
    });

    await expect(verifyJwt(token, "wrong-secret")).rejects.toThrow(
      "invalid token signature",
    );
  });
});
