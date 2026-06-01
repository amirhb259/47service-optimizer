import { randomBytes, randomInt, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { Prisma, License, LicenseStatus, LicenseType } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { generateLicenseKey } from "../lib/licenseKeys.js";

const scryptAsync = promisify(scrypt);
const USERNAME_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const PASSWORD_UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const PASSWORD_LOWER = "abcdefghjkmnpqrstuvwxyz";
const PASSWORD_DIGITS = "23456789";
const PASSWORD_SYMBOLS = "@#$%&*+-_!?";
const PASSWORD_ALPHABET = `${PASSWORD_UPPER}${PASSWORD_LOWER}${PASSWORD_DIGITS}${PASSWORD_SYMBOLS}`;
const MIN_CREDENTIAL_LENGTH = 14;
const MAX_CREDENTIAL_LENGTH = 24;

let lastUsernameLength: number | null = null;
let lastPasswordLength: number | null = null;

type LicenseClient = Prisma.TransactionClient | typeof prisma;
const LITE_TRIAL_DAYS = 4;

export type LiteTrialMetadata = {
  ipAddress: string;
  userAgent?: string | null;
  deviceFingerprint?: string | null;
};

export type CreateLicenseInput = {
  type: LicenseType;
  expiresAt?: Date | null;
  notes?: string | null;
};

export type CreateAdminAccessAccountInput = {
  type: LicenseType;
  premium: boolean;
  notes?: string | null;
};

export async function createLicense(input: CreateLicenseInput) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      return await prisma.license.create({
        data: {
          key: generateLicenseKey(input.type),
          type: input.type,
          expiresAt: input.expiresAt ?? null,
          notes: input.notes ?? null,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        continue;
      }

      throw error;
    }
  }

  throw new Error("Unable to generate a unique license key");
}

export async function createAdminAccessAccount(input: CreateAdminAccessAccountInput) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      const credentials = await generateCredentials();
      const license = await prisma.license.create({
        data: {
          key: generateLicenseKey(input.type),
          type: input.type,
          status: LicenseStatus.ACTIVE,
          premium: input.premium,
          expiresAt: null,
          activatedAt: new Date(),
          hwid: null,
          username: credentials.username,
          passwordHash: credentials.passwordHash,
          passwordSalt: credentials.passwordSalt,
          credentialIssuedAt: new Date(),
          adminCreated: true,
          notes: input.notes ?? "Admin-created permanent account",
        },
      });

      return {
        license,
        username: credentials.username,
        password: credentials.password,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        continue;
      }

      throw error;
    }
  }

  throw new Error("Unable to generate a unique admin access account");
}

export async function prepareLicenseKeyLogin(key: string, hwid: string) {
  const normalizedKey = normalizeLicenseKey(key);
  const normalizedHwid = normalizeHwid(hwid);
  const license = await prisma.license.findUnique({ where: { key: normalizedKey } });
  const inactive = await getInactiveResult(license);

  if (inactive) {
    return inactive;
  }

  if (!license) {
    return { valid: false as const, reason: "NOT_FOUND" as const };
  }

  if (license.hwid && license.hwid !== normalizedHwid) {
    return { valid: false as const, reason: "HWID_MISMATCH" as const };
  }

  if (license.hwid || license.credentialIssuedAt) {
    return { valid: false as const, reason: "KEY_REDEEMED" as const };
  }

  if (!license.hwid) {
    return {
      valid: true as const,
      requiresActivation: true as const,
      type: license.type,
      key: license.key,
      premium: license.premium,
    };
  }

  return {
    valid: true as const,
    requiresActivation: false as const,
    type: license.type,
    key: license.key,
    premium: license.premium,
  };
}

export async function validateLicenseSession(key: string, hwid: string) {
  const normalizedKey = normalizeLicenseKey(key);
  const normalizedHwid = normalizeHwid(hwid);
  const license = await prisma.license.findUnique({ where: { key: normalizedKey } });
  const inactive = await getInactiveResult(license);

  if (inactive) {
    return inactive;
  }

  if (!license) {
    return { valid: false as const, reason: "NOT_FOUND" as const };
  }

  if (!license.hwid) {
    return { valid: false as const, reason: "FIRST_ACTIVATION_REQUIRED" as const };
  }

  if (license.credentialIssuedAt) {
    return { valid: false as const, reason: "CREDENTIAL_LOGIN_REQUIRED" as const };
  }

  if (license.hwid !== normalizedHwid) {
    return { valid: false as const, reason: "HWID_MISMATCH" as const };
  }

  return { valid: true as const, type: license.type, key: license.key, premium: license.premium };
}

