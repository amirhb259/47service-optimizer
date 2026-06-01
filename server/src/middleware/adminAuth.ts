import type { NextFunction, Request, Response } from "express";
import { timingSafeEqual } from "node:crypto";
import { env } from "../config/env.js";

function tokensMatch(receivedToken: string) {
  const expected = Buffer.from(env.ADMIN_TOKEN);
  const received = Buffer.from(receivedToken);

  return expected.length === received.length && timingSafeEqual(expected, received);
}

export function requireAdminToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.header("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : undefined;
  const adminToken = bearerToken ?? req.header("x-admin-token");

  if (!adminToken || !tokensMatch(adminToken)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  next();
}
