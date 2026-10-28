import { getDb } from "./db";
import { newId, nowMs } from "./id";
import { wouldCreateCycle } from "./graph";
import { schedulePush } from "./sync";
import type {
  EventRecord,
  FolderRecord,
  NoteRecord,
  TableName,
  TodoRecord,
} from "./types";

/**
 * The write API for the productivity sections. Every mutation is ONE IndexedDB
 * transaction that writes the record AND its outbox entry atomically, then
 * schedules a background push. Nothing here touches the network — the UI path
 * is always instant.
 */

/** Thrown when a blocker change would create a dependency loop. */
export class CycleError extends Error {
  constructor() {
    super("That blocker would create a loop.");
    this.name = "CycleError";
  }
}

const EMPTY_DOC = { type: "doc", content: [{ type: "paragraph" }] };

/** Queue a record for push (must run inside an open rw transaction). */
async function queue(tx: {
  outbox: OutboxTable;
}, table: TableName, recordId: string): Promise<void> {
  await tx.outbox.put({
    id: `${table}:${recordId}`,
    table,
    recordId,
    queuedAt: nowMs(),
  });
}

// Dexie's Table type for the outbox, named for brevity in helper signatures.
type OutboxTable = ProductivityDbShape["outbox"];
type ProductivityDbShape = ReturnType<typeof getDb>;

// ---------------------------------------------------------------------------
// Todos
// ---------------------------------------------------------------------------

export async function createTodo(
  userId: string,
  input: { text: string; date?: string | null; blockerId?: string | null },
): Promise<string> {
  const db = getDb();
  const id = newId();
  const now = nowMs();
  // A brand-new todo has no children, so it can never close a cycle — no
  // cycle check needed here (self-reference is impossible: fresh uuid).
  const record: TodoRecord = {
    id,
    userId,
    text: input.text,
    completed: false,
    completedAt: null,
    date: input.date ?? null,
    blockerId: input.blockerId ?? null,
    sortOrder: 0,
    createdAt: now,
    updatedAt: now,
    deleted: false,
  };
  await db.transaction("rw", db.todos, db.outbox, async () => {
    await db.todos.put(record);
    await queue(db, "todos", id);
  });
  schedulePush();
  return id;
}

export type TodoPatch = Partial<
  Pick<TodoRecord, "text" | "date" | "blockerId" | "sortOrder">
>;

export async function updateTodo(id: string, patch: TodoPatch): Promise<void> {
  const db = getDb();
  await db.transaction("rw", db.todos, db.outbox, async () => {
    const cur = await db.todos.get(id);
    if (!cur || cur.deleted) return;
    if (patch.blockerId !== undefined && patch.blockerId !== cur.blockerId) {
      const all = await db.todos.where("userId").equals(cur.userId).toArray();
      const byId = new Map(
        all.filter((t) => !t.deleted).map((t) => [t.id, t] as const),
      );
      if (wouldCreateCycle(byId, id, patch.blockerId)) throw new CycleError();
    }
    await db.todos.put({ ...cur, ...patch, updatedAt: nowMs() });
    await queue(db, "todos", id);
  });
  schedulePush();
}

export async function toggleTodo(id: string): Promise<void> {
  const db = getDb();
  const now = nowMs();
  await db.transaction("rw", db.todos, db.outbox, async () => {
    const cur = await db.todos.get(id);
    if (!cur || cur.deleted) return;
    const completed = !cur.completed;
    await db.todos.put({
      ...cur,
      completed,
      completedAt: completed ? now : null,
      updatedAt: now,
    });
    await queue(db, "todos", id);
  });
  schedulePush();
}

/**
 * Soft-delete a todo and, in the same transaction, detach direct children
 * (their blockerId → null) so nothing points at a tombstone.
 */
