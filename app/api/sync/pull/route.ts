import { NextResponse, type NextRequest } from "next/server";
import { pullLocalRecords } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { jsonError } from "@/lib/api-helpers";

/**
 * Rows changed on the server since the cursor (`?since=` ms epoch, server
 * clock — the client stores the cursor returned by its last pull). The
 * client's merge is idempotent, so overlapping re-delivery is harmless.
 */
export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const since = Number(new URL(req.url).searchParams.get("since") ?? "0");
  if (!Number.isFinite(since) || since < 0) {
    return NextResponse.json(
      { error: "since must be a non-negative number (ms epoch)." },
      { status: 400 },
    );
  }
  try {
    const payload = await pullLocalRecords(user.userId, since);
    return NextResponse.json(payload);
  } catch (e) {
    return jsonError(e);
  }
}
