import { NextResponse, type NextRequest } from "next/server";
import { createTask } from "@/lib/db";
import { jsonError } from "@/lib/api-helpers";

export async function POST(req: NextRequest) {
  const { user_id, title, notes } = await req.json().catch(() => ({}));
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
  try {
    const task = await createTask(
      user_id,
      title,
      typeof notes === "string" ? notes : "",
    );
    return NextResponse.json({ task }, { status: 201 });
  } catch (e) {
    return jsonError(e);
  }
}
