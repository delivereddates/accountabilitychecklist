// Local-first record types for the productivity sections (todos / calendar /
// notes). This shape is the wire format too — /api/sync/* pass these records
// through unchanged; only lib/db.ts maps them to snake_case Postgres rows.
//
// Conventions:
//   id         — crypto.randomUUID(), generated client-side
//   updatedAt  — CLIENT clock (ms epoch); the last-write-wins arbiter
//   deleted    — soft-delete tombstone (tombstones sync, rows never vanish
//                mid-flight on another device)
//   dates      — local "YYYY-MM-DD" strings (lib/utils.ts toISODate)
//   times      — minutes from midnight (no timezone serialization anywhere)

export interface BaseRecord {
  id: string;
  userId: string;
  createdAt: number;
  updatedAt: number;
  deleted: boolean;
}

export interface TodoRecord extends BaseRecord {
  text: string;
  completed: boolean;
  completedAt: number | null;
  /** Optional due date ("YYYY-MM-DD"); dated todos appear in the unified feed. */
  date: string | null;
  /** Single blocker: this todo depends on that todo. No FK — see plan. */
  blockerId: string | null;
  sortOrder: number;
}

export interface EventRecord extends BaseRecord {
  title: string;
  description: string;
  date: string; // "YYYY-MM-DD" (single-day events)
  allDay: boolean;
  startMin: number | null; // 0–1439; null when allDay
  endMin: number | null;
  location: string | null;
  /** "manual" today; future importers use "gmail" | "whatsapp" | "instagram". */
  source: string;
  /** Dedup key from the external system (null for manual events). */
  externalId: string | null;
}

export interface FolderRecord extends BaseRecord {
  name: string;
  /** Parent folder id — folders nest in the sidebar. No FK (see blockerId). */
  parentId: string | null;
  sortOrder: number;
}

export interface NoteRecord extends BaseRecord {
  folderId: string | null;
  title: string;
  /** Tiptap JSON document (editor.getJSON()); passthrough outside the editor. */
  content: unknown;
  /** Optional date; dated notes appear in the unified feed. */
  date: string | null;
}

export type TableName = "todos" | "events" | "notes" | "folders";

export type AnyRecord = TodoRecord | EventRecord | NoteRecord | FolderRecord;

/** Body of POST /api/sync/push (one batch of current row states). */
export interface SyncChanges {
  todos: TodoRecord[];
  events: EventRecord[];
  notes: NoteRecord[];
  folders: FolderRecord[];
}

/** Body of GET /api/sync/pull. */
export interface SyncPullResponse {
  cursor: number; // server ms epoch to use as the next `since`
  todos: TodoRecord[];
  events: EventRecord[];
  notes: NoteRecord[];
  folders: FolderRecord[];
}

export const EMPTY_CHANGES: SyncChanges = {
  todos: [],
  events: [],
  notes: [],
  folders: [],
};

/** Outbox row: one per dirty record. id = `${table}:${recordId}` so repeated
 *  edits of the same record collapse into a single pending entry. */
export interface OutboxEntry {
  id: string;
  table: TableName;
  recordId: string;
  queuedAt: number;
}
