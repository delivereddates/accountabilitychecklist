import { NextResponse } from "next/server";
import { getUsers } from "@/lib/db";

export async function GET() {
  const users = await getUsers();
  return NextResponse.json({ users });
}
