import type { LucideIcon } from "lucide-react";
import type { FeatureId } from "../lib/featureAccess";
import {
  Zap,
  Gamepad2,
  Activity,
  Cpu,
  Radar,
  Moon,
  SlidersHorizontal,
  Network,
  Brush,
  RotateCcw,
  ScrollText,
} from "lucide-react";

export type PremiumActionId =
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

export type PremiumModule = {
  id: PremiumActionId;
  title: string;
  eyebrow: string;
  description: string;
  accent: "gold" | "amber" | "cyan" | "violet" | "steel" | "green" | "red";
  icon: LucideIcon;
  checks: string[];
  changes: string;
  feature: FeatureId;
  warning: string;
};

export const premiumModules: PremiumModule[] = [
  {
    id: "extreme-optimization",
    title: "Extreme Optimization Mode",
    eyebrow: "Elite engine",
    description: "Multi-stage aggressive optimization: process priority, CPU affinity, background suspension, cache cleanup, and power tuning in one safe pass.",
    accent: "gold",
    icon: Zap,
    checks: ["Process priority tuning", "CPU affinity optimization", "Background app suspension", "Startup bloat reduction", "Cache cleanup", "Memory pressure analysis", "Network adapter refresh", "Power plan tuning", "Before/after snapshot", "Auto rollback token"],
    changes: "Changes process priorities, CPU affinities, suspends non-critical user processes, cleans temp/cache/shader files, refreshes network adapter, and tunes power plan. All changes are reversible via the undo token.",
    feature: "extreme-optimization",
    warning: "This runs aggressive optimizations. A full before/after snapshot and undo token will be created. All changes are reversible.",
  },
  {
    id: "gaming-optimization",
    title: "Advanced Gaming Optimization",
    eyebrow: "Game engine",
    description: "Deep gaming performance tuning with process priority boost, GPU affinity, background suppression, and shader cache preparation.",
    accent: "green",
    icon: Gamepad2,
    checks: ["Game process detection", "Priority class boost", "CPU affinity adjustment", "Background app suspension", "GPU optimization", "Shader cache preparation", "Power plan switching", "Undo token creation"],
    changes: "Boosts game process to High priority, sets CPU affinity to favor performance cores, suspends non-critical background apps, and switches to high-performance power plan. Reversible.",
    feature: "gaming-optimization",
    warning: "Optimizes game-related system behavior. Undo token created for full restoration.",
  },
  {
    id: "deep-diagnostics",
    title: "Deep System Diagnostics",
    eyebrow: "Analysis",
    description: "Comprehensive read-only system analysis covering CPU, RAM, disk, GPU, network, processes, services, startup items, and system health metrics.",
    accent: "cyan",
    icon: Activity,
    checks: ["CPU metrics", "Memory analysis", "Disk health", "GPU status", "Network diagnostics", "Process audit", "Service audit", "Startup inventory", "System uptime", "Health score"],
    changes: "Read-only. No system changes are made. Generates a detailed diagnostic report with health score.",
    feature: "deep-diagnostics",
    warning: "Read-only diagnostic scan. No changes will be made to your system.",
  },
  {
    id: "resource-management",
    title: "Elite Resource Management",
    eyebrow: "Resource engine",
    description: "Intelligent resource allocation: identify memory hogs, CPU drains, disk saturators, and network bandwidth consumers. Provides safe actionable recommendations.",
    accent: "violet",
    icon: Cpu,
    checks: ["Memory hog detection", "CPU drain analysis", "Disk saturation check", "Network bandwidth check", "Resource pressure score", "Safe recommendations"],
    changes: "Read-only analysis with safe recommendations. No processes are automatically ended.",
    feature: "resource-management",
    warning: "Read-only resource analysis. No automatic process termination.",
  },
  {
    id: "bottleneck-detection",
    title: "Real-time Bottleneck Detection",
    eyebrow: "Detection",
    description: "Live bottleneck identification across CPU, GPU, RAM, disk, and network. Tracks performance counters in real-time and pinpoints the exact bottleneck.",
    accent: "amber",
    icon: Radar,
    checks: ["CPU bottleneck check", "GPU bottleneck check", "RAM pressure analysis", "Disk queue analysis", "Network latency check", "Bottleneck scoring", "Actionable recommendations"],
    changes: "Read-only. No system settings are modified. Provides bottleneck score and recommendations.",
    feature: "bottleneck-detection",
    warning: "Read-only bottleneck analysis.",
  },
  {
    id: "background-suppression",
    title: "Intelligent Background Suppression",
    eyebrow: "Suppression",
    description: "Safely suspend non-critical background user applications to free CPU, RAM, and disk resources. All suspended apps can be resumed.",
    accent: "steel",
    icon: Moon,
    checks: ["Non-critical app detection", "Safety filter (exclude system)", "Resource impact calculation", "Suspension candidates list", "Undo token creation"],
    changes: "Suspends selected non-critical user applications. All suspended processes can be resumed via the undo token.",
    feature: "background-suppression",
    warning: "Will suspend non-critical background user apps. System processes and critical apps are excluded. Full undo available.",
  },
  {
    id: "performance-tuning",
    title: "Dynamic Performance Tuning",
    eyebrow: "Tuning",
    description: "Adaptive performance adjustments based on current system load, running applications, and resource pressure. Dynamically tunes for peak performance.",
    accent: "gold",
    icon: SlidersHorizontal,
    checks: ["System load assessment", "Running app analysis", "Resource pressure check", "Power policy adjustment", "Performance profile application", "Undo token creation"],
    changes: "Adjusts power policy, process priorities, and system performance settings based on current workload. Reversible.",
    feature: "performance-tuning",
    warning: "Applies dynamic performance tuning based on current system state. Full undo available.",
  },
  {
    id: "network-stabilization",
    title: "Advanced Network Stabilization",
    eyebrow: "Network",
    description: "Complete network optimization: DNS cache flush, Winsock reset, adapter refresh, latency testing, and stability scoring.",
    accent: "red",
    icon: Network,
    checks: ["DNS cache flush", "Winsock reset", "Network adapter refresh", "Latency test", "Packet loss check", "Stability score"],
    changes: "Flushes DNS cache, resets Winsock catalog, and refreshes network adapters. All standard Windows maintenance operations.",
    feature: "network-stabilization",
    warning: "Performs standard Windows network maintenance operations: DNS flush, Winsock reset, adapter refresh. Safe and reversible.",
  },
  {
    id: "cache-shader-cleanup",
    title: "Deep Cache & Shader Cleanup",
    eyebrow: "Cleanup",
    description: "Aggressive yet safe cleanup of temp files, cache directories, and shader caches for supported games and applications.",
    accent: "violet",
    icon: Brush,
    checks: ["Windows temp scan", "Application cache scan", "Shader cache scan (supported games)", "Browser cache scan", "Cleanup size estimation", "Safety exclusions", "Quarantine preparation"],
    changes: "Moves temp files, cache data, and shader caches to quarantine. Important user and system folders are excluded.",
    feature: "cache-shader-cleanup",
    warning: "Cleans temp/cache/shader files safely. All files are moved to quarantine, not permanently deleted. Full undo available.",
  },
  {
    id: "session-restoration",
    title: "Intelligent Session Restoration",
    eyebrow: "Restore",
    description: "Complete save and restore of the optimization state. Reverts all Premium changes to the exact pre-optimization state.",
    accent: "steel",
    icon: RotateCcw,
    checks: ["Optimization state detection", "Undo token validation", "Process restoration", "Power plan restoration", "Cache file restoration", "Network setting restoration"],
    changes: "Reverts all Premium optimizations: restores process priorities, CPU affinities, power plans, network settings, and quarantined files.",
    feature: "session-restoration",
    warning: "This will revert ALL Premium optimizations back to pre-optimization state.",
  },
  {
    id: "performance-analytics",
    title: "Performance Analytics & History",
    eyebrow: "Analytics",
    description: "Track performance metrics over time, view optimization history, compare before/after snapshots, and export detailed analytics reports.",
    accent: "cyan",
    icon: ScrollText,
    checks: ["Optimization history", "Performance trends", "Before/after comparison", "Resource usage timeline", "Analytics export"],
    changes: "Read-only analysis of performance history and optimization impact. No system changes.",
    feature: "performance-analytics",
    warning: "Read-only analytics. Reviews past optimization sessions and their impact.",
  },
];