import { NextResponse } from "next/server";
import { updateLicenseAction } from "../../../../../lib/backend";
import { hasAdminSession } from "../../../../../lib/session";

const actions = new Set(["enable", "disable", "reset-hwid"]);

type Context = {
  params: Promise<{ key: string }>;
};

export async function POST(request: Request, context: Context) {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { action?: unknown } | null;
  const action = body?.action;

  if (typeof action !== "string" || !actions.has(action)) {
    return NextResponse.json({ error: "Invalid license action" }, { status: 400 });
  }

  const { key } = await context.params;
  return NextResponse.json(await updateLicenseAction(decodeURIComponent(key), action as "enable" | "disable" | "reset-hwid"));
}
