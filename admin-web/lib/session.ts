import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "admin_session";
const SESSION_TTL_SECONDS = 8 * 60 * 60;

function getSessionSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET;

  if (!secret || secret.length < 24) {
    throw new Error("ADMIN_SESSION_SECRET must be configured for admin sessions.");
  }

  return secret;
}

function sign(value: string) {
  return createHmac("sha256", getSessionSecret()).update(value).digest("hex");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function verifyAdminCredentials(username: string, password: string) {
  const expectedUser = process.env.ADMIN_DASHBOARD_USER ?? "admin";
  const expectedPassword = process.env.ADMIN_DASHBOARD_PASSWORD;

  if (!expectedPassword || expectedPassword.length < 12) {
    throw new Error("ADMIN_DASHBOARD_PASSWORD must be configured and at least 12 characters long.");
  }

  return safeEqual(username.trim(), expectedUser) && safeEqual(password, expectedPassword);
}

export async function createAdminSession() {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = `admin.${expiresAt}`;
  const value = `${payload}.${sign(payload)}`;
  const cookieStore = await cookies();

  cookieStore.set(COOKIE_NAME, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_SECONDS,
    path: "/",
  });
}

export async function clearAdminSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function hasAdminSession() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(COOKIE_NAME)?.value;

  if (!raw) {
    return false;
  }

  const parts = raw.split(".");
  if (parts.length !== 3 || parts[0] !== "admin") {
    return false;
  }

  const payload = `${parts[0]}.${parts[1]}`;
  const signature = parts[2];
  const expiresAt = Number(parts[1]);

  if (!Number.isFinite(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000)) {
    return false;
  }

  return safeEqual(signature, sign(payload));
}
