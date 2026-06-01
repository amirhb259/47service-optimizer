import { Request, Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { env } from "../config/env.js";
import { getLocalDeviceHwid } from "../lib/deviceHwid.js";
import {
  activateLicenseKey,
  createLiteTrialAccount,
  prepareLicenseKeyLogin,
  validateCredentialLogin,
  validateLicenseSession,
} from "../services/licenseService.js";

const licenseKeySchema = z.string().trim().min(6).max(64);
const hwidSchema = z.string().trim().min(8).max(128);

const keyLoginSchema = z.object({
  key: licenseKeySchema,
  hwid: hwidSchema,
});

const credentialLoginSchema = z.object({
  username: z.string().trim().min(3).max(64),
  password: z.string().min(8).max(128),
  hwid: hwidSchema,
});

const liteTrialSchema = z.object({
  hwid: hwidSchema,
  deviceFingerprint: z.string().trim().min(8).max(256).optional(),
});

export const licenseRoutes = Router();

const validationLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.RATE_LIMIT_MAX,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { valid: false, reason: "RATE_LIMITED" },
});

const liteCreationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 3,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { valid: false, reason: "RATE_LIMITED" },
});

licenseRoutes.post("/validate", validationLimiter, async (req, res, next) => {
  try {
    const body = keyLoginSchema.parse(req.body);
    const result = await validateLicenseSession(body.key, body.hwid);

    if (!result.valid) {
      res.status(statusForReason(result.reason)).json(result);
      return;
    }

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

licenseRoutes.get("/hwid", async (_req, res, next) => {
  try {
    const hwid = await getLocalDeviceHwid();
    res.status(200).json({ hwid });
  } catch (error) {
    next(error);
  }
});

licenseRoutes.post("/key-login", validationLimiter, async (req, res, next) => {
  try {
    const body = keyLoginSchema.parse(req.body);
    const result = await prepareLicenseKeyLogin(body.key, body.hwid);

    if (!result.valid) {
      res.status(statusForReason(result.reason)).json(result);
      return;
    }

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

licenseRoutes.post("/activate", validationLimiter, async (req, res, next) => {
  try {
    const body = keyLoginSchema.parse(req.body);
    const result = await activateLicenseKey(body.key, body.hwid);

    if (!result.valid) {
      res.status(statusForReason(result.reason)).json(result);
      return;
    }

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

licenseRoutes.post("/credentials-login", validationLimiter, async (req, res, next) => {
  try {
    const body = credentialLoginSchema.parse(req.body);
    const result = await validateCredentialLogin(body.username, body.password, body.hwid);

    if (!result.valid) {
      res.status(statusForReason(result.reason)).json(result);
      return;
    }

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

licenseRoutes.post("/lite", liteCreationLimiter, async (req, res, next) => {
  try {
    const body = liteTrialSchema.parse(req.body);
    const result = await createLiteTrialAccount(body.hwid, {
      ipAddress: getRequestIp(req),
      userAgent: req.get("user-agent"),
      deviceFingerprint: body.deviceFingerprint,
    });

    if (!result.valid) {
      res.status(statusForReason(result.reason)).json(result);
      return;
    }

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

function statusForReason(reason: string) {
  if (reason === "NOT_FOUND") {
    return 404;
  }

  if (reason === "RATE_LIMITED") {
    return 429;
  }

  if (reason === "KEY_REDEEMED" || reason.startsWith("LITE_")) {
    return 409;
  }

  return 403;
}

function getRequestIp(req: Request) {
  return req.ip || req.socket.remoteAddress || "unknown";
}
