-- CreateEnum
CREATE TYPE "LicenseStatus" AS ENUM ('ACTIVE', 'DISABLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "LicenseType" AS ENUM ('LITE', 'PRO', 'LIFETIME');

-- CreateEnum
CREATE TYPE "SupportTicketStatus" AS ENUM ('OPEN', 'REVIEWING', 'ACCEPTED', 'REJECTED', 'CLOSED');

-- CreateTable
CREATE TABLE "License" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "type" "LicenseType" NOT NULL,
    "status" "LicenseStatus" NOT NULL DEFAULT 'ACTIVE',
    "premium" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "activatedAt" TIMESTAMP(3),
    "hwid" TEXT,
    "username" TEXT,
    "passwordHash" TEXT,
    "passwordSalt" TEXT,
    "credentialIssuedAt" TIMESTAMP(3),
    "adminCreated" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,

    CONSTRAINT "License_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiteTrial" (
    "id" TEXT NOT NULL,
    "licenseId" TEXT NOT NULL,
    "hwid" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "userAgent" TEXT,
    "deviceFingerprint" TEXT,
    "status" "LicenseStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "disabledAt" TIMESTAMP(3),
    "resetAt" TIMESTAMP(3),

    CONSTRAINT "LiteTrial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportTicket" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "hwid" TEXT NOT NULL,
    "status" "SupportTicketStatus" NOT NULL DEFAULT 'OPEN',
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportProofImage" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "relativePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "sha256" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportProofImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "License_key_key" ON "License"("key");

-- CreateIndex
CREATE UNIQUE INDEX "License_username_key" ON "License"("username");

-- CreateIndex
CREATE INDEX "License_status_idx" ON "License"("status");

-- CreateIndex
CREATE INDEX "License_type_idx" ON "License"("type");

-- CreateIndex
CREATE INDEX "License_premium_idx" ON "License"("premium");

-- CreateIndex
CREATE INDEX "License_adminCreated_idx" ON "License"("adminCreated");

-- CreateIndex
CREATE INDEX "License_expiresAt_idx" ON "License"("expiresAt");

-- CreateIndex
CREATE INDEX "License_username_idx" ON "License"("username");

-- CreateIndex
CREATE UNIQUE INDEX "LiteTrial_licenseId_key" ON "LiteTrial"("licenseId");

-- CreateIndex
CREATE INDEX "LiteTrial_hwid_idx" ON "LiteTrial"("hwid");

-- CreateIndex
CREATE INDEX "LiteTrial_ipAddress_idx" ON "LiteTrial"("ipAddress");

-- CreateIndex
CREATE INDEX "LiteTrial_status_idx" ON "LiteTrial"("status");

-- CreateIndex
CREATE INDEX "LiteTrial_expiresAt_idx" ON "LiteTrial"("expiresAt");

-- CreateIndex
CREATE INDEX "LiteTrial_resetAt_idx" ON "LiteTrial"("resetAt");

-- CreateIndex
CREATE INDEX "SupportTicket_createdAt_idx" ON "SupportTicket"("createdAt");

-- CreateIndex
CREATE INDEX "SupportTicket_hwid_idx" ON "SupportTicket"("hwid");

-- CreateIndex
CREATE INDEX "SupportTicket_status_idx" ON "SupportTicket"("status");

-- CreateIndex
CREATE INDEX "SupportProofImage_ticketId_idx" ON "SupportProofImage"("ticketId");

-- CreateIndex
CREATE INDEX "SupportProofImage_sha256_idx" ON "SupportProofImage"("sha256");

-- AddForeignKey
ALTER TABLE "LiteTrial" ADD CONSTRAINT "LiteTrial_licenseId_fkey" FOREIGN KEY ("licenseId") REFERENCES "License"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportProofImage" ADD CONSTRAINT "SupportProofImage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
