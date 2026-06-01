import { NextResponse } from "next/server";
import { BackendRequestError, updateSupportTicketAction } from "../../../../../lib/backend";
import { hasAdminSession } from "../../../../../lib/session";

const actions = new Set(["close", "reject", "accept-hwid-reset"]);

type Context = {
  params: Promise<{ ticketId: string }>;
};

export async function POST(request: Request, context: Context) {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    action?: unknown;
    adminNote?: unknown;
  } | null;
  const action = body?.action;

  if (typeof action !== "string" || !actions.has(action)) {
    return NextResponse.json({ error: "Invalid ticket action" }, { status: 400 });
  }

  const adminNote =
    body?.adminNote === undefined
      ? undefined
      : typeof body.adminNote === "string" && body.adminNote.trim()
        ? body.adminNote.trim().slice(0, 1_000)
        : null;

  try {
    const { ticketId } = await context.params;
    return NextResponse.json(
      await updateSupportTicketAction(
        decodeURIComponent(ticketId),
        action as "close" | "reject" | "accept-hwid-reset",
        adminNote,
      ),
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ticket action failed" },
      { status: error instanceof BackendRequestError ? error.status : 500 },
    );
  }
}
