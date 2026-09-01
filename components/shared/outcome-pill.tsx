import type { OutcomeTone } from "@/lib/reconciliation/outcome";

const TONE_CLASSES: Record<OutcomeTone, string> = {
  ok: "bg-[var(--severity-tint-reconciled)] text-[var(--severity-reconciled)]",
  bad: "bg-[var(--severity-tint-critical)] text-[var(--severity-critical)]",
  warn: "bg-[var(--severity-tint-high)] text-[var(--severity-high)]",
  info: "bg-[var(--severity-tint-medium)] text-[var(--severity-medium)]",
  mute: "bg-[var(--severity-tint-low)] text-[var(--severity-low)]",
};

export function OutcomePill({ label, tone }: { label: string; tone: OutcomeTone }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${TONE_CLASSES[tone]}`}>
      {label}
    </span>
  );
}
