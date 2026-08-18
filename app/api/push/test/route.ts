import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { sendToUser } from "@/lib/push";

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  try {
    const sent = await sendToUser(user.userId, {
      title: "Test notification",
      body: "Push notifications are working — this is what they'll look like.",
    });
    return NextResponse.json({ ok: true, sent });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Couldn't send test notification.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
