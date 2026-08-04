import { NextResponse, type NextRequest } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, type SessionData } from "@/lib/session";

/**
 * Gate every route except /login, /api/*, and static assets.
 * If the iron-session is not logged in, redirect to /login (remembering the
 * intended destination in ?from= so we can return there after auth).
 */
export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const session = await getIronSession<SessionData>(req, res, sessionOptions);

  if (!session.isLoggedIn) {
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
    // Match everything except: /login, /api/*, Next internals, favicon.
    "/((?!login|api|_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
