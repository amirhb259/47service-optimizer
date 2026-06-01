import { NextResponse } from "next/server";
import { setLicenseType } from "../../../../../lib/backend";
import { hasAdminSession } from "../../../../../lib/session";
import type { LicenseType } from "../../../../../lib/types";

const licenseTypes = new Set<LicenseType>(["LITE", "PRO", "LIFETIME"]);

type Context = {
  params: Promise<{ key: string }>;
};

export async function POST(request: Request, context: Context) {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { type?: unknown } | null;

  if (typeof body?.type !== "string" || !licenseTypes.has(body.type as LicenseType)) {
    return NextResponse.json({ error: "Invalid account rank" }, { status: 400 });
  }

  const { key } = await context.params;
  return NextResponse.json(await setLicenseType(decodeURIComponent(key), body.type as LicenseType));
}
