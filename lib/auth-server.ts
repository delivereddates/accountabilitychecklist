import "server-only";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, type SessionData } from "./session";

/**
 * Read the logged-in user from a Server Component / server action (the
 * `next/headers` cookie store). Middleware has already gated the page, so a
 * missing session here is exceptional — the null return keeps callers simple.
 */
export async function currentUserId(): Promise<string | null> {
  const session = await getIronSession<SessionData>(
    await cookies(),
    sessionOptions,
  );
  if (!session.isLoggedIn || !session.userId) return null;
  return session.userId;
}
