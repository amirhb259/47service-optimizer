import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock,
  Database,
  Download,
  FileDown,
  FileInput,
  FileOutput,
  Gauge,
  Gamepad2,
  Laptop,
  LayoutDashboard,
  LifeBuoy,
  Layers3,
  LogOut,
  Minimize2,
  Moon,
  Power,
  RefreshCw,
  RotateCcw,
  Rocket,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Sparkle,
  Sun,
  Trash2,
  Volume2,
  Wand2,
  X,
} from "lucide-react";
import { Crown } from "lucide-react";
import type { AccessState, AppToast } from "../App";
import { dashboardModules, type DashboardModule } from "../data/dashboardModules";
import { desktopRuntime, parseImportedSettings } from "../lib/desktopRuntime";
import { canUseFeature, getUpgradeMessage, requiredPlanForFeature, type FeatureId } from "../lib/featureAccess";
import type { LicenseType } from "../lib/licenseApi";
import { defaultSettings, type AppSettings, type DashboardSectionId, type ThemePreference } from "../lib/settingsStorage";
import {
  formatReport,
  smartActionRuntime,
  type SelectedGameProcess,
  type SmartActionReport,
  type SmartActionStatus,
} from "../lib/smartActions";
import BrandLogo from "./BrandLogo";
import FeatureCard from "./FeatureCard";
import PremiumOverlay from "./PremiumOverlay";
import PremiumSection from "./PremiumSection";
import StatusPill from "./StatusPill";
import SupportTicketForm from "./SupportTicketForm";

type DashboardProps = {
  accessState: AccessState;
  settings: AppSettings;
  onClearSession: () => void;
  onResetSettings: () => void;
  onSettingsChange: (
    updater: AppSettings | ((current: AppSettings) => AppSettings),
    successMessage?: string,
    options?: { silent?: boolean },
  ) => void;
  onShowToast: (toast: Omit<AppToast, "id">) => void;
  onSignOut: () => void;
};

type SectionId = DashboardSectionId;

const navItems: Array<{ id: SectionId; label: string; icon: typeof Gauge }> = [
  { id: "overview", label: "Overview", icon: Gauge },
  { id: "modules", label: "Modules", icon: Layers3 },
  { id: "settings", label: "Settings", icon: SlidersHorizontal },
  { id: "help", label: "Help", icon: LifeBuoy },
];

