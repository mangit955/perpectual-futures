export interface JwtClaims {
  sub: string;
  email?: string;
  iat: number;
  exp: number;
}

export interface IssueJwtInput {
  userId: string;
  email?: string;
  secret: string;
  now?: number;
  expiresInSeconds?: number;
}

export async function hashPassword(password: string): Promise<string> {
  validatePassword(password);
  return Bun.password.hash(password);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return Bun.password.verify(password, hash);
}

export async function issueJwt(input: IssueJwtInput): Promise<string> {
  const now = Math.floor((input.now ?? Date.now()) / 1000);
  const claims: JwtClaims = {
    sub: input.userId,
    email: input.email,
    iat: now,
    exp: now + (input.expiresInSeconds ?? 60 * 60 * 24),
  };
  const header = { alg: "HS256", typ: "JWT" };
  const signingInput = `${base64UrlJson(header)}.${base64UrlJson(claims)}`;
  const signature = await hmacSha256(signingInput, input.secret);

  return `${signingInput}.${base64Url(signature)}`;
}

export async function verifyJwt(
  token: string,
  secret: string,
  now = Date.now(),
): Promise<JwtClaims> {
  const [encodedHeader, encodedPayload, encodedSignature] = token.split(".");

  if (!encodedHeader || !encodedPayload || !encodedSignature) {
    throw new Error("invalid token");
  }

  const header = JSON.parse(base64UrlDecode(encodedHeader)) as { alg?: string };

  if (header.alg !== "HS256") {
    throw new Error("unsupported token algorithm");
  }

  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const expected = base64Url(await hmacSha256(signingInput, secret));

  if (!timingSafeEqual(expected, encodedSignature)) {
    throw new Error("invalid token signature");
  }

  const claims = JSON.parse(base64UrlDecode(encodedPayload)) as JwtClaims;

  if (!claims.sub || !claims.exp || Math.floor(now / 1000) >= claims.exp) {
    throw new Error("expired token");
  }

  return claims;
}

export function validateEmail(email: string): void {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("invalid email");
  }
}

export function validatePassword(password: string): void {
  if (password.length < 8) {
    throw new Error("password must be at least 8 characters");
  }
}

function base64UrlJson(value: unknown): string {
  return base64Url(new TextEncoder().encode(JSON.stringify(value)));
}

function base64UrlDecode(value: string): string {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    "=",
  );

  return atob(padded);
}

function base64Url(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";

  for (const byte of view) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

async function hmacSha256(input: string, secret: string): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  return crypto.subtle.sign("HMAC", key, new TextEncoder().encode(input));
}

function timingSafeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }

  let result = 0;

  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return result === 0;
}
