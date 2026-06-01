import "server-only";

import type { LicenseRecord, LicenseType, LiteTrialRecord, SupportTicket, SupportTicketStatus } from "./types";
import {
  createAdminAccessAccount,
  createLicense as createLicenseRecord,
  deleteLicense as deleteLicenseRecord,
  deleteLiteTrial as deleteLiteTrialRecord,
  disableLicense,
  disableLiteTrial,
  enableLicense,
  listLicenses as listLicenseRecords,
  listLiteTrials as listLiteTrialRecords,
  listPremiumLicenses as listPremiumLicenseRecords,
  normalizeLicenseKey,
  resetAdminAccountPassword as resetAdminAccountPasswordRecord,
  resetLicenseHwid,
  resetLiteTrial,
  setLicensePremium as setLicensePremiumRecord,
  setLicenseType as setLicenseTypeRecord,
  updateLicenseNotes as updateLicenseNotesRecord,
} from "./server/licenseService";
import {
  acceptSupportTicketHwidReset,
  deleteSupportTicket as deleteSupportTicketRecord,
  getSupportProofImage,
  listSupportTickets as listSupportTicketRecords,
  updateSupportTicketAdminNote,
  updateSupportTicketStatus,
} from "./server/supportService";

export class BackendRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "BackendRequestError";
  }
}

export async function listLicenses() {
  const licenses = await listLicenseRecords();
  return { licenses: licenses.map(serializeLicense) };
}

export async function listLiteTrials() {
  const trials = await listLiteTrialRecords();
  return { trials: trials.map(serializeLiteTrial) };
}

export async function createLicense(payload: {
  type: LicenseType;
  expiresAt: string | null;
  notes: string | null;
}) {
  const license = await createLicenseRecord({
    type: payload.type,
    expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : null,
    notes: payload.notes,
  });

  return { license: serializeLicense(license) };
}

export async function createAdminAccount(payload: {
  type: LicenseType;
  premium: boolean;
  notes: string | null;
}) {
  const account = await createAdminAccessAccount({
    type: payload.type,
    premium: payload.premium,
    notes: payload.notes,
  });

  return {
    ...account,
    license: serializeLicense(account.license),
  };
}

export async function updateLicenseAction(key: string, action: "enable" | "disable" | "reset-hwid") {
  const normalizedKey = normalizeLicenseKey(key);
  const license =
    action === "enable"
      ? await enableLicense(normalizedKey)
      : action === "disable"
        ? await disableLicense(normalizedKey)
        : await resetLicenseHwid(normalizedKey);

  return { license: serializeLicense(license) };
}

export async function updateLicenseNotes(key: string, notes: string | null) {
  const license = await updateLicenseNotesRecord(normalizeLicenseKey(key), notes?.trim() || null);
  return { license: serializeLicense(license) };
}

export async function deleteLicense(key: string) {
  const license = await deleteLicenseRecord(normalizeLicenseKey(key));
  return { license: serializeLicense(license) };
}

export async function updateLiteTrialAction(trialId: string, action: "disable" | "reset") {
  const trial = action === "disable" ? await disableLiteTrial(trialId) : await resetLiteTrial(trialId);
  return { trial: serializeLiteTrial(trial) };
}

export async function deleteLiteTrial(trialId: string) {
  const trial = await deleteLiteTrialRecord(trialId);
  return { trial: serializeLiteTrial(trial) };
}

export async function listSupportTickets() {
  const tickets = await listSupportTicketRecords();
  return { tickets: tickets.map(serializeSupportTicket) };
}

export async function updateSupportTicket(
  ticketId: string,
  payload: { status?: SupportTicketStatus; adminNote?: string | null },
) {
  let ticket =
    payload.status === undefined
      ? null
      : await updateSupportTicketStatus(ticketId, payload.status);

  if (payload.adminNote !== undefined) {
    ticket = await updateSupportTicketAdminNote(ticketId, payload.adminNote?.trim() || null);
  }

  if (!ticket) {
    throw new BackendRequestError("Ticket status or admin note is required", 400);
  }

  return { ticket: serializeSupportTicket(ticket) };
}

