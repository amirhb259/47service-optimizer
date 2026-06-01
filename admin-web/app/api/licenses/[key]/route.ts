import { NextResponse } from "next/server";
import { deleteLicense, updateLicenseNotes } from "../../../../lib/backend";
import { hasAdminSession } from "../../../../lib/session";

type Context = {
  params: Promise<{ key: string }>;
};

export async function DELETE(_request: Request, context: Context) {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { key } = await context.params;
  return NextResponse.json(await deleteLicense(decodeURIComponent(key)));
}

export async function PATCH(request: Request, context: Context) {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { key } = await context.params;
  const body = (await request.json().catch(() => null)) as { notes?: unknown } | null;
  const notes = typeof body?.notes === "string" && body.notes.trim() ? body.notes.trim().slice(0, 500) : null;

  return NextResponse.json(await updateLicenseNotes(decodeURIComponent(key), notes));
}
