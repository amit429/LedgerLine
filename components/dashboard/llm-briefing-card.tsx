"use client";

import { useEffect, useState } from "react";
import type { PortfolioSummary } from "@/lib/llm/schema";

export function LlmBriefingCard({ runId }: { runId: string }) {
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [state, setState] = useState<"loading" | "idle" | "error">("loading");
  const [isFallback, setIsFallback] = useState(false);

  async function load(regenerate = false) {
    setState("loading");
    try {
      const res = await fetch(
        `/api/runs/${runId}/explain-summary${regenerate ? "?regenerate=true" : ""}`,
        { method: "POST" }
      );
      if (!res.ok) throw new Error("failed");
      const body = await res.json();
      setSummary(body.summary);
      setIsFallback(body.fallback);
      setState("idle");
    } catch {
      setState("error");
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="mb-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="h-1.75 w-1.75 rounded-full bg-[var(--severity-reconciled)]" />
          <h2 className="text-[15px] font-semibold">What this run means</h2>
        </div>
        {state === "idle" && summary && (
          <button
            onClick={() => load(true)}
            className="text-[12px] font-medium text-muted-foreground"
          >
            Regenerate
          </button>
        )}
      </div>

      {state === "loading" && (
        <div className="flex flex-col gap-2">
          <div className="h-4 w-full animate-pulse rounded bg-secondary" />
          <div className="h-4 w-5/6 animate-pulse rounded bg-secondary" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-secondary" />
          <p className="mt-1 text-[12px] text-muted-foreground">
            Writing the summary. The numbers on this dashboard are already
            final — this only adds a plain-language read.
          </p>
        </div>
      )}

      {state === "error" && (
        <div className="rounded-md bg-[var(--severity-tint-critical)] p-3">
          <p className="mb-1 text-[12.5px] font-semibold text-[var(--severity-critical)]">
            The explanation service didn&apos;t respond
          </p>
          <p className="mb-2.5 text-[12px] text-[var(--severity-critical)]">
            The request timed out. Your reconciliation results are
            unaffected.
          </p>
          <button
            onClick={() => load(true)}
            className="rounded-md border border-[var(--severity-critical)] px-2.5 py-1 text-[12px] font-medium text-[var(--severity-critical)]"
          >
            Try again
          </button>
        </div>
      )}

      {state === "idle" && summary && (
        <div className="flex flex-col gap-3.5">
          {isFallback && (
            <p className="text-[11.5px] text-muted-foreground">
              Generated from a template — the explanation service
              didn&apos;t return a usable response.
            </p>
          )}
          {summary.bullets.map((bullet, i) => (
            <div key={i} className="flex gap-2.5">
              <span className="mt-1 w-0.5 flex-none rounded-full bg-ring" />
              <div>
                <p className="mb-1 text-[13px] font-semibold">{bullet.headline}</p>
                <p className="text-[12.5px] leading-[19px] text-muted-foreground">
                  {bullet.detail}
                </p>
              </div>
            </div>
          ))}
          {!isFallback && (
            <p className="border-t border-border pt-3 text-[11px] text-muted-foreground">
              Written from the deterministic results — never from the raw
              files. gemini-2.5-flash · temperature 0.2
            </p>
          )}
        </div>
      )}
    </div>
  );
}
