import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(8787),
  DATABASE_URL: z.string().url("DATABASE_URL must be a PostgreSQL connection URL"),
  ADMIN_TOKEN: z.string().min(24, "ADMIN_TOKEN must be at least 24 characters long"),
  CORS_ORIGIN: z.string().default("http://127.0.0.1:1420"),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("Invalid backend environment configuration");
  console.error(parsedEnv.error.flatten().fieldErrors);
  process.exit(1);
}

process.env.DATABASE_URL = parsedEnv.data.DATABASE_URL;

export const env = parsedEnv.data;
