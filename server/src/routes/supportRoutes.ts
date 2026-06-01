import { Router } from "express";
import multer from "multer";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { env } from "../config/env.js";
import {
  createSupportTicket,
  MAX_PROOF_IMAGE_BYTES,
  MAX_PROOF_IMAGES,
  type IncomingProofImage,
} from "../services/supportService.js";

const ticketSchema = z.object({
  subject: z.string().trim().min(3).max(120),
  description: z.string().trim().min(10).max(2_000),
  hwid: z.string().trim().min(8).max(128),
  licenseType: z.enum(["LITE", "PRO", "LIFETIME"]),
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_PROOF_IMAGE_BYTES,
    files: MAX_PROOF_IMAGES,
    fields: 4,
    parts: MAX_PROOF_IMAGES + 4,
  },
});

const ticketLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: Math.max(5, Math.floor(env.RATE_LIMIT_MAX / 2)),
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many support ticket attempts. Wait a moment and try again." },
});

export const supportRoutes = Router();

supportRoutes.post(
  "/tickets",
  ticketLimiter,
  upload.array("proofImages", MAX_PROOF_IMAGES),
  async (req, res, next) => {
    try {
      const body = ticketSchema.parse(req.body);
      const supportLicenseType = body.licenseType;

      const ticket = await createSupportTicket({
        ...body,
        licenseType: supportLicenseType,
        files: normalizeFiles(req.files),
      });

      res.status(201).json({
        ticket: {
          id: ticket.id,
          subject: ticket.subject,
          hwid: ticket.hwid,
          status: ticket.status,
          createdAt: ticket.createdAt,
          licenseType: supportLicenseType,
          priorityBadge: supportLicenseType === "LIFETIME" ? "Lifetime priority" : null,
          proofs: ticket.proofs,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

function normalizeFiles(files: Express.Multer.File[] | { [fieldname: string]: Express.Multer.File[] } | undefined) {
  if (!files) {
    return [];
  }

  if (Array.isArray(files)) {
    return files.map(toIncomingProofImage);
  }

  return Object.values(files).flat().map(toIncomingProofImage);
}

function toIncomingProofImage(file: Express.Multer.File): IncomingProofImage {
  return {
    originalname: file.originalname,
    mimetype: file.mimetype,
    size: file.size,
    buffer: file.buffer,
  };
}
