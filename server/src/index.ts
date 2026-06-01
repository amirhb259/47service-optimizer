import express from "express";
import cors from "cors";
import { env } from "./config/env.js";
import { ensureDatabaseReady } from "./lib/database.js";
import { prisma } from "./lib/prisma.js";
import { adminRoutes } from "./routes/adminRoutes.js";
import { licenseRoutes } from "./routes/licenseRoutes.js";
import { supportRoutes } from "./routes/supportRoutes.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

async function main() {
  await ensureDatabaseReady();
  await prisma.$connect();

  const app = express();

  app.disable("x-powered-by");
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: false }));
  app.use(express.json({ limit: "16kb" }));

  app.get("/health", (_req, res) => {
    res.status(200).json({ ok: true });
  });

  app.use("/api/license", licenseRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/support", supportRoutes);
  app.use(notFoundHandler);
  app.use(errorHandler);

  const server = app.listen(env.PORT, "127.0.0.1", () => {
    console.log(`47Service license backend listening on http://127.0.0.1:${env.PORT}`);
  });

  const shutdown = async () => {
    server.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
