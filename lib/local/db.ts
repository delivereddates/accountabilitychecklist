import Dexie, { type Table } from "dexie";
import type {
  EventRecord,
  FolderRecord,
  NoteRecord,
  OutboxEntry,
  TodoRecord,
} from "./types";

export interface MetaEntry {
  key: string;
  value: unknown;
}

/**
 * The local database for the productivity sections (todos / calendar / notes).
 * The checklist sections never touch IndexedDB — they keep their SWR flow.
 *
 * Index choices: `deleted` is deliberately unindexed (Dexie skips null/false
 * nuances across versions; datasets are small, so hooks filter in the
 * querier). `blockerId`/`folderId`/`date` on todos/notes are unindexed for
 * the same reason; events carry `[userId+date]` for the calendar day query.
 */
export class ProductivityDb extends Dexie {
  todos!: Table<TodoRecord, string>;
  events!: Table<EventRecord, string>;
  notes!: Table<NoteRecord, string>;
  folders!: Table<FolderRecord, string>;
  outbox!: Table<OutboxEntry, string>;
  meta!: Table<MetaEntry, string>;

  constructor() {
    super("productivity");
    this.version(1).stores({
      todos: "id, userId, updatedAt",
      events: "id, userId, updatedAt, [userId+date]",
      notes: "id, userId, updatedAt",
      folders: "id, userId, updatedAt",
      outbox: "id, queuedAt",
      meta: "key",
    });
  }
}

let _db: ProductivityDb | null = null;

/**
 * Lazy, browser-only singleton. "use client" modules still get SSR'd, so
 * never construct Dexie at module scope. Throws when IndexedDB is missing
 * (SSR, or iOS Safari private mode) — callers surface that as a banner.
 */
export function getDb(): ProductivityDb {
  if (typeof indexedDB === "undefined") {
    throw new Error("IndexedDB unavailable in this environment");
  }
  if (!_db) _db = new ProductivityDb();
  return _db;
}

/** The tables that hold synced records (outbox/meta are engine-internal). */
export const RECORD_TABLES = ["todos", "events", "notes", "folders"] as const;
