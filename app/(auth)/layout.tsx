/**
 * Shared split-panel chrome for /login and /signup, ported from
 * ledgerline-ui.html screens 01/02. The pitch panel's copy is real product
 * description, not fabricated stats — the mockup shows illustrative
 * numbers (e.g. "165 of 184 orders reconciled") that only make sense once
 * a signed-in user has data, so they're replaced here with a static
 * feature list rather than numbers nobody has actually seen yet.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <div className="hidden w-[420px] flex-none flex-col justify-between bg-primary p-10 text-primary-foreground lg:flex xl:w-[480px] xl:p-14">
        <div className="flex items-center gap-2.5">
          <span className="block h-6 w-6 rounded-[6.5px] bg-[var(--severity-reconciled)]" />
          <span className="text-[15.5px] font-semibold tracking-tight">
            Ledgerline
          </span>
        </div>

        <div className="max-w-[420px]">
          <h2 className="mb-4 text-3xl leading-tight font-semibold tracking-tight text-white xl:text-4xl">
            Find the money that never arrived.
          </h2>
          <p className="text-[15px] leading-relaxed text-white/60">
            Upload your order export and your payment processor&apos;s
            settlement file. Ledgerline matches them line by line and shows
            you every dollar the two systems disagree about.
          </p>
        </div>

        <div className="max-w-[448px] text-sm text-white/60">
          <div className="flex items-center justify-between border-t border-white/10 py-3.5 first:border-t-0">
            <span>Reconciliation runs deterministically, every time</span>
          </div>
          <div className="flex items-center justify-between border-t border-white/10 py-3.5">
            <span>Every discrepancy classified, with a plain-language explanation</span>
          </div>
          <div className="flex items-center justify-between border-t border-white/10 py-3.5">
            <span>Your imports and results stay private to your account</span>
          </div>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center bg-white px-6 py-12">
        <div className="w-full max-w-[372px]">{children}</div>
      </div>
    </div>
  );
}
