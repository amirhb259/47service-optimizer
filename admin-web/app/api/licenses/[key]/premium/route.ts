import { NextResponse } from "next/server";
import { BackendRequestError, setLicensePremium } from "../../../../../lib/backend";
import { hasAdminSession } from "../../../../../lib/session";

type Context = {
  params: Promise<{ key: string }>;
};

export async function POST(request: Request, context: Context) {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { premium?: unknown } | null;

  if (typeof body?.premium !== "boolean") {
    return NextResponse.json({ error: "Premium must be a boolean" }, { status: 400 });
  }

  const { key } = await context.params;

  try {
    return NextResponse.json(await setLicensePremium(decodeURIComponent(key), body.premium));
  } catch (error) {
    if (error instanceof BackendRequestError) {
      const isMissingBackendRoute = error.status === 404 && error.message === "Not found";
      return NextResponse.json(
        {
          error: isMissingBackendRoute
            ? "Premium update endpoint is unavailable on the backend."
            : error.message,
        },
        { status: isMissingBackendRoute ? 502 : error.status },
      );
    }

    return NextResponse.json({ error: "Unable to update premium status." }, { status: 500 });
  }
}
