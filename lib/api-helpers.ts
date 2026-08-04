import "server-only";
import { NextResponse } from "next/server";

/** Map a thrown DB/Postgres error to an appropriate JSON HTTP response. */
export function jsonError(e: unknown) {
  const msg = e instanceof Error ? e.message : "Unknown error";
  const code = (e as { code?: string })?.code;

  // 23505 = unique_violation (e.g. duplicate user name)
  if (code === "23505") {
    return NextResponse.json(
      { error: "That name already exists.", detail: msg },
      { status: 409 },
    );
  }
  // 23503 = foreign_key_violation (e.g. user_id / task_id not found)
  if (code === "23503") {
    return NextResponse.json(
      { error: "Referenced record not found.", detail: msg },
      { status: 400 },
    );
  }

  console.error("[api] unexpected error:", e);
  return NextResponse.json(
    { error: "Something went wrong.", detail: msg },
    { status: 500 },
  );
}
