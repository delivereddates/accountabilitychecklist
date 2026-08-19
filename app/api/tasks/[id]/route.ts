import { NextResponse, type NextRequest } from "next/server";
import { deleteTask, getTaskById, updateTask } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { jsonError } from "@/lib/api-helpers";

/** Load the task and confirm the session user owns it, else respond. */
async function ownedTask(
  req: NextRequest,
  id: string,
): Promise<
  { ok: true; userId: string } | { ok: false; res: NextResponse }
> {
  const user = await requireUser(req);
  if (!user) {
    return {
      ok: false,
      res: NextResponse.json({ error: "Not authenticated." }, { status: 401 }),
    };
  }
  const task = await getTaskById(id);
  if (!task || task.user_id !== user.userId) {
    // 404 (not 403) so other users' task ids aren't enumerable.
    return {
      ok: false,
      res: NextResponse.json({ error: "Task not found." }, { status: 404 }),
    };
  }
  return { ok: true, userId: user.userId };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const own = await ownedTask(req, id);
  if (!own.ok) return own.res;
  const { title } = await req.json().catch(() => ({}));
  if (typeof title !== "string" || !title.trim()) {
    return NextResponse.json(
      { error: "A non-empty title is required." },
      { status: 400 },
    );
  }
  try {
    const task = await updateTask(id, title);
    return NextResponse.json({ task });
  } catch (e) {
    return jsonError(e);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const own = await ownedTask(req, id);
  if (!own.ok) return own.res;
  try {
    await deleteTask(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return jsonError(e);
  }
}
