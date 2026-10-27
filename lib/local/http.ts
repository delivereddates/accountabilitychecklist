/**
 * fetch with a few retries on transient (5xx / network) failures, ported from
 * the checklist's coordinator (lib/swr-mutations.ts): 4xx returned as-is,
 * 401 hard-navigates to /login (a full reload clears all client state).
 * Used only by the sync engine — mutations never touch the network.
 */
export async function fetchRetry(
  url: string,
  init: RequestInit,
  attempts = 4,
): Promise<Response> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, init);
      if (res.status === 401) {
        redirectOn401();
        throw new Error("unauthenticated");
      }
      if (res.ok || res.status < 500) return res;
      last = new Error(`HTTP ${res.status}`);
    } catch (e) {
      last = e;
    }
    await new Promise((r) => setTimeout(r, 250 * (i + 1)));
  }
  throw last instanceof Error ? last : new Error("request failed");
}

/** Hard-navigate to /login (same convention as the checklist coordinator). */
function redirectOn401() {
  if (typeof window === "undefined") return;
  const from = window.location.pathname + window.location.search;
  window.location.assign(
    "/login" + (from && from !== "/" ? `?from=${encodeURIComponent(from)}` : ""),
  );
}
