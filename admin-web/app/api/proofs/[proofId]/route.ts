import { NextResponse } from "next/server";
import { fetchProofImage } from "../../../../lib/backend";
import { hasAdminSession } from "../../../../lib/session";

type Context = {
  params: Promise<{ proofId: string }>;
};

export async function GET(_request: Request, context: Context) {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { proofId } = await context.params;
  const response = await fetchProofImage(proofId);

  if (!response.ok || !response.body) {
    return NextResponse.json({ error: "Proof image not found" }, { status: response.status || 404 });
  }

  const headers = new Headers({
    "Content-Type": response.headers.get("Content-Type") ?? "application/octet-stream",
    "Content-Disposition": response.headers.get("Content-Disposition") ?? "inline",
  });
  const contentLength = response.headers.get("Content-Length");

  if (contentLength) {
    headers.set("Content-Length", contentLength);
  }

  return new Response(response.body, {
    status: response.status,
    headers,
  });
}
