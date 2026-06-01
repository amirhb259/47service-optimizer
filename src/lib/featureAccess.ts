import type { LicenseType } from "./licenseApi";

export type FeatureId =
  | "basic-system-status"
  | "smart-game-prep"
  | "game-optimizer-session"
  | "game-optimizer-session-start"
  | "lag-cause-analyzer"
  | "network-stability-doctor"
  | "safe-cleanup-plan"
  | "cleanup-execute"
  | "session-report"
  | "support-tickets"
  | "export-reports"
  | "advanced-report-history"
  | "extra-deep-diagnostics"
  | "priority-support"
  | "lifetime-badge"
  | "early-access-tools"
  | "extreme-optimization"
  | "gaming-optimization"
  | "deep-diagnostics"
  | "resource-management"
  | "bottleneck-detection"
  | "background-suppression"
  | "performance-tuning"
  | "network-stabilization"
  | "cache-shader-cleanup"
  | "session-restoration"
  | "performance-analytics";

export type PlanRank = LicenseType;

const featureMinimumPlan: Record<FeatureId, PlanRank> = {
  "basic-system-status": "LITE",
  "smart-game-prep": "PRO",
  "game-optimizer-session": "LITE",
  "game-optimizer-session-start": "PRO",
  "lag-cause-analyzer": "PRO",
  "network-stability-doctor": "LITE",
  "safe-cleanup-plan": "LITE",
  "cleanup-execute": "PRO",
  "session-report": "PRO",
  "support-tickets": "LITE",
  "export-reports": "PRO",
  "advanced-report-history": "LIFETIME",
  "extra-deep-diagnostics": "LIFETIME",
  "priority-support": "LIFETIME",
  "lifetime-badge": "LIFETIME",
  "early-access-tools": "LIFETIME",
  "extreme-optimization": "LITE",
  "gaming-optimization": "PRO",
  "deep-diagnostics": "LITE",
  "resource-management": "PRO",
  "bottleneck-detection": "LITE",
  "background-suppression": "PRO",
  "performance-tuning": "PRO",
  "network-stabilization": "LITE",
  "cache-shader-cleanup": "LITE",
  "session-restoration": "LITE",
  "performance-analytics": "LITE",
};

const premiumFeatures = new Set<FeatureId>([
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
]);

const rankWeight: Record<PlanRank, number> = {
  LITE: 0,
  PRO: 1,
  LIFETIME: 2,
};

export function canUseFeature(feature: FeatureId, licenseType: LicenseType = "LITE") {
  return rankWeight[licenseType] >= rankWeight[featureMinimumPlan[feature]];
}

export function isPremiumFeature(feature: FeatureId) {
  return premiumFeatures.has(feature);
}

export function canUsePremiumFeature(feature: FeatureId, licenseType: LicenseType = "LITE", hasPremium = false) {
  return hasPremium && canUseFeature(feature, licenseType);
}

export function requiredPlanForFeature(feature: FeatureId) {
  return featureMinimumPlan[feature];
}

export function getUpgradeMessage(feature: FeatureId, licenseType: LicenseType = "LITE") {
  if (premiumFeatures.has(feature)) {
    return "This is a PREMIUM addon feature. Enable Premium to access elite optimizations.";
  }

  const required = requiredPlanForFeature(feature);
  if (required === "LIFETIME") {
    return licenseType === "PRO"
      ? "This is a LIFETIME exclusive tool."
      : "Upgrade to LIFETIME for this exclusive tool.";
  }

  if (feature === "export-reports") {
    return "Upgrade to PRO to export reports.";
  }

  if (feature === "cleanup-execute") {
    return "Upgrade to PRO to quarantine cleanup candidates.";
  }

  if (feature === "game-optimizer-session-start") {
    return "Upgrade to PRO to start a timed Game Optimizer Session.";
  }

  return "Upgrade to PRO to use this Smart Action.";
}