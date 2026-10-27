import { getDb } from "./db";
import { flushNow } from "./sync";

/**
 * Wipe all local-first data (called on logout, right after the checklist's
 * resetCoordinator()). Best-effort final flush first — bounded to 2s so the
 * logout button never hangs — then everything is cleared. If the flush is
 * skipped, rows are still userId-scoped and the next user's hooks filter by
 * their own id, so nothing from the previous account is ever visible.
 */
export async function resetLocalData(): Promise<void> {
  try {
    await Promise.race([
      flushNow(),
      new Promise((resolve) => setTimeout(resolve, 2000)),
    ]);
  } catch {
    // Offline or failed — proceed with the wipe regardless.
  }
  try {
    const db = getDb();
    await db.transaction(
      "rw",
      [db.todos, db.events, db.notes, db.folders, db.outbox, db.meta],
      () =>
        Promise.all([
          db.todos.clear(),
          db.events.clear(),
          db.notes.clear(),
          db.folders.clear(),
          db.outbox.clear(),
          db.meta.clear(),
        ]),
    );
  } catch {
    // Storage unavailable (private mode) — nothing to clear.
  }
}
