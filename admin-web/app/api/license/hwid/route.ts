import { publicJson, publicOptions } from "../../../../lib/server/http";

export function OPTIONS(request: Request) {
  return publicOptions(request);
}

export function GET(request: Request) {
  return publicJson(
    request,
    { error: "Remote Netlify API cannot read a desktop device HWID. Use the Tauri desktop HWID command." },
    { status: 501 },
  );
}
