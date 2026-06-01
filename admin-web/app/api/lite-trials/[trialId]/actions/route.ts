import { NextResponse } from "next/server";
import { updateLiteTrialAction } from "../../../../../lib/backend";
import { hasAdminSession } from "../../../../../lib/session";

const actions = new Set(["disable", "reset"]);

type Context = {
  params: Promise<{ trialId: string }>;
};

export async function POST(request: Request, context: Context) {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { action?: unknown } | null;
  const action = body?.action;

  if (typeof action !== "string" || !actions.has(action)) {
    return NextResponse.json({ error: "Invalid Lite trial action" }, { status: 400 });
  }

  const { trialId } = await context.params;
  return NextResponse.json(await updateLiteTrialAction(decodeURIComponent(trialId), action as "disable" | "reset"));
}
