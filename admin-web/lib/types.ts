export type LicenseType = "LITE" | "PRO" | "LIFETIME";
export type LicenseStatus = "ACTIVE" | "DISABLED" | "EXPIRED";
export type SupportTicketStatus = "OPEN" | "REVIEWING" | "ACCEPTED" | "REJECTED" | "CLOSED";

export type LicenseRecord = {
  id: string;
  key: string;
  type: LicenseType;
  status: LicenseStatus;
  premium: boolean;
  createdAt: string;
  expiresAt: string | null;
  activatedAt: string | null;
  hwid: string | null;
  username: string | null;
  credentialIssuedAt: string | null;
  adminCreated: boolean;
  notes: string | null;
};

export type GeneratedAdminAccount = {
  license: LicenseRecord;
  username: string;
  password: string;
};

export type LiteTrialRecord = {
  id: string;
  licenseId: string;
  hwid: string;
  ipAddress: string;
  userAgent: string | null;
  deviceFingerprint: string | null;
  status: LicenseStatus;
  createdAt: string;
  expiresAt: string;
  disabledAt: string | null;
  resetAt: string | null;
  license: LicenseRecord;
};

export type SupportProofImage = {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
};

export type SupportTicket = {
  id: string;
  subject: string;
  description: string;
  hwid: string;
  status: SupportTicketStatus;
  adminNote: string | null;
  createdAt: string;
  proofs: SupportProofImage[];
};
