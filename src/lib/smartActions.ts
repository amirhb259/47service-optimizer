import { dashboardModules, type SmartActionId } from "../data/dashboardModules";
import { premiumModules, type PremiumActionId } from "../data/premiumModules";
import type { LicenseType } from "./licenseApi";

export type SmartActionSeverity = "good" | "watch" | "warning";
export type SmartActionStatus = "ready" | "running" | "complete" | "error";

export type SmartActionFinding = {
  label: string;
  value: string;
  severity: SmartActionSeverity;
  detail: string;
};

export type SmartActionStep = {
  label: string;
  detail: string;
  status: "done" | "skipped" | "warning" | "error";
};

export type SmartActionReport = {
  id: SmartActionId | PremiumActionId;
  title: string;
  timestamp: string;
  summary: string;
  score?: number;
  beforeSnapshot?: string;
  afterSnapshot?: string;
  findings: SmartActionFinding[];
  steps: SmartActionStep[];
  actionsTaken: string[];
  skippedActions: string[];
  errors: string[];
  undoInfo: string[];
  logPath?: string;
  exportPath?: string;
  raw?: Record<string, unknown>;
};

export type GameSessionResult = {
  report: SmartActionReport;
  undoToken?: string;
};

export type SelectedGameProcess = {
  pid: number;
  gameName: string;
  processName: string;
};

export type SmartActionRuntime = {
  runSmartAction: (actionId: SmartActionId | PremiumActionId, licenseType: LicenseType) => Promise<SmartActionReport>;
  startGameSession: (
    minutes: number,
    licenseType: LicenseType,
    selectedGame?: SelectedGameProcess,
  ) => Promise<GameSessionResult>;
  restoreGameSession: (undoToken: string | undefined, licenseType: LicenseType) => Promise<SmartActionReport>;
  executeCleanupPlan: (licenseType: LicenseType) => Promise<GameSessionResult>;
  restoreCleanup: (undoToken: string | undefined, licenseType: LicenseType) => Promise<SmartActionReport>;
  exportSmartActionReport: (report: SmartActionReport, licenseType: LicenseType) => Promise<string>;
};

export const smartActionRuntime: SmartActionRuntime = {
  async runSmartAction(actionId, licenseType) {
    const tauri = await tryGetTauriCore();
    if (tauri) {
      const isPremiumAction = [
        "extreme-optimization",
        "gaming-optimization",
        "deep-diagnostics",
        "resource-management",
        "bottleneck-detection",
        "background-suppression",
        "performance-tuning",
        "network-stabilization",
        "cache-shader-cleanup",
        "session-restoration",
        "performance-analytics",
      ].includes(actionId);

      if (isPremiumAction) {
        return tauri.invoke<SmartActionReport>("run_premium_smart_action", { actionId, licenseType, premium: true });
      }
      return tauri.invoke<SmartActionReport>("run_smart_action", { actionId, licenseType });
    }

    return createBrowserReport(actionId, "Browser preview mode cannot read live Windows diagnostics.");
  },

  async startGameSession(minutes, licenseType, selectedGame) {
    const tauri = await tryGetTauriCore();
    if (tauri) {
      return tauri.invoke<GameSessionResult>("start_game_session", {
        minutes,
        licenseType,
        selectedGamePid: selectedGame?.pid ?? null,
        selectedGameName: selectedGame?.gameName ?? null,
      });
    }

    return {
      report: createBrowserReport("game-optimizer-session", "Browser preview logged a dry-run gaming session plan."),
    };
  },

  async restoreGameSession(undoToken, licenseType) {
    const tauri = await tryGetTauriCore();
    if (tauri) {
      return tauri.invoke<SmartActionReport>("restore_game_session", { undoToken: undoToken ?? "", licenseType });
    }

    return createBrowserReport("game-optimizer-session", "Browser preview has no changed power plan to restore.");
  },

  async executeCleanupPlan(licenseType) {
    const tauri = await tryGetTauriCore();
    if (tauri) {
      return tauri.invoke<GameSessionResult>("execute_cleanup_plan", { licenseType });
    }

    return {
      report: createBrowserReport("safe-cleanup-plan", "Browser preview cannot move cleanup candidates."),
    };
  },

  async restoreCleanup(undoToken, licenseType) {
    const tauri = await tryGetTauriCore();
    if (tauri) {
      return tauri.invoke<SmartActionReport>("restore_cleanup", { undoToken: undoToken ?? "", licenseType });
    }

    return createBrowserReport("safe-cleanup-plan", "Browser preview has no quarantined cleanup files to restore.");
  },

  async exportSmartActionReport(report, licenseType) {
    const tauri = await tryGetTauriCore();
    if (tauri) {
      return tauri.invoke<string>("export_smart_action_report", { reportJson: JSON.stringify(report, null, 2), licenseType });
    }

    const blob = new Blob([formatReport(report)], { type: "text/plain" });
    return URL.createObjectURL(blob);
  },
};

export function formatReport(report: SmartActionReport) {
  return [
    `${report.title}`,
    `Timestamp: ${new Date(report.timestamp).toLocaleString()}`,
    `Summary: ${report.summary}`,
    report.score == null ? "" : `Score: ${report.score}/100`,
    report.beforeSnapshot ? `Before: ${report.beforeSnapshot}` : "",
    report.afterSnapshot ? `After: ${report.afterSnapshot}` : "",
    "",
    "Findings",
    ...report.findings.map((finding) => `- ${finding.label}: ${finding.value} (${finding.severity}) - ${finding.detail}`),
    "",
    "Actions taken",
    ...(report.actionsTaken.length ? report.actionsTaken.map((action) => `- ${action}`) : ["- None"]),
    "",
    "Skipped actions",
    ...(report.skippedActions.length ? report.skippedActions.map((action) => `- ${action}`) : ["- None"]),
    "",
    "Errors",
    ...(report.errors.length ? report.errors.map((error) => `- ${error}`) : ["- None"]),
    "",
    "Undo info",
    ...(report.undoInfo.length ? report.undoInfo.map((info) => `- ${info}`) : ["- Nothing changed"]),
  ]
    .filter((line, index, lines) => line !== "" || lines[index - 1] !== "")
    .join("\n");
}

function createBrowserReport(actionId: SmartActionId | PremiumActionId, summary: string): SmartActionReport {
  const module = dashboardModules.find((item) => item.id === actionId) ?? premiumModules.find((item) => item.id === actionId);
  const title = module?.title ?? "Smart Action";
  return {
    id: actionId,
    title,
    timestamp: new Date().toISOString(),
    summary,
    score: 0,
    beforeSnapshot: "Browser preview snapshot only.",
    afterSnapshot: "No live system change was made.",
    findings: [
      {
        label: "Runtime",
        value: "Desktop app required",
        severity: "watch",
        detail: "Open 47Service through Tauri to run live process, network, storage, and power-plan checks.",
      },
    ],
    steps: [
      {
        label: "Preview guard",
        detail: "No Windows system data was read and no settings were changed in browser preview mode.",
        status: "skipped",
      },
    ],
    actionsTaken: ["Created a dry-run report only."],
    skippedActions: ["Live checks are available in the desktop runtime."],
    errors: [],
    undoInfo: ["No undo needed because no system change was made."],
  };
}

async function tryGetTauriCore() {
  if (!("__TAURI_INTERNALS__" in window)) {
    return null;
  }

  try {
    return await import("@tauri-apps/api/core");
  } catch {
    return null;
  }
}
