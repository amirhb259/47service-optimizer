import { getDeviceHwid } from "./licenseApi";
import type { LicenseType } from "./licenseApi";

export const SUPPORT_MAX_IMAGES = 6;
export const SUPPORT_MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const SUPPORT_ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg"];

export type SupportTicketResult = {
  ticket: {
    id: string;
    subject: string;
    hwid: string;
    status: string;
    createdAt: string;
    licenseType: LicenseType;
    priorityBadge: string | null;
    proofs: Array<{
      id: string;
      originalName: string;
      mimeType: string;
      sizeBytes: number;
    }>;
  };
};

const CONFIGURED_API_BASE_URL = import.meta.env.VITE_LICENSE_API_URL?.replace(/\/$/, "");
const API_BASE_URL = CONFIGURED_API_BASE_URL || (import.meta.env.DEV ? "http://127.0.0.1:8787" : "");

export async function createSupportTicket(input: {
  subject: string;
  description: string;
  licenseType: LicenseType;
  proofImages: File[];
}) {
  if (!API_BASE_URL) {
    throw new Error("VITE_LICENSE_API_URL must point to the deployed Netlify API URL.");
  }

  const hwid = await getDeviceHwid();
  const formData = new FormData();
  formData.append("subject", input.subject);
  formData.append("description", input.description);
  formData.append("hwid", hwid);
  formData.append("licenseType", input.licenseType);

  for (const image of input.proofImages) {
    formData.append("proofImages", image, image.name);
  }

  const response = await fetch(`${API_BASE_URL}/api/support/tickets`, {
    method: "POST",
    body: formData,
  });

  const payload = (await response.json().catch(() => null)) as SupportTicketResult | { error?: string } | null;

  if (!response.ok) {
    throw new Error(payload && "error" in payload && payload.error ? payload.error : "Unable to create support ticket.");
  }

  return payload as SupportTicketResult;
}

export async function getCurrentSupportHwid() {
  return getDeviceHwid();
}

export function validateProofImage(file: File) {
  const lowerName = file.name.toLowerCase();
  const hasAllowedExtension =
    lowerName.endsWith(".png") || lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg");

  if (!SUPPORT_ALLOWED_IMAGE_TYPES.includes(file.type) || !hasAllowedExtension) {
    return "Only .png, .jpg, and .jpeg proof images are allowed.";
  }

  if (file.size > SUPPORT_MAX_IMAGE_BYTES) {
    return "Each proof image must be 5 MB or smaller.";
  }

  return null;
}
