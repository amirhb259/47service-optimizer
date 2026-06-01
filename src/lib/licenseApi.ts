export type LicenseType = "LITE" | "PRO" | "LIFETIME";
export type LicenseStatus = "ACTIVE" | "DISABLED" | "EXPIRED";

export type StoredLicense = {
  key: string;
  type: LicenseType;
  premium?: boolean;
};

export type LicenseValidationResult =
  | { valid: true; type: LicenseType; key: string; premium: boolean }
  | { valid: false; reason: string };

export type LicenseKeyLoginResult =
  | { valid: true; requiresActivation: false; type: LicenseType; key: string; premium: boolean }
  | { valid: true; requiresActivation: true; type: LicenseType; key: string; premium: boolean }
  | { valid: false; reason: string };

export type LicenseActivationResult =
  | {
      valid: true;
      type: LicenseType;
      key: string;
      premium: boolean;
      firstActivation: boolean;
      hwid?: string;
      username?: string;
      password?: string;
    }
  | { valid: false; reason: string };

export type LiteAccountCreationResult =
  | {
      valid: true;
      type: "LITE";
      key: string;
      premium: false;
      expiresAt: string;
      hwid: string;
      username: string;
      password: string;
    }
  | { valid: false; reason: string };

export type CredentialLoginResult =
  | { valid: true; type: LicenseType; key: string; premium: boolean }
  | { valid: false; reason: string };

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

const CONFIGURED_API_BASE_URL = import.meta.env.VITE_LICENSE_API_URL?.replace(/\/$/, "");
const API_BASE_URL = CONFIGURED_API_BASE_URL || (import.meta.env.DEV ? "http://127.0.0.1:8787" : "");

const BROWSER_HWID_STORAGE_KEY = "47service.browserHwid";

async function parseJson<T>(response: Response): Promise<T> {
  try {
    return (await response.json()) as T;
  } catch {
    throw new Error("The license server returned an unreadable response.");
  }
}

async function postLicense<T>(path: string, payload: unknown): Promise<T> {
  if (!API_BASE_URL) {
    throw new Error("VITE_LICENSE_API_URL must point to the deployed Netlify API URL.");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const body = await parseJson<T>(response);

  if (!response.ok && !(body && typeof body === "object" && "valid" in body)) {
    throw new Error("License validation failed.");
  }

  return body;
}

export async function getDeviceHwid() {
  if (typeof window !== "undefined" && window.__TAURI_INTERNALS__) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const hwid = await invoke<string>("get_device_hwid");
      if (hwid.trim()) {
        return hwid.trim();
      }
    } catch {
      if (!import.meta.env.DEV) {
        throw new Error("Unable to read the device HWID from the desktop app.");
      }
    }
  }

  try {
    if (!API_BASE_URL) {
      throw new Error("VITE_LICENSE_API_URL must point to the deployed Netlify API URL.");
    }

    const response = await fetch(`${API_BASE_URL}/api/license/hwid`);
    if (response.ok) {
      const payload = (await response.json()) as { hwid?: string };
      if (payload.hwid?.trim()) {
        return payload.hwid.trim();
      }
    }
  } catch {
    if (!import.meta.env.DEV) {
      throw new Error("Unable to read the device HWID from the backend.");
    }
  }

  if (!import.meta.env.DEV) {
    throw new Error("Unable to read the device HWID from the desktop app.");
  }

  const stored = window.localStorage.getItem(BROWSER_HWID_STORAGE_KEY);
  if (stored) {
    return stored;
  }

  const randomValue =
    window.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  const hwid = `HWID-DEV-${randomValue.toUpperCase()}`;
  window.localStorage.setItem(BROWSER_HWID_STORAGE_KEY, hwid);
  return hwid;
}

export async function validateLicense(key: string, hwid: string): Promise<LicenseValidationResult> {
  return postLicense<LicenseValidationResult>("/api/license/validate", { key, hwid });
}

export async function startLicenseLogin(key: string, hwid: string): Promise<LicenseKeyLoginResult> {
  return postLicense<LicenseKeyLoginResult>("/api/license/key-login", { key, hwid });
}

export async function activateLicense(key: string, hwid: string): Promise<LicenseActivationResult> {
  return postLicense<LicenseActivationResult>("/api/license/activate", { key, hwid });
}

export async function createLiteAccount(hwid: string): Promise<LiteAccountCreationResult> {
  return postLicense<LiteAccountCreationResult>("/api/license/lite", {
    hwid,
    deviceFingerprint: await getBestEffortDeviceFingerprint(),
  });
}

export async function loginWithCredentials(
  username: string,
  password: string,
  hwid: string,
): Promise<CredentialLoginResult> {
  return postLicense<CredentialLoginResult>("/api/license/credentials-login", {
    username,
    password,
    hwid,
  });
}

export function getLicenseErrorMessage(reason: string) {
  const messages: Record<string, string> = {
    DISABLED: "This license has been disabled.",
    EXPIRED: "This license has expired.",
    CREDENTIAL_LOGIN_REQUIRED: "Sign in with the generated username and password for this account.",
    FIRST_ACTIVATION_REQUIRED: "This license needs first activation before it can restore a session.",
    HWID_MISMATCH: "This license is already activated on another PC.",
    INVALID_CREDENTIALS: "The username or password is incorrect.",
    KEY_REDEEMED: "This license key has already been redeemed. Sign in with the generated username and password.",
    LITE_DEVICE_USED: "A Lite trial already exists for this device.",
    LITE_HWID_USED: "A Lite trial already exists for this HWID.",
    LITE_IP_USED: "A Lite trial is already active from this network.",
    NOT_FOUND: "No active license was found for that key.",
    RATE_LIMITED: "Too many attempts. Wait a moment and try again.",
  };

  return messages[reason] ?? "The license could not be validated.";
}

export const licenseStorage = {
  key: "47service.license",
  read(): StoredLicense | null {
    const rawValue = window.localStorage.getItem(this.key);
    if (!rawValue) {
      return null;
    }

    try {
      const parsed = JSON.parse(rawValue) as StoredLicense;
      return parsed.key && parsed.type ? parsed : null;
    } catch {
      return null;
    }
  },
  write(license: StoredLicense) {
    window.localStorage.setItem(this.key, JSON.stringify(license));
  },
  clear() {
    window.localStorage.removeItem(this.key);
  },
};

async function getBestEffortDeviceFingerprint() {
  if (typeof window === "undefined" || !window.crypto?.subtle) {
    return undefined;
  }

  const source = [
    navigator.userAgent,
    navigator.language,
    navigator.languages?.join(",") ?? "",
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`,
    String(navigator.hardwareConcurrency ?? ""),
    String(navigator.maxTouchPoints ?? ""),
  ].join("|");

  try {
    const bytes = new TextEncoder().encode(source);
    const hash = await window.crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(hash))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return undefined;
  }
}
