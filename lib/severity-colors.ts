import type { Severity } from "./reconciliation/types";

/**
 * Mirrors the --severity-* custom properties in app/globals.css. Kept as a
 * plain JS map too because chart libraries (Recharts SVG fills) need an
 * actual color value at render time, not a CSS custom property reference.
 */
export const SEVERITY_COLORS: Record<Severity, string> = {
  critical: "#C0362C",
  high: "#B26B12",
  medium: "#3F6BB0",
  low: "#6B7480",
};

export const RECONCILED_COLOR = "#1C7A5E";
