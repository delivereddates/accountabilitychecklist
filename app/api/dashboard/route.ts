import { NextResponse } from "next/server";
import { getDashboardAll } from "@/lib/db";
import { jsonError } from "@/lib/api-helpers";

/** Full dataset for the client-side SWR cache (all users/tasks/completions). */
export async function GET() {
  try {
    const data = await getDashboardAll();
    return NextResponse.json(data);
  } catch (e) {
    return jsonError(e);
  }
}
