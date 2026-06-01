import { NextResponse } from "next/server";
import { createAdminAccount } from "../../../lib/backend";
import { hasAdminSession } from "../../../lib/session";
import type { LicenseType } from "../../../lib/types";

const licenseTypes = new Set<LicenseType>(["LITE", "PRO", "LIFETIME"]);

export async function POST(request: Request) {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    type?: unknown;
    premium?: unknown;
    notes?: unknown;
  } | null;
  const type = body?.type;

  if (typeof type !== "string" || !licenseTypes.has(type as LicenseType)) {
    return NextResponse.json({ error: "Invalid account rank" }, { status: 400 });
  }

  if (typeof body?.premium !== "boolean") {
    return NextResponse.json({ error: "Premium must be a boolean" }, { status: 400 });
  }

  const notes = typeof body?.notes === "string" && body.notes.trim() ? body.notes.trim().slice(0, 500) : null;

  return NextResponse.json(
    await createAdminAccount({ type: type as LicenseType, premium: body.premium, notes }),
    { status: 201 },
  );
}