export async function activateLicenseKey(key: string, hwid: string) {
  const normalizedKey = normalizeLicenseKey(key);
  const normalizedHwid = normalizeHwid(hwid);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        const license = await tx.license.findUnique({ where: { key: normalizedKey } });
        const inactive = await getInactiveResult(license, tx);

        if (inactive) {
          return inactive;
        }

        if (!license) {
          return { valid: false as const, reason: "NOT_FOUND" as const };
        }

        if (license.hwid && license.hwid !== normalizedHwid) {
          return { valid: false as const, reason: "HWID_MISMATCH" as const };
        }

        if (license.hwid || license.credentialIssuedAt) {
          return { valid: false as const, reason: "KEY_REDEEMED" as const };
        }

        const credentials = await generateCredentials();
        const updated = await tx.license.updateMany({
          where: { id: license.id, hwid: null },
          data: {
            activatedAt: new Date(),
            hwid: normalizedHwid,
            username: credentials.username,
            passwordHash: credentials.passwordHash,
            passwordSalt: credentials.passwordSalt,
            credentialIssuedAt: new Date(),
          },
        });

        if (updated.count !== 1) {
          const current = await tx.license.findUnique({ where: { id: license.id } });
          if (current?.hwid === normalizedHwid) {
            return { valid: false as const, reason: "KEY_REDEEMED" as const };
          }

          return { valid: false as const, reason: "HWID_MISMATCH" as const };
        }

        return {
          valid: true as const,
          type: license.type,
          key: license.key,
          firstActivation: true as const,
          hwid: normalizedHwid,
          username: credentials.username,
          password: credentials.password,
          premium: license.premium,
        };
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        continue;
      }

      throw error;
    }
  }

  throw new Error("Unable to generate unique activation credentials");
}

export async function validateCredentialLogin(username: string, password: string, hwid: string) {
  const normalizedUsername = normalizeUsername(username);
  const normalizedHwid = normalizeHwid(hwid);
  const license = await prisma.license.findUnique({
    where: { username: normalizedUsername },
  });
  const inactive = await getInactiveResult(license);

  if (inactive) {
    return inactive;
  }

  if (!license) {
    return { valid: false as const, reason: "INVALID_CREDENTIALS" as const };
  }

  if (!license.passwordHash || !license.passwordSalt) {
    return { valid: false as const, reason: "INVALID_CREDENTIALS" as const };
  }

  const isPasswordValid = await verifyPassword(password, license.passwordSalt, license.passwordHash);

  if (!isPasswordValid) {
    return { valid: false as const, reason: "INVALID_CREDENTIALS" as const };
  }

  if (license.adminCreated) {
    return { valid: true as const, type: license.type, key: license.key, premium: license.premium };
  }

  if (!license.hwid) {
    const updated = await prisma.license.update({
      where: { id: license.id },
      data: {
        hwid: normalizedHwid,
        activatedAt: new Date(),
      },
    });

    return { valid: true as const, type: updated.type, key: updated.key, premium: updated.premium };
  }

  if (license.hwid !== normalizedHwid) {
    return { valid: false as const, reason: "HWID_MISMATCH" as const };
  }

  return { valid: true as const, type: license.type, key: license.key, premium: license.premium };
}

export async function createLiteTrialAccount(hwid: string, metadata: LiteTrialMetadata) {
  const normalizedHwid = normalizeHwid(hwid);
  const normalizedIp = normalizeIpAddress(metadata.ipAddress);
  const userAgent = normalizeOptionalText(metadata.userAgent, 500);
  const deviceFingerprint = normalizeOptionalText(metadata.deviceFingerprint, 256);

  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        const now = new Date();
        await expireLiteTrials(tx, now);

        const existingHwidTrial = await tx.liteTrial.findFirst({
          where: {
            hwid: normalizedHwid,
            resetAt: null,
          },
        });

        if (existingHwidTrial) {
          return { valid: false as const, reason: "LITE_HWID_USED" as const };
        }

        const existingIpTrial = await tx.liteTrial.findFirst({
          where: {
            ipAddress: normalizedIp,
            resetAt: null,
            status: LicenseStatus.ACTIVE,
            expiresAt: { gt: now },
          },
        });

        if (existingIpTrial) {
          return { valid: false as const, reason: "LITE_IP_USED" as const };
        }

        if (deviceFingerprint) {
          const existingFingerprintTrial = await tx.liteTrial.findFirst({
            where: {
              deviceFingerprint,
              resetAt: null,
              status: LicenseStatus.ACTIVE,
              expiresAt: { gt: now },
            },
          });

          if (existingFingerprintTrial) {
            return { valid: false as const, reason: "LITE_DEVICE_USED" as const };
          }
        }

        const credentials = await generateCredentials();
        const expiresAt = new Date(now.getTime() + LITE_TRIAL_DAYS * 24 * 60 * 60 * 1000);
        const license = await tx.license.create({
          data: {
            key: generateLicenseKey(LicenseType.LITE),
            type: LicenseType.LITE,
            status: LicenseStatus.ACTIVE,
            premium: false,
            expiresAt,
            activatedAt: now,
            hwid: normalizedHwid,
            username: credentials.username,
            passwordHash: credentials.passwordHash,
            passwordSalt: credentials.passwordSalt,
            credentialIssuedAt: now,
            notes: "Lite trial account",
          },
        });

        await tx.liteTrial.create({
          data: {
            licenseId: license.id,
            hwid: normalizedHwid,
            ipAddress: normalizedIp,
            userAgent,
            deviceFingerprint,
            status: LicenseStatus.ACTIVE,
            expiresAt,
          },
        });

        return {
          valid: true as const,
          type: license.type,
          key: license.key,
          premium: license.premium,
          expiresAt,
          hwid: normalizedHwid,
          username: credentials.username,
          password: credentials.password,
        };
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        continue;
      }

      throw error;
    }
  }

  throw new Error("Unable to create a unique Lite account");
}

