import { NextResponse } from "next/server";
import { BackendRequestError, deleteSupportTicket, updateSupportTicket } from "../../../../lib/backend";
import { hasAdminSession } from "../../../../lib/session";
import type { SupportTicketStatus } from "../../../../lib/types";

const statuses = new Set<SupportTicketStatus>(["OPEN", "ACCEPTED", "REJECTED", "CLOSED"]);

type Context = {
  params: Promise<{ ticketId: string }>;
};

export async function PATCH(request: Request, context: Context) {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    status?: unknown;
    adminNote?: unknown;
  } | null;
  const payload: { status?: SupportTicketStatus; adminNote?: string | null } = {};

  if (body?.status !== undefined) {
    if (typeof body.status !== "string" || !statuses.has(body.status as SupportTicketStatus)) {
      return NextResponse.json({ error: "Invalid ticket status" }, { status: 400 });
    }

    payload.status = body.status as SupportTicketStatus;
  }

  if (body?.adminNote !== undefined) {
    payload.adminNote =
      typeof body.adminNote === "string" && body.adminNote.trim()
        ? body.adminNote.trim().slice(0, 1_000)
        : null;
  }

  if (!payload.status && payload.adminNote === undefined) {
    return NextResponse.json({ error: "Ticket status or admin note is required" }, { status: 400 });
  }

  try {
    const { ticketId } = await context.params;
    return NextResponse.json(await updateSupportTicket(decodeURIComponent(ticketId), payload));
  } catch (error) {
    return proxyError(error);
  }
}

export async function DELETE(_request: Request, context: Context) {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { ticketId } = await context.params;
    return NextResponse.json(await deleteSupportTicket(decodeURIComponent(ticketId)));
  } catch (error) {
    return proxyError(error);
  }
}

function proxyError(error: unknown) {
  return NextResponse.json(
    { error: error instanceof Error ? error.message : "Ticket request failed" },
    { status: error instanceof BackendRequestError ? error.status : 500 },
  );
}
