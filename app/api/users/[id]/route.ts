import { NextResponse, type NextRequest } from "next/server";
import { deleteUser } from "@/lib/db";
import { jsonError } from "@/lib/api-helpers";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    await deleteUser(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return jsonError(e);
  }
}
