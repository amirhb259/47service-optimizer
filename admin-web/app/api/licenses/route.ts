import { NextResponse } from "next/server";
import { createLicense, listLicenses } from "../../../lib/backend";
import { hasAdminSession } from "../../../lib/session";
import type { LicenseType } from "../../../lib/types";

const licenseTypes = new Set<LicenseType>(["LITE", "PRO", "LIFETIME"]);

export async function GET() {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(await listLicenses());
}

export async function POST(request: Request) {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    type?: unknown;
    expiresAt?: unknown;
    notes?: unknown;
  } | null;
  const type = body?.type;

  if (typeof type !== "string" || !licenseTypes.has(type as LicenseType)) {
    return NextResponse.json({ error: "Invalid license type" }, { status: 400 });
  }

  const expiresAt = typeof body?.expiresAt === "string" && body.expiresAt ? body.expiresAt : null;
  const notes = typeof body?.notes === "string" && body.notes.trim() ? body.notes.trim().slice(0, 500) : null;

  return NextResponse.json(await createLicense({ type: type as LicenseType, expiresAt, notes }), { status: 201 });
}
