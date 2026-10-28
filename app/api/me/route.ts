import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/auth-server";

/**
 * The session's userId, for the local-first pages: they cache it in
 * localStorage (lib/local/user-id.ts) so they can prerender statically
 * instead of awaiting currentUserId() in a server component per navigation.
 */
export async function GET() {
  const userId = await currentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  return NextResponse.json({ userId });
}
