import { NextResponse, type NextRequest } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, type SessionData } from "@/lib/session";

/**
 * Gate every route except /login, the self-authenticating API routes
 * (/api/login, /api/logout, /api/cron/*), and static assets.
 * Requires a logged-in session WITH a userId (per-user auth) — cookies from
 * the old shared-password era lack it, so everyone re-logs in once.
 * API paths get a 401 JSON; pages redirect to /login (remembering the
 * intended destination in ?from= so we can return there after auth).
 */
export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const session = await getIronSession<SessionData>(req, res, sessionOptions);

  if (!session.isLoggedIn || !session.userId) {
    if (req.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    const from = req.nextUrl.pathname + req.nextUrl.search;
    url.pathname = "/login";
    url.search = "";
    if (from && from !== "/") {
      url.searchParams.set("from", from);
    }
    return NextResponse.redirect(url);
  }

  return res;
}

export const config = {
  matcher: [
    // Match everything except: /login, the auth/cron API routes, Next
    // internals, favicon, and the PWA/icon routes. Icons + manifest MUST be
    // reachable without auth — iOS/Android fetch them without session cookies
    // when adding to the home screen, and a redirect to /login serves HTML
    // where a PNG is expected (the broken-home-screen-icon bug). Every other
    // /api route IS matched (guarded above) so the API isn't publicly
    // readable/writable.
    "/((?!api/login|api/logout|api/cron|login|_next/static|_next/image|favicon.ico|icon|apple-icon|apple-touch-icon|manifest|.*\\..*).*)",
  ],
};
