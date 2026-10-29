"use client";

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useSyncExternalStore } from "react";
import { getDb } from "./db";
import { getSyncStatus, subscribeSyncStatus } from "./sync";
import {
  readLocalUserId,
  subscribeLocalUserId,
  writeLocalUserId,
} from "./user-id";
import type {
  EventRecord,
  FolderRecord,
  NoteRecord,
  TodoRecord,
} from "./types";

// Read hooks for the productivity sections. useLiveQuery re-renders on every
// local write AND on cross-tab writes (Dexie observability), which is what
// makes every mutation feel instant. Returns undefined until the first query
// resolves (a few ms) — callers render an empty state meanwhile. The userId
// comes from useLocalUserId and may briefly be null on a cold device.

export function useTodos(userId: string | null): TodoRecord[] | undefined {
  return useLiveQuery(async () => {
    if (!userId) return [];
    const rows = await getDb().todos.where("userId").equals(userId).toArray();
    return rows.filter((t) => !t.deleted);
  }, [userId]);
}

export function useEvents(userId: string | null): EventRecord[] | undefined {
  return useLiveQuery(async () => {
    if (!userId) return [];
    const rows = await getDb().events.where("userId").equals(userId).toArray();
    return rows.filter((e) => !e.deleted);
  }, [userId]);
}

export function useNotes(userId: string | null): NoteRecord[] | undefined {
  return useLiveQuery(async () => {
    if (!userId) return [];
    const rows = await getDb().notes.where("userId").equals(userId).toArray();
    return rows.filter((n) => !n.deleted);
  }, [userId]);
}

export function useFolders(userId: string | null): FolderRecord[] | undefined {
  return useLiveQuery(async () => {
    if (!userId) return [];
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

// /api/me confirmation runs ONCE per document load. Every tab mounts
// useLocalUserId, but a single fetch heals the cache for all of them — and
// stops a network round trip from tagging along on every navigation.
let meCheck: Promise<void> | null = null;

function confirmUserIdOnce(): void {
  meCheck ??= fetch("/api/me")
    .then(async (res) => {
      if (!res.ok) return;
      const data = (await res.json().catch(() => null)) as {
        userId?: string;
      } | null;
      const id = data?.userId;
      if (id && id !== readLocalUserId()) writeLocalUserId(id);
    })
    .catch(() => {
      meCheck = null; // offline — a later mount retries
    });
}

/**
 * The logged-in user's id, client-side. Served from the localStorage cache
 * (instant on every load after the first) and confirmed against /api/me on
 * mount, which also self-heals the cache after an account switch. null
 * until known — callers render a loading state meanwhile. The server
 * snapshot is null so hydration matches the prerendered page (same pattern
 * as useSyncStatus).
 */
export function useLocalUserId(): string | null {
  const uid = useSyncExternalStore(
    subscribeLocalUserId,
    readLocalUserId,
    () => null,
  );
  useEffect(() => {
    confirmUserIdOnce();
  }, []);
  return uid;
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
