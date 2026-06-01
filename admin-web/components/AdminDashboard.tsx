"use client";

import { useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  Ban,
  CheckCircle2,
  Copy,
  Crown,
  Eye,
  FileImage,
  KeyRound,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  MoreHorizontal,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  Ticket,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  createLicense,
  createAdminAccount,
  deleteLicense,
  deleteLiteTrial,
  deleteSupportTicket,
  listLicenses,
  listLiteTrials,
  listSupportTickets,
  logout as logoutSession,
  runLicenseAction as runClientLicenseAction,
  runLiteTrialAction,
  runSupportTicketAction,
  resetAdminAccountPassword,
  setLicensePremium,
  setLicenseType,
  updateLicenseNotes,
  updateSupportTicket,
} from "../lib/clientApi";
import type {
  LicenseRecord,
  LicenseStatus,
  LicenseType,
  GeneratedAdminAccount,
  LiteTrialRecord,
  SupportTicket,
  SupportTicketStatus,
} from "../lib/types";

const licenseTypes: LicenseType[] = ["LITE", "PRO", "LIFETIME"];
const statusFilters: Array<LicenseStatus | "ALL"> = ["ALL", "ACTIVE", "DISABLED", "EXPIRED"];
const ticketStatuses: SupportTicketStatus[] = ["OPEN", "ACCEPTED", "REJECTED", "CLOSED"];
const activeTicketStatuses = new Set<SupportTicketStatus>(["OPEN", "REVIEWING"]);

type Props = {
  initialLicenses: LicenseRecord[];
  initialLiteTrials: LiteTrialRecord[];
  initialTickets: SupportTicket[];
};

type AdminSection = "overview" | "licenses" | "adminAccounts" | "lite" | "tickets" | "premium";
type ActionMenuItem = {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
};

