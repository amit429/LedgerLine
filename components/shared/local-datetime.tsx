"use client";

import { useEffect, useState } from "react";

interface LocalDateTimeProps {
  iso: string;
  options: Intl.DateTimeFormatOptions;
}

/**
 * Formats a timestamp in the *viewer's* local timezone. The same
 * `toLocaleString` call made directly in a Server Component — or baked
 * into stored data at write time, the bug this component exists to fix
 * (see app/api/batches/route.ts) — runs on Vercel's server clock, which
 * is UTC. For anyone in a timezone ahead of UTC, that silently shows
 * yesterday's date for part of every day.
 *
 * Renders in UTC on the first pass — the server render and the client's
 * pre-hydration render have to match exactly, and only the server knows
 * to use UTC — then swaps to the real local-timezone value in an effect
 * once mounted, to avoid a hydration mismatch.
 */
export function LocalDateTime({ iso, options }: LocalDateTimeProps) {
  const [display, setDisplay] = useState(() =>
    new Date(iso).toLocaleString("en-US", { ...options, timeZone: "UTC" })
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDisplay(new Date(iso).toLocaleString("en-US", options));
    // options is expected to be a stable, module-level constant per call
    // site — re-running this on every parent render would be harmless
    // (same result) but pointless, so it's deliberately not a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iso]);

  return <>{display}</>;
}
