import { NextResponse, type NextRequest } from "next/server";
import { createUser, getUsers } from "@/lib/db";
import { jsonError } from "@/lib/api-helpers";

export async function GET() {
  const users = await getUsers();
  return NextResponse.json({ users });
}

export async function POST(req: NextRequest) {
  const { name } = await req.json().catch(() => ({}));
  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json(
      { error: "A non-empty name is required." },
      { status: 400 },
    );
  }
  try {
    const user = await createUser(name);
    return NextResponse.json({ user }, { status: 201 });
  } catch (e) {
    return jsonError(e);
  }
}