export default function Dashboard({
  accessState,
  settings,
  onClearSession,
  onResetSettings,
  onSettingsChange,
  onShowToast,
  onSignOut,
}: DashboardProps) {
  const [activeSection, setActiveSection] = useState<SectionId>("overview");
  const [activeModule, setActiveModule] = useState<DashboardModule | null>(null);
  const [smartActionStatus, setSmartActionStatus] = useState<SmartActionStatus>("ready");
  const [smartActionReport, setSmartActionReport] = useState<SmartActionReport | null>(null);
  const [sessionUndoToken, setSessionUndoToken] = useState<string | undefined>();
  const [cleanupUndoToken, setCleanupUndoToken] = useState<string | undefined>();
  const [selectedGamePid, setSelectedGamePid] = useState("");
  const sessionTimerRef = useRef<number | null>(null);
  const previousModeRef = useRef(accessState.mode);
  const licenseType = getEffectiveLicenseType(accessState);
  const isPremium = accessState.mode === "licensed" && (accessState.premium ?? false);
  const isLifetime = licenseType === "LIFETIME";
  const [showPremiumOverlay, setShowPremiumOverlay] = useState(false);

  const allNavItems = useMemo(() => {
    const items = [...navItems];
    items.push({ id: "premium" as SectionId, label: "Premium", icon: Crown });
    return items;
  }, []);

  const activeTitle = useMemo(() => {
    return allNavItems.find((item) => item.id === activeSection)?.label ?? "Overview";
  }, [activeSection]);

  useEffect(() => {
    const previousMode = previousModeRef.current;
    previousModeRef.current = accessState.mode;

    if (previousMode !== "licensed" && accessState.mode === "licensed") {
      setActiveSection("overview");
    }
  }, [accessState.mode]);

  return (
    <section className="dashboard-screen" aria-label="47Service dashboard">
      <aside className="nav-rail" aria-label="Primary navigation">
        <div className="rail-brand">
          <div className="sidebar-logo-stage">
            <BrandLogo className="brand-logo-sidebar" />
          </div>
          <div>
            <strong>47Service</strong>
            <span>{licenseType} access</span>
          </div>
        </div>

        <nav className="rail-nav">
          {allNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                className={isActive ? "nav-button active" : "nav-button"}
                type="button"
                key={item.id}
                onClick={() => {
                  setActiveSection(item.id);
                }}
                aria-label={item.label}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon size={18} aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="rail-footer">
          <button className="premium-footer-button" type="button" onClick={() => setShowPremiumOverlay(true)} aria-label="Premium addon">
            <Crown size={17} aria-hidden="true" />
            <span>{isPremium ? "Premium active" : "Get Premium"}</span>
          </button>
          <StatusPill variant="full">
            <Shield size={17} aria-hidden="true" />
            <span>No system actions active</span>
          </StatusPill>
          <button
            className="ghost-button"
            type="button"
            onClick={() => {
              setActiveSection("overview");
              onSignOut();
            }}
          >
            <LogOut size={17} aria-hidden="true" />
            <span>Return</span>
          </button>
        </div>
      </aside>

      <div className="dashboard-content">
        <header className="dashboard-header">
          <div>
            <p className="section-kicker">47Service command shell</p>
            <h2>{activeTitle}</h2>
          </div>
          <div className="mode-chip">
            <Sparkle size={16} aria-hidden="true" />
            <span>
              {accessState.mode === "licensed"
                ? accessState.devFallback
                  ? "Development fallback"
                  : `${licenseType} license verified`
                : "Lite entry"}
            </span>
          </div>
          {isPremium ? (
            <div className="mode-chip premium">
              <Crown size={16} aria-hidden="true" />
              <span>Premium active</span>
            </div>
          ) : null}
          {isLifetime ? (
            <div className="mode-chip lifetime">
              <Sparkle size={16} aria-hidden="true" />
              <span>Lifetime exclusive</span>
            </div>
          ) : null}
        </header>

        {activeSection === "overview" ? (
          <OverviewSection licenseType={licenseType} onOpenSmartAction={openSmartAction} />
        ) : null}
        {activeSection === "modules" ? (
          <ModulesSection licenseType={licenseType} onOpenSmartAction={openSmartAction} />
        ) : null}
        {activeSection === "settings" ? (
          <SettingsSection
            settings={settings}
            onClearSession={onClearSession}
            onResetSettings={onResetSettings}
            onSettingsChange={onSettingsChange}
            onShowToast={onShowToast}
          />
        ) : null}
        {activeSection === "premium" ? (
          <PremiumSection
            licenseType={licenseType}
            isPremium={isPremium}
            onShowToast={(toast) => onShowToast({ ...toast, kind: toast.kind })}
          />
        ) : null}
        {activeSection === "help" ? <HelpSection licenseType={licenseType} /> : null}
      </div>
      {showPremiumOverlay ? (
        <PremiumOverlay licenseType={licenseType} isPremium={isPremium} onClose={() => setShowPremiumOverlay(false)} />
      ) : null}
      {activeModule ? (
        <SmartActionPanel
          module={activeModule}
          status={smartActionStatus}
          report={smartActionReport}
          hasSessionUndo={Boolean(sessionUndoToken)}
          hasCleanupUndo={Boolean(cleanupUndoToken)}
          licenseType={licenseType}
          onClose={() => setActiveModule(null)}
          onRun={() => runSmartAction(activeModule)}
          onStartSession={() => startGameSession()}
          onRestoreSession={() => restoreGameSession()}
          onExecuteCleanup={() => executeCleanupPlan()}
          onRestoreCleanup={() => restoreCleanup()}
          onExport={() => exportReport()}
          selectedGamePid={selectedGamePid}
          onSelectedGameChange={setSelectedGamePid}
        />
      ) : null}
    </section>
  );

  function openSmartAction(module: DashboardModule) {
    setActiveModule(module);
    setSmartActionStatus("ready");
    setSmartActionReport(null);
    setSelectedGamePid("");
  }

  async function runSmartAction(module: DashboardModule) {
    if (!ensureFeatureAccess(module.feature)) {
      return;
    }

    setSmartActionStatus("running");
    try {
      const report = await smartActionRuntime.runSmartAction(module.id, licenseType);
      setSmartActionReport(report);
      if (module.id === "game-optimizer-session") {
        const detectedGames = getDetectedGames(report);
        setSelectedGamePid(detectedGames.length === 1 ? String(detectedGames[0].pid) : "");
      }
      setSmartActionStatus("complete");
      onShowToast({ kind: "success", title: `${module.title} complete.`, detail: report.summary });
    } catch (error) {
      setSmartActionStatus("error");
      onShowToast({
        kind: "error",
        title: `${module.title} failed.`,
        detail: error instanceof Error ? error.message : "The workflow could not be completed.",
      });
    }
  }

  async function startGameSession() {
    if (!ensureFeatureAccess("game-optimizer-session-start")) {
      return;
    }

    const selectedGame = getSelectedGameProcess(smartActionReport, selectedGamePid);
    if (!selectedGame) {
      onShowToast({
        kind: "info",
        title: "Select a detected game.",
        detail: "Run Game Optimizer Session, choose a detected game process, then start the timed session.",
      });
      return;
    }

    if (!window.confirm(`Start a timed optimization session for ${selectedGame.gameName} and switch to a high-performance power plan if Windows allows it?`)) {
      return;
    }

    setSmartActionStatus("running");
    try {
      const result = await smartActionRuntime.startGameSession(60, licenseType, selectedGame);
      setSessionUndoToken(result.undoToken);
      setSmartActionReport(result.report);
      setSmartActionStatus("complete");
      if (sessionTimerRef.current) {
        window.clearTimeout(sessionTimerRef.current);
      }
      if (result.undoToken) {
        sessionTimerRef.current = window.setTimeout(() => {
          void restoreGameSession(result.undoToken);
        }, 60 * 60 * 1000);
      }
      onShowToast({ kind: "success", title: "Gaming session started.", detail: result.report.summary });
    } catch (error) {
      setSmartActionStatus("error");
      onShowToast({
        kind: "error",
        title: "Gaming session failed.",
        detail: error instanceof Error ? error.message : "The session could not be started.",
      });
    }
  }

  async function restoreGameSession(overrideToken?: string) {
    if (!ensureFeatureAccess("game-optimizer-session-start")) {
      return;
    }

    setSmartActionStatus("running");
    try {
      const report = await smartActionRuntime.restoreGameSession(overrideToken ?? sessionUndoToken, licenseType);
      if (sessionTimerRef.current) {
        window.clearTimeout(sessionTimerRef.current);
        sessionTimerRef.current = null;
      }
      setSessionUndoToken(undefined);
      setSmartActionReport(report);
      setSmartActionStatus("complete");
      onShowToast({ kind: "success", title: "Session restored.", detail: report.summary });
    } catch (error) {
      setSmartActionStatus("error");
      onShowToast({
        kind: "error",
        title: "Restore failed.",
        detail: error instanceof Error ? error.message : "47Service could not restore the previous power plan.",
      });
    }
  }

  async function executeCleanupPlan() {
    if (!ensureFeatureAccess("cleanup-execute")) {
      return;
    }

    if (!window.confirm("Move safe cleanup candidates to a 47Service quarantine folder? This avoids permanent deletion and creates an undo token.")) {
      return;
    }

    setSmartActionStatus("running");
    try {
      const result = await smartActionRuntime.executeCleanupPlan(licenseType);
      setCleanupUndoToken(result.undoToken);
      setSmartActionReport(result.report);
      setSmartActionStatus("complete");
      onShowToast({ kind: "success", title: "Cleanup quarantined.", detail: result.report.summary });
    } catch (error) {
      setSmartActionStatus("error");
      onShowToast({
        kind: "error",
        title: "Cleanup failed.",
        detail: error instanceof Error ? error.message : "47Service could not quarantine cleanup candidates.",
      });
    }
  }

  async function restoreCleanup() {
    if (!ensureFeatureAccess("cleanup-execute")) {
      return;
    }

    setSmartActionStatus("running");
    try {
      const report = await smartActionRuntime.restoreCleanup(cleanupUndoToken, licenseType);
      setCleanupUndoToken(undefined);
      setSmartActionReport(report);
      setSmartActionStatus("complete");
      onShowToast({ kind: "success", title: "Cleanup restored.", detail: report.summary });
    } catch (error) {
      setSmartActionStatus("error");
      onShowToast({
        kind: "error",
        title: "Cleanup restore failed.",
        detail: error instanceof Error ? error.message : "47Service could not restore quarantined files.",
      });
    }
  }

  async function exportReport() {
    if (!smartActionReport) {
      return;
    }
    if (!ensureFeatureAccess("export-reports")) {
      return;
    }

    try {
      const path = await smartActionRuntime.exportSmartActionReport(smartActionReport, licenseType);
      onShowToast({ kind: "success", title: "Report exported.", detail: path });
    } catch (error) {
      onShowToast({
        kind: "error",
        title: "Export failed.",
        detail: error instanceof Error ? error.message : "The report could not be exported.",
      });
    }
  }

  function ensureFeatureAccess(feature: FeatureId) {
    if (canUseFeature(feature, licenseType)) {
      return true;
    }

    onShowToast({
      kind: "info",
      title: `${requiredPlanForFeature(feature)} plan required.`,
      detail: getUpgradeMessage(feature, licenseType),
    });
    return false;
  }
}

function getEffectiveLicenseType(accessState: AccessState): LicenseType {
  if (accessState.mode === "licensed") {
    return accessState.licenseType ?? "LITE";
  }

  return "LITE";
}

function OverviewSection({
  licenseType,
  onOpenSmartAction,
}: {
  licenseType: LicenseType;
  onOpenSmartAction: (module: DashboardModule) => void;
}) {
  return (
    <div className="content-stack">
      <section className="status-plate" aria-label="Foundation status">
        <div className="status-core">
          <div className="reactor-ring logo-reactor" aria-hidden="true">
            <BrandLogo className="brand-logo-reactor" label="" />
          </div>
          <div>
            <p className="module-eyebrow">Smart Action console</p>
            <h3>Safe workflows online. Every run explains, logs, and reports.</h3>
            <p>
              47Service now groups diagnostics, recommendations, guarded changes, and undo notes into clear
              workflows instead of one-click mystery tweaks.
            </p>
          </div>
        </div>
        <div className="status-bars" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </section>

      <section className="feature-grid" aria-label="Smart Actions">
        {dashboardModules.map((module) => (
          <FeatureCard
            key={module.id}
            module={module}
            isLocked={!canUseFeature(module.feature, licenseType)}
            onOpen={onOpenSmartAction}
          />
        ))}
      </section>
    </div>
  );
}

function ModulesSection({
  licenseType,
  onOpenSmartAction,
}: {
  licenseType: LicenseType;
  onOpenSmartAction: (module: DashboardModule) => void;
}) {
  return (
    <div className="content-stack">
      <section className="module-board" aria-label="Smart Action workflows">
        <div className="board-header">
          <div>
            <p className="module-eyebrow">Workflow bay</p>
            <h3>High-value Smart Actions</h3>
          </div>
          <StatusPill variant="large">{licenseType} plan</StatusPill>
        </div>
        <div className="module-list">
          {dashboardModules.map((module) => {
            const Icon = module.icon;
            return (
              <button
                className={`module-row accent-${module.accent} ${!canUseFeature(module.feature, licenseType) ? "locked" : ""}`}
                key={module.id}
                type="button"
                onClick={() => onOpenSmartAction(module)}
              >
                <div className="row-icon" aria-hidden="true">
                  <Icon size={20} />
                </div>
                <div>
                  <strong>{module.title}</strong>
                  <span>{module.description}</span>
                </div>
                <span className="row-state">
                  {canUseFeature(module.feature, licenseType) ? "Open" : `${requiredPlanForFeature(module.feature)} locked`}
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function SmartActionPanel({
  module,
  status,
  report,
  hasSessionUndo,
  hasCleanupUndo,
  licenseType,
  onClose,
  onRun,
  onStartSession,
  onRestoreSession,
  onExecuteCleanup,
  onRestoreCleanup,
  onExport,
  selectedGamePid,
  onSelectedGameChange,
}: {
  module: DashboardModule;
  status: SmartActionStatus;
  report: SmartActionReport | null;
  hasSessionUndo: boolean;
  hasCleanupUndo: boolean;
  licenseType: LicenseType;
  onClose: () => void;
  onRun: () => void;
  onStartSession: () => void;
  onRestoreSession: () => void;
  onExecuteCleanup: () => void;
  onRestoreCleanup: () => void;
  onExport: () => void;
  selectedGamePid: string;
  onSelectedGameChange: (pid: string) => void;
}) {
  const Icon = module.icon;
  const isRunning = status === "running";
  const isGameOptimizer = module.id === "game-optimizer-session";
  const isCleanup = module.id === "safe-cleanup-plan";
  const isLocked = !canUseFeature(module.feature, licenseType);
  const canExport = canUseFeature("export-reports", licenseType);
  const canExecuteCleanup = canUseFeature("cleanup-execute", licenseType);
  const canStartGameSession = canUseFeature("game-optimizer-session-start", licenseType);
  const detectedGames = isGameOptimizer ? getDetectedGames(report) : [];
  const selectedGame = getSelectedGameProcess(report, selectedGamePid);

  return (
    <div className="smart-action-backdrop" role="dialog" aria-modal="true" aria-labelledby="smart-action-title">
      <section className={`smart-action-panel accent-${module.accent}`}>
        <button className="modal-close" type="button" onClick={onClose} aria-label="Close Smart Action">
          <X size={18} aria-hidden="true" />
        </button>

        <div className="smart-action-hero">
          <div className="feature-icon" aria-hidden="true">
            <Icon size={25} />
          </div>
          <div>
            <p className="module-eyebrow">{module.eyebrow}</p>
            <h3 id="smart-action-title">{module.title}</h3>
            <p>{module.description}</p>
          </div>
        </div>

        <div className="smart-action-grid">
          <div className="smart-action-card">
            <strong>Workflow checks</strong>
            <div className="smart-chip-list">
              {module.checks.map((check) => (
                <span className="smart-chip" key={check}>
                  <CheckCircle2 size={14} aria-hidden="true" />
                  {check}
                </span>
              ))}
            </div>
          </div>

          <div className="smart-action-card warning">
            <strong>{isLocked ? `${requiredPlanForFeature(module.feature)} plan required` : "Change policy"}</strong>
            <p>{isLocked ? getUpgradeMessage(module.feature, licenseType) : module.changes}</p>
          </div>
        </div>

        {isGameOptimizer ? (
          <GameProcessPicker
            detectedGames={detectedGames}
            selectedGamePid={selectedGamePid}
            canStartSession={canStartGameSession}
            onSelectedGameChange={onSelectedGameChange}
          />
        ) : null}

        <div className="smart-action-actions">
          <button className="license-submit wide modal-primary" type="button" onClick={onRun} disabled={isRunning || isLocked}>
            {isRunning ? <RefreshCw className="spin-icon" size={17} aria-hidden="true" /> : <Gauge size={17} aria-hidden="true" />}
            <span>{isLocked ? "Upgrade required" : isRunning ? "Running checks" : "Run workflow"}</span>
          </button>
          {isGameOptimizer ? (
            <>
              <button
                className="ghost-button"
                type="button"
                onClick={onStartSession}
                disabled={isRunning || !canStartGameSession || !selectedGame}
              >
                <GamepadIcon />
                <span>{canStartGameSession ? "Start 60m session" : "PRO session required"}</span>
              </button>
              <button
                className="ghost-button"
                type="button"
                onClick={onRestoreSession}
                disabled={isRunning || !canStartGameSession || !hasSessionUndo}
              >
                <RotateCcw size={17} aria-hidden="true" />
                <span>Restore session</span>
              </button>
            </>
          ) : null}
          {isCleanup ? (
            <>
              <button className="ghost-button" type="button" onClick={onExecuteCleanup} disabled={isRunning || !canExecuteCleanup}>
                <Trash2 size={17} aria-hidden="true" />
                <span>Quarantine cleanup</span>
              </button>
              <button className="ghost-button" type="button" onClick={onRestoreCleanup} disabled={isRunning || !canExecuteCleanup || !hasCleanupUndo}>
                <RotateCcw size={17} aria-hidden="true" />
                <span>Undo cleanup</span>
              </button>
            </>
          ) : null}
          <button className="ghost-button" type="button" onClick={onExport} disabled={!report || isRunning || !canExport}>
            <Download size={17} aria-hidden="true" />
            <span>Export report</span>
          </button>
        </div>

        <div className="smart-progress" aria-live="polite">
          {(report?.steps ?? getPendingSteps(module)).map((step, index) => (
            <div className={`smart-step ${step.status}`} key={`${step.label}-${index}`}>
              <span>{index + 1}</span>
              <div>
                <strong>{step.label}</strong>
                <small>{step.detail}</small>
              </div>
            </div>
          ))}
        </div>

        {status === "error" ? (
          <div className="smart-warning">
            <AlertTriangle size={17} aria-hidden="true" />
            <span>The workflow stopped early. No unsafe fallback changes were attempted.</span>
          </div>
        ) : null}

        {report ? (
          <div className="smart-results">
            <div className="smart-result-summary">
              <div>
                <strong>{report.summary}</strong>
                <span>{new Date(report.timestamp).toLocaleString()}</span>
              </div>
              {report.score != null ? <b>{report.score}/100</b> : null}
            </div>
            {(report.beforeSnapshot || report.afterSnapshot) ? (
              <div className="smart-snapshots">
                <div>
                  <span>Before</span>
                  <strong>{report.beforeSnapshot ?? "Not captured"}</strong>
                </div>
                <div>
                  <span>After</span>
                  <strong>{report.afterSnapshot ?? "Not captured"}</strong>
                </div>
              </div>
            ) : null}

            <div className="smart-findings">
              {report.findings.map((finding) => (
                <div className={`smart-finding ${finding.severity}`} key={`${finding.label}-${finding.value}`}>
                  <span>{finding.label}</span>
                  <strong>{finding.value}</strong>
                  <small>{finding.detail}</small>
                </div>
              ))}
            </div>

            <details className="smart-report-text">
              <summary>Session report details</summary>
              <pre>{formatReport(report)}</pre>
            </details>
          </div>
        ) : null}
      </section>
    </div>
  );
}

type DetectedGameProcess = SelectedGameProcess & {
  ramMb?: number;
  cpuUsage?: string;
  gpuUsage?: string;
  windowTitle?: string;
};

function GameProcessPicker({
  detectedGames,
  selectedGamePid,
  canStartSession,
  onSelectedGameChange,
}: {
  detectedGames: DetectedGameProcess[];
  selectedGamePid: string;
  canStartSession: boolean;
  onSelectedGameChange: (pid: string) => void;
}) {
  const selectedGame = detectedGames.find((game) => String(game.pid) === selectedGamePid);

  return (
      <div className="game-picker-card">
        <div className="game-picker-heading">
          <div>
            <strong>Detected game process</strong>
            <span>{canStartSession ? "Select one process before starting the timed session." : "Run detection to view active games. Upgrade your plan to start a timed session."}</span>
          </div>
          {canStartSession ? <StatusPill>Session ready</StatusPill> : null}
        </div>

      {detectedGames.length ? (
        <>
          <label className="game-process-select">
            <span>Game process</span>
            <select value={selectedGamePid} onChange={(event) => onSelectedGameChange(event.target.value)}>
              <option value="">Select detected game</option>
              {detectedGames.map((game) => (
                <option value={game.pid} key={`${game.processName}-${game.pid}`}>
                  {game.gameName} - {game.processName} ({game.pid})
                </option>
              ))}
            </select>
          </label>

          {selectedGame ? (
            <div className="game-process-details">
              <Metric label="Game" value={selectedGame.gameName} />
              <Metric label="Process" value={selectedGame.processName} />
              <Metric label="PID" value={String(selectedGame.pid)} />
              <Metric label="RAM" value={selectedGame.ramMb == null ? "Unavailable" : `${selectedGame.ramMb} MB`} />
              <Metric label="CPU" value={selectedGame.cpuUsage ?? "Unavailable"} />
              <Metric label="GPU" value={selectedGame.gpuUsage ?? "Unavailable"} />
            </div>
          ) : null}
        </>
      ) : (
        <div className="proof-empty-state">
          <Gamepad2 size={18} aria-hidden="true" />
          <span>Run the workflow to detect active games.</span>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function getSelectedGameProcess(report: SmartActionReport | null, selectedGamePid: string): SelectedGameProcess | undefined {
  const selected = getDetectedGames(report).find((game) => String(game.pid) === selectedGamePid);
  if (!selected) {
    return undefined;
  }

  return {
    pid: selected.pid,
    gameName: selected.gameName,
    processName: selected.processName,
  };
}

function getDetectedGames(report: SmartActionReport | null): DetectedGameProcess[] {
  if (!report?.raw) {
    return [];
  }

  const rawGames = report.raw.detectedGames ?? report.raw.games;
  const parsed = parseRawList(rawGames);
  return parsed
    .map((item) => normalizeDetectedGame(item))
    .filter((game): game is DetectedGameProcess => Boolean(game));
}

function parseRawList(value: unknown): unknown[] {
  const parsed = typeof value === "string" ? safeJsonParse(value) : value;
  if (Array.isArray(parsed)) {
    return parsed;
  }
  if (parsed && typeof parsed === "object") {
    return [parsed];
  }
  return [];
}

function normalizeDetectedGame(value: unknown): DetectedGameProcess | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const pid = Number(readKey(record, "pid", "PID", "Id"));
  const processName = String(readKey(record, "processName", "ProcessName") ?? "").trim();
  if (!Number.isFinite(pid) || !processName) {
    return null;
  }

  const gameName = String(readKey(record, "gameName", "GameName") ?? processName).trim();
  const ramMb = Number(readKey(record, "ramMb", "RamMB", "MemoryMB"));
  const gpu = readKey(record, "gpuUsage", "GpuUsage");
  const cpu = readKey(record, "cpuUsage", "CpuUsage", "CPU");

  return {
    pid,
    processName,
    gameName,
    ramMb: Number.isFinite(ramMb) ? ramMb : undefined,
    cpuUsage: cpu == null ? undefined : String(cpu),
    gpuUsage: gpu == null ? undefined : String(gpu),
    windowTitle: String(readKey(record, "windowTitle", "WindowTitle") ?? ""),
  };
}

function readKey(record: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    if (key in record) {
      return record[key];
    }
  }
  return undefined;
}

function safeJsonParse(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function getPendingSteps(module: DashboardModule) {
  return module.checks.map((check) => ({
    label: check,
    detail: "Ready to run. No changes are made until the workflow reaches an explicit action step.",
    status: "skipped" as const,
  }));
}

function GamepadIcon() {
  return <Gamepad2 size={17} aria-hidden="true" />;
}

function SettingsSection({
  settings,
  onClearSession,
  onResetSettings,
  onSettingsChange,
  onShowToast,
}: {
  settings: AppSettings;
  onClearSession: () => void;
  onResetSettings: () => void;
  onSettingsChange: DashboardProps["onSettingsChange"];
  onShowToast: DashboardProps["onShowToast"];
}) {
  const importInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function syncStartupStatus() {
      try {
        const enabled = await desktopRuntime.getLaunchOnStartup();
        if (isMounted && typeof enabled === "boolean" && enabled !== settings.launchOnWindowsStartup) {
          onSettingsChange(
            (current) => ({ ...current, launchOnWindowsStartup: enabled }),
            "Startup launch status synced.",
            { silent: true },
          );
        }
      } catch {
        // Startup status is advisory in browser preview and should not block the page.
      }
    }

    void syncStartupStatus();
    return () => {
      isMounted = false;
    };
  }, [onSettingsChange, settings.launchOnWindowsStartup]);

  function updateSetting(nextSettings: AppSettings, message: string) {
    onSettingsChange(nextSettings, message);
  }

  function updateBoolean(key: keyof Pick<
    AppSettings,
    | "autoLogin"
    | "compactMode"
    | "autoMinimizeToTray"
    | "soundEffects"
    | "safetyConfirmations"
    | "autoRefreshLicenseSession"
  >, message: string) {
    updateSetting({ ...settings, [key]: !settings[key] }, message);
  }

  async function updateLaunchOnStartup() {
    const enabled = !settings.launchOnWindowsStartup;
    try {
      const result = await desktopRuntime.setLaunchOnStartup(enabled);
      updateSetting({ ...settings, launchOnWindowsStartup: enabled }, result.detail);
    } catch (error) {
      onShowToast({
        kind: "error",
        title: "Startup launch was not changed.",
        detail: error instanceof Error ? error.message : "Windows rejected the startup update.",
      });
    }
  }

  function handleClearSession() {
    if (settings.safetyConfirmations && !window.confirm("Clear saved local login data and return to the license screen?")) {
      return;
    }

    onClearSession();
  }

  async function handleResetSettings() {
    if (settings.safetyConfirmations && !window.confirm("Reset all settings to their defaults?")) {
      return;
    }

    if (settings.launchOnWindowsStartup) {
      try {
        await desktopRuntime.setLaunchOnStartup(defaultSettings.launchOnWindowsStartup);
      } catch {
        onShowToast({
          kind: "warning",
          title: "Startup launch still needs attention.",
          detail: "Windows did not confirm removal from startup during reset.",
        });
      }
    }

    onResetSettings();
  }

  async function handleClearCache() {
    if (settings.safetyConfirmations && !window.confirm("Clear local 47Service cache files? Settings and license data stay intact.")) {
      return;
    }

    try {
      const result = await desktopRuntime.clearCache();
      onShowToast({ kind: "success", title: "Cache cleared.", detail: result.detail });
    } catch (error) {
      onShowToast({
        kind: "error",
        title: "Cache was not cleared.",
        detail: error instanceof Error ? error.message : "The cache cleanup failed.",
      });
    }
  }

  async function handleExportLogs() {
    try {
      const result = await desktopRuntime.exportLocalLogs(settings);
      onShowToast({ kind: "success", title: "Local logs exported.", detail: result.path ?? result.detail });
    } catch (error) {
      onShowToast({
        kind: "error",
        title: "Logs were not exported.",
        detail: error instanceof Error ? error.message : "The local log export failed.",
      });
    }
  }

  function handleExportSettings() {
    desktopRuntime.exportSettings(settings);
    onShowToast({ kind: "success", title: "Settings exported.", detail: "A JSON settings backup was created." });
  }

  async function handleImportSettings(file: File | undefined) {
    if (!file) {
      return;
    }

    try {
      const imported = parseImportedSettings(await file.text()) as Partial<AppSettings>;
      if (typeof imported.launchOnWindowsStartup === "boolean") {
        await desktopRuntime.setLaunchOnStartup(imported.launchOnWindowsStartup);
      }
      onSettingsChange({ ...settings, ...imported }, "Settings imported.");
    } catch {
      onShowToast({
        kind: "error",
        title: "Settings import failed.",
        detail: "The selected file was not a readable 47Service settings export.",
      });
    } finally {
      if (importInputRef.current) {
        importInputRef.current.value = "";
      }
    }
  }

  function handleRestoreUiLayout() {
    updateSetting(
      {
        ...settings,
        compactMode: defaultSettings.compactMode,
        animationIntensity: defaultSettings.animationIntensity,
        backgroundBlur: defaultSettings.backgroundBlur,
      },
      "Default UI layout restored.",
    );
  }

  return (
    <div className="content-stack settings-content-stack">
      <section className="module-board settings-board" aria-label="Application settings">
        <div className="board-header">
          <div>
            <p className="module-eyebrow">Preferences</p>
            <h3>Settings</h3>
          </div>
          <StatusPill variant="large">Saved locally</StatusPill>
        </div>
        <div className="settings-category-grid">
          <SettingsCategory title="Interface" description="Visual density, motion, and app chrome.">
            <SettingCard
              icon={Sun}
              title="Theme selection"
              description="Apply the visual theme instantly across the full app."
              control={
                <ThemeSelector
                  value={settings.theme}
                  onChange={(theme) => updateSetting({ ...settings, theme }, "Theme updated.")}
                />
              }
            />
            <SettingCard
              icon={LayoutDashboard}
              title="Compact mode"
              description="Tighten dashboard spacing and controls for denser work sessions."
              control={
                <ToggleSwitch
                  checked={settings.compactMode}
                  label="Compact mode"
                  onChange={() => updateBoolean("compactMode", "Compact mode saved.")}
                />
              }
            />
            <SettingCard
              icon={Wand2}
              title="Animation intensity"
              description="Tune UI motion from minimal to expressive."
              control={
                <SelectControl
                  label="Animation intensity"
                  value={settings.animationIntensity}
                  options={[
                    { value: "reduced", label: "Reduced" },
                    { value: "balanced", label: "Balanced" },
                    { value: "expressive", label: "Expressive" },
                  ]}
                  onChange={(animationIntensity) =>
                    updateSetting({ ...settings, animationIntensity }, "Animation intensity saved.")
                  }
                />
              }
            />
            <SettingCard
              icon={SlidersHorizontal}
              title="Background blur intensity"
              description="Control the premium glass effect used by panels and overlays."
              control={
                <RangeControl
                  label="Background blur intensity"
                  value={settings.backgroundBlur}
                  min={0}
                  max={36}
                  unit="px"
                  onChange={(backgroundBlur) =>
                    updateSetting({ ...settings, backgroundBlur }, "Background blur saved.")
                  }
                />
              }
            />
            <SettingCard
              icon={RotateCcw}
              title="Restore default UI layout"
              description="Reset density, motion, blur, and startup section to the default layout."
              control={
                <button className="ghost-button settings-action" type="button" onClick={handleRestoreUiLayout}>
                  <RotateCcw size={17} aria-hidden="true" />
                  <span>Restore layout</span>
                </button>
              }
            />
          </SettingsCategory>

          <SettingsCategory title="Startup & session" description="Launch, restore, and timeout behavior.">
            <SettingCard
              icon={Power}
              title="Auto login"
              description="Restore only a saved license session after it validates against this device."
              control={
                <ToggleSwitch
                  checked={settings.autoLogin}
                  label="Auto login"
                  onChange={() => updateBoolean("autoLogin", "Auto login preference saved.")}
                />
              }
            />
            <SettingCard
              icon={Rocket}
              title="Launch on Windows startup"
              description="Add or remove 47Service from the current user's Windows startup apps."
              control={
                <ToggleSwitch
                  checked={settings.launchOnWindowsStartup}
                  label="Launch on Windows startup"
                  onChange={updateLaunchOnStartup}
                />
              }
            />
            <SettingCard
              icon={Minimize2}
              title="Auto minimize to tray"
              description="Closing the desktop window hides it to the 47Service tray icon instead of exiting."
              control={
                <ToggleSwitch
                  checked={settings.autoMinimizeToTray}
                  label="Auto minimize to tray"
                  onChange={() => updateBoolean("autoMinimizeToTray", "Tray behavior saved.")}
                />
              }
            />
            <SettingCard
              icon={Clock}
              title="Session timeout timer"
              description="Automatically clear the local license session after inactivity."
              control={
                <SelectControl
                  label="Session timeout timer"
                  value={String(settings.sessionTimeoutMinutes)}
                  options={[
                    { value: "0", label: "Off" },
                    { value: "15", label: "15 min" },
                    { value: "30", label: "30 min" },
                    { value: "60", label: "1 hour" },
                    { value: "120", label: "2 hours" },
                  ]}
                  onChange={(value) =>
                    updateSetting(
                      { ...settings, sessionTimeoutMinutes: Number(value) },
                      "Session timeout saved.",
                    )
                  }
                />
              }
            />
            <SettingCard
              icon={RefreshCw}
              title="Auto refresh license session"
              description="Periodically revalidate saved licensed sessions while you are signed in."
              control={
                <ToggleSwitch
                  checked={settings.autoRefreshLicenseSession}
                  label="Auto refresh license session"
                  onChange={() =>
                    updateBoolean("autoRefreshLicenseSession", "License refresh preference saved.")
                  }
                />
              }
            />
          </SettingsCategory>

          <SettingsCategory title="Notifications" description="Toast timing, detail level, and sound feedback.">
            <SettingCard
              icon={Bell}
              title="Notification style"
              description="Use expanded toasts with detail text, or quiet compact toasts."
              control={
                <ToggleSwitch
                  checked={settings.notificationStyle === "expanded"}
                  label="Notification style"
                  onLabel="Expanded"
                  offLabel="Quiet"
                  onChange={() =>
                    updateSetting(
                      {
                        ...settings,
                        notificationStyle: settings.notificationStyle === "expanded" ? "quiet" : "expanded",
                      },
                      "Notification style saved.",
                    )
                  }
                />
              }
            />
            <SettingCard
              icon={Clock}
              title="Notification duration"
              description="Choose how long success, warning, and info toasts remain visible."
              control={
                <RangeControl
                  label="Notification duration"
                  value={settings.notificationDurationMs}
                  min={1500}
                  max={12000}
                  step={500}
                  unit="ms"
                  onChange={(notificationDurationMs) =>
                    updateSetting({ ...settings, notificationDurationMs }, "Notification duration saved.")
                  }
                />
              }
            />
            <SettingCard
              icon={Volume2}
              title="Sound effects"
              description="Play a short confirmation tone when notifications appear."
              control={
                <ToggleSwitch
                  checked={settings.soundEffects}
                  label="Sound effects"
                  onChange={() => updateBoolean("soundEffects", "Sound effects preference saved.")}
                />
              }
            />
          </SettingsCategory>

          <SettingsCategory title="Data & maintenance" description="Backups, logs, cache, and local safety controls.">
            <SettingCard
              icon={Database}
              title="Clear cache"
              description="Remove temporary 47Service cache data while keeping settings and license data."
              control={
                <button className="ghost-button settings-action" type="button" onClick={handleClearCache}>
                  <Trash2 size={17} aria-hidden="true" />
                  <span>Clear cache</span>
                </button>
              }
            />
            <SettingCard
              icon={FileDown}
              title="Export local logs"
              description="Create a local support bundle with recent Smart Action report logs."
              control={
                <button className="ghost-button settings-action" type="button" onClick={handleExportLogs}>
                  <Download size={17} aria-hidden="true" />
                  <span>Export logs</span>
                </button>
              }
            />
            <SettingCard
              icon={FileOutput}
              title="Export settings"
              description="Download a JSON backup of all persisted 47Service preferences."
              control={
                <button className="ghost-button settings-action" type="button" onClick={handleExportSettings}>
                  <FileOutput size={17} aria-hidden="true" />
                  <span>Export</span>
                </button>
              }
            />
            <SettingCard
              icon={FileInput}
              title="Import settings"
              description="Load a previously exported 47Service settings JSON file."
              control={
                <>
                  <input
                    ref={importInputRef}
                    className="settings-file-input"
                    type="file"
                    accept="application/json,.json"
                    onChange={(event) => void handleImportSettings(event.target.files?.[0])}
                  />
                  <button
                    className="ghost-button settings-action"
                    type="button"
                    onClick={() => importInputRef.current?.click()}
                  >
                    <FileInput size={17} aria-hidden="true" />
                    <span>Import</span>
                  </button>
                </>
              }
            />
            <SettingCard
              icon={ShieldCheck}
              title="Safety confirmations"
              description="Ask before destructive actions such as license deletion, cache clearing, and resets."
              control={
                <ToggleSwitch
                  checked={settings.safetyConfirmations}
                  label="Safety confirmations"
                  onChange={() => updateBoolean("safetyConfirmations", "Safety confirmation preference saved.")}
                />
              }
            />
            <SettingCard
              icon={Trash2}
              title="Clear local session"
              description="Remove saved license login data from this device and return to the license screen."
              tone="danger"
              control={
                <button className="ghost-button settings-action danger" type="button" onClick={handleClearSession}>
                  <Trash2 size={17} aria-hidden="true" />
                  <span>Clear session</span>
                </button>
              }
            />
            <SettingCard
              icon={RotateCcw}
              title="Reset all settings"
              description="Restore every setting to its default value while keeping the current app session."
              control={
                <button className="ghost-button settings-action" type="button" onClick={handleResetSettings}>
                  <RotateCcw size={17} aria-hidden="true" />
                  <span>Reset all</span>
                </button>
              }
            />
          </SettingsCategory>
        </div>
      </section>
    </div>
  );
}

function SettingsCategory({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="settings-category" aria-label={title}>
      <div className="settings-category-heading">
        <div>
          <strong>{title}</strong>
          <span>{description}</span>
        </div>
      </div>
      <div className="settings-grid settings-grid-wide">{children}</div>
    </section>
  );
}

function SettingCard({
  icon: Icon,
  title,
  description,
  control,
  tone = "default",
}: {
  icon: typeof Gauge;
  title: string;
  description: string;
  control: ReactNode;
  tone?: "default" | "danger";
}) {
  return (
    <article className={`setting-card ${tone}`}>
      <div className="setting-card-icon row-icon" aria-hidden="true">
        <Icon size={20} />
      </div>
      <div className="setting-card-text">
        <strong>{title}</strong>
        <span>{description}</span>
      </div>
      <div className="setting-control">
        {control}
      </div>
    </article>
  );
}

function ToggleSwitch({
  checked,
  label,
  onChange,
  onLabel = "On",
  offLabel = "Off",
}: {
  checked: boolean;
  label: string;
  onChange: () => void;
  onLabel?: string;
  offLabel?: string;
}) {
  return (
    <button
      className={checked ? "toggle-switch active" : "toggle-switch"}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
    >
      <span className="toggle-track" aria-hidden="true">
        <span className="toggle-thumb" />
      </span>
      <span>{checked ? onLabel : offLabel}</span>
    </button>
  );
}

function SelectControl<TValue extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: TValue;
  options: Array<{ value: TValue; label: string }>;
  onChange: (value: TValue) => void;
}) {
  return (
    <label className="settings-select">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value as TValue)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function RangeControl({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="settings-range">
      <span>
        {label}
        <b>{unit === "ms" ? `${(value / 1000).toFixed(1)}s` : `${value}${unit}`}</b>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function ThemeSelector({
  value,
  onChange,
}: {
  value: ThemePreference;
  onChange: (theme: ThemePreference) => void;
}) {
  const options: Array<{ value: ThemePreference; label: string; icon: typeof Gauge }> = [
    { value: "dark", label: "Dark", icon: Moon },
    { value: "light", label: "Light", icon: Sun },
    { value: "system", label: "System", icon: Laptop },
  ];

  return (
    <div className="theme-segment" role="radiogroup" aria-label="Theme selection">
      {options.map((option) => {
        const Icon = option.icon;
        const isActive = value === option.value;
        return (
          <button
            className={isActive ? "theme-option active" : "theme-option"}
            type="button"
            role="radio"
            aria-checked={isActive}
            key={option.value}
            onClick={() => onChange(option.value)}
          >
            <Icon size={15} aria-hidden="true" />
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function HelpSection({ licenseType }: { licenseType: LicenseType }) {
  const isPriority = canUseFeature("priority-support", licenseType);

  return (
    <div className="content-stack">
      <section className="module-board" aria-label="Support ticket">
        <div className="board-header">
          <div>
            <p className="module-eyebrow">Support ticket</p>
            <h3>HWID reset / proof request</h3>
          </div>
          <StatusPill variant="large">{isPriority ? "Priority proof upload" : "Proof upload"}</StatusPill>
        </div>
        <div className="support-ticket-panel">
          <SupportTicketForm licenseType={licenseType} prioritySupport={isPriority} />
        </div>
      </section>
    </div>
  );
}
