import { NextResponse } from "next/server";
import { deleteLiteTrial } from "../../../../lib/backend";
import { hasAdminSession } from "../../../../lib/session";

type Context = {
  params: Promise<{ trialId: string }>;
};

export async function DELETE(_request: Request, context: Context) {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { trialId } = await context.params;
  return NextResponse.json(await deleteLiteTrial(decodeURIComponent(trialId)));
}
