import { useMemo, useState } from "react";
import { Crown, RefreshCw, AlertTriangle, Gauge, CheckCircle2, Download, RotateCcw, X } from "lucide-react";
import { premiumModules, type PremiumModule } from "../data/premiumModules";
import { canUsePremiumFeature, getUpgradeMessage } from "../lib/featureAccess";
import type { LicenseType } from "../lib/licenseApi";
import { smartActionRuntime } from "../lib/smartActions";
import type { SmartActionReport, SmartActionStatus } from "../lib/smartActions";
import StatusPill from "./StatusPill";

type PremiumSectionProps = {
  licenseType: LicenseType;
  isPremium: boolean;
  onShowToast: (toast: { kind: "success" | "warning" | "error" | "info"; title: string; detail?: string }) => void;
};

export default function PremiumSection({ licenseType, isPremium, onShowToast }: PremiumSectionProps) {
  const [activeModule, setActiveModule] = useState<PremiumModule | null>(null);
  const [status, setStatus] = useState<SmartActionStatus>("ready");
  const [report, setReport] = useState<SmartActionReport | null>(null);
  const [undoToken, setUndoToken] = useState<string | undefined>();

  const availableModules = useMemo(() => {
    return premiumModules.filter((mod) => isPremium && canUsePremiumFeature(mod.feature, licenseType, isPremium));
  }, [licenseType, isPremium]);

  const lockedModules = useMemo(() => {
    return premiumModules.filter((mod) => !isPremium || !canUsePremiumFeature(mod.feature, licenseType, isPremium));
  }, [licenseType, isPremium]);

  async function openModule(module: PremiumModule) {
    setActiveModule(module);
    setStatus("ready");
    setReport(null);
    setUndoToken(undefined);
  }

  async function runModule(module: PremiumModule) {
    if (!isPremium) {
      onShowToast({ kind: "info", title: "Premium required", detail: getUpgradeMessage(module.feature, licenseType) });
      return;
    }

    if (module.warning && !window.confirm(module.warning)) {
      return;
    }

    setStatus("running");
    try {
      const result = await smartActionRuntime.runSmartAction(module.id, licenseType);
      setReport(result);
      if ("undoToken" in result) {
        setUndoToken((result as unknown as { undoToken?: string }).undoToken);
      }
      setStatus("complete");
      onShowToast({ kind: "success", title: `${module.title} complete.`, detail: result.summary });
    } catch (error) {
      setStatus("error");
      onShowToast({
        kind: "error",
        title: `${module.title} failed.`,
        detail: error instanceof Error ? error.message : "The premium workflow could not be completed.",
      });
    }
  }

  return (
    <div className="content-stack">
      <section className="status-plate premium-plate" aria-label="Premium status">
        <div className="status-core">
          <div className="premium-badge-large" aria-hidden="true">
            <Crown size={28} />
          </div>
          <div>
            <p className="module-eyebrow">Premium addon</p>
            <h3>Elite optimization engine</h3>
            <p>
              {isPremium
                ? "Premium is active. All 11 elite optimization tools are available alongside your current plan."
                : "Enable Premium to access extreme optimization, gaming tuning, deep diagnostics, and more."}
            </p>
          </div>
        </div>
        <div className="status-bars premium-bars" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </section>

      <section className="premium-module-grid" aria-label="Premium Smart Actions">
        {availableModules.map((mod) => {
          const Icon = mod.icon;
          return (
            <article className={`premium-module-card accent-${mod.accent}`} key={mod.id}>
              <div className="premium-module-header">
                <div className="feature-icon" aria-hidden="true">
                  <Icon size={22} />
                </div>
                <StatusPill variant="premium">Premium</StatusPill>
              </div>
              <h4>{mod.title}</h4>
              <p>{mod.description}</p>
              <button className="premium-module-action" type="button" onClick={() => openModule(mod)}>
                <Gauge size={16} />
                <span>Open</span>
              </button>
            </article>
          );
        })}
      </section>

      {lockedModules.length > 0 ? (
        <section className="premium-locked-section" aria-label="Locked Premium actions">
          <h4>Unavailable</h4>
          <div className="premium-module-grid locked">
            {lockedModules.map((mod) => {
              const Icon = mod.icon;
              return (
                <article className="premium-module-card locked" key={mod.id}>
                  <div className="premium-module-header">
                    <div className="feature-icon" aria-hidden="true">
                      <Icon size={22} />
                    </div>
                    <StatusPill variant="locked">{!isPremium ? "Premium" : "Locked"}</StatusPill>
                  </div>
                  <h4>{mod.title}</h4>
                  <p>{mod.description}</p>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {activeModule ? (
        <div className="smart-action-backdrop" role="dialog" aria-modal="true" aria-labelledby="premium-action-title">
          <section className={`smart-action-panel accent-${activeModule.accent}`}>
            <button className="modal-close" type="button" onClick={() => setActiveModule(null)} aria-label="Close Premium action">
              <X size={18} />
            </button>

            <div className="smart-action-hero">
              <div className="feature-icon" aria-hidden="true">
                <activeModule.icon size={25} />
              </div>
              <div>
                <p className="module-eyebrow">{activeModule.eyebrow}</p>
                <h3 id="premium-action-title">{activeModule.title}</h3>
                <p>{activeModule.description}</p>
              </div>
            </div>

            <div className="smart-action-card warning">
              <AlertTriangle size={17} />
              <strong>Premium operation</strong>
              <p>{activeModule.warning}</p>
            </div>

            <div className="smart-action-card">
              <strong>Safety checks</strong>
              <div className="smart-chip-list">
                {activeModule.checks.map((check) => (
                  <span className="smart-chip" key={check}>
                    <CheckCircle2 size={14} />
                    {check}
                  </span>
                ))}
              </div>
            </div>

            <div className="smart-action-actions">
              <button className="license-submit wide modal-primary premium-submit" type="button" onClick={() => runModule(activeModule)} disabled={status === "running"}>
                {status === "running" ? <RefreshCw className="spin-icon" size={17} /> : <Crown size={17} />}
                <span>{status === "running" ? "Running..." : "Run Premium workflow"}</span>
              </button>
              <button className="ghost-button" type="button" onClick={() => setActiveModule(null)} disabled={status === "running"}>
                <X size={17} />
                <span>Cancel</span>
              </button>
            </div>

            <div className="smart-progress" aria-live="polite">
              {(report?.steps ?? []).map((step, index) => (
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
                <AlertTriangle size={17} />
                <span>The premium workflow stopped early. No unsafe changes were made.</span>
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

                <div className="smart-findings">
                  {report.findings.map((finding) => (
                    <div className={`smart-finding ${finding.severity}`} key={`${finding.label}-${finding.value}`}>
                      <span>{finding.label}</span>
                      <strong>{finding.value}</strong>
                      <small>{finding.detail}</small>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        </div>
      ) : null}
    </div>
  );
}