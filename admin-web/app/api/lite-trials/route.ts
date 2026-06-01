import { NextResponse } from "next/server";
import { listLiteTrials } from "../../../lib/backend";
import { hasAdminSession } from "../../../lib/session";

export async function GET() {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(await listLiteTrials());
}
