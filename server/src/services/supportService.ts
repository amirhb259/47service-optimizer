import { createHash, randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { basename, join, resolve, sep } from "node:path";
import { SupportTicketStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export const MAX_PROOF_IMAGES = 6;
export const MAX_PROOF_IMAGE_BYTES = 5 * 1024 * 1024;
export const PROOF_UPLOAD_ROOT = resolve(process.cwd(), "server", "uploads", "support-proofs");

const allowedMimeTypes = new Set(["image/png", "image/jpeg"]);

export type IncomingProofImage = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

export type CreateSupportTicketInput = {
  subject: string;
  description: string;
  hwid: string;
  licenseType: "LITE" | "PRO" | "LIFETIME";
  files: IncomingProofImage[];
};

export type SupportTicketWithProofs = {
  id: string;
  subject: string;
  description: string;
  hwid: string;
  status: SupportTicketStatus;
  adminNote: string | null;
  createdAt: Date;
  proofs: Array<{
    id: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    createdAt?: Date;
  }>;
};

export class SupportTicketValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SupportTicketValidationError";
  }
}

export async function createSupportTicket(input: CreateSupportTicketInput) {
  const subject = input.subject.trim();
  const description = input.description.trim();
  const hwid = input.hwid.trim();
  const licenseType = input.licenseType;

  if (!subject) {
    throw new SupportTicketValidationError("Subject is required.");
  }

  if (!description) {
    throw new SupportTicketValidationError("Description is required.");
  }

  if (!hwid) {
    throw new SupportTicketValidationError("HWID is required.");
  }

  if (input.files.length > MAX_PROOF_IMAGES) {
    throw new SupportTicketValidationError(`Attach up to ${MAX_PROOF_IMAGES} proof images.`);
  }

  const validatedFiles = input.files.map(validateProofImage);
  const ticketId = randomUUID();
  const ticketDir = resolve(PROOF_UPLOAD_ROOT, ticketId);
  const rootWithSeparator = `${PROOF_UPLOAD_ROOT}${separatorForPath(PROOF_UPLOAD_ROOT)}`;

  if (!ticketDir.startsWith(rootWithSeparator)) {
    throw new Error("Unsafe proof storage path");
  }

  const storedFiles = validatedFiles.map((file) => {
    const storedName = `${randomUUID()}${file.extension}`;
    const absolutePath = resolve(ticketDir, storedName);

    if (!absolutePath.startsWith(`${ticketDir}${separatorForPath(ticketDir)}`)) {
      throw new Error("Unsafe proof file path");
    }

    return {
      ...file,
      storedName,
      absolutePath,
      relativePath: join("support-proofs", ticketId, storedName).replace(/\\/g, "/"),
    };
  });

  await mkdir(ticketDir, { recursive: true });

  try {
    await Promise.all(storedFiles.map((file) => writeFile(file.absolutePath, file.buffer, { flag: "wx" })));

    const ticket = await prisma.supportTicket.create({
      data: {
        id: ticketId,
        subject,
        description,
        hwid,
        proofs: {
          create: storedFiles.map((file) => ({
            originalName: file.originalName,
            storedName: file.storedName,
            relativePath: file.relativePath,
            mimeType: file.mimeType,
            sizeBytes: file.size,
            data: Uint8Array.from(file.buffer),
            sha256: file.sha256,
          })),
        },
      },
      include: {
        proofs: {
          select: {
            id: true,
            originalName: true,
            mimeType: true,
            sizeBytes: true,
          },
        },
      },
    });

    return ticket as SupportTicketWithProofs;
  } catch (error) {
    await rm(ticketDir, { recursive: true, force: true });
    throw error;
  }
}

export async function listSupportTickets() {
  return prisma.supportTicket.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      proofs: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          originalName: true,
          mimeType: true,
          sizeBytes: true,
          createdAt: true,
        },
      },
    },
  });
}

