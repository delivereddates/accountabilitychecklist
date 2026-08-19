import { NextResponse } from "next/server";
import { getConfiguredUsers } from "@/lib/db";

export async function GET() {
  const users = await getConfiguredUsers();
  return NextResponse.json({ users });
}
