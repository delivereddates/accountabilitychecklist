import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import {
  deleteAllPushSubscriptions,
  deletePushSubscription,
  upsertPushSubscription,
} from "@/lib/db";

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const endpoint = typeof body?.endpoint === "string" ? body.endpoint : "";
  const keys = body?.keys;
  const p256dh = typeof keys?.p256dh === "string" ? keys.p256dh : "";
  const auth = typeof keys?.auth === "string" ? keys.auth : "";
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json(
      { error: "endpoint and keys {p256dh, auth} are required." },
      { status: 400 },
    );
  }
  try {
    // Upsert on endpoint — if this browser was subscribed under a different
    // account, it now belongs to the current user.
    await upsertPushSubscription(user.userId, endpoint, p256dh, auth);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Couldn't save subscription." },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  try {
    if (body?.all === true) {
      // Remove every row on the account — the recovery path for devices that
      // were destroyed without unsubscribing (e.g. home-screen install
      // deleted): their endpoints are unreachable from the new install.
      await deleteAllPushSubscriptions(user.userId);
      return NextResponse.json({ ok: true });
    }
    const endpoint = typeof body?.endpoint === "string" ? body.endpoint : "";
    if (!endpoint) {
      return NextResponse.json(
        { error: "endpoint or all:true is required." },
        { status: 400 },
      );
    }
    await deletePushSubscription(endpoint, user.userId);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Couldn't remove subscription." },
      { status: 500 },
    );
  }
}
