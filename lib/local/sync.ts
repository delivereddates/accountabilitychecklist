import { getDb, type ProductivityDb } from "./db";
import { fetchRetry } from "./http";
import type { BaseRecord, SyncChanges, SyncPullResponse, TableName } from "./types";

/**
 * Background sync engine. Outbox pattern with last-write-wins:
 *
 *  - PUSH sends the CURRENT row state for every pending record (not a frozen
 *    op), so repeated edits collapse into one push and re-pushes are
 *    idempotent under LWW.
 *  - PULL walks a server-clock cursor (`synced_at`), never client clocks.
 *    Merge rule per remote row: apply iff no local row, strictly newer
 *    updatedAt, or equal updatedAt with nothing unacknowledged locally.
 *  - Failures leave the outbox untouched (it persists in IndexedDB across
 *    reloads) and retry with backoff.
 *
 * Deliberately React-free; hooks live in ./hooks.
 */

const PUSH_DEBOUNCE_MS = 300;
const PUSH_BATCH = 200;
const PULL_PAGE = 500;
const BACKOFF_START_MS = 1_000;
const BACKOFF_MAX_MS = 60_000;
const VISIBLE_PULL_INTERVAL_MS = 15_000;

let pushTimer: ReturnType<typeof setTimeout> | null = null;
let pushing = false;
let pulling = false;
let backoffMs = BACKOFF_START_MS;
let backoffTimer: ReturnType<typeof setTimeout> | null = null;
let lastError: string | null = null;

// --- status snapshot for useSyncStatus (referentially stable) --------------

export interface SyncStatus {
  pushing: boolean;
  pulling: boolean;
  error: string | null;
}

let snapshot: SyncStatus = { pushing: false, pulling: false, error: null };
const listeners = new Set<() => void>();

function notify() {
  snapshot = { pushing, pulling, error: lastError };
  for (const fn of listeners) fn();
}

export function subscribeSyncStatus(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function getSyncStatus(): SyncStatus {
  return snapshot;
}

// --- push --------------------------------------------------------------------

/** Debounced push trigger — called by every mutation. */
export function schedulePush(): void {
  if (typeof window === "undefined") return;
  if (pushTimer !== null) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    void pushOnce();
  }, PUSH_DEBOUNCE_MS);
}

/** Immediate best-effort flush (cancels any pending debounce). */
export async function flushNow(): Promise<void> {
  if (pushTimer !== null) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
  await pushOnce();
}

export async function pushOnce(): Promise<void> {
  if (typeof window === "undefined") return;
  if (!navigator.onLine || pushing) return;
  const db = getDb();
  if ((await db.outbox.count()) === 0) return;
  pushing = true;
  notify();
  try {
    // Keep draining while records remain (or mutations keep arriving).
    for (let rounds = 0; rounds < 50; rounds++) {
      const entries = await db.outbox.orderBy("queuedAt").limit(PUSH_BATCH).toArray();
      if (entries.length === 0) break;
      const changes = await buildBatch(db, entries);
      const res = await fetchRetry("/api/sync/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ changes }),
      });
      if (!res.ok) throw new Error(`push failed (HTTP ${res.status})`);
      await db.outbox.bulkDelete(entries.map((e) => e.id));
      if ((await db.outbox.count()) === 0) break;
    }
    lastError = null;
    backoffMs = BACKOFF_START_MS;
    notify();
    await pullOnce(); // server may hold rows from another device
  } catch (e) {
    lastError = e instanceof Error ? e.message : "push failed";
    scheduleBackoff();
  } finally {
    pushing = false;
    notify();
  }
}

/** Group outbox entries into their records' CURRENT states. */
async function buildBatch(
  db: ProductivityDb,
  entries: { table: TableName; recordId: string }[],
): Promise<SyncChanges> {
  const ids: Record<TableName, string[]> = {
    todos: [],
    events: [],
    notes: [],
    folders: [],
  };
  for (const e of entries) ids[e.table].push(e.recordId);
  const [todos, events, notes, folders] = await Promise.all([
    db.todos.bulkGet(ids.todos),
    db.events.bulkGet(ids.events),
    db.notes.bulkGet(ids.notes),
    db.folders.bulkGet(ids.folders),
  ]);
  return {
    todos: todos.filter(Boolean) as SyncChanges["todos"],
    events: events.filter(Boolean) as SyncChanges["events"],
    notes: notes.filter(Boolean) as SyncChanges["notes"],
    folders: folders.filter(Boolean) as SyncChanges["folders"],
  };
}

function scheduleBackoff() {
  if (backoffTimer !== null) return; // one retry in flight is enough
  backoffTimer = setTimeout(() => {
    backoffTimer = null;
    void pushOnce();
  }, backoffMs);
  backoffMs = Math.min(backoffMs * 2, BACKOFF_MAX_MS);
}

