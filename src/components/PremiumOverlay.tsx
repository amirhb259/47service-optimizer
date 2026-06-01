import { useMemo } from "react";
import { CheckCircle2, Crown, Sparkle, X } from "lucide-react";
import { canUseFeature, canUsePremiumFeature, type FeatureId } from "../lib/featureAccess";
import type { LicenseType } from "../lib/licenseApi";

type PremiumOverlayProps = {
  licenseType: string;
  isPremium: boolean;
  onClose: () => void;
};

type ComparisonRow = {
  name: string;
  featureId?: FeatureId;
  isPremium: boolean;
  minPlan: LicenseType;
};

const comparisonRows: ComparisonRow[] = [
  { name: "System Status", featureId: "basic-system-status", isPremium: false, minPlan: "LITE" },
  { name: "Game Optimizer Session", featureId: "game-optimizer-session", isPremium: false, minPlan: "LITE" },
  { name: "Network Stability Doctor", featureId: "network-stability-doctor", isPremium: false, minPlan: "LITE" },
  { name: "Safe Cleanup Plan", featureId: "safe-cleanup-plan", isPremium: false, minPlan: "LITE" },
  { name: "Support Tickets", featureId: "support-tickets", isPremium: false, minPlan: "LITE" },
  { name: "Smart Game Prep", featureId: "smart-game-prep", isPremium: false, minPlan: "PRO" },
  { name: "Lag Cause Analyzer", featureId: "lag-cause-analyzer", isPremium: false, minPlan: "PRO" },
  { name: "Cleanup Execute", featureId: "cleanup-execute", isPremium: false, minPlan: "PRO" },
  { name: "Session Report", featureId: "session-report", isPremium: false, minPlan: "PRO" },
  { name: "Export Reports", featureId: "export-reports", isPremium: false, minPlan: "PRO" },
  { name: "Advanced Report History", featureId: "advanced-report-history", isPremium: false, minPlan: "LIFETIME" },
  { name: "Extra Deep Diagnostics", featureId: "extra-deep-diagnostics", isPremium: false, minPlan: "LIFETIME" },
  { name: "Extreme Optimization Mode", featureId: "extreme-optimization", isPremium: true, minPlan: "LITE" },
  { name: "Advanced Gaming Optimization", featureId: "gaming-optimization", isPremium: true, minPlan: "PRO" },
  { name: "Deep System Diagnostics", featureId: "deep-diagnostics", isPremium: true, minPlan: "LITE" },
  { name: "Elite Resource Management", featureId: "resource-management", isPremium: true, minPlan: "PRO" },
  { name: "Real-time Bottleneck Detection", featureId: "bottleneck-detection", isPremium: true, minPlan: "LITE" },
  { name: "Intelligent Background Suppression", featureId: "background-suppression", isPremium: true, minPlan: "PRO" },
  { name: "Dynamic Performance Tuning", featureId: "performance-tuning", isPremium: true, minPlan: "PRO" },
  { name: "Advanced Network Stabilization", featureId: "network-stabilization", isPremium: true, minPlan: "LITE" },
  { name: "Deep Cache & Shader Cleanup", featureId: "cache-shader-cleanup", isPremium: true, minPlan: "LITE" },
  { name: "Intelligent Session Restoration", featureId: "session-restoration", isPremium: true, minPlan: "LITE" },
  { name: "Performance Analytics & History", featureId: "performance-analytics", isPremium: true, minPlan: "LITE" },
];

const premiumExtras = [
  "Undo & Rollback all changes",
  "Before/After snapshots",
  "Performance history tracking",
];

const licenseLabels: Record<string, string> = {
  LITE: "LITE plan",
  PRO: "PRO plan",
  LIFETIME: "LIFETIME plan",
};

export default function PremiumOverlay({ licenseType, isPremium, onClose }: PremiumOverlayProps) {
  const userLabel = licenseLabels[licenseType] ?? `${licenseType} plan`;

  const userCanAccess = useMemo(() => {
    return (row: ComparisonRow) => {
      if (!row.featureId) return false;
      if (row.isPremium) {
        return canUsePremiumFeature(row.featureId, licenseType as LicenseType, isPremium);
      }
      return canUseFeature(row.featureId, licenseType as LicenseType);
    };
  }, [licenseType, isPremium]);

  const statusMessage = useMemo(() => {
    if (isPremium) return null;
    if (licenseType === "LIFETIME") {
      return "You currently have LIFETIME access, but Premium addon is not enabled.";
    }
    return null;
  }, [licenseType, isPremium]);

  const standardRows = comparisonRows.filter((r) => !r.isPremium);
  const premiumRows = comparisonRows.filter((r) => r.isPremium);

  return (
    <div className="premium-overlay-backdrop" role="dialog" aria-modal="true" aria-labelledby="premium-title" onClick={onClose}>
      <section className="premium-overlay" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close" type="button" onClick={onClose} aria-label="Close Premium">
          <X size={18} />
        </button>

        <div className="premium-overlay-head">
          <div className="premium-hero">
            <div className="premium-crown">
              <Crown size={32} />
            </div>
            <div>
              <p className="module-eyebrow">47Service Elite</p>
              <h2 id="premium-title">Premium Addon</h2>
              <p>
                Unlock the extreme optimization engine. Premium works alongside your current{" "}
                <strong>{licenseType}</strong> plan to deliver elite-level system performance tools.
              </p>
            </div>
          </div>

          {isPremium ? (
            <div className="premium-status-badge active">
              <CheckCircle2 size={18} />
              <span>Premium active on {licenseType}</span>
            </div>
          ) : (
            <div className="premium-status-badge inactive">
              <Sparkle size={18} />
              <span>{statusMessage ?? "Premium addon not enabled"}</span>
            </div>
          )}
        </div>

        <div className="premium-overlay-body">
          <div className="premium-compare">
            <h3>Feature comparison</h3>
            <div className="premium-compare-grid">
              <div className="premium-compare-col you-col">
                <h4>You</h4>
                <span className="plan-subtitle">{userLabel}</span>
                <ul>
                  {standardRows.map((row) => {
                    const enabled = userCanAccess(row);
                    return (
                      <li key={row.name} className={enabled ? "enabled" : "disabled"}>
                        {row.name}
                      </li>
                    );
                  })}
                </ul>
                <div className="compare-divider" />
                <ul>
                  {premiumRows.map((row) => {
                    const enabled = userCanAccess(row);
                    return (
                      <li key={row.name} className={enabled ? "enabled" : "disabled"}>
                        {row.name}
                      </li>
                    );
                  })}
                </ul>
              </div>
              <div className="premium-compare-col highlight">
                <h4>
                  <Crown size={16} />
                  Premium
                </h4>
                <span className="plan-subtitle gold">Unlocks all Premium features</span>
                <ul>
                  {premiumRows.map((row) => (
                    <li key={row.name} className="enabled premium-item">
                      {row.name}
                    </li>
                  ))}
                </ul>
                <div className="compare-divider" />
                <ul>
                  {premiumExtras.map((extra) => (
                    <li key={extra} className="enabled premium-item">
                      {extra}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="premium-overlay-foot">
          <div className="premium-footer">
            {isPremium ? (
              <div className="premium-active-message">
                <Crown size={20} />
                <span>Premium addon is active on your {licenseType} license</span>
              </div>
            ) : (
              <a className="premium-buy-button" href="https://47service.com/premium" target="_blank" rel="noreferrer">
                <Sparkle size={18} />
                <span>Get Premium Addon</span>
              </a>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}