export async function listLicenses() {
  return prisma.license.findMany({
    orderBy: { createdAt: "desc" },
  });
}

export async function listLiteTrials() {
  await expireLiteTrials(prisma, new Date());
  return prisma.liteTrial.findMany({
    include: { license: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function disableLiteTrial(trialId: string) {
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const trial = await tx.liteTrial.update({
      where: { id: trialId },
      data: {
        status: LicenseStatus.DISABLED,
        disabledAt: now,
        license: {
          update: { status: LicenseStatus.DISABLED },
        },
      },
      include: { license: true },
    });

    return trial;
  });
}

export async function resetLiteTrial(trialId: string) {
  const now = new Date();
  return prisma.liteTrial.update({
    where: { id: trialId },
    data: {
      status: LicenseStatus.DISABLED,
      disabledAt: now,
      resetAt: now,
      license: {
        update: { status: LicenseStatus.DISABLED },
      },
    },
    include: { license: true },
  });
}

export async function deleteLiteTrial(trialId: string) {
  return prisma.$transaction(async (tx) => {
    const trial = await tx.liteTrial.findUnique({
      where: { id: trialId },
      include: { license: true },
    });

    if (!trial) {
      throw new Error("Lite trial not found");
    }

    await tx.license.delete({ where: { id: trial.licenseId } });
    return trial;
  });
}

export async function disableLicense(key: string) {
  return prisma.license.update({
    where: { key: normalizeLicenseKey(key) },
    data: { status: LicenseStatus.DISABLED },
  });
}

export async function enableLicense(key: string) {
  const license = await prisma.license.findUnique({
    where: { key: normalizeLicenseKey(key) },
  });

  if (!license) {
    throw new Error("License not found");
  }

  const now = new Date();
  const status =
    license.expiresAt && license.expiresAt.getTime() <= now.getTime()
      ? LicenseStatus.EXPIRED
      : LicenseStatus.ACTIVE;

  return prisma.license.update({
    where: { key: normalizeLicenseKey(key) },
    data: { status },
  });
}

export async function deleteLicense(key: string) {
  return prisma.license.delete({
    where: { key: normalizeLicenseKey(key) },
  });
}

export async function resetLicenseHwid(key: string) {
  return prisma.license.update({
    where: { key: normalizeLicenseKey(key) },
    data: {
      activatedAt: null,
      hwid: null,
    },
  });
}

export async function setLicensePremium(key: string, premium: boolean) {
  return prisma.license.update({
    where: { key: normalizeLicenseKey(key) },
    data: { premium },
  });
}

export async function setLicenseType(key: string, type: LicenseType) {
  return prisma.license.update({
    where: { key: normalizeLicenseKey(key) },
    data: { type },
  });
}

export async function resetAdminAccountPassword(key: string) {
  const normalizedKey = normalizeLicenseKey(key);
  const license = await prisma.license.findUnique({ where: { key: normalizedKey } });

  if (!license) {
    throw new Error("License not found");
  }

  if (!license.adminCreated || !license.username) {
    throw new Error("Password reset is only available for admin-created accounts");
  }

  const credentials = await generateCredentials();
  const updated = await prisma.license.update({
    where: { key: normalizedKey },
    data: {
      passwordHash: credentials.passwordHash,
      passwordSalt: credentials.passwordSalt,
      credentialIssuedAt: new Date(),
      hwid: null,
    },
  });

  return {
    license: updated,
    username: updated.username,
    password: credentials.password,
  };
}

export async function listPremiumLicenses() {
  return prisma.license.findMany({
    where: { premium: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function updateLicenseNotes(key: string, notes: string | null) {
  return prisma.license.update({
    where: { key: normalizeLicenseKey(key) },
    data: { notes },
  });
}

async function getInactiveResult(license: License | null, client: LicenseClient = prisma) {
  if (!license) {
    return null;
  }

  if (license.status === LicenseStatus.DISABLED) {
    if (license.type === LicenseType.LITE) {
      await client.liteTrial.updateMany({
        where: { licenseId: license.id, status: { not: LicenseStatus.DISABLED } },
        data: { status: LicenseStatus.DISABLED, disabledAt: new Date() },
      });
    }

    return { valid: false as const, reason: "DISABLED" as const };
  }

  const now = new Date();
  if (
    license.status === LicenseStatus.EXPIRED ||
    (license.expiresAt && license.expiresAt.getTime() <= now.getTime())
  ) {
    if (license.status !== LicenseStatus.EXPIRED) {
      await client.license.update({
        where: { id: license.id },
        data: { status: LicenseStatus.EXPIRED },
      });
    }

    if (license.type === LicenseType.LITE) {
      await client.liteTrial.updateMany({
        where: { licenseId: license.id, status: { not: LicenseStatus.EXPIRED } },
        data: { status: LicenseStatus.EXPIRED },
      });
    }

    return { valid: false as const, reason: "EXPIRED" as const };
  }

  return null;
}

async function expireLiteTrials(client: LicenseClient, now: Date) {
  const expiredTrials = await client.liteTrial.findMany({
    where: {
      status: LicenseStatus.ACTIVE,
      expiresAt: { lte: now },
    },
    select: { id: true, licenseId: true },
  });

  if (!expiredTrials.length) {
    return;
  }

  const trialIds = expiredTrials.map((trial) => trial.id);
  const licenseIds = expiredTrials.map((trial) => trial.licenseId);

  await client.liteTrial.updateMany({
    where: { id: { in: trialIds } },
    data: { status: LicenseStatus.EXPIRED },
  });

  await client.license.updateMany({
    where: { id: { in: licenseIds } },
    data: { status: LicenseStatus.EXPIRED },
  });
}

async function generateCredentials() {
  const usernameLength = randomCredentialLength(lastUsernameLength);
  lastUsernameLength = usernameLength;
  const passwordLength = randomCredentialLength(lastPasswordLength, usernameLength);
  lastPasswordLength = passwordLength;

  const username = randomString(usernameLength, USERNAME_ALPHABET);
  const password = strongRandomPassword(passwordLength);
  const passwordSalt = randomBytes(16).toString("hex");
  const passwordHash = await hashPassword(password, passwordSalt);

  return {
    username,
    password,
    passwordHash,
    passwordSalt,
  };
}

function randomCredentialLength(previousLength: number | null, avoidLength?: number) {
  const optionCount = MAX_CREDENTIAL_LENGTH - MIN_CREDENTIAL_LENGTH + 1;
  let length = randomInt(MIN_CREDENTIAL_LENGTH, MAX_CREDENTIAL_LENGTH + 1);

  if ((previousLength !== null || avoidLength !== undefined) && optionCount > 1) {
    while (length === previousLength || length === avoidLength) {
      length = randomInt(MIN_CREDENTIAL_LENGTH, MAX_CREDENTIAL_LENGTH + 1);
    }
  }

  return length;
}

function randomString(length: number, alphabet: string) {
  let value = "";
  for (let index = 0; index < length; index += 1) {
    value += alphabet[randomInt(0, alphabet.length)];
  }

  return value;
}

function strongRandomPassword(length: number) {
  const requiredCharacters = [
    randomString(1, PASSWORD_UPPER),
    randomString(1, PASSWORD_LOWER),
    randomString(1, PASSWORD_DIGITS),
    randomString(1, PASSWORD_SYMBOLS),
  ];

  const remainingCharacters = Array.from({ length: length - requiredCharacters.length }, () =>
    randomString(1, PASSWORD_ALPHABET),
  );

  return shuffleCharacters([...requiredCharacters, ...remainingCharacters]).join("");
}

function shuffleCharacters(characters: string[]) {
  for (let index = characters.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(0, index + 1);
    [characters[index], characters[swapIndex]] = [characters[swapIndex], characters[index]];
  }

  return characters;
}

async function hashPassword(password: string, salt: string) {
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  return derived.toString("hex");
}

async function verifyPassword(password: string, salt: string, expectedHash: string) {
  const actualHash = Buffer.from(await hashPassword(password, salt), "hex");
  const expected = Buffer.from(expectedHash, "hex");

  if (actualHash.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(actualHash, expected);
}

export function normalizeLicenseKey(key: string) {
  return key.trim().toUpperCase();
}

export function normalizeHwid(hwid: string) {
  return hwid.trim();
}

export function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

function normalizeIpAddress(ipAddress: string) {
  const normalized = ipAddress.trim();
  return normalized || "unknown";
}

function normalizeOptionalText(value: string | null | undefined, maxLength: number) {
  const normalized = value?.trim();
  return normalized ? normalized.slice(0, maxLength) : null;
}