// --- pull --------------------------------------------------------------------

export async function pullOnce(): Promise<void> {
  if (typeof window === "undefined") return;
  if (!navigator.onLine || pulling) return;
  const db = getDb();
  pulling = true;
  notify();
  try {
    let cursor =
      ((await db.meta.get("pullCursor"))?.value as number | undefined) ?? 0;
    // Page until no table fills its page (server caps at PULL_PAGE).
    for (let pages = 0; pages < 50; pages++) {
      const res = await fetchRetry(`/api/sync/pull?since=${cursor}`, {
        method: "GET",
      });
      if (!res.ok) throw new Error(`pull failed (HTTP ${res.status})`);
      const data = (await res.json()) as SyncPullResponse;
      await mergeRemote(db, data);
      cursor = data.cursor;
      await db.meta.put({ key: "pullCursor", value: cursor });
      const full =
        data.todos.length >= PULL_PAGE ||
        data.events.length >= PULL_PAGE ||
        data.notes.length >= PULL_PAGE ||
        data.folders.length >= PULL_PAGE;
      if (!full) break;
    }
    lastError = null;
  } catch (e) {
    // Pull failures are quiet: local data stays usable; the next trigger
    // (visibility/online/interval) retries.
    lastError = e instanceof Error ? e.message : "pull failed";
  } finally {
    pulling = false;
    notify();
  }
}

/**
 * Idempotent LWW merge per table. A pending local edit (still in the outbox)
 * is never clobbered by an equal-timestamp remote row; it converges after its
 * push is acknowledged and the next pull re-delivers the row.
 */
async function mergeRemote(db: ProductivityDb, data: SyncPullResponse) {
  await mergeTable(db, "todos", data.todos as BaseRecord[]);
  await mergeTable(db, "events", data.events as BaseRecord[]);
  await mergeTable(db, "notes", data.notes as BaseRecord[]);
  await mergeTable(db, "folders", data.folders as BaseRecord[]);
}

async function mergeTable(
  db: ProductivityDb,
  name: TableName,
  rows: BaseRecord[],
) {
  if (rows.length === 0) return;
  const table = db.table(name);
  await db.transaction("rw", table, db.outbox, async () => {
    const pending = new Set(
      (await db.outbox.where("id").startsWith(`${name}:`).toArray()).map(
        (e) => e.recordId,
      ),
    );
    for (const r of rows) {
      const local = await table.get(r.id);
      const apply =
        !local ||
        r.updatedAt > local.updatedAt ||
        (r.updatedAt === local.updatedAt && !pending.has(r.id));
      if (apply) await table.put(r);
    }
  });
}

// --- engine lifecycle ---------------------------------------------------------

/**
 * Wire up all sync triggers. Returns a cleanup function. Called once per
 * document load by <LocalSyncEngine />.
 */
export function startSyncEngine(): () => void {
  if (typeof window === "undefined") return () => {};
  void pullOnce(); // local data already renders via useLiveQuery

  const sync = () => {
    if (document.visibilityState === "visible") {
      void pushOnce();
      void pullOnce();
    }
  };
  // Devices that never changed visibility — a browser tab that stayed
  // focused while the user edited on the phone, a foregrounded app — only
  // heard from the interval before, which made a 10-second cross-check look
  // like sync was dead. pageshow + focus fire on arrival/resume (iOS
  // standalone apps don't reliably send visibilitychange), and hiding
  // flushes pending pushes before iOS suspends the page's timers.
  const onVisible = () => {
    if (document.visibilityState === "visible") sync();
    else void flushNow();
  };
  const onPageHide = () => void flushNow();
  const onOnline = () => {
    backoffMs = BACKOFF_START_MS;
    sync();
  };
  const onInterval = () => {
    if (document.visibilityState === "visible") void pullOnce();
  };

  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("pageshow", sync);
  window.addEventListener("focus", sync);
  window.addEventListener("pagehide", onPageHide);
  window.addEventListener("online", onOnline);
  const interval = setInterval(onInterval, VISIBLE_PULL_INTERVAL_MS);
  return () => {
    document.removeEventListener("visibilitychange", onVisible);
    window.removeEventListener("pageshow", sync);
    window.removeEventListener("focus", sync);
    window.removeEventListener("pagehide", onPageHide);
    window.removeEventListener("online", onOnline);
    clearInterval(interval);
    if (pushTimer !== null) clearTimeout(pushTimer);
    if (backoffTimer !== null) clearTimeout(backoffTimer);
    pushTimer = null;
    backoffTimer = null;
  };
}
