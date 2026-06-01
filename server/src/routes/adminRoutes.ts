import { Router } from "express";
import { LicenseType, SupportTicketStatus } from "@prisma/client";
import { resolve, sep } from "node:path";
import { z } from "zod";
import {
  createAdminAccessAccount,
  createLicense,
  deleteLicense,
  disableLicense,
  enableLicense,
  listLicenses,
  normalizeLicenseKey,
  resetLicenseHwid,
  resetAdminAccountPassword,
  updateLicenseNotes,
  setLicensePremium,
  setLicenseType,
  listPremiumLicenses,
  listLiteTrials,
  disableLiteTrial,
  deleteLiteTrial,
  resetLiteTrial,
} from "../services/licenseService.js";
import { requireAdminToken } from "../middleware/adminAuth.js";
import {
  acceptSupportTicketHwidReset,
  deleteSupportTicket,
  getSupportProofImage,
  listSupportTickets,
  PROOF_UPLOAD_ROOT,
  supportTicketStatuses,
  updateSupportTicketAdminNote,
  updateSupportTicketStatus,
} from "../services/supportService.js";

const licensePremiumSchema = z.object({
  key: z.string().trim().min(8).max(64),
  premium: z.boolean(),
});

const licenseTypeSchema = z.object({
  key: z.string().trim().min(8).max(64),
  type: z.nativeEnum(LicenseType),
});

