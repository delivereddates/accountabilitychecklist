import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getUserIdForApiKey } from "./db";

/**
 * Bearer API-key auth for the external write-only routes (/api/v1/*).
 * Keys look like "ac_" + 43 base64url chars (192 random bits), live in the
 * api_keys table hashed with sha256, and are shown to the user exactly once
 * at creation. These routes never read the session cookie, so CORS with
 * Allow-Origin:* is safe (no credentials are involved — CSRF is structurally
 * impossible).
 */

const AC_PREFIX = "ac_";
const KEY_LENGTH = AC_PREFIX.length + 43; // "ac_" + base64url(32 bytes)

export interface ApiKeyPrincipal {
  userId: string;
  keyId: string;
}

/** Generate a fresh key: the caller sees `secret` once; store hash + prefix. */
export function generateApiKey(): {
  secret: string;
  hash: string;
  prefix: string;
} {
  const secret = AC_PREFIX + randomBytes(32).toString("base64url");
  return {
    secret,
    hash: createHash("sha256").update(secret).digest("hex"),
    prefix: secret.slice(0, 12),
  };
}

/**
 * Resolve the request's Bearer key to its owner, or null when the header is
 * missing/malformed or no active key matches. The format check runs before
 * any DB call so garbage costs nothing; hash lookup by equality (the index
 * does the work — the hash is preimage-resistant, so no constant-time
 * compare is needed). DB errors PROPAGATE — a Supabase outage is a 500, not
 * a misleading 401.
 */
export async function requireApiKey(
  req: NextRequest,
): Promise<ApiKeyPrincipal | null> {
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return null;
  const secret = auth.slice("Bearer ".length);
  // Cheap reject: right shape or don't touch the database.
  if (!secret.startsWith(AC_PREFIX) || secret.length !== KEY_LENGTH) {
    return null;
  }
  if (!/^[A-Za-z0-9_-]+$/.test(secret)) return null;
  const hash = createHash("sha256").update(secret).digest("hex");
  return getUserIdForApiKey(hash);
}

/** CORS headers for /api/v1 — applied to every response, errors included
 *  (a browser caller can't read an error body without them). */
export const V1_CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Max-Age": "86400",
};

export function withV1Cors(res: NextResponse): NextResponse {
  const withHeaders = new NextResponse(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: res.headers,
  });
  for (const [k, v] of Object.entries(V1_CORS)) withHeaders.headers.set(k, v);
  return withHeaders;
}
