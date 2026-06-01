import { NextResponse } from "next/server";

const DEFAULT_ALLOWED_ORIGIN = "*";

function corsOrigin(request: Request) {
  const configured = process.env.API_CORS_ORIGIN?.trim() || DEFAULT_ALLOWED_ORIGIN;

  if (configured === "*") {
    return "*";
  }

  const origin = request.headers.get("origin");
  const allowed = configured
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return origin && allowed.includes(origin) ? origin : allowed[0] ?? DEFAULT_ALLOWED_ORIGIN;
}

export function withPublicCors(request: Request, response: Response) {
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", corsOrigin(request));
  headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type");
  headers.set("Vary", "Origin");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function publicJson(request: Request, body: unknown, init?: ResponseInit) {
  return withPublicCors(request, NextResponse.json(body, init));
}

export function publicOptions(request: Request) {
  return withPublicCors(request, new Response(null, { status: 204 }));
}

export function statusForLicenseReason(reason: string) {
  if (reason === "NOT_FOUND") {
    return 404;
  }

  if (reason === "RATE_LIMITED") {
    return 429;
  }

  if (reason === "KEY_REDEEMED" || reason.startsWith("LITE_")) {
    return 409;
  }

  return 403;
}
