import { NextResponse } from "next/server";
import { resetAdminAccountPassword } from "../../../../../lib/backend";
import { hasAdminSession } from "../../../../../lib/session";

type Context = {
  params: Promise<{ key: string }>;
};

export async function POST(_request: Request, context: Context) {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { key } = await context.params;
  return NextResponse.json(await resetAdminAccountPassword(decodeURIComponent(key)));
}
