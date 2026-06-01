import { createSupportTicket, SupportTicketValidationError, type IncomingProofImage } from "../../../../lib/server/supportService";
import { publicJson, publicOptions } from "../../../../lib/server/http";
import type { LicenseType } from "../../../../lib/types";

const licenseTypes = new Set<LicenseType>(["LITE", "PRO", "LIFETIME"]);

export function OPTIONS(request: Request) {
  return publicOptions(request);
}

export async function POST(request: Request) {
  const formData = await request.formData().catch(() => null);

  if (!formData) {
    return publicJson(request, { error: "Invalid support ticket request." }, { status: 400 });
  }

  const subject = textField(formData, "subject");
  const description = textField(formData, "description");
  const hwid = textField(formData, "hwid");
  const licenseType = textField(formData, "licenseType");

  if (!isTicketText(subject, 3, 120) || !isTicketText(description, 10, 2_000) || !isHwid(hwid)) {
    return publicJson(request, { error: "Invalid support ticket request." }, { status: 400 });
  }

  if (!licenseTypes.has(licenseType as LicenseType)) {
    return publicJson(request, { error: "Invalid license type." }, { status: 400 });
  }

  try {
    const ticket = await createSupportTicket({
      subject,
      description,
      hwid,
      licenseType: licenseType as LicenseType,
      files: await proofImages(formData),
    });

    return publicJson(
      request,
      {
        ticket: {
          id: ticket.id,
          subject: ticket.subject,
          hwid: ticket.hwid,
          status: ticket.status,
          createdAt: ticket.createdAt,
          licenseType,
          priorityBadge: licenseType === "LIFETIME" ? "Lifetime priority" : null,
          proofs: ticket.proofs,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return publicJson(
      request,
      { error: error instanceof Error ? error.message : "Unable to create support ticket." },
      { status: error instanceof SupportTicketValidationError ? 400 : 500 },
    );
  }
}

function textField(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function isTicketText(value: string, minLength: number, maxLength: number) {
  const length = value.trim().length;
  return length >= minLength && length <= maxLength;
}

function isHwid(value: string) {
  const length = value.trim().length;
  return length >= 8 && length <= 128;
}

async function proofImages(formData: FormData): Promise<IncomingProofImage[]> {
  const files = formData.getAll("proofImages").filter((value): value is File => value instanceof File);

  return Promise.all(
    files.map(async (file) => ({
      originalname: file.name,
      mimetype: file.type,
      size: file.size,
      buffer: Buffer.from(await file.arrayBuffer()),
    })),
  );
}
