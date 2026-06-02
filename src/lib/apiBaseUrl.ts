const configuredApiBaseUrl = import.meta.env.VITE_LICENSE_API_URL?.replace(/\/+$/, "");

export const API_BASE_URL = configuredApiBaseUrl ?? "";

if (import.meta.env.DEV) {
  console.info("[47Service] License API base URL:", API_BASE_URL || "(not configured)");
}

export function requireApiBaseUrl() {
  if (!API_BASE_URL) {
    throw new Error("VITE_LICENSE_API_URL must point to the deployed Netlify API URL.");
  }

  return API_BASE_URL;
}
