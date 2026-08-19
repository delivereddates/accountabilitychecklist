import { NextResponse, type NextRequest } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, type SessionData } from "@/lib/session";
import { findAppUser, getAppUsers, AppUsersError } from "@/lib/app-users";
import { getOrCreateUserByName, syncUsersWithAccounts } from "@/lib/db";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const username = typeof body?.username === "string" ? body.username : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!username || !password) {
    return NextResponse.json(
      { error: "Username and password are required." },
      { status: 400 },
    );
  }

  let account;
  try {
    account = findAppUser(username, password);
  } catch (e) {
    if (e instanceof AppUsersError) {
      return NextResponse.json({ error: e.message }, { status: 500 });
    }
    throw e;
  }
  // One generic message for unknown username OR wrong password.
  if (!account) {
    return NextResponse.json(
      { error: "Incorrect username or password." },
      { status: 401 },
    );
  }

  let user;
  try {
    // Reconcile the users table with APP_USERS first (creates rows for new
    // accounts, deletes rows for removed ones), then load this account's row.
    await syncUsersWithAccounts(getAppUsers().map((a) => a.name));
    user = await getOrCreateUserByName(account.name);
  } catch {
    return NextResponse.json(
      { error: "Couldn't reach the database. Try again." },
      { status: 500 },
    );
  }

  const res = NextResponse.json({
    ok: true,
    user: { id: user.id, name: user.name },
  });
  const session = await getIronSession<SessionData>(req, res, sessionOptions);
  session.isLoggedIn = true;
  session.userId = user.id;
  session.username = account.username;
  session.name = user.name;
  await session.save();
  return res;
}
