// Client-side cache of the logged-in user's id. The local-first pages
// (todos/calendar/notes) prerender statically and resolve their data scope
// here instead of awaiting currentUserId() in a server component — which
// made every route dynamic and every navbar tap a server round trip.
// /api/me (fetched once per load by useLocalUserId) keeps the cache honest,
// including after an account switch on the same device.

const UID_KEY = "productivity-user-id";
const listeners = new Set<() => void>();

export function readLocalUserId(): string | null {
  try {
    return localStorage.getItem(UID_KEY);
  } catch {
    return null;
  }
}

export function writeLocalUserId(uid: string): void {
  try {
    localStorage.setItem(UID_KEY, uid);
  } catch {
    // Private mode etc. — /api/me is simply re-asked next load.
  }
  for (const notify of listeners) notify();
}

/** Logout path: the next account must not inherit this id. */
export function clearLocalUserId(): void {
  try {
    localStorage.removeItem(UID_KEY);
  } catch {
    // Ignore.
  }
  for (const notify of listeners) notify();
}

export function subscribeLocalUserId(onChange: () => void): () => void {
  listeners.add(onChange);
  // Another tab on this device may log in/out.
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}
