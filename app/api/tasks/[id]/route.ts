import { NextResponse, type NextRequest } from "next/server";
import { deleteTask, updateTask } from "@/lib/db";
import { jsonError } from "@/lib/api-helpers";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
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
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    await deleteTask(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return jsonError(e);
  }
}
