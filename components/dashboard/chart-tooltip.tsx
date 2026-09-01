/** Shared visual chrome for chart hover tooltips — each chart supplies its
 * own content, this just gives every tooltip the same card treatment. */
export function TooltipCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-white px-3 py-2.5 text-[12.5px] shadow-lg">
      {children}
    </div>
  );
}
