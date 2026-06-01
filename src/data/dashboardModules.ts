import type { LucideIcon } from "lucide-react";
import type { FeatureId } from "../lib/featureAccess";
import {
  Activity,
  Brush,
  Gamepad2,
  Network,
  Radar,
  ScrollText,
} from "lucide-react";

export type SmartActionId =
  | "smart-game-prep"
  | "game-optimizer-session"
  | "lag-cause-analyzer"
  | "network-stability-doctor"
  | "safe-cleanup-plan"
  | "session-report";

export type DashboardModule = {
  id: SmartActionId;
  title: string;
  eyebrow: string;
  description: string;
  accent: "cyan" | "green" | "amber" | "red" | "violet" | "steel";
  icon: LucideIcon;
  checks: string[];
  changes: string;
  feature: FeatureId;
  lockedSummary: string;
};

export const dashboardModules: DashboardModule[] = [
  {
    id: "smart-game-prep",
    title: "Smart Game Prep",
    eyebrow: "Session workflow",
    description: "Detects games, heavy apps, disk/RAM pressure, and starts a reversible timed gaming profile.",
    accent: "cyan",
    icon: Gamepad2,
    checks: ["Running games", "Heavy background apps", "Power plan", "RAM and disk pressure"],
    changes: "Can switch to a high-performance power plan only after confirmation, then restores it when the timer ends.",
    feature: "smart-game-prep",
    lockedSummary: "PRO unlocks timed gaming sessions, reversible power-plan switching, and safe close suggestions.",
  },
  {
    id: "game-optimizer-session",
    title: "Game Optimizer Session",
    eyebrow: "Detected game",
    description: "Detects running games, shows process pressure, lists safe suggestions, and starts a reversible timed session.",
    accent: "green",
    icon: Gamepad2,
    checks: ["Detected games", "Process CPU/RAM/GPU", "Heavy background apps", "System pressure"],
    changes: "LITE can view detected games. PRO can start a timed session with reversible power-plan changes only.",
    feature: "game-optimizer-session",
    lockedSummary: "LITE can view detected games. PRO unlocks timed optimization sessions and reports.",
  },
  {
    id: "lag-cause-analyzer",
    title: "Lag Cause Analyzer",
    eyebrow: "Analysis",
    description: "Runs CPU, RAM, disk, network, and background-app checks together to identify the likely bottleneck.",
    accent: "amber",
    icon: Radar,
    checks: ["CPU load", "RAM pressure", "Disk pressure", "Network latency", "Background apps"],
    changes: "No system changes. It recommends safe next actions and logs the diagnosis.",
    feature: "lag-cause-analyzer",
    lockedSummary: "PRO unlocks combined bottleneck detection and safe recommended actions.",
  },
  {
    id: "network-stability-doctor",
    title: "Network Stability Doctor",
    eyebrow: "Packet path",
    description: "Pings multiple endpoints, checks DNS and gateway latency, scores stability, and exports a support report.",
    accent: "red",
    icon: Network,
    checks: ["Gateway latency", "DNS response", "Packet loss", "Multi-endpoint ping"],
    changes: "No network settings are changed. It only reads connectivity signals and writes a report.",
    feature: "network-stability-doctor",
    lockedSummary: "LITE can run the basic network check. PRO unlocks exportable support reports.",
  },
  {
    id: "safe-cleanup-plan",
    title: "Safe Cleanup Plan",
    eyebrow: "Storage",
    description: "Scans temp, cache, and log locations, excludes important folders, and prepares a confirm-before-clean plan.",
    accent: "violet",
    icon: Brush,
    checks: ["Temp files", "Cache folders", "Log folders", "Protected exclusions"],
    changes: "Planning is read-only. Deletion requires confirmation and records exact categories and undo limits.",
    feature: "safe-cleanup-plan",
    lockedSummary: "LITE can scan cleanup candidates. PRO unlocks confirmed quarantine cleanup and undo.",
  },
  {
    id: "session-report",
    title: "Session Report",
    eyebrow: "Audit trail",
    description: "Builds a before/after report with timestamps, actions taken, skipped work, errors, and undo info.",
    accent: "steel",
    icon: ScrollText,
    checks: ["Action history", "Skipped actions", "Errors", "Undo details"],
    changes: "Writes an exportable report only. No optimizer settings are changed.",
    feature: "session-report",
    lockedSummary: "PRO unlocks full session reports. LIFETIME adds advanced report history.",
  },
];
