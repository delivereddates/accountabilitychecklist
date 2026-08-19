import { NextResponse, type NextRequest } from "next/server";
import { createTask } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { jsonError } from "@/lib/api-helpers";

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const { user_id, title } = await req.json().catch(() => ({}));
  if (
    typeof user_id !== "string" ||
    typeof title !== "string" ||
    !title.trim()
  ) {
    return NextResponse.json(
      { error: "user_id and a non-empty title are required." },
      { status: 400 },
    );
  }
  // You can only create tasks for yourself.
  if (user_id !== user.userId) {
    return NextResponse.json(
      { error: "You can only add tasks for your own account." },
      { status: 403 },
    );
  }
  try {
    const task = await createTask(user.userId, title);
    return NextResponse.json({ task }, { status: 201 });
  } catch (e) {
    return jsonError(e);
  }
}
