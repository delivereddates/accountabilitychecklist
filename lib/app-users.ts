import "server-only";

/**
 * Admin-managed accounts. The whole user list lives in one env var (set in
 * Vercel → Settings → Environment Variables):
 *
 *   APP_USERS=[{"username":"oliver","password":"...","name":"Oliver"}, ...]
 *
 * There is deliberately no in-app account management or validation — the
 * administrator edits this variable and redeploys. `name` maps an account to
 * its row in the users table (auto-created on first login).
 */

export interface AppUser {
  username: string;
  password: string;
  name: string;
}

export class AppUsersError extends Error {}

export function getAppUsers(): AppUser[] {
  const raw = process.env.APP_USERS;
  if (!raw) {
    throw new AppUsersError(
      "APP_USERS is not configured. Add it under Vercel → Settings → " +
        "Environment Variables as a JSON array of " +
        '{username, password, name} objects and redeploy.',
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new AppUsersError("APP_USERS is set but is not valid JSON.");
  }
  if (
    !Array.isArray(parsed) ||
    !parsed.every(
      (u): u is AppUser =>
        typeof u === "object" &&
        u !== null &&
        typeof (u as AppUser).username === "string" &&
        typeof (u as AppUser).password === "string" &&
        typeof (u as AppUser).name === "string",
    )
  ) {
    throw new AppUsersError(
      'APP_USERS must be a JSON array of {username, password, name} objects.',
    );
  }
  return parsed;
}

/** Exact-match lookup of an account by username + password. */
export function findAppUser(
  username: string,
  password: string,
): AppUser | null {
  for (const u of getAppUsers()) {
    if (u.username === username && u.password === password) return u;
  }
  return null;
}
