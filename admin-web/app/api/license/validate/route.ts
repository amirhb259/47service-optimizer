import { validateLicenseSession } from "../../../../lib/server/licenseService";
import { publicJson, publicOptions, statusForLicenseReason } from "../../../../lib/server/http";

export function OPTIONS(request: Request) {
  return publicOptions(request);
}

export async function POST(request: Request) {
  const body = await readJson(request);
  const key = typeof body?.key === "string" ? body.key : "";
  const hwid = typeof body?.hwid === "string" ? body.hwid : "";

  if (!isLicenseKey(key) || !isHwid(hwid)) {
    return publicJson(request, { valid: false, reason: "INVALID_REQUEST" }, { status: 400 });
  }

  const result = await validateLicenseSession(key, hwid);
  return publicJson(request, result, { status: result.valid ? 200 : statusForLicenseReason(result.reason) });
}

async function readJson(request: Request) {
  return (await request.json().catch(() => null)) as { key?: unknown; hwid?: unknown } | null;
}

function isLicenseKey(value: string) {
  const length = value.trim().length;
  return length >= 6 && length <= 64;
}

function isHwid(value: string) {
  const length = value.trim().length;
  return length >= 8 && length <= 128;
}