export async function getSupportProofImage(proofId: string) {
  return prisma.supportProofImage.findUnique({
    where: { id: proofId },
    select: {
      id: true,
      ticketId: true,
      originalName: true,
      storedName: true,
      mimeType: true,
      sizeBytes: true,
    },
  });
}

export async function updateSupportTicketStatus(ticketId: string, status: SupportTicketStatus) {
  return prisma.supportTicket.update({
    where: { id: ticketId },
    data: { status },
    include: supportTicketInclude,
  });
}

export async function updateSupportTicketAdminNote(ticketId: string, adminNote: string | null) {
  return prisma.supportTicket.update({
    where: { id: ticketId },
    data: { adminNote },
    include: supportTicketInclude,
  });
}

export async function deleteSupportTicket(ticketId: string) {
  const ticket = await prisma.supportTicket.delete({
    where: { id: ticketId },
    include: supportTicketInclude,
  });

  await rm(resolve(PROOF_UPLOAD_ROOT, ticket.id), { recursive: true, force: true });
  return ticket;
}

export async function acceptSupportTicketHwidReset(ticketId: string, adminNote?: string | null) {
  return prisma.$transaction(async (tx) => {
    const ticket = await tx.supportTicket.findUnique({
      where: { id: ticketId },
      include: supportTicketInclude,
    });

    if (!ticket) {
      throw new SupportTicketValidationError("Support ticket not found.");
    }

    const matchedLicenses = await tx.license.findMany({
      where: { hwid: ticket.hwid },
      orderBy: { createdAt: "desc" },
      take: 2,
    });

    if (matchedLicenses.length === 0) {
      throw new SupportTicketValidationError("No license is currently bound to this ticket HWID.");
    }

    if (matchedLicenses.length > 1) {
      throw new SupportTicketValidationError("Multiple licenses are bound to this HWID. Reset the license manually.");
    }

    const license = await tx.license.update({
      where: { id: matchedLicenses[0].id },
      data: {
        activatedAt: null,
        hwid: null,
      },
    });

    const updatedTicket = await tx.supportTicket.update({
      where: { id: ticket.id },
      data: {
        status: SupportTicketStatus.ACCEPTED,
        ...(adminNote !== undefined ? { adminNote } : {}),
      },
      include: supportTicketInclude,
    });

    return { ticket: updatedTicket, license };
  });
}

export const supportTicketStatuses = [
  SupportTicketStatus.OPEN,
  SupportTicketStatus.ACCEPTED,
  SupportTicketStatus.REJECTED,
  SupportTicketStatus.CLOSED,
] as const;

const supportTicketInclude = {
  proofs: {
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      originalName: true,
      mimeType: true,
      sizeBytes: true,
      createdAt: true,
    },
  },
} as const;

function validateProofImage(file: IncomingProofImage) {
  if (!allowedMimeTypes.has(file.mimetype)) {
    throw new SupportTicketValidationError("Only PNG and JPG proof images are allowed.");
  }

  if (!file.size || file.size > MAX_PROOF_IMAGE_BYTES) {
    throw new SupportTicketValidationError("Each proof image must be 5 MB or smaller.");
  }

  const detected = detectImageType(file.buffer);
  if (!detected || detected.mimeType !== file.mimetype) {
    throw new SupportTicketValidationError("One or more proof images have an invalid file type.");
  }

  return {
    buffer: file.buffer,
    extension: detected.extension,
    mimeType: detected.mimeType,
    originalName: safeOriginalName(file.originalname),
    sha256: createHash("sha256").update(file.buffer).digest("hex"),
    size: file.size,
  };
}

function detectImageType(buffer: Buffer) {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { extension: ".png", mimeType: "image/png" };
  }

  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { extension: ".jpg", mimeType: "image/jpeg" };
  }

  return null;
}

function safeOriginalName(value: string) {
  const name = basename(value).replace(/[^\w.\- ()]/g, "_").trim();
  return name.slice(0, 180) || "proof-image";
}

function separatorForPath(path: string) {
  return path.endsWith("\\") || path.endsWith("/") ? "" : sep;
}