const createLicenseSchema = z.object({
  type: z.nativeEnum(LicenseType).default(LicenseType.PRO),
  expiresAt: z.string().datetime().nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

const createAdminAccessAccountSchema = z.object({
  type: z.nativeEnum(LicenseType),
  premium: z.boolean().default(false),
  notes: z.string().max(500).nullable().optional(),
});

const disableLicenseSchema = z.object({
  key: z.string().trim().min(8).max(64),
});

const licenseActionSchema = z.object({
  key: z.string().trim().min(8).max(64),
});

const licenseNotesSchema = licenseActionSchema.extend({
  notes: z.string().max(500).nullable(),
});

const proofIdSchema = z.object({
  proofId: z.string().trim().min(8).max(128),
});

const ticketIdSchema = z.object({
  ticketId: z.string().trim().min(8).max(128),
});

const ticketStatusSchema = z.object({
  status: z.enum(supportTicketStatuses),
  adminNote: z.string().max(1_000).nullable().optional(),
});

const ticketNoteSchema = z.object({
  adminNote: z.string().max(1_000).nullable(),
});

const liteTrialIdSchema = z.object({
  trialId: z.string().trim().min(8).max(128),
});

export const adminRoutes = Router();

adminRoutes.use(requireAdminToken);

adminRoutes.get("/verify", (_req, res) => {
  res.status(200).json({ valid: true });
});

adminRoutes.get("/licenses", async (_req, res, next) => {
  try {
    const licenses = await listLicenses();
    res.status(200).json({
      licenses: licenses.map((license) => ({
        ...license,
        key: license.key,
      })),
    });
  } catch (error) {
    next(error);
  }
});

adminRoutes.post("/licenses/create", async (req, res, next) => {
  try {
    const body = createLicenseSchema.parse(req.body);
    const license = await createLicense({
      type: body.type,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      notes: body.notes ?? null,
    });

    res.status(201).json({ license });
  } catch (error) {
    next(error);
  }
});

adminRoutes.post("/admin-accounts/create", async (req, res, next) => {
  try {
    const body = createAdminAccessAccountSchema.parse(req.body);
    const account = await createAdminAccessAccount({
      type: body.type,
      premium: body.premium,
      notes: body.notes?.trim() || null,
    });

    res.status(201).json(account);
  } catch (error) {
    next(error);
  }
});

adminRoutes.post("/licenses/disable", async (req, res, next) => {
  try {
    const body = disableLicenseSchema.parse(req.body);
    const license = await disableLicense(normalizeLicenseKey(body.key));

    res.status(200).json({ license });
  } catch (error) {
    next(error);
  }
});

adminRoutes.post("/licenses/enable", async (req, res, next) => {
  try {
    const body = licenseActionSchema.parse(req.body);
    const license = await enableLicense(normalizeLicenseKey(body.key));

    res.status(200).json({ license });
  } catch (error) {
    next(error);
  }
});

adminRoutes.post("/licenses/reset-hwid", async (req, res, next) => {
  try {
    const body = licenseActionSchema.parse(req.body);
    const license = await resetLicenseHwid(normalizeLicenseKey(body.key));

    res.status(200).json({ license });
  } catch (error) {
    next(error);
  }
});

adminRoutes.patch("/licenses/notes", async (req, res, next) => {
  try {
    const body = licenseNotesSchema.parse(req.body);
    const license = await updateLicenseNotes(normalizeLicenseKey(body.key), body.notes?.trim() || null);

    res.status(200).json({ license });
  } catch (error) {
    next(error);
  }
});

adminRoutes.post("/licenses/set-premium", async (req, res, next) => {
  try {
    const body = licensePremiumSchema.parse(req.body);
    const license = await setLicensePremium(normalizeLicenseKey(body.key), body.premium);
    res.status(200).json({ license });
  } catch (error) {
    next(error);
  }
});

adminRoutes.post("/licenses/set-type", async (req, res, next) => {
  try {
    const body = licenseTypeSchema.parse(req.body);
    const license = await setLicenseType(normalizeLicenseKey(body.key), body.type);
    res.status(200).json({ license });
  } catch (error) {
    next(error);
  }
});

adminRoutes.post("/licenses/reset-password", async (req, res, next) => {
  try {
    const body = licenseActionSchema.parse(req.body);
    const account = await resetAdminAccountPassword(normalizeLicenseKey(body.key));
    res.status(200).json(account);
  } catch (error) {
    next(error);
  }
});

adminRoutes.get("/premium-users", async (_req, res, next) => {
  try {
    const licenses = await listPremiumLicenses();
    res.status(200).json({ licenses });
  } catch (error) {
    next(error);
  }
});

adminRoutes.get("/lite-trials", async (_req, res, next) => {
  try {
    const trials = await listLiteTrials();
    res.status(200).json({ trials });
  } catch (error) {
    next(error);
  }
});

adminRoutes.post("/lite-trials/:trialId/disable", async (req, res, next) => {
  try {
    const { trialId } = liteTrialIdSchema.parse(req.params);
    const trial = await disableLiteTrial(trialId);
    res.status(200).json({ trial });
  } catch (error) {
    next(error);
  }
});

adminRoutes.post("/lite-trials/:trialId/reset", async (req, res, next) => {
  try {
    const { trialId } = liteTrialIdSchema.parse(req.params);
    const trial = await resetLiteTrial(trialId);
    res.status(200).json({ trial });
  } catch (error) {
    next(error);
  }
});

adminRoutes.delete("/lite-trials/:trialId", async (req, res, next) => {
  try {
    const { trialId } = liteTrialIdSchema.parse(req.params);
    const trial = await deleteLiteTrial(trialId);
    res.status(200).json({ trial });
  } catch (error) {
    next(error);
  }
});
adminRoutes.delete("/licenses/:key", async (req, res, next) => {
  try {
    const body = licenseActionSchema.parse({ key: req.params.key });
    const license = await deleteLicense(normalizeLicenseKey(body.key));

    res.status(200).json({ license });
  } catch (error) {
    next(error);
  }
});

adminRoutes.get("/support/tickets", async (_req, res, next) => {
  try {
    const tickets = await listSupportTickets();

    res.status(200).json({ tickets });
  } catch (error) {
    next(error);
  }
});

adminRoutes.patch("/support/tickets/:ticketId", async (req, res, next) => {
  try {
    const { ticketId } = ticketIdSchema.parse(req.params);
    const body = ticketStatusSchema.partial().parse(req.body);
    const adminNote = body.adminNote === undefined ? undefined : body.adminNote?.trim() || null;

    if (body.status) {
      const ticket = await updateSupportTicketStatus(ticketId, body.status);

      if (adminNote !== undefined) {
        const updatedTicket = await updateSupportTicketAdminNote(ticket.id, adminNote);
        res.status(200).json({ ticket: updatedTicket });
        return;
      }

      res.status(200).json({ ticket });
      return;
    }

    if (adminNote !== undefined) {
      const ticket = await updateSupportTicketAdminNote(ticketId, adminNote);
      res.status(200).json({ ticket });
      return;
    }

    res.status(400).json({ error: "Ticket status or admin note is required" });
  } catch (error) {
    next(error);
  }
});

adminRoutes.patch("/support/tickets/:ticketId/note", async (req, res, next) => {
  try {
    const { ticketId } = ticketIdSchema.parse(req.params);
    const body = ticketNoteSchema.parse(req.body);
    const ticket = await updateSupportTicketAdminNote(ticketId, body.adminNote?.trim() || null);

    res.status(200).json({ ticket });
  } catch (error) {
    next(error);
  }
});

adminRoutes.post("/support/tickets/:ticketId/close", async (req, res, next) => {
  try {
    const { ticketId } = ticketIdSchema.parse(req.params);
    const body = ticketNoteSchema.partial().parse(req.body);
    const ticket = await updateSupportTicketStatus(ticketId, SupportTicketStatus.CLOSED);
    const adminNote = body.adminNote === undefined ? undefined : body.adminNote?.trim() || null;

    if (adminNote !== undefined) {
      res.status(200).json({ ticket: await updateSupportTicketAdminNote(ticket.id, adminNote) });
      return;
    }

    res.status(200).json({ ticket });
  } catch (error) {
    next(error);
  }
});

adminRoutes.post("/support/tickets/:ticketId/reject", async (req, res, next) => {
  try {
    const { ticketId } = ticketIdSchema.parse(req.params);
    const body = ticketNoteSchema.partial().parse(req.body);
    const ticket = await updateSupportTicketStatus(ticketId, SupportTicketStatus.REJECTED);
    const adminNote = body.adminNote === undefined ? undefined : body.adminNote?.trim() || null;

    if (adminNote !== undefined) {
      res.status(200).json({ ticket: await updateSupportTicketAdminNote(ticket.id, adminNote) });
      return;
    }

    res.status(200).json({ ticket });
  } catch (error) {
    next(error);
  }
});

adminRoutes.post("/support/tickets/:ticketId/accept-hwid-reset", async (req, res, next) => {
  try {
    const { ticketId } = ticketIdSchema.parse(req.params);
    const body = ticketNoteSchema.partial().parse(req.body);
    const result = await acceptSupportTicketHwidReset(
      ticketId,
      body.adminNote === undefined ? undefined : body.adminNote?.trim() || null,
    );

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

adminRoutes.delete("/support/tickets/:ticketId", async (req, res, next) => {
  try {
    const { ticketId } = ticketIdSchema.parse(req.params);
    const ticket = await deleteSupportTicket(ticketId);

    res.status(200).json({ ticket });
  } catch (error) {
    next(error);
  }
});

adminRoutes.get("/support/proofs/:proofId", async (req, res, next) => {
  try {
    const { proofId } = proofIdSchema.parse(req.params);
    const proof = await getSupportProofImage(proofId);

    if (!proof) {
      res.status(404).json({ error: "Proof image not found" });
      return;
    }

    const proofPath = resolve(PROOF_UPLOAD_ROOT, proof.ticketId, proof.storedName);
    const rootWithSeparator = `${PROOF_UPLOAD_ROOT}${separatorForPath(PROOF_UPLOAD_ROOT)}`;

    if (!proofPath.startsWith(rootWithSeparator)) {
      res.status(400).json({ error: "Unsafe proof image path" });
      return;
    }

    res.setHeader("Content-Type", proof.mimeType);
    res.setHeader("Content-Length", String(proof.sizeBytes));
    res.setHeader("Content-Disposition", `inline; filename="${proof.originalName.replace(/"/g, "")}"`);
    res.sendFile(proofPath);
  } catch (error) {
    next(error);
  }
});

function separatorForPath(path: string) {
  return path.endsWith("\\") || path.endsWith("/") ? "" : sep;
}
