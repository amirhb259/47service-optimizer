import { validateCredentialLogin } from "../../../../lib/server/licenseService";
import { publicJson, publicOptions, statusForLicenseReason } from "../../../../lib/server/http";

export function OPTIONS(request: Request) {
  return publicOptions(request);
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    username?: unknown;
    password?: unknown;
    hwid?: unknown;
  } | null;
  const username = typeof body?.username === "string" ? body.username : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const hwid = typeof body?.hwid === "string" ? body.hwid : "";

  if (!isUsername(username) || !isPassword(password) || !isHwid(hwid)) {
    return publicJson(request, { valid: false, reason: "INVALID_REQUEST" }, { status: 400 });
  }

  const result = await validateCredentialLogin(username, password, hwid);
  return publicJson(request, result, { status: result.valid ? 200 : statusForLicenseReason(result.reason) });
}

function isUsername(value: string) {
  const length = value.trim().length;
  return length >= 3 && length <= 64;
}

function isPassword(value: string) {
  return value.length >= 8 && value.length <= 128;
}

function isHwid(value: string) {
  const length = value.trim().length;
  return length >= 8 && length <= 128;
}
