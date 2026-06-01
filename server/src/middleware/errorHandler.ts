import type { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import multer from "multer";
import { ZodError } from "zod";
import { SupportTicketValidationError } from "../services/supportService.js";

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: "Not found" });
}

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (error instanceof ZodError) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  if (error instanceof SupportTicketValidationError) {
    res.status(400).json({ error: error.message });
    return;
  }

  if (error instanceof multer.MulterError) {
    const messages: Record<string, string> = {
      LIMIT_FILE_SIZE: "Each proof image must be 5 MB or smaller.",
      LIMIT_FILE_COUNT: "Too many proof images attached.",
      LIMIT_PART_COUNT: "Too many form fields or files attached.",
      LIMIT_UNEXPECTED_FILE: "Use the proofImages field for proof uploads.",
    };

    res.status(400).json({ error: messages[error.code] ?? "Invalid proof upload." });
    return;
  }

  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2025"
  ) {
    const modelName = typeof error.meta?.modelName === "string" ? error.meta.modelName : null;
    res.status(404).json({ error: modelName === "SupportTicket" ? "Support ticket not found" : "License not found" });
    return;
  }

  console.error(error);
  res.status(500).json({ error: "Internal server error" });
}
