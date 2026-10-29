import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { generateApiKey } from "@/lib/api-auth";
import { jsonError } from "@/lib/api-helpers";
import { createApiKey, listApiKeys } from "@/lib/db";

/**
 * Manage the account's external API keys (used by POST /api/v1/todos and
 * /api/v1/events). Session-gated like every other /api route. The full
 * secret is returned exactly once, at creation — afterwards only its sha256
 * hash exists server-side.
 */

const MAX_ACTIVE_KEYS = 20;

export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  try {
    return NextResponse.json({ keys: await listApiKeys(user.userId) });
  } catch (e) {
    return jsonError(e);
  }
}

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as {
    name?: unknown;
  } | null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 100) {
    return NextResponse.json(
      { error: "name is required (1–100 characters)." },
      { status: 400 },
    );
  }
  try {
    const active = (await listApiKeys(user.userId)).filter(
      (k) => !k.revokedAt,
    );
    if (active.length >= MAX_ACTIVE_KEYS) {
      return NextResponse.json(
        { error: "Too many active keys — revoke one first." },
        { status: 400 },
      );
    }
    const { secret, hash, prefix } = generateApiKey();
    const key = await createApiKey(user.userId, {
      name,
      keyHash: hash,
      keyPrefix: prefix,
    });
    return NextResponse.json({ key, secret }, { status: 201 });
  } catch (e) {
    return jsonError(e);
  }
}
