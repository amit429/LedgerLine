import { Info } from "lucide-react";

/** Pure-CSS hover/focus tooltip — no client JS needed, so it works inside
 * server components like the dashboard's headline tiles.
 *
 * `align="right"` right-aligns the tooltip box to the icon instead of
 * left-aligning it, so it grows leftward instead of off the edge of the
 * viewport — use it for triggers near the right edge of the page. */
export function InfoTooltip({
  text,
  align = "left",
}: {
  text: string;
  align?: "left" | "right";
}) {
  return (
    <span
      className="group/tooltip relative inline-flex focus:outline-none"
      tabIndex={0}
      aria-label={text}
    >
      <Info size={12} className="text-muted-foreground/70" aria-hidden />
      <span
        role="tooltip"
        className={`pointer-events-none absolute top-full z-20 mt-1.5 w-52 rounded-md border border-border bg-white px-3 py-2 text-[11.5px] leading-[16px] font-normal normal-case text-foreground opacity-0 shadow-lg transition-opacity duration-100 group-hover/tooltip:opacity-100 group-focus/tooltip:opacity-100 ${
          align === "right" ? "right-0" : "left-0"
        }`}
      >
        {text}
      </span>
    </span>
  );
}
