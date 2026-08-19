import { NextResponse, type NextRequest } from "next/server";
import { clearCompletion, getTaskById, setCompletion } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { jsonError } from "@/lib/api-helpers";
import type { CompletionStatus } from "@/lib/types";

const VALID_STATUSES: CompletionStatus[] = ["check", "no_check", "exempt"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Load the task and confirm the session user owns it, else respond. */
async function guard(
  req: NextRequest,
  taskId: string,
): Promise<{ ok: true } | { ok: false; res: NextResponse }> {
  const user = await requireUser(req);
  if (!user) {
    return {
      ok: false,
      res: NextResponse.json({ error: "Not authenticated." }, { status: 401 }),
    };
  }
  const task = await getTaskById(taskId);
  if (!task || task.user_id !== user.userId) {
    // 404 (not 403) so other users' task ids aren't enumerable.
    return {
      ok: false,
      res: NextResponse.json({ error: "Task not found." }, { status: 404 }),
    };
  }
  return { ok: true };
}

/** Upsert a task's status for a date. Called on every 3-way toggle (debounced). */
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

  const g = await guard(req, task_id);
  if (!g.ok) return g.res;

  try {
    // The client is the source of truth; blanks are simply never sent.
    const completion = await setCompletion(task_id, date, status);
    return NextResponse.json({ completion });
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

  const g = await guard(req, taskId);
  if (!g.ok) return g.res;

  try {
    await clearCompletion(taskId, date);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return jsonError(e);
  }
}
