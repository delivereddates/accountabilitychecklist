import type { SessionOptions } from "iron-session";

export interface SessionData {
  isLoggedIn: boolean;
  /** The DB users.id of the logged-in person (absent on pre-migration cookies). */
  userId?: string;
  /** The APP_USERS username they logged in with. */
  username?: string | null;
  /** Their display name (users.name). */
  name?: string;
}

/**
 * iron-session requires a password of at least 32 characters. If it is missing
 * (e.g. not set in the Vercel environment), throw a descriptive error instead
 * of letting iron-session fail opaquely inside middleware.
 *
 * NOTE: keep this module free of `next/headers` and other server-only imports —
 * it is imported by `middleware.ts`, which runs on the Edge Runtime.
 */
function readSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "SESSION_SECRET is missing or shorter than 32 characters. " +
        "Add it under Vercel → Settings → Environment Variables (Production) " +
        "and redeploy.",
    );
  }
  return secret;
}

export const sessionOptions: SessionOptions = {
  password: readSessionSecret(),
  cookieName: "checklist_session",
  // `ttl` is how long the encrypted seal itself stays valid — it is separate
  // from the cookie's maxAge and defaults to only 14 days, which used to log
  // people out despite the 1-year cookie. Keep both at 1 year.
  ttl: 60 * 60 * 24 * 365,
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 year — stay logged in
  },
};
