import { NextResponse, type NextRequest } from "next/server";
import { deleteTask, updateTask } from "@/lib/db";
import { jsonError } from "@/lib/api-helpers";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { title, notes } = await req.json().catch(() => ({}));
  const patch: { title?: string; notes?: string } = {};
  if (typeof title === "string" && title.trim()) patch.title = title;
  if (typeof notes === "string") patch.notes = notes;
  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { error: "Provide title and/or notes to update." },
      { status: 400 },
    );
  }
  try {
    const task = await updateTask(id, patch);
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
