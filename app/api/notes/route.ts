import { NextResponse, type NextRequest } from "next/server";
import { upsertTaskNote } from "@/lib/db";
import { jsonError } from "@/lib/api-helpers";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Upsert a per-task-per-day note. */
export async function POST(req: NextRequest) {
  const { task_id, date, note } = await req.json().catch(() => ({}));
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
  try {
    const saved = await upsertTaskNote(task_id, date, typeof note === "string" ? note : "");
    return NextResponse.json({ note: saved });
  } catch (e) {
    return jsonError(e);
  }
}
