import { createLiteTrialAccount } from "../../../../lib/server/licenseService";
import { publicJson, publicOptions, statusForLicenseReason } from "../../../../lib/server/http";

export function OPTIONS(request: Request) {
  return publicOptions(request);
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    hwid?: unknown;
    deviceFingerprint?: unknown;
  } | null;
  const hwid = typeof body?.hwid === "string" ? body.hwid : "";
  const deviceFingerprint = typeof body?.deviceFingerprint === "string" ? body.deviceFingerprint : undefined;

  if (!isHwid(hwid) || (deviceFingerprint !== undefined && !isFingerprint(deviceFingerprint))) {
    return publicJson(request, { valid: false, reason: "INVALID_REQUEST" }, { status: 400 });
  }

  const result = await createLiteTrialAccount(hwid, {
    ipAddress: getRequestIp(request),
    userAgent: request.headers.get("user-agent"),
    deviceFingerprint,
  });

  return publicJson(request, result, { status: result.valid ? 201 : statusForLicenseReason(result.reason) });
}

function isHwid(value: string) {
  const length = value.trim().length;
  return length >= 8 && length <= 128;
}

function isFingerprint(value: string) {
  const length = value.trim().length;
  return length >= 8 && length <= 256;
}

function getRequestIp(request: Request) {
  return (
    request.headers.get("x-nf-client-connection-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}
