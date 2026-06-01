import { ArrowRight, CheckCircle2, Lock } from "lucide-react";
import type { DashboardModule } from "../data/dashboardModules";
import { requiredPlanForFeature } from "../lib/featureAccess";
import StatusPill from "./StatusPill";

type FeatureCardProps = {
  module: DashboardModule;
  isLocked?: boolean;
  onOpen: (module: DashboardModule) => void;
};

export default function FeatureCard({ module, isLocked = false, onOpen }: FeatureCardProps) {
  const Icon = module.icon;
  const requiredPlan = requiredPlanForFeature(module.feature);

  return (
    <article className={`feature-card accent-${module.accent} ${isLocked ? "locked" : ""}`}>
      <div className="card-topline">
        <span className="module-eyebrow">{module.eyebrow}</span>
        <StatusPill variant={isLocked ? "locked" : "default"}>
          {isLocked ? <Lock size={13} aria-hidden="true" /> : <CheckCircle2 size={13} aria-hidden="true" />}
          {isLocked ? `${requiredPlan} locked` : "Safe workflow"}
        </StatusPill>
      </div>
      <div className="feature-icon" aria-hidden="true">
        <Icon size={24} />
      </div>
      <h3>{module.title}</h3>
      <p>{isLocked ? module.lockedSummary : module.description}</p>
      <button className="feature-action" type="button" onClick={() => onOpen(module)}>
        <span>{isLocked ? "View access" : "Open workflow"}</span>
        <ArrowRight size={16} aria-hidden="true" />
      </button>
    </article>
  );
}
