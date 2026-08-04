import { NextResponse, type NextRequest } from "next/server";
import { setCompletion } from "@/lib/db";
import { jsonError } from "@/lib/api-helpers";
import type { CompletionStatus } from "@/lib/types";

const VALID_STATUSES: CompletionStatus[] = ["check", "no_check", "exempt"];

/** Upsert a task's status for a date. Called on every 3-way toggle. */
export async function POST(req: NextRequest) {
  const { task_id, date, status } = await req.json().catch(() => ({}));

  if (typeof task_id !== "string" || typeof date !== "string") {
    return NextResponse.json(
      { error: "task_id and date are required." },
      { status: 400 },
    );
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
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
    return NextResponse.json({ completion });
  } catch (e) {
    return jsonError(e);
  }
}
