import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, type SessionData } from "./session";

export interface SessionUser {
  userId: string;
  username: string | null;
  name: string;
}

/**
 * Read the logged-in user in a Node-runtime route handler.
 * Returns null when unauthenticated (middleware normally screens this out
 * already; routes that are excluded from the matcher check for themselves).
 */
export async function requireUser(req: NextRequest): Promise<SessionUser | null> {
  // Reading only parses the request's cookie header; the throwaway response
  // carrier is never returned, so a (never-called) save() would be discarded.
  const session = await getIronSession<SessionData>(
    req,
    new NextResponse(null),
    sessionOptions,
  );
  if (!session.isLoggedIn || !session.userId) return null;
  return {
    userId: session.userId,
    username: session.username ?? null,
    name: session.name ?? "",
  };
}
