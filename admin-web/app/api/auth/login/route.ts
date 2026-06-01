import { NextResponse } from "next/server";
import { createAdminSession, verifyAdminCredentials } from "../../../../lib/session";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { username?: unknown; password?: unknown } | null;
  const username = typeof body?.username === "string" ? body.username : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!username.trim() || !password) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (!verifyAdminCredentials(username, password)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await createAdminSession();
  return NextResponse.json({ ok: true });
}
