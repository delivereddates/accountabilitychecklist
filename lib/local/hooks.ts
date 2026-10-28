"use client";

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useSyncExternalStore } from "react";
import { getDb } from "./db";
import { getSyncStatus, subscribeSyncStatus } from "./sync";
import type {
  EventRecord,
  FolderRecord,
  NoteRecord,
  TodoRecord,
} from "./types";

// Read hooks for the productivity sections. useLiveQuery re-renders on every
// local write AND on cross-tab writes (Dexie observability), which is what
// makes every mutation feel instant. Returns undefined until the first query
// resolves (a few ms) — callers render an empty state meanwhile.

export function useTodos(userId: string): TodoRecord[] | undefined {
  return useLiveQuery(async () => {
    const rows = await getDb().todos.where("userId").equals(userId).toArray();
    return rows.filter((t) => !t.deleted);
  }, [userId]);
}

export function useEvents(userId: string): EventRecord[] | undefined {
  return useLiveQuery(async () => {
    const rows = await getDb().events.where("userId").equals(userId).toArray();
    return rows.filter((e) => !e.deleted);
  }, [userId]);
}

export function useNotes(userId: string): NoteRecord[] | undefined {
  return useLiveQuery(async () => {
    const rows = await getDb().notes.where("userId").equals(userId).toArray();
    return rows.filter((n) => !n.deleted);
  }, [userId]);
}

export function useFolders(userId: string): FolderRecord[] | undefined {
  return useLiveQuery(async () => {
    const rows = await getDb().folders.where("userId").equals(userId).toArray();
    return rows.filter((f) => !f.deleted);
  }, [userId]);
}

export function useOutboxCount(): number {
  const count = useLiveQuery(() => getDb().outbox.count(), []);
  return count ?? 0;
}

export function useSyncStatus() {
  // Third arg = server snapshot: the navbar renders on statically-prerendered
  // pages (e.g. /year), where the module state is always fully idle.
  const status = useSyncExternalStore(
    subscribeSyncStatus,
    getSyncStatus,
    getSyncStatus,
  );
  const pending = useOutboxCount();
  return { ...status, pending };
}

/**
 * True until IndexedDB provably fails to open (iOS Safari private mode).
 * Components render an "offline storage unavailable" banner when false.
 */
export function useStorageAvailable(): boolean {
  const [ok, setOk] = useState(true);
  useEffect(() => {
    let alive = true;
    getDb()
      .open()
      .then(() => {
        if (alive) setOk(true);
      })
      .catch(() => {
        if (alive) setOk(false);
      });
    return () => {
      alive = false;
    };
  }, []);
  return ok;
}