export default function AdminDashboard({ initialLicenses, initialLiteTrials, initialTickets }: Props) {
  const router = useRouter();
  const [activeSection, setActiveSection] = useState<AdminSection>("overview");
  const [licenses, setLicenses] = useState(initialLicenses);
  const [liteTrials, setLiteTrials] = useState(initialLiteTrials);
  const [tickets, setTickets] = useState(initialTickets);
  const [licenseQuery, setLicenseQuery] = useState("");
  const [liteTrialQuery, setLiteTrialQuery] = useState("");
  const [ticketQuery, setTicketQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<LicenseStatus | "ALL">("ALL");
  const [type, setType] = useState<LicenseType>("PRO");
  const [adminAccountType, setAdminAccountType] = useState<LicenseType>("PRO");
  const [adminAccountPremium, setAdminAccountPremium] = useState(false);
  const [adminAccountNotes, setAdminAccountNotes] = useState("");
  const [generatedAccount, setGeneratedAccount] = useState<GeneratedAdminAccount | null>(null);
  const [expiresAt, setExpiresAt] = useState("");
  const [notes, setNotes] = useState("");
  const [draftNotes, setDraftNotes] = useState<Record<string, string>>(
    Object.fromEntries(initialLicenses.map((license) => [license.key, license.notes ?? ""])),
  );
  const [ticketAdminNotes, setTicketAdminNotes] = useState<Record<string, string>>(
    Object.fromEntries(initialTickets.map((ticket) => [ticket.id, ticket.adminNote ?? ""])),
  );
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [selectedNotesKey, setSelectedNotesKey] = useState<string | null>(null);
  const [openActionMenu, setOpenActionMenu] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const activeCount = useMemo(() => licenses.filter((license) => license.status === "ACTIVE").length, [licenses]);
  const disabledCount = useMemo(() => licenses.filter((license) => license.status === "DISABLED").length, [licenses]);
  const activatedCount = useMemo(() => licenses.filter((license) => Boolean(license.hwid)).length, [licenses]);
  const openTicketCount = useMemo(
    () => tickets.filter((ticketItem) => activeTicketStatuses.has(ticketItem.status)).length,
    [tickets],
  );
  const premiumCount = useMemo(() => licenses.filter((license) => license.premium).length, [licenses]);
  const activeLiteTrialCount = useMemo(
    () => liteTrials.filter((trial) => trial.status === "ACTIVE" && !trial.resetAt).length,
    [liteTrials],
  );
  const selectedTicket = useMemo(
    () => tickets.find((ticketItem) => ticketItem.id === selectedTicketId) ?? null,
    [tickets, selectedTicketId],
  );
  const selectedNotesLicense = useMemo(
    () => licenses.find((license) => license.key === selectedNotesKey) ?? null,
    [licenses, selectedNotesKey],
  );

  const filteredLicenses = useMemo(() => {
    const query = licenseQuery.trim().toLowerCase();

    return licenses.filter((license) => {
      if (statusFilter !== "ALL" && license.status !== statusFilter) {
        return false;
      }

      if (!query) {
        return true;
      }

      return [license.key, license.type, license.status, license.hwid, license.username, license.notes]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [licenses, licenseQuery, statusFilter]);

  const filteredPremiumLicenses = useMemo(
    () => filteredLicenses.filter((license) => license.premium),
    [filteredLicenses],
  );
  const filteredAdminAccounts = useMemo(
    () => filteredLicenses.filter((license) => license.adminCreated),
    [filteredLicenses],
  );

  const filteredTickets = useMemo(() => {
    const query = ticketQuery.trim().toLowerCase();

    if (!query) {
      return tickets;
    }

    return tickets.filter((ticketItem) =>
      [ticketItem.id, ticketItem.subject, ticketItem.description, ticketItem.hwid, ticketItem.status, ticketItem.adminNote]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [tickets, ticketQuery]);

  const filteredLiteTrials = useMemo(() => {
    const query = liteTrialQuery.trim().toLowerCase();

    if (!query) {
      return liteTrials;
    }

    return liteTrials.filter((trial) =>
      [
        trial.id,
        trial.hwid,
        trial.ipAddress,
        trial.status,
        trial.userAgent,
        trial.deviceFingerprint,
        trial.license.key,
        trial.license.username,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [liteTrials, liteTrialQuery]);

  const recentTickets = useMemo(() => tickets.slice(0, 5), [tickets]);
  const expiringLicenses = useMemo(() => {
    const now = Date.now();
    const soon = now + 1000 * 60 * 60 * 24 * 14;

    return licenses
      .filter((license) => {
        if (!license.expiresAt || license.status !== "ACTIVE") {
          return false;
        }

        const expires = new Date(license.expiresAt).getTime();
        return expires >= now && expires <= soon;
      })
      .slice(0, 5);
  }, [licenses]);

  const sections = [
    { id: "overview" as const, label: "Overview", icon: <LayoutDashboard size={16} />, count: null },
    { id: "licenses" as const, label: "Licenses", icon: <KeyRound size={16} />, count: licenses.length },
    { id: "adminAccounts" as const, label: "Admin Accounts", icon: <UserPlus size={16} />, count: licenses.filter((license) => license.adminCreated).length },
    { id: "lite" as const, label: "Lite Trials", icon: <ShieldCheck size={16} />, count: liteTrials.length },
    { id: "tickets" as const, label: "Tickets", icon: <Ticket size={16} />, count: openTicketCount },
    { id: "premium" as const, label: "Premium Users", icon: <Users size={16} />, count: premiumCount },
  ];

  async function refreshAll() {
    setIsRefreshing(true);
    setError("");
    setMessage("");

    try {
      const [licensePayload, liteTrialPayload, ticketPayload] = await Promise.all([
        listLicenses(),
        listLiteTrials(),
        listSupportTickets(),
      ]);
      setLicenses(licensePayload.licenses);
      setLiteTrials(liteTrialPayload.trials);
      setTickets(ticketPayload.tickets);
      setDraftNotes(Object.fromEntries(licensePayload.licenses.map((license) => [license.key, license.notes ?? ""])));
      setTicketAdminNotes(Object.fromEntries(ticketPayload.tickets.map((ticketItem) => [ticketItem.id, ticketItem.adminNote ?? ""])));
      setMessage("Admin data refreshed.");
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "Unable to refresh admin data.");
    } finally {
      setIsRefreshing(false);
    }
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsCreating(true);
    setError("");
    setMessage("");

    try {
      const payload = await createLicense({
        type,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        notes: notes.trim() || null,
      });
      setLicenses((current) => [payload.license, ...current]);
      setDraftNotes((current) => ({ ...current, [payload.license.key]: payload.license.notes ?? "" }));
      setNotes("");
      setMessage(`Created ${payload.license.key}`);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Unable to create license.");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleCreateAdminAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsCreating(true);
    setError("");
    setMessage("");

    try {
      const payload = await createAdminAccount({
        type: adminAccountType,
        premium: adminAccountPremium,
        notes: adminAccountNotes.trim() || null,
      });
      setLicenses((current) => [payload.license, ...current]);
      setDraftNotes((current) => ({ ...current, [payload.license.key]: payload.license.notes ?? "" }));
      setAdminAccountNotes("");
      setGeneratedAccount(payload);
      setMessage(`Created admin access account ${payload.username}.`);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Unable to create admin access account.");
    } finally {
      setIsCreating(false);
    }
  }

  async function runLicenseAction(key: string, action: "enable" | "disable" | "reset-hwid" | "delete") {
    if (action === "delete" && !window.confirm("Delete this license permanently?")) {
      return;
    }

    if (action === "reset-hwid" && !window.confirm("Reset this license HWID and activation credentials?")) {
      return;
    }

    setOpenActionMenu(null);
    setBusyKey(`${key}:${action}`);
    setError("");
    setMessage("");

    try {
      const payload =
        action === "delete" ? await deleteLicense(key) : await runClientLicenseAction(key, action);
      if (action === "delete") {
        setLicenses((current) => current.filter((license) => license.id !== payload.license.id));
        setMessage(`Deleted ${payload.license.key}`);
      } else {
        setLicenses((current) =>
          current.map((license) => (license.id === payload.license.id ? payload.license : license)),
        );
        setDraftNotes((current) => ({ ...current, [payload.license.key]: payload.license.notes ?? "" }));
        setMessage(action === "reset-hwid" ? `HWID reset for ${payload.license.key}` : `Updated ${payload.license.key}`);
      }
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "License action failed.");
    } finally {
      setBusyKey(null);
    }
  }

  async function saveNotes(key: string) {
    setBusyKey(`${key}:notes`);
    setError("");
    setMessage("");

    try {
      const payload = await updateLicenseNotes(key, draftNotes[key]?.trim() || null);
      setLicenses((current) => current.map((license) => (license.id === payload.license.id ? payload.license : license)));
      setMessage(`Notes saved for ${payload.license.key}`);
      setSelectedNotesKey(null);
    } catch (notesError) {
      setError(notesError instanceof Error ? notesError.message : "Unable to save notes.");
    } finally {
      setBusyKey(null);
    }
  }

  async function copyKey(key: string) {
    await navigator.clipboard.writeText(key);
    setOpenActionMenu(null);
    setMessage("License key copied.");
  }

  function updateTicketState(ticket: SupportTicket) {
    setTickets((current) => current.map((item) => (item.id === ticket.id ? ticket : item)));
    setTicketAdminNotes((current) => ({ ...current, [ticket.id]: ticket.adminNote ?? "" }));
  }

  async function togglePremium(license: LicenseRecord) {
    setOpenActionMenu(null);
    setBusyKey(`${license.key}:premium`);
    setError("");
    setMessage("");

    try {
      const payload = await setLicensePremium(license.key, !license.premium);
      setLicenses((current) => current.map((item) => (item.id === payload.license.id ? payload.license : item)));
      setDraftNotes((current) => ({ ...current, [payload.license.key]: payload.license.notes ?? "" }));
      setMessage(`Premium ${payload.license.premium ? "enabled" : "disabled"} for ${payload.license.key}.`);
    } catch (premiumError) {
      setError(premiumError instanceof Error ? premiumError.message : "Premium update failed.");
    } finally {
      setBusyKey(null);
    }
  }

  async function changeLicenseType(license: LicenseRecord, nextType: LicenseType) {
    if (license.type === nextType) {
      return;
    }

    setOpenActionMenu(null);
    setBusyKey(`${license.key}:type`);
    setError("");
    setMessage("");

    try {
      const payload = await setLicenseType(license.key, nextType);
      setLicenses((current) => current.map((item) => (item.id === payload.license.id ? payload.license : item)));
      setDraftNotes((current) => ({ ...current, [payload.license.key]: payload.license.notes ?? "" }));
      setMessage(`Rank changed to ${payload.license.type} for ${payload.license.key}.`);
    } catch (typeError) {
      setError(typeError instanceof Error ? typeError.message : "Rank update failed.");
    } finally {
      setBusyKey(null);
    }
  }

  async function resetAdminPassword(license: LicenseRecord) {
    if (!window.confirm("Reset this admin-created account password? The new password will only be shown once.")) {
      return;
    }

    setOpenActionMenu(null);
    setBusyKey(`${license.key}:password`);
    setError("");
    setMessage("");

    try {
      const payload = await resetAdminAccountPassword(license.key);
      setLicenses((current) => current.map((item) => (item.id === payload.license.id ? payload.license : item)));
      setDraftNotes((current) => ({ ...current, [payload.license.key]: payload.license.notes ?? "" }));
      setGeneratedAccount(payload);
      setMessage(`Password reset for ${payload.username}.`);
    } catch (passwordError) {
      setError(passwordError instanceof Error ? passwordError.message : "Password reset failed.");
    } finally {
      setBusyKey(null);
    }
  }

  async function runLiteAction(trial: LiteTrialRecord, action: "disable" | "reset" | "delete") {
    if (action === "reset" && !window.confirm("Reset this Lite trial? The current account will be disabled and this HWID can create a new Lite account.")) {
      return;
    }

    if (action === "delete" && !window.confirm("Delete this Lite trial and its linked account permanently?")) {
      return;
    }

    setOpenActionMenu(null);
    setBusyKey(`lite:${trial.id}:${action}`);
    setError("");
    setMessage("");

    try {
      const payload = action === "delete"
        ? await deleteLiteTrial(trial.id)
        : await runLiteTrialAction(trial.id, action);

      if (action === "delete") {
        setLiteTrials((current) => current.filter((item) => item.id !== payload.trial.id));
        setLicenses((current) => current.filter((license) => license.id !== payload.trial.licenseId));
        setMessage(`Deleted Lite trial ${payload.trial.id.slice(0, 8)}.`);
        return;
      }

      setLiteTrials((current) => current.map((item) => (item.id === payload.trial.id ? payload.trial : item)));
      setLicenses((current) =>
        current.map((license) => (license.id === payload.trial.license.id ? payload.trial.license : license)),
      );
      setDraftNotes((current) => ({ ...current, [payload.trial.license.key]: payload.trial.license.notes ?? "" }));
      setMessage(action === "reset" ? "Lite trial reset. This HWID can create a new Lite account." : "Lite trial disabled.");
    } catch (liteError) {
      setError(liteError instanceof Error ? liteError.message : "Lite trial action failed.");
    } finally {
      setBusyKey(null);
    }
  }

  async function saveTicketNote(ticketItem: SupportTicket) {
    setBusyKey(`ticket:${ticketItem.id}:note`);
    setError("");
    setMessage("");

    try {
      const payload = await updateSupportTicket(ticketItem.id, {
        adminNote: ticketAdminNotes[ticketItem.id]?.trim() || null,
      });
      updateTicketState(payload.ticket);
      setMessage(`Admin note saved for ticket ${payload.ticket.id.slice(0, 8)}.`);
    } catch (noteError) {
      setError(noteError instanceof Error ? noteError.message : "Unable to save ticket note.");
    } finally {
      setBusyKey(null);
    }
  }

  async function setTicketStatus(ticketItem: SupportTicket, status: SupportTicketStatus) {
    if (ticketItem.status === status) {
      return;
    }

    setBusyKey(`ticket:${ticketItem.id}:status`);
    setError("");
    setMessage("");

    try {
      const payload = await updateSupportTicket(ticketItem.id, { status });
      updateTicketState(payload.ticket);
      setMessage(`Ticket ${payload.ticket.id.slice(0, 8)} set to ${payload.ticket.status}.`);
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "Unable to update ticket status.");
    } finally {
      setBusyKey(null);
    }
  }

  async function runTicketAction(ticketItem: SupportTicket, action: "accept-hwid-reset" | "reject" | "close" | "delete") {
    if (action === "accept-hwid-reset" && !window.confirm("Accept this HWID reset and clear the linked license HWID?")) {
      return;
    }

    if (action === "delete" && !window.confirm("Delete this support ticket and its proof files permanently?")) {
      return;
    }

    setOpenActionMenu(null);
    setBusyKey(`ticket:${ticketItem.id}:${action}`);
    setError("");
    setMessage("");

    try {
      if (action === "delete") {
        const payload = await deleteSupportTicket(ticketItem.id);
        setTickets((current) => current.filter((item) => item.id !== payload.ticket.id));
        setTicketAdminNotes((current) => {
          const next = { ...current };
          delete next[payload.ticket.id];
          return next;
        });
        setSelectedTicketId(null);
        setMessage(`Deleted ticket ${payload.ticket.id.slice(0, 8)}.`);
        return;
      }

      const payload = await runSupportTicketAction(ticketItem.id, action, ticketAdminNotes[ticketItem.id]?.trim() || null);
      updateTicketState(payload.ticket);

      if (payload.license) {
        const updatedLicense = payload.license;
        setLicenses((current) =>
          current.map((license) => (license.id === updatedLicense.id ? updatedLicense : license)),
        );
        setDraftNotes((current) => ({ ...current, [updatedLicense.key]: updatedLicense.notes ?? "" }));
      }

      setMessage(
        action === "accept-hwid-reset" && payload.license
          ? `Accepted HWID reset for ${payload.license.key}.`
          : `Updated ticket ${payload.ticket.id.slice(0, 8)}.`,
      );
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Ticket action failed.");
    } finally {
      setBusyKey(null);
    }
  }

  async function logout() {
    await logoutSession();
    router.refresh();
  }

  function licenseMenuItems(license: LicenseRecord): ActionMenuItem[] {
    return [
      { label: "Copy key", icon: <Copy size={15} />, onClick: () => copyKey(license.key) },
      {
        label: license.premium ? "Remove Premium" : "Grant Premium",
        icon: <Crown size={15} />,
        onClick: () => togglePremium(license),
        disabled: busyKey === `${license.key}:premium`,
      },
      ...licenseTypes
        .filter((licenseType) => licenseType !== license.type)
        .map((licenseType) => ({
          label: `Set ${licenseType}`,
          icon: <ShieldCheck size={15} />,
          onClick: () => changeLicenseType(license, licenseType),
          disabled: busyKey === `${license.key}:type`,
        })),
      ...(license.adminCreated
        ? [{
            label: "Reset password",
            icon: <RotateCcw size={15} />,
            onClick: () => resetAdminPassword(license),
            disabled: busyKey === `${license.key}:password`,
          }]
        : []),
      {
        label: "Enable",
        icon: <CheckCircle2 size={15} />,
        onClick: () => runLicenseAction(license.key, "enable"),
        disabled: license.status === "ACTIVE" || busyKey === `${license.key}:enable`,
      },
      {
        label: "Disable",
        icon: <Ban size={15} />,
        onClick: () => runLicenseAction(license.key, "disable"),
        disabled: license.status === "DISABLED" || busyKey === `${license.key}:disable`,
      },
      {
        label: "Reset HWID",
        icon: <RotateCcw size={15} />,
        onClick: () => runLicenseAction(license.key, "reset-hwid"),
        disabled: !license.hwid || busyKey === `${license.key}:reset-hwid`,
      },
      {
        label: "Delete",
        icon: <Trash2 size={15} />,
        onClick: () => runLicenseAction(license.key, "delete"),
        disabled: busyKey === `${license.key}:delete`,
        danger: true,
      },
    ];
  }

  function liteTrialMenuItems(trial: LiteTrialRecord): ActionMenuItem[] {
    return [
      {
        label: "Disable trial",
        icon: <Ban size={15} />,
        onClick: () => runLiteAction(trial, "disable"),
        disabled: trial.status === "DISABLED" || busyKey === `lite:${trial.id}:disable`,
      },
      {
        label: "Reset trial",
        icon: <RotateCcw size={15} />,
        onClick: () => runLiteAction(trial, "reset"),
        disabled: Boolean(trial.resetAt) || busyKey === `lite:${trial.id}:reset`,
      },
      {
        label: "Delete trial",
        icon: <Trash2 size={15} />,
        onClick: () => runLiteAction(trial, "delete"),
        disabled: busyKey === `lite:${trial.id}:delete`,
        danger: true,
      },
    ];
  }

  function ticketMenuItems(ticketItem: SupportTicket): ActionMenuItem[] {
    const isBusy = busyKey?.startsWith(`ticket:${ticketItem.id}:`) ?? false;

    return [
      { label: "View details", icon: <Eye size={15} />, onClick: () => setSelectedTicketId(ticketItem.id) },
      {
        label: "Accept HWID reset",
        icon: <KeyRound size={15} />,
        onClick: () => runTicketAction(ticketItem, "accept-hwid-reset"),
        disabled: isBusy,
      },
      { label: "Reject", icon: <Ban size={15} />, onClick: () => runTicketAction(ticketItem, "reject"), disabled: isBusy },
      {
        label: "Close",
        icon: <CheckCircle2 size={15} />,
        onClick: () => runTicketAction(ticketItem, "close"),
        disabled: isBusy,
      },
      {
        label: "Delete",
        icon: <Trash2 size={15} />,
        onClick: () => runTicketAction(ticketItem, "delete"),
        disabled: isBusy,
        danger: true,
      },
    ];
  }

  return (
    <main className="admin-shell min-h-screen px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto grid min-w-0 max-w-[1480px] gap-6">
        <header className="glass-panel rounded-[24px] p-5 sm:p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <p className="m-0 text-xs font-black uppercase text-reactor-cyan">47Service License Authority</p>
              <h1 className="mt-2 text-3xl font-black leading-tight sm:text-4xl">Admin dashboard</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-white/65">
                A focused control room for licenses, Lite trials, support tickets, and Premium access.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <ButtonLike type="button" onClick={refreshAll} disabled={isRefreshing}>
                {isRefreshing ? <LoaderCircle className="animate-spin" size={17} aria-hidden="true" /> : <RefreshCw size={17} aria-hidden="true" />}
                <span>Refresh</span>
              </ButtonLike>
              <ButtonLike tone="danger" type="button" onClick={logout}>
                <LogOut size={17} aria-hidden="true" />
                <span>Sign out</span>
              </ButtonLike>
            </div>
          </div>

          <nav className="mt-6 flex w-full max-w-full gap-2 overflow-x-auto pb-1" aria-label="Admin sections">
            {sections.map((section) => (
              <button
                key={section.id}
                className={`section-tab ${activeSection === section.id ? "section-tab-active" : ""}`}
                type="button"
                onClick={() => {
                  setActiveSection(section.id);
                  setOpenActionMenu(null);
                }}
              >
                {section.icon}
                <span>{section.label}</span>
                {section.count !== null ? <strong>{section.count}</strong> : null}
              </button>
            ))}
          </nav>
        </header>

        {error ? <p className="m-0 rounded-lg border border-reactor-red/30 bg-reactor-red/10 px-4 py-3 text-sm text-red-100">{error}</p> : null}
        {message ? <p className="m-0 rounded-lg border border-reactor-cyan/25 bg-reactor-cyan/10 px-4 py-3 text-sm text-emerald-100">{message}</p> : null}

        {activeSection === "overview" ? (
          <OverviewPanel
            activeCount={activeCount}
            activeLiteTrialCount={activeLiteTrialCount}
            activatedCount={activatedCount}
            disabledCount={disabledCount}
            expiringLicenses={expiringLicenses}
            licenses={licenses}
            openTicketCount={openTicketCount}
            premiumCount={premiumCount}
            recentTickets={recentTickets}
            setActiveSection={setActiveSection}
          />
        ) : null}

        {activeSection === "licenses" ? (
          <LicensePanel
            busyKey={busyKey}
            expiresAt={expiresAt}
            filteredLicenses={filteredLicenses}
            isCreating={isCreating}
            licenseQuery={licenseQuery}
            menuItemsForLicense={licenseMenuItems}
            notes={notes}
            onCreate={handleCreate}
            onEditNotes={(license) => setSelectedNotesKey(license.key)}
            openActionMenu={openActionMenu}
            setExpiresAt={setExpiresAt}
            setLicenseQuery={setLicenseQuery}
            setNotes={setNotes}
            setOpenActionMenu={setOpenActionMenu}
            setStatusFilter={setStatusFilter}
            setType={setType}
            statusFilter={statusFilter}
            type={type}
          />
        ) : null}

        {activeSection === "adminAccounts" ? (
          <AdminAccountsPanel
            adminAccountNotes={adminAccountNotes}
            adminAccountPremium={adminAccountPremium}
            adminAccountType={adminAccountType}
            filteredLicenses={filteredAdminAccounts}
            isCreating={isCreating}
            licenseQuery={licenseQuery}
            menuItemsForLicense={licenseMenuItems}
            onCreate={handleCreateAdminAccount}
            onEditNotes={(license) => setSelectedNotesKey(license.key)}
            openActionMenu={openActionMenu}
            setAdminAccountNotes={setAdminAccountNotes}
            setAdminAccountPremium={setAdminAccountPremium}
            setAdminAccountType={setAdminAccountType}
            setLicenseQuery={setLicenseQuery}
            setOpenActionMenu={setOpenActionMenu}
          />
        ) : null}

        {activeSection === "lite" ? (
          <LiteTrialsPanel
            filteredLiteTrials={filteredLiteTrials}
            liteTrialQuery={liteTrialQuery}
            menuItemsForTrial={liteTrialMenuItems}
            openActionMenu={openActionMenu}
            setLiteTrialQuery={setLiteTrialQuery}
            setOpenActionMenu={setOpenActionMenu}
          />
        ) : null}

        {activeSection === "tickets" ? (
          <TicketsPanel
            filteredTickets={filteredTickets}
            menuItemsForTicket={ticketMenuItems}
            openActionMenu={openActionMenu}
            setOpenActionMenu={setOpenActionMenu}
            setSelectedTicketId={setSelectedTicketId}
            setTicketQuery={setTicketQuery}
            ticketQuery={ticketQuery}
          />
        ) : null}

        {activeSection === "premium" ? (
          <PremiumUsersPanel
            filteredLicenses={filteredPremiumLicenses}
            licenseQuery={licenseQuery}
            menuItemsForLicense={licenseMenuItems}
            onEditNotes={(license) => setSelectedNotesKey(license.key)}
            openActionMenu={openActionMenu}
            setLicenseQuery={setLicenseQuery}
            setOpenActionMenu={setOpenActionMenu}
            setStatusFilter={setStatusFilter}
            statusFilter={statusFilter}
          />
        ) : null}

        {selectedNotesLicense ? (
          <LicenseNotesModal
            busyKey={busyKey}
            draftNote={draftNotes[selectedNotesLicense.key] ?? ""}
            license={selectedNotesLicense}
            onChange={(value) =>
              setDraftNotes((current) => ({ ...current, [selectedNotesLicense.key]: value }))
            }
            onClose={() => setSelectedNotesKey(null)}
            onSave={() => saveNotes(selectedNotesLicense.key)}
          />
        ) : null}

        {generatedAccount ? (
          <GeneratedAccountModal
            account={generatedAccount}
            onClose={() => setGeneratedAccount(null)}
          />
        ) : null}

        {selectedTicket ? (
          <TicketModal
            busyKey={busyKey}
            ticket={selectedTicket}
            adminNote={ticketAdminNotes[selectedTicket.id] ?? ""}
            onAdminNoteChange={(value) =>
              setTicketAdminNotes((current) => ({ ...current, [selectedTicket.id]: value }))
            }
            onClose={() => setSelectedTicketId(null)}
            onDelete={() => runTicketAction(selectedTicket, "delete")}
            onSaveNote={() => saveTicketNote(selectedTicket)}
            onSetStatus={(status) => setTicketStatus(selectedTicket, status)}
            onTicketAction={(action) => runTicketAction(selectedTicket, action)}
          />
        ) : null}
      </div>
    </main>
  );
}

function OverviewPanel({
  activeCount,
  activeLiteTrialCount,
  activatedCount,
  disabledCount,
  expiringLicenses,
  licenses,
  openTicketCount,
  premiumCount,
  recentTickets,
  setActiveSection,
}: {
  activeCount: number;
  activeLiteTrialCount: number;
  activatedCount: number;
  disabledCount: number;
  expiringLicenses: LicenseRecord[];
  licenses: LicenseRecord[];
  openTicketCount: number;
  premiumCount: number;
  recentTickets: SupportTicket[];
  setActiveSection: (section: AdminSection) => void;
}) {
  return (
    <section className="grid gap-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <MetricCard label="Total licenses" value={licenses.length} />
        <MetricCard label="Active keys" value={activeCount} />
        <MetricCard label="Activated HWIDs" value={activatedCount} />
        <MetricCard label="Disabled keys" value={disabledCount} tone="red" />
        <MetricCard label="Open tickets" value={openTicketCount} tone="gold" />
        <MetricCard label="Premium users" value={premiumCount} tone="gold" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(340px,0.75fr)]">
        <SectionPanel
          eyebrow="Operational overview"
          title="License health"
          description="High-level signals without mixing every admin workflow into one crowded surface."
          action={
            <ButtonLike type="button" onClick={() => setActiveSection("licenses")}>
              <KeyRound size={16} aria-hidden="true" />
              <span>Open licenses</span>
            </ButtonLike>
          }
        >
          <div className="grid gap-4 lg:grid-cols-3">
            <OverviewTile label="Active Lite trials" value={activeLiteTrialCount} />
            <OverviewTile label="Premium share" value={`${licenses.length ? Math.round((premiumCount / licenses.length) * 100) : 0}%`} />
            <OverviewTile label="Activated share" value={`${licenses.length ? Math.round((activatedCount / licenses.length) * 100) : 0}%`} />
          </div>
          <div className="mt-5 rounded-lg border border-white/10 bg-black/20 p-4">
            <h3 className="text-sm font-black uppercase text-white/55">Expiring soon</h3>
            <div className="mt-3 grid gap-2">
              {expiringLicenses.map((license) => (
                <div className="grid gap-2 rounded-md border border-white/10 bg-white/[0.04] p-3 sm:grid-cols-[minmax(0,1fr)_auto]" key={license.id}>
                  <span className="min-w-0 font-mono text-xs font-black text-white">{license.key}</span>
                  <span className="text-xs text-white/55">{formatDate(license.expiresAt)}</span>
                </div>
              ))}
              {!expiringLicenses.length ? <p className="m-0 text-sm text-white/50">No active licenses expire in the next 14 days.</p> : null}
            </div>
          </div>
        </SectionPanel>

        <SectionPanel
          eyebrow="Support"
          title="Recent tickets"
          description="A quick read of the newest support work, with the full queue isolated in Tickets."
          action={
            <ButtonLike type="button" onClick={() => setActiveSection("tickets")}>
              <Ticket size={16} aria-hidden="true" />
              <span>Open tickets</span>
            </ButtonLike>
          }
        >
          <div className="grid gap-3">
            {recentTickets.map((ticketItem) => (
              <div className="rounded-lg border border-white/10 bg-black/20 p-4" key={ticketItem.id}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`status-pill status-${ticketItem.status.toLowerCase()}`}>{ticketItem.status}</span>
                  <span className="font-mono text-xs text-white/45">{ticketItem.id.slice(0, 8)}</span>
                </div>
                <p className="mt-3 line-clamp-2 text-sm font-black text-white">{ticketItem.subject}</p>
                <p className="mt-1 text-xs text-white/45">{formatDate(ticketItem.createdAt)}</p>
              </div>
            ))}
            {!recentTickets.length ? <p className="m-0 text-sm text-white/50">No support tickets have been submitted yet.</p> : null}
          </div>
        </SectionPanel>
      </div>
    </section>
  );
}

function LicensePanel({
  busyKey,
  expiresAt,
  filteredLicenses,
  isCreating,
  licenseQuery,
  menuItemsForLicense,
  notes,
  onCreate,
  onEditNotes,
  openActionMenu,
  setExpiresAt,
  setLicenseQuery,
  setNotes,
  setOpenActionMenu,
  setStatusFilter,
  setType,
  statusFilter,
  type,
}: {
  busyKey: string | null;
  expiresAt: string;
  filteredLicenses: LicenseRecord[];
  isCreating: boolean;
  licenseQuery: string;
  menuItemsForLicense: (license: LicenseRecord) => ActionMenuItem[];
  notes: string;
  onCreate: (event: FormEvent<HTMLFormElement>) => void;
  onEditNotes: (license: LicenseRecord) => void;
  openActionMenu: string | null;
  setExpiresAt: (value: string) => void;
  setLicenseQuery: (value: string) => void;
  setNotes: (value: string) => void;
  setOpenActionMenu: (value: string | null) => void;
  setStatusFilter: (value: LicenseStatus | "ALL") => void;
  setType: (value: LicenseType) => void;
  statusFilter: LicenseStatus | "ALL";
  type: LicenseType;
}) {
  return (
    <SectionPanel
      eyebrow="License operations"
      title="Licenses"
      description="Create keys, scan license state, edit notes, and run account actions from one clean table."
      action={<SearchFilter value={licenseQuery} onChange={setLicenseQuery} placeholder="Search key, HWID, user, notes" />}
    >
      <form className="admin-form" onSubmit={onCreate}>
        <FieldLabel label="Type">
          <select className="field min-h-11 px-3 text-sm" value={type} onChange={(event) => setType(event.target.value as LicenseType)}>
            {licenseTypes.map((licenseType) => <option key={licenseType}>{licenseType}</option>)}
          </select>
        </FieldLabel>
        <FieldLabel label="Expiration">
          <input className="field min-h-11 px-3 text-sm" type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} />
        </FieldLabel>
        <FieldLabel label="Initial notes">
          <input className="field min-h-11 px-3 text-sm" value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={500} placeholder="Buyer, order id, account context" />
        </FieldLabel>
        <button className="primary-action" type="submit" disabled={isCreating}>
          {isCreating ? <LoaderCircle className="animate-spin" size={17} aria-hidden="true" /> : <Plus size={17} aria-hidden="true" />}
          <span>Create key</span>
        </button>
      </form>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {statusFilters.map((status) => (
            <button
              className={`filter-chip ${statusFilter === status ? "filter-chip-active" : ""}`}
              type="button"
              key={status}
              onClick={() => setStatusFilter(status)}
            >
              {status}
            </button>
          ))}
        </div>
        <span className="text-sm text-white/50">{filteredLicenses.length} results</span>
      </div>

      <LicenseTable
        busyKey={busyKey}
        licenses={filteredLicenses}
        menuItemsForLicense={menuItemsForLicense}
        onEditNotes={onEditNotes}
        openActionMenu={openActionMenu}
        setOpenActionMenu={setOpenActionMenu}
      />
    </SectionPanel>
  );
}

function AdminAccountsPanel({
  adminAccountNotes,
  adminAccountPremium,
  adminAccountType,
  filteredLicenses,
  isCreating,
  licenseQuery,
  menuItemsForLicense,
  onCreate,
  onEditNotes,
  openActionMenu,
  setAdminAccountNotes,
  setAdminAccountPremium,
  setAdminAccountType,
  setLicenseQuery,
  setOpenActionMenu,
}: {
  adminAccountNotes: string;
  adminAccountPremium: boolean;
  adminAccountType: LicenseType;
  filteredLicenses: LicenseRecord[];
  isCreating: boolean;
  licenseQuery: string;
  menuItemsForLicense: (license: LicenseRecord) => ActionMenuItem[];
  onCreate: (event: FormEvent<HTMLFormElement>) => void;
  onEditNotes: (license: LicenseRecord) => void;
  openActionMenu: string | null;
  setAdminAccountNotes: (value: string) => void;
  setAdminAccountPremium: (value: boolean) => void;
  setAdminAccountType: (value: LicenseType) => void;
  setLicenseQuery: (value: string) => void;
  setOpenActionMenu: (value: string | null) => void;
}) {
  return (
    <SectionPanel
      eyebrow="Permanent account generator"
      title="Create Admin Access Account"
      description="Create backend-issued permanent username/password accounts with no HWID binding."
      action={<SearchFilter value={licenseQuery} onChange={setLicenseQuery} placeholder="Search admin accounts" />}
    >
      <form className="admin-form" onSubmit={onCreate}>
        <FieldLabel label="Rank">
          <select className="field min-h-11 px-3 text-sm" value={adminAccountType} onChange={(event) => setAdminAccountType(event.target.value as LicenseType)}>
            {licenseTypes.map((licenseType) => <option key={licenseType}>{licenseType}</option>)}
          </select>
        </FieldLabel>
        <FieldLabel label="Premium addon">
          <label className="inline-flex min-h-11 items-center gap-3 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm font-black text-white">
            <input type="checkbox" checked={adminAccountPremium} onChange={(event) => setAdminAccountPremium(event.target.checked)} />
            <span>{adminAccountPremium ? "Enabled" : "Disabled"}</span>
          </label>
        </FieldLabel>
        <FieldLabel label="Initial notes">
          <input className="field min-h-11 px-3 text-sm" value={adminAccountNotes} onChange={(event) => setAdminAccountNotes(event.target.value)} maxLength={500} placeholder="Admin-created permanent account" />
        </FieldLabel>
        <button className="primary-action" type="submit" disabled={isCreating}>
          {isCreating ? <LoaderCircle className="animate-spin" size={17} aria-hidden="true" /> : <UserPlus size={17} aria-hidden="true" />}
          <span>Create account</span>
        </button>
      </form>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-white/50">{filteredLicenses.length} admin-created permanent accounts</span>
      </div>

      <LicenseTable
        licenses={filteredLicenses}
        menuItemsForLicense={menuItemsForLicense}
        onEditNotes={onEditNotes}
        openActionMenu={openActionMenu}
        setOpenActionMenu={setOpenActionMenu}
      />
    </SectionPanel>
  );
}

function PremiumUsersPanel({
  filteredLicenses,
  licenseQuery,
  menuItemsForLicense,
  onEditNotes,
  openActionMenu,
  setLicenseQuery,
  setOpenActionMenu,
  setStatusFilter,
  statusFilter,
}: {
  filteredLicenses: LicenseRecord[];
  licenseQuery: string;
  menuItemsForLicense: (license: LicenseRecord) => ActionMenuItem[];
  onEditNotes: (license: LicenseRecord) => void;
  openActionMenu: string | null;
  setLicenseQuery: (value: string) => void;
  setOpenActionMenu: (value: string | null) => void;
  setStatusFilter: (value: LicenseStatus | "ALL") => void;
  statusFilter: LicenseStatus | "ALL";
}) {
  return (
    <SectionPanel
      eyebrow="Premium access"
      title="Premium users"
      description="Premium customers get their own uncluttered management section."
      action={<SearchFilter value={licenseQuery} onChange={setLicenseQuery} placeholder="Search Premium users" />}
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {statusFilters.map((status) => (
            <button
              className={`filter-chip ${statusFilter === status ? "filter-chip-active" : ""}`}
              type="button"
              key={status}
              onClick={() => setStatusFilter(status)}
            >
              {status}
            </button>
          ))}
        </div>
        <span className="text-sm text-white/50">{filteredLicenses.length} Premium users</span>
      </div>
      <LicenseTable
        licenses={filteredLicenses}
        menuItemsForLicense={menuItemsForLicense}
        onEditNotes={onEditNotes}
        openActionMenu={openActionMenu}
        setOpenActionMenu={setOpenActionMenu}
      />
    </SectionPanel>
  );
}

function LicenseTable({
  busyKey,
  licenses,
  menuItemsForLicense,
  onEditNotes,
  openActionMenu,
  setOpenActionMenu,
}: {
  busyKey?: string | null;
  licenses: LicenseRecord[];
  menuItemsForLicense: (license: LicenseRecord) => ActionMenuItem[];
  onEditNotes: (license: LicenseRecord) => void;
  openActionMenu: string | null;
  setOpenActionMenu: (value: string | null) => void;
}) {
  return (
    <>
      <div className="mt-5 hidden overflow-visible rounded-lg border border-white/10 lg:block">
        <table className="admin-table table-fixed">
          <colgroup>
            <col className="w-[30%]" />
            <col className="w-[11%]" />
            <col className="w-[13%]" />
            <col className="w-[22%]" />
            <col className="w-[16%]" />
            <col className="w-[8%]" />
          </colgroup>
          <thead>
            <tr>
              <th>License</th>
              <th>Plan</th>
              <th>Status</th>
              <th>HWID</th>
              <th>Dates</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {licenses.map((license) => (
              <tr key={license.id}>
                <td>
                  <div className="grid gap-2">
                    <button className="min-w-0 break-all text-left font-mono text-xs font-black text-white hover:text-reactor-cyan" type="button" onClick={() => navigator.clipboard.writeText(license.key)} title="Copy license key">
                      {license.key}
                    </button>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-white/50">{license.username ?? "No username yet"}</span>
                      {license.premium ? <span className="premium-badge"><Crown size={12} /> Premium</span> : null}
                      {license.adminCreated ? <span className="detail-pill">Admin-created permanent account</span> : null}
                    </div>
                    <button className="w-fit text-xs font-black text-reactor-cyan hover:text-white" type="button" onClick={() => onEditNotes(license)}>
                      {license.notes ? "View notes" : "Add notes"}
                    </button>
                  </div>
                </td>
                <td className="font-black text-white">{license.type}</td>
                <td><span className={`status-pill status-${license.status.toLowerCase()}`}>{license.status}</span></td>
                <td className="break-all font-mono text-xs text-white/65">{license.adminCreated ? "No HWID binding" : license.hwid ?? "Not activated"}</td>
                <td className="text-xs text-white/60">
                  <div>Created {formatDate(license.createdAt)}</div>
                  <div>Activated {formatDate(license.activatedAt)}</div>
                  <div>Expires {formatDate(license.expiresAt)}</div>
                </td>
                <td className="text-right">
                  <ActionMenu
                    id={`license:${license.id}`}
                    items={menuItemsForLicense(license)}
                    openActionMenu={openActionMenu}
                    setOpenActionMenu={setOpenActionMenu}
                  />
                </td>
              </tr>
            ))}
            {!licenses.length ? <EmptyTableRow colSpan={6} label="No licenses match the current filters." /> : null}
          </tbody>
        </table>
      </div>

      <div className="mt-5 grid gap-3 lg:hidden">
        {licenses.map((license) => (
          <RecordCard key={license.id}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="break-all font-mono text-xs font-black text-white">{license.key}</p>
                <p className="mt-1 text-xs text-white/50">{license.username ?? "No username yet"}</p>
              </div>
              <ActionMenu
                id={`mobile-license:${license.id}`}
                items={menuItemsForLicense(license)}
                openActionMenu={openActionMenu}
                setOpenActionMenu={setOpenActionMenu}
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className={`status-pill status-${license.status.toLowerCase()}`}>{license.status}</span>
              <span className="detail-pill">{license.type}</span>
              {license.premium ? <span className="premium-badge"><Crown size={12} /> Premium</span> : null}
              {license.adminCreated ? <span className="detail-pill">Admin-created permanent account</span> : null}
            </div>
            <div className="mt-4 grid gap-3 text-xs text-white/60">
              <DetailLine label="HWID" value={license.adminCreated ? "No HWID binding" : license.hwid ?? "Not activated"} />
              <DetailLine label="Expires" value={formatDate(license.expiresAt)} />
            </div>
            <button className="mt-4 text-left text-xs font-black text-reactor-cyan" type="button" onClick={() => onEditNotes(license)} disabled={busyKey === `${license.key}:notes`}>
              {license.notes ? "View notes" : "Add notes"}
            </button>
          </RecordCard>
        ))}
        {!licenses.length ? <EmptyState label="No licenses match the current filters." /> : null}
      </div>
    </>
  );
}

function LiteTrialsPanel({
  filteredLiteTrials,
  liteTrialQuery,
  menuItemsForTrial,
  openActionMenu,
  setLiteTrialQuery,
  setOpenActionMenu,
}: {
  filteredLiteTrials: LiteTrialRecord[];
  liteTrialQuery: string;
  menuItemsForTrial: (trial: LiteTrialRecord) => ActionMenuItem[];
  openActionMenu: string | null;
  setLiteTrialQuery: (value: string) => void;
  setOpenActionMenu: (value: string | null) => void;
}) {
  return (
    <SectionPanel
      eyebrow="Lite trial accounts"
      title="Lite trials"
      description="Review HWID, IP, fingerprint, and reset history without squeezing it beside the license table."
      action={<SearchFilter value={liteTrialQuery} onChange={setLiteTrialQuery} placeholder="Search HWID, IP, user" />}
    >
      <div className="hidden rounded-lg border border-white/10 lg:block">
        <table className="admin-table table-fixed">
          <colgroup>
            <col className="w-[24%]" />
            <col className="w-[25%]" />
            <col className="w-[13%]" />
            <col className="w-[15%]" />
            <col className="w-[15%]" />
            <col className="w-[8%]" />
          </colgroup>
          <thead>
            <tr>
              <th>Account</th>
              <th>HWID / Fingerprint</th>
              <th>IP</th>
              <th>Created</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredLiteTrials.map((trial) => (
              <tr key={trial.id}>
                <td>
                  <div className="grid gap-1">
                    <span className="font-mono text-xs font-black text-white">{trial.license.username ?? "No username"}</span>
                    <span className="break-all font-mono text-[0.68rem] text-white/45">{trial.license.key}</span>
                  </div>
                </td>
                <td className="break-all font-mono text-xs text-white/65">
                  <div>{trial.hwid}</div>
                  <div className="mt-2 text-white/38">{trial.deviceFingerprint ?? "No fingerprint"}</div>
                </td>
                <td className="font-mono text-xs text-white/70">{trial.ipAddress}</td>
                <td className="text-xs text-white/60">
                  <div>{formatDate(trial.createdAt)}</div>
                  <div>Expires {formatDate(trial.expiresAt)}</div>
                </td>
                <td>
                  <div className="grid gap-2">
                    <span className={`status-pill status-${trial.status.toLowerCase()}`}>{trial.status}</span>
                    {trial.resetAt ? <span className="text-xs text-white/45">Reset {formatDate(trial.resetAt)}</span> : null}
                  </div>
                </td>
                <td className="text-right">
                  <ActionMenu
                    id={`lite:${trial.id}`}
                    items={menuItemsForTrial(trial)}
                    openActionMenu={openActionMenu}
                    setOpenActionMenu={setOpenActionMenu}
                  />
                </td>
              </tr>
            ))}
            {!filteredLiteTrials.length ? <EmptyTableRow colSpan={6} label="No Lite trials match the current search." /> : null}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 lg:hidden">
        {filteredLiteTrials.map((trial) => (
          <RecordCard key={trial.id}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-xs font-black text-white">{trial.license.username ?? "No username"}</p>
                <p className="mt-1 break-all font-mono text-[0.68rem] text-white/45">{trial.license.key}</p>
              </div>
              <ActionMenu
                id={`mobile-lite:${trial.id}`}
                items={menuItemsForTrial(trial)}
                openActionMenu={openActionMenu}
                setOpenActionMenu={setOpenActionMenu}
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className={`status-pill status-${trial.status.toLowerCase()}`}>{trial.status}</span>
              <span className="detail-pill">{trial.ipAddress}</span>
            </div>
            <div className="mt-4 grid gap-3 text-xs text-white/60">
              <DetailLine label="HWID" value={trial.hwid} />
              <DetailLine label="Fingerprint" value={trial.deviceFingerprint ?? "Not provided"} />
              <DetailLine label="Expires" value={formatDate(trial.expiresAt)} />
            </div>
          </RecordCard>
        ))}
        {!filteredLiteTrials.length ? <EmptyState label="No Lite trials match the current search." /> : null}
      </div>
    </SectionPanel>
  );
}

function TicketsPanel({
  filteredTickets,
  menuItemsForTicket,
  openActionMenu,
  setOpenActionMenu,
  setSelectedTicketId,
  setTicketQuery,
  ticketQuery,
}: {
  filteredTickets: SupportTicket[];
  menuItemsForTicket: (ticket: SupportTicket) => ActionMenuItem[];
  openActionMenu: string | null;
  setOpenActionMenu: (value: string | null) => void;
  setSelectedTicketId: (id: string) => void;
  setTicketQuery: (value: string) => void;
  ticketQuery: string;
}) {
  return (
    <SectionPanel
      eyebrow="Support intake"
      title="Tickets"
      description="A roomier support queue with proof counts, readable subjects, and details moved into a focused modal."
      action={<SearchFilter value={ticketQuery} onChange={setTicketQuery} placeholder="Search tickets" />}
    >
      <div className="grid gap-3 xl:grid-cols-2">
        {filteredTickets.map((ticketItem) => (
          <button
            className="ticket-card text-left"
            key={ticketItem.id}
            type="button"
            onClick={() => setSelectedTicketId(ticketItem.id)}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`status-pill status-${ticketItem.status.toLowerCase()}`}>{ticketItem.status}</span>
                  <span className="font-mono text-xs text-white/45">{ticketItem.id.slice(0, 8)}</span>
                </div>
                <h3 className="mt-3 text-lg font-black leading-snug text-white">{ticketItem.subject}</h3>
              </div>
              <span onClick={(event) => event.stopPropagation()}>
                <ActionMenu
                  id={`ticket:${ticketItem.id}`}
                  items={menuItemsForTicket(ticketItem)}
                  openActionMenu={openActionMenu}
                  setOpenActionMenu={setOpenActionMenu}
                />
              </span>
            </div>
            <p className="mt-3 line-clamp-2 text-sm leading-6 text-white/58">{ticketItem.description}</p>
            <div className="mt-4 grid gap-3 text-xs text-white/55 sm:grid-cols-3">
              <DetailLine label="Created" value={formatDate(ticketItem.createdAt)} />
              <DetailLine label="Proofs" value={String(ticketItem.proofs.length)} />
              <DetailLine label="Note" value={ticketItem.adminNote ? "Added" : "None"} />
            </div>
          </button>
        ))}
        {!filteredTickets.length ? <EmptyState label="No tickets match the current search." /> : null}
      </div>
    </SectionPanel>
  );
}

function LicenseNotesModal({
  busyKey,
  draftNote,
  license,
  onChange,
  onClose,
  onSave,
}: {
  busyKey: string | null;
  draftNote: string;
  license: LicenseRecord;
  onChange: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={`Notes for ${license.key}`}>
      <div className="glass-panel grid max-h-[92vh] w-full max-w-2xl overflow-hidden rounded-[20px]">
        <div className="modal-header">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase text-reactor-cyan">License notes</p>
            <h2 className="mt-1 break-all text-xl font-black text-white">{license.key}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close notes">
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="grid gap-4 p-5">
          <textarea
            className="field min-h-[190px] resize-y px-4 py-3 text-sm leading-6"
            value={draftNote}
            onChange={(event) => onChange(event.target.value)}
            maxLength={500}
            placeholder="Buyer, order id, Discord handle, or account context"
          />
          <div className="flex flex-wrap justify-end gap-2">
            <ButtonLike type="button" onClick={onClose}>Cancel</ButtonLike>
            <button className="primary-action" type="button" onClick={onSave} disabled={busyKey === `${license.key}:notes`}>
              {busyKey === `${license.key}:notes` ? <LoaderCircle className="animate-spin" size={16} /> : <Save size={16} />}
              <span>Save notes</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function GeneratedAccountModal({
  account,
  onClose,
}: {
  account: GeneratedAdminAccount;
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={`Generated account ${account.username}`}>
      <div className="glass-panel grid max-h-[92vh] w-full max-w-2xl overflow-hidden rounded-[20px]">
        <div className="modal-header">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase text-reactor-cyan">Shown once</p>
            <h2 className="mt-1 text-xl font-black text-white">Admin-created permanent account</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close generated credentials">
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="grid gap-4 p-5">
          <GeneratedSecretRow label="Username" value={account.username} />
          <GeneratedSecretRow label="Password" value={account.password} />
          <GeneratedSecretRow label="Linked license key" value={account.license.key} />
          <div className="rounded-lg border border-reactor-gold/25 bg-reactor-gold/10 px-4 py-3 text-sm leading-6 text-amber-50">
            Passwords are stored only as hashes and are not recoverable after this window closes.
          </div>
          <div className="flex justify-end">
            <button className="primary-action" type="button" onClick={onClose}>
              <CheckCircle2 size={16} aria-hidden="true" />
              <span>Done</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function GeneratedSecretRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-2 rounded-lg border border-white/10 bg-black/20 p-4">
      <span className="text-[0.68rem] font-black uppercase text-white/45">{label}</span>
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <code className="break-all rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/80">{value}</code>
        <button className="secondary-action" type="button" onClick={() => navigator.clipboard.writeText(value)}>
          <Copy size={16} aria-hidden="true" />
          <span>Copy</span>
        </button>
      </div>
    </div>
  );
}

function TicketModal({
  ticket,
  adminNote,
  busyKey,
  onAdminNoteChange,
  onClose,
  onDelete,
  onSaveNote,
  onSetStatus,
  onTicketAction,
}: {
  ticket: SupportTicket;
  adminNote: string;
  busyKey: string | null;
  onAdminNoteChange: (value: string) => void;
  onClose: () => void;
  onDelete: () => void;
  onSaveNote: () => void;
  onSetStatus: (status: SupportTicketStatus) => void;
  onTicketAction: (action: "accept-hwid-reset" | "reject" | "close") => void;
}) {
  const isBusy = busyKey?.startsWith(`ticket:${ticket.id}:`) ?? false;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={`Ticket ${ticket.id.slice(0, 8)}`}>
      <div className="glass-panel grid max-h-[92vh] w-full max-w-6xl overflow-hidden rounded-[20px]">
        <div className="modal-header">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`status-pill status-${ticket.status.toLowerCase()}`}>{ticket.status}</span>
              <span className="font-mono text-xs text-white/45">{ticket.id.slice(0, 8)}</span>
              <span className="text-xs text-white/45">{formatDate(ticket.createdAt)}</span>
            </div>
            <h2 className="mt-3 text-2xl font-black leading-tight text-white">{ticket.subject}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close ticket details">
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="grid gap-5 overflow-y-auto p-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="grid content-start gap-5">
            <section className="inner-panel">
              <h3>Description</h3>
              <p className="m-0 whitespace-pre-wrap text-sm leading-6 text-white/75">{ticket.description}</p>
            </section>

            <section className="inner-panel">
              <h3>HWID</h3>
              <code className="break-all rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/70">
                {ticket.hwid}
              </code>
            </section>

            <section className="inner-panel">
              <h3>Proofs</h3>
              {ticket.proofs.length ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {ticket.proofs.map((proof) => (
                    <a
                      className="proof-link"
                      href={`/api/proofs/${proof.id}`}
                      target="_blank"
                      rel="noreferrer"
                      key={proof.id}
                    >
                      <img className="h-44 w-full rounded object-cover" src={`/api/proofs/${proof.id}`} alt={proof.originalName} />
                      <span className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                        <span className="min-w-0">
                          <strong className="block overflow-hidden text-ellipsis whitespace-nowrap">{proof.originalName}</strong>
                          <small className="text-white/50">{formatBytes(proof.sizeBytes)}</small>
                        </span>
                        <Eye size={16} aria-hidden="true" />
                      </span>
                    </a>
                  ))}
                </div>
              ) : (
                <div className="inline-flex min-h-10 items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-3 text-sm text-white/50">
                  <FileImage size={16} aria-hidden="true" />
                  <span>No proof images attached.</span>
                </div>
              )}
            </section>
          </div>

          <aside className="grid content-start gap-4">
            <section className="inner-panel">
              <FieldLabel label="Set status">
                <select
                  className="field min-h-11 px-3 text-sm"
                  value={ticket.status}
                  onChange={(event) => onSetStatus(event.target.value as SupportTicketStatus)}
                  disabled={isBusy}
                >
                  {ticketStatuses.map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
              </FieldLabel>
            </section>

            <section className="inner-panel">
              <FieldLabel label="Admin note">
                <textarea
                  className="field min-h-[140px] resize-y px-3 py-2 text-sm leading-6"
                  value={adminNote}
                  onChange={(event) => onAdminNoteChange(event.target.value)}
                  maxLength={1_000}
                  placeholder="Internal resolution notes"
                  disabled={isBusy}
                />
              </FieldLabel>
              <button className="secondary-action mt-3" type="button" onClick={onSaveNote} disabled={isBusy}>
                {busyKey === `ticket:${ticket.id}:note` ? <LoaderCircle className="animate-spin" size={16} aria-hidden="true" /> : <Save size={16} aria-hidden="true" />}
                <span>Save admin note</span>
              </button>
            </section>

            <section className="inner-panel">
              <button className="primary-action w-full" type="button" onClick={() => onTicketAction("accept-hwid-reset")} disabled={isBusy}>
                <KeyRound size={16} aria-hidden="true" />
                <span>Accept HWID reset</span>
              </button>
              <button className="secondary-action mt-2 w-full" type="button" onClick={() => onTicketAction("reject")} disabled={isBusy}>
                <Ban size={16} aria-hidden="true" />
                <span>Reject ticket</span>
              </button>
              <button className="secondary-action mt-2 w-full" type="button" onClick={() => onTicketAction("close")} disabled={isBusy}>
                <CheckCircle2 size={16} aria-hidden="true" />
                <span>Close ticket</span>
              </button>
              <button className="danger-action mt-2 w-full" type="button" onClick={onDelete} disabled={isBusy}>
                <Trash2 size={16} aria-hidden="true" />
                <span>Delete ticket</span>
              </button>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}

function SectionPanel({
  action,
  children,
  description,
  eyebrow,
  title,
}: {
  action?: ReactNode;
  children: ReactNode;
  description: string;
  eyebrow: string;
  title: string;
}) {
  return (
    <section className="glass-panel rounded-[22px] p-5 sm:p-6">
      <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <p className="m-0 text-xs font-black uppercase text-reactor-cyan">{eyebrow}</p>
          <h2 className="mt-1 text-2xl font-black text-white">{title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-white/60">{description}</p>
        </div>
        {action ? <div className="min-w-0 xl:min-w-[320px]">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

function SearchFilter({ onChange, placeholder, value }: { onChange: (value: string) => void; placeholder: string; value: string }) {
  return (
    <label className="relative block">
      <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/45" size={17} />
      <input className="field min-h-11 pl-10 pr-3 text-sm" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </label>
  );
}

function FieldLabel({ children, label }: { children: ReactNode; label: string }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[0.68rem] font-black uppercase text-white/60">{label}</span>
      {children}
    </label>
  );
}

function MetricCard({ label, value, tone = "cyan" }: { label: string; value: number; tone?: "cyan" | "gold" | "red" }) {
  const toneClass = tone === "gold" ? "text-reactor-gold" : tone === "red" ? "text-reactor-red" : "text-reactor-cyan";

  return (
    <div className="glass-panel rounded-xl p-4">
      <span className={`text-xs font-black uppercase ${toneClass}`}>{label}</span>
      <strong className="mt-2 block text-3xl font-black text-white">{value}</strong>
    </div>
  );
}

function OverviewTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-4">
      <span className="text-xs font-black uppercase text-white/45">{label}</span>
      <strong className="mt-2 block text-2xl font-black text-white">{value}</strong>
    </div>
  );
}

function ActionMenu({
  id,
  items,
  openActionMenu,
  setOpenActionMenu,
}: {
  id: string;
  items: ActionMenuItem[];
  openActionMenu: string | null;
  setOpenActionMenu: (value: string | null) => void;
}) {
  const isOpen = openActionMenu === id;

  return (
    <div className="relative inline-flex justify-end">
      <button
        className="icon-button"
        type="button"
        onClick={() => setOpenActionMenu(isOpen ? null : id)}
        aria-label="Open action menu"
        aria-expanded={isOpen}
      >
        <MoreHorizontal size={18} aria-hidden="true" />
      </button>
      {isOpen ? (
        <div className="action-menu">
          {items.map((item) => (
            <button
              className={`action-menu-item ${item.danger ? "action-menu-danger" : ""}`}
              type="button"
              key={item.label}
              onClick={item.onClick}
              disabled={item.disabled}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ButtonLike({
  children,
  disabled,
  onClick,
  tone = "neutral",
  type,
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  tone?: "neutral" | "danger";
  type: "button" | "submit";
}) {
  return (
    <button
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-black ${
        tone === "danger"
          ? "border-reactor-red/25 bg-reactor-red/10 text-red-100 hover:bg-reactor-red/15"
          : "border-white/10 bg-white/10 text-white hover:bg-white/15"
      }`}
      type={type}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

function RecordCard({ children }: { children: ReactNode }) {
  return <article className="rounded-lg border border-white/10 bg-black/20 p-4">{children}</article>;
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <span className="block text-[0.68rem] font-black uppercase text-white/38">{label}</span>
      <span className="mt-1 block min-w-0 break-all text-white/70">{value}</span>
    </div>
  );
}

function EmptyTableRow({ colSpan, label }: { colSpan: number; label: string }) {
  return (
    <tr>
      <td className="px-4 py-10 text-center text-sm text-white/50" colSpan={colSpan}>
        {label}
      </td>
    </tr>
  );
}

function EmptyState({ label }: { label: string }) {
  return <div className="rounded-lg border border-white/10 bg-black/20 p-8 text-center text-sm text-white/50">{label}</div>;
}

function formatDate(value: string | null) {
  if (!value) {
    return "Never";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatBytes(value: number) {
  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}
