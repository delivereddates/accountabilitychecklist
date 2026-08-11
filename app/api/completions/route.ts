import { NextResponse, type NextRequest } from "next/server";
import { clearCompletion, finalizeDay, getTaskUserId, setCompletion } from "@/lib/db";
import { jsonError } from "@/lib/api-helpers";
import type { CompletionStatus, TaskCompletion } from "@/lib/types";

const VALID_STATUSES: CompletionStatus[] = ["check", "no_check", "exempt"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Upsert a task's status for a date. Called on every 3-way toggle. */
export async function POST(req: NextRequest) {
  const { task_id, date, status } = await req.json().catch(() => ({}));

  if (typeof task_id !== "string" || typeof date !== "string") {
    return NextResponse.json(
      { error: "task_id and date are required." },
      { status: 400 },
    );
  }
  if (!DATE_RE.test(date)) {
    return NextResponse.json(
      { error: "date must be YYYY-MM-DD." },
      { status: 400 },
    );
  }
  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json(
      { error: "status must be check | no_check | exempt." },
      { status: 400 },
    );
  }

  try {
    const completion = await setCompletion(task_id, date, status);
    // Checking a task finalizes the day: mark the owner's other active tasks
    // (that have no row yet) as 'no_check'. Server resolves the user itself.
    let finalized: TaskCompletion[] = [];
    if (status === "check") {
      const userId = await getTaskUserId(task_id);
      if (userId) finalized = await finalizeDay(userId, date);
    }
    return NextResponse.json({ completion, finalized });
  } catch (e) {
    return jsonError(e);
  }
}

/** Remove a task's row for a date, returning it to "no data". */
export async function DELETE(req: NextRequest) {
  const url = new URL(req.url);
  const taskId = url.searchParams.get("task_id");
  const date = url.searchParams.get("date");

  if (typeof taskId !== "string" || typeof date !== "string") {
    return NextResponse.json(
      { error: "task_id and date are required." },
      { status: 400 },
    );
  }
  if (!DATE_RE.test(date)) {
    return NextResponse.json(
      { error: "date must be YYYY-MM-DD." },
      { status: 400 },
    );
  }

  try {
    await clearCompletion(taskId, date);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return jsonError(e);
  }
}
