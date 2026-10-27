import { NextResponse, type NextRequest } from "next/server";
import { pushLocalRecords } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { jsonError } from "@/lib/api-helpers";
import { EMPTY_CHANGES, type BaseRecord, type SyncChanges } from "@/lib/local/types";

// Hard cap per table per request — the client's sync engine batches at 200;
// anything larger is rejected rather than trusted.
const MAX_PER_TABLE = 200;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validate one batch of records against the session user. Returns an error
 * message or null. The RPC ignores the client-supplied userId anyway; this
 * check exists so a buggy client fails loudly (400) instead of silently
 * mis-attributing rows.
 */
function validateChanges(
  changes: Partial<SyncChanges>,
  userId: string,
): string | null {
  for (const table of ["todos", "events", "notes", "folders"] as const) {
    const rows = changes[table];
    if (rows === undefined) continue;
    if (!Array.isArray(rows)) return `${table}: expected an array.`;
    if (rows.length > MAX_PER_TABLE)
      return `${table}: too many records (${rows.length} > ${MAX_PER_TABLE}).`;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i] as Partial<BaseRecord> & { date?: unknown };
      const at = `${table}[${i}]`;
      if (typeof r.id !== "string" || !UUID_RE.test(r.id))
        return `${at}: id must be a uuid.`;
      if (r.userId !== userId)
        return `${at}: userId does not match the session user.`;
      if (typeof r.createdAt !== "number" || typeof r.updatedAt !== "number")
        return `${at}: createdAt/updatedAt must be numbers.`;
      if (typeof r.deleted !== "boolean")
        return `${at}: deleted must be a boolean.`;
      if (table === "events" && (typeof r.date !== "string" || !r.date))
        return `${at}: events require a date.`;
    }
  }
  return null;
}

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const changes = body?.changes as Partial<SyncChanges> | undefined;
  if (!changes) {
    return NextResponse.json(
      { error: "Body must be { changes: { todos, events, notes, folders } }." },
      { status: 400 },
    );
  }
  const invalid = validateChanges(changes, user.userId);
  if (invalid) {
    return NextResponse.json({ error: invalid }, { status: 400 });
  }
  try {
    await pushLocalRecords(user.userId, {
      todos: changes.todos ?? EMPTY_CHANGES.todos,
      events: changes.events ?? EMPTY_CHANGES.events,
      notes: changes.notes ?? EMPTY_CHANGES.notes,
      folders: changes.folders ?? EMPTY_CHANGES.folders,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return jsonError(e);
  }
}