export async function updateSupportTicketAction(
  ticketId: string,
  action: "close" | "reject" | "accept-hwid-reset",
  adminNote?: string | null,
) {
  if (action === "accept-hwid-reset") {
    const result = await acceptSupportTicketHwidReset(ticketId, adminNote);
    return {
      ticket: serializeSupportTicket(result.ticket),
      license: serializeLicense(result.license),
    };
  }

  const status = action === "close" ? "CLOSED" : "REJECTED";
  let ticket = await updateSupportTicketStatus(ticketId, status);

  if (adminNote !== undefined) {
    ticket = await updateSupportTicketAdminNote(ticketId, adminNote?.trim() || null);
  }

  return { ticket: serializeSupportTicket(ticket) };
}

export async function deleteSupportTicket(ticketId: string) {
  const ticket = await deleteSupportTicketRecord(ticketId);
  return { ticket: serializeSupportTicket(ticket) };
}

export async function fetchProofImage(proofId: string) {
  const proof = await getSupportProofImage(proofId);

  if (!proof) {
    return Response.json({ error: "Proof image not found" }, { status: 404 });
  }

  return new Response(proof.data, {
    status: 200,
    headers: {
      "Content-Type": proof.mimeType,
      "Content-Length": String(proof.sizeBytes),
      "Content-Disposition": `inline; filename="${proof.originalName.replace(/"/g, "")}"`,
    },
  });
}

export async function setLicensePremium(key: string, premium: boolean) {
  const license = await setLicensePremiumRecord(normalizeLicenseKey(key), premium);
  return { license: serializeLicense(license) };
}

export async function setLicenseType(key: string, type: LicenseType) {
  const license = await setLicenseTypeRecord(normalizeLicenseKey(key), type);
  return { license: serializeLicense(license) };
}

export async function resetAdminAccountPassword(key: string) {
  const account = await resetAdminAccountPasswordRecord(normalizeLicenseKey(key));
  return {
    ...account,
    license: serializeLicense(account.license),
  };
}

export async function listPremiumLicenses() {
  const licenses = await listPremiumLicenseRecords();
  return { licenses: licenses.map(serializeLicense) };
}

function serializeLicense(license: {
  id: string;
  key: string;
  type: LicenseType;
  status: LicenseRecord["status"];
  premium: boolean;
  createdAt: Date;
  expiresAt: Date | null;
  activatedAt: Date | null;
  hwid: string | null;
  username: string | null;
  credentialIssuedAt: Date | null;
  adminCreated: boolean;
  notes: string | null;
}): LicenseRecord {
  return {
    id: license.id,
    key: license.key,
    type: license.type,
    status: license.status,
    premium: license.premium,
    createdAt: license.createdAt.toISOString(),
    expiresAt: license.expiresAt?.toISOString() ?? null,
    activatedAt: license.activatedAt?.toISOString() ?? null,
    hwid: license.hwid,
    username: license.username,
    credentialIssuedAt: license.credentialIssuedAt?.toISOString() ?? null,
    adminCreated: license.adminCreated,
    notes: license.notes,
  };
}

function serializeLiteTrial(trial: {
  id: string;
  licenseId: string;
  hwid: string;
  ipAddress: string;
  userAgent: string | null;
  deviceFingerprint: string | null;
  status: LiteTrialRecord["status"];
  createdAt: Date;
  expiresAt: Date;
  disabledAt: Date | null;
  resetAt: Date | null;
  license: Parameters<typeof serializeLicense>[0];
}): LiteTrialRecord {
  return {
    id: trial.id,
    licenseId: trial.licenseId,
    hwid: trial.hwid,
    ipAddress: trial.ipAddress,
    userAgent: trial.userAgent,
    deviceFingerprint: trial.deviceFingerprint,
    status: trial.status,
    createdAt: trial.createdAt.toISOString(),
    expiresAt: trial.expiresAt.toISOString(),
    disabledAt: trial.disabledAt?.toISOString() ?? null,
    resetAt: trial.resetAt?.toISOString() ?? null,
    license: serializeLicense(trial.license),
  };
}

function serializeSupportTicket(ticket: {
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
    createdAt: Date;
  }>;
}): SupportTicket {
  return {
    id: ticket.id,
    subject: ticket.subject,
    description: ticket.description,
    hwid: ticket.hwid,
    status: ticket.status,
    adminNote: ticket.adminNote,
    createdAt: ticket.createdAt.toISOString(),
    proofs: ticket.proofs.map((proof) => ({
      id: proof.id,
      originalName: proof.originalName,
      mimeType: proof.mimeType,
      sizeBytes: proof.sizeBytes,
      createdAt: proof.createdAt.toISOString(),
    })),
  };
}