export async function deleteTodo(id: string): Promise<void> {
  const db = getDb();
  const now = nowMs();
  await db.transaction("rw", db.todos, db.outbox, async () => {
    const cur = await db.todos.get(id);
    if (!cur) return;
    await db.todos.put({ ...cur, deleted: true, updatedAt: now });
    await queue(db, "todos", id);
    const children = await db.todos
      .filter((t) => t.blockerId === id && !t.deleted)
      .toArray();
    for (const c of children) {
      await db.todos.put({ ...c, blockerId: null, updatedAt: now });
      await queue(db, "todos", c.id);
    }
  });
  schedulePush();
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export type EventInput = {
  title: string;
  date: string; // YYYY-MM-DD
  allDay: boolean;
  startMin?: number | null;
  endMin?: number | null;
  location?: string | null;
  description?: string;
};

export async function createEvent(
  userId: string,
  input: EventInput,
): Promise<string> {
  const db = getDb();
  const id = newId();
  const now = nowMs();
  const record: EventRecord = {
    id,
    userId,
    title: input.title,
    description: input.description ?? "",
    date: input.date,
    allDay: input.allDay,
    startMin: input.allDay ? null : (input.startMin ?? null),
    endMin: input.allDay ? null : (input.endMin ?? null),
    location: input.location ?? null,
    source: "manual",
    externalId: null,
    createdAt: now,
    updatedAt: now,
    deleted: false,
  };
  await db.transaction("rw", db.events, db.outbox, async () => {
    await db.events.put(record);
    await queue(db, "events", id);
  });
  schedulePush();
  return id;
}

export type EventPatch = Partial<
  Pick<
    EventRecord,
    "title" | "description" | "date" | "allDay" | "startMin" | "endMin" | "location"
  >
>;

export async function updateEvent(id: string, patch: EventPatch): Promise<void> {
  const db = getDb();
  await db.transaction("rw", db.events, db.outbox, async () => {
    const cur = await db.events.get(id);
    if (!cur || cur.deleted) return;
    await db.events.put({ ...cur, ...patch, updatedAt: nowMs() });
    await queue(db, "events", id);
  });
  schedulePush();
}

export async function deleteEvent(id: string): Promise<void> {
  const db = getDb();
  const now = nowMs();
  await db.transaction("rw", db.events, db.outbox, async () => {
    const cur = await db.events.get(id);
    if (!cur) return;
    await db.events.put({ ...cur, deleted: true, updatedAt: now });
    await queue(db, "events", id);
  });
  schedulePush();
}

/** Copy an event to the next day with a fresh id (the "duplicate" button). */
export async function duplicateEvent(id: string): Promise<string | null> {
  const db = getDb();
  const src = await db.events.get(id);
  if (!src || src.deleted) return null;
  const newId_ = newId();
  const now = nowMs();
  const nextDate = new Date(
    Number(src.date.slice(0, 4)),
    Number(src.date.slice(5, 7)) - 1,
    Number(src.date.slice(8, 10)) + 1,
  );
  const yyyy = nextDate.getFullYear();
  const mm = String(nextDate.getMonth() + 1).padStart(2, "0");
  const dd = String(nextDate.getDate()).padStart(2, "0");
  const copy: EventRecord = {
    ...src,
    id: newId_,
    date: `${yyyy}-${mm}-${dd}`,
    createdAt: now,
    updatedAt: now,
    deleted: false,
  };
  await db.transaction("rw", db.events, db.outbox, async () => {
    await db.events.put(copy);
    await queue(db, "events", newId_);
  });
  schedulePush();
  return newId_;
}

// ---------------------------------------------------------------------------
// Folders
// ---------------------------------------------------------------------------

export async function createFolder(
  userId: string,
  name: string,
  parentId: string | null = null,
): Promise<string> {
  const db = getDb();
  const id = newId();
  const now = nowMs();
  const record: FolderRecord = {
    id,
    userId,
    name,
    parentId,
    sortOrder: 0,
    createdAt: now,
    updatedAt: now,
    deleted: false,
  };
  await db.transaction("rw", db.folders, db.outbox, async () => {
    await db.folders.put(record);
    await queue(db, "folders", id);
  });
  schedulePush();
  return id;
}

export async function renameFolder(id: string, name: string): Promise<void> {
  const db = getDb();
  await db.transaction("rw", db.folders, db.outbox, async () => {
    const cur = await db.folders.get(id);
    if (!cur || cur.deleted) return;
    await db.folders.put({ ...cur, name, updatedAt: nowMs() });
    await queue(db, "folders", id);
  });
  schedulePush();
}

/**
 * Soft-delete a folder in one transaction: its notes become unfiled and its
 * subfolders move up to the deleted folder's parent — nothing is lost.
 */
export async function deleteFolder(id: string): Promise<void> {
  const db = getDb();
  const now = nowMs();
  await db.transaction("rw", db.folders, db.notes, db.outbox, async () => {
    const cur = await db.folders.get(id);
    if (!cur) return;
    await db.folders.put({ ...cur, deleted: true, updatedAt: now });
    await queue(db, "folders", id);
    const children = await db.folders
      .filter((f) => f.parentId === id && !f.deleted)
      .toArray();
    for (const c of children) {
      await db.folders.put({ ...c, parentId: cur.parentId, updatedAt: now });
      await queue(db, "folders", c.id);
    }
    const notes = await db.notes
      .filter((n) => n.folderId === id && !n.deleted)
      .toArray();
    for (const n of notes) {
      await db.notes.put({ ...n, folderId: null, updatedAt: now });
      await queue(db, "notes", n.id);
    }
  });
  schedulePush();
}

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------

export async function createNote(
  userId: string,
  folderId: string | null = null,
): Promise<string> {
  const db = getDb();
  const id = newId();
  const now = nowMs();
  const record: NoteRecord = {
    id,
    userId,
    folderId,
    title: "",
    content: EMPTY_DOC,
    date: null,
    createdAt: now,
    updatedAt: now,
    deleted: false,
  };
  await db.transaction("rw", db.notes, db.outbox, async () => {
    await db.notes.put(record);
    await queue(db, "notes", id);
  });
  schedulePush();
  return id;
}

export type NotePatch = Partial<
  Pick<NoteRecord, "title" | "content" | "folderId" | "date">
>;

export async function updateNote(id: string, patch: NotePatch): Promise<void> {
  const db = getDb();
  await db.transaction("rw", db.notes, db.outbox, async () => {
    const cur = await db.notes.get(id);
    if (!cur || cur.deleted) return;
    await db.notes.put({ ...cur, ...patch, updatedAt: nowMs() });
    await queue(db, "notes", id);
  });
  schedulePush();
}

export async function deleteNote(id: string): Promise<void> {
  const db = getDb();
  const now = nowMs();
  await db.transaction("rw", db.notes, db.outbox, async () => {
    const cur = await db.notes.get(id);
    if (!cur) return;
    await db.notes.put({ ...cur, deleted: true, updatedAt: now });
    await queue(db, "notes", id);
  });
  schedulePush();
}
