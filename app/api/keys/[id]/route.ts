import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { jsonError } from "@/lib/api-helpers";
import { revokeApiKey } from "@/lib/db";

/**
 * Revoke an API key (sets revoked_at — /api/v1 auth ignores it immediately).
 * Someone else's key id gets a 404, not a 403, so ids aren't enumerable
 * (same convention as the task routes).
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireUser(req);
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const { id } = await params;
  try {
    const ok = await revokeApiKey(user.userId, id);
    if (!ok) {
      return NextResponse.json({ error: "Key not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return jsonError(e);
  }
}
