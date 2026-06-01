import type { GeneratedAdminAccount, LicenseRecord, LicenseType, LiteTrialRecord, SupportTicket, SupportTicketStatus } from "./types";

type RequestOptions = RequestInit & {
  body?: BodyInit | null;
};

export class ClientApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClientApiError";
  }
}

async function requestJson<T>(path: string, init: RequestOptions = {}) {
  const response = await fetch(path, {
    cache: "no-store",
    ...init,
    headers: {
      ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });
  const payload = (await response.json().catch(() => null)) as (T & { error?: string }) | null;

  if (!response.ok) {
    throw new ClientApiError(payload?.error ?? `Request failed with ${response.status}`);
  }

  return payload as T;
}

export function listLicenses() {
  return requestJson<{ licenses: LicenseRecord[] }>("/api/licenses");
}

export function listLiteTrials() {
  return requestJson<{ trials: LiteTrialRecord[] }>("/api/lite-trials");
}

export function createLicense(payload: {
  type: LicenseType;
  expiresAt: string | null;
  notes: string | null;
}) {
  return requestJson<{ license: LicenseRecord }>("/api/licenses", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function createAdminAccount(payload: {
  type: LicenseType;
  premium: boolean;
  notes: string | null;
}) {
  return requestJson<GeneratedAdminAccount>("/api/admin-accounts", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function runLicenseAction(key: string, action: "enable" | "disable" | "reset-hwid") {
  return requestJson<{ license: LicenseRecord }>(`/api/licenses/${encodeURIComponent(key)}/actions`, {
    method: "POST",
    body: JSON.stringify({ action }),
  });
}

export function deleteLicense(key: string) {
  return requestJson<{ license: LicenseRecord }>(`/api/licenses/${encodeURIComponent(key)}`, {
    method: "DELETE",
  });
}

export function runLiteTrialAction(trialId: string, action: "disable" | "reset") {
  return requestJson<{ trial: LiteTrialRecord }>(`/api/lite-trials/${encodeURIComponent(trialId)}/actions`, {
    method: "POST",
    body: JSON.stringify({ action }),
  });
}

export function deleteLiteTrial(trialId: string) {
  return requestJson<{ trial: LiteTrialRecord }>(`/api/lite-trials/${encodeURIComponent(trialId)}`, {
    method: "DELETE",
  });
}

export function updateLicenseNotes(key: string, notes: string | null) {
  return requestJson<{ license: LicenseRecord }>(`/api/licenses/${encodeURIComponent(key)}`, {
    method: "PATCH",
    body: JSON.stringify({ notes }),
  });
}

export function setLicensePremium(key: string, premium: boolean) {
  return requestJson<{ license: LicenseRecord }>(`/api/licenses/${encodeURIComponent(key)}/premium`, {
    method: "POST",
    body: JSON.stringify({ premium }),
  });
}

export function setLicenseType(key: string, type: LicenseType) {
  return requestJson<{ license: LicenseRecord }>(`/api/licenses/${encodeURIComponent(key)}/type`, {
    method: "POST",
    body: JSON.stringify({ type }),
  });
}

export function resetAdminAccountPassword(key: string) {
  return requestJson<GeneratedAdminAccount>(`/api/licenses/${encodeURIComponent(key)}/password`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function listSupportTickets() {
  return requestJson<{ tickets: SupportTicket[] }>("/api/tickets");
}

export function updateSupportTicket(
  ticketId: string,
  payload: { status?: SupportTicketStatus; adminNote?: string | null },
) {
  return requestJson<{ ticket: SupportTicket }>(`/api/tickets/${encodeURIComponent(ticketId)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function runSupportTicketAction(
  ticketId: string,
  action: "accept-hwid-reset" | "reject" | "close",
  adminNote?: string | null,
) {
  return requestJson<{ ticket: SupportTicket; license?: LicenseRecord }>(
    `/api/tickets/${encodeURIComponent(ticketId)}/actions`,
    {
      method: "POST",
      body: JSON.stringify({
        action,
        ...(adminNote === undefined ? {} : { adminNote }),
      }),
    },
  );
}

export function deleteSupportTicket(ticketId: string) {
  return requestJson<{ ticket: SupportTicket }>(`/api/tickets/${encodeURIComponent(ticketId)}`, {
    method: "DELETE",
  });
}

export async function logout() {
  const response = await fetch("/api/auth/logout", {
    method: "POST",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new ClientApiError("Unable to sign out.");
  }
}
