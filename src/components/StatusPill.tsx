import type { ReactNode } from "react";

type PillVariant = "default" | "locked" | "premium" | "lifetime" | "success" | "large" | "full";

type StatusPillProps = {
  children: ReactNode;
  variant?: PillVariant;
  className?: string;
};

const variantClass: Record<PillVariant, string> = {
  default: "status-pill",
  locked: "status-pill locked",
  premium: "status-pill premium",
  lifetime: "status-pill lifetime",
  success: "status-pill success",
  large: "status-pill large",
  full: "status-pill full",
};

export default function StatusPill({ children, variant = "default", className = "" }: StatusPillProps) {
  const cls = variantClass[variant];
  return <span className={`${cls} ${className}`.trim()}>{children}</span>;
}