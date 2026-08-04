import { cookies } from "next/headers";
import { getIronSession, type SessionOptions } from "iron-session";

export interface SessionData {
  isLoggedIn: boolean;
}

/**
 * iron-session config.
 * - cookieName matches the spec.
 * - password (>= 32 chars) encrypts the cookie.
 * - httpOnly + sameSite=lax; secure in production (requires HTTPS, e.g. Vercel).
 */
export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET!,
  cookieName: "checklist_session",
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  },
};

/**
 * Get the session for Server Components and Route Handlers (Node runtime).
 * In `middleware.ts` use `getIronSession(req, res, sessionOptions)` instead —
 * `next/headers` cookies() is not available there.
 */
export async function getSession(): Promise<
  Awaited<ReturnType<typeof getIronSession<SessionData>>>
> {
  const session = await getIronSession<SessionData>(
    await cookies(),
    sessionOptions,
  );
  if (!session.isLoggedIn) {
    session.isLoggedIn = false;
  }
  return session;
}
