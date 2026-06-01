import { execFile } from "node:child_process";
import { hostname, userInfo } from "node:os";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const FNV_OFFSET = 0xcbf29ce484222325n;
const FNV_PRIME = 0x100000001b3n;
const U64_MASK = 0xffffffffffffffffn;

export async function getLocalDeviceHwid() {
  const source = await getDeviceFingerprintSource();
  return `HWID-${fnv1a64(source).toString(16).toUpperCase().padStart(16, "0")}`;
}

async function getDeviceFingerprintSource() {
  if (process.platform === "win32") {
    const machineGuid = await readWindowsMachineGuid();
    if (machineGuid) {
      return machineGuid;
    }
  }

  const fallback = `${hostname()}:${userInfo().username}`;
  if (!fallback.trim().replace(":", "")) {
    throw new Error("Unable to build a device HWID.");
  }

  return fallback;
}

async function readWindowsMachineGuid() {
  try {
    const { stdout } = await execFileAsync(
      "reg",
      ["query", String.raw`HKLM\SOFTWARE\Microsoft\Cryptography`, "/v", "MachineGuid"],
      { windowsHide: true },
    );

    for (const line of stdout.split(/\r?\n/)) {
      if (line.includes("MachineGuid")) {
        const parts = line.trim().split(/\s+/);
        const value = parts.at(-1)?.trim();
        if (value) {
          return value;
        }
      }
    }
  } catch {
    return null;
  }

  return null;
}

function fnv1a64(value: string) {
  let hash = FNV_OFFSET;
  for (const byte of Buffer.from(value)) {
    hash ^= BigInt(byte);
    hash = (hash * FNV_PRIME) & U64_MASK;
  }

  return hash;
}
