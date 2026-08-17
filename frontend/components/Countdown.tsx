"use client";

import { useEffect, useState } from "react";
import { formatCountdown } from "@/lib/time";

type Props = {
  seconds: number | null;
  label: string;
  compact?: boolean;
};

export function Countdown({ seconds, label, compact = false }: Props) {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    if (seconds === null || seconds <= 0) {
      const reset = window.setTimeout(() => setRemaining(seconds), 0);
      return () => window.clearTimeout(reset);
    }

    const deadline = performance.now() + seconds * 1000;
    const update = (): void => {
      setRemaining(Math.max(0, Math.ceil((deadline - performance.now()) / 1000)));
    };
    const timer = window.setInterval(update, 1000);
    const visibilityHandler = (): void => {
      if (document.visibilityState === "visible") {
        update();
      }
    };

    document.addEventListener("visibilitychange", visibilityHandler);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", visibilityHandler);
    };
  }, [seconds]);

  return (
    <span className={compact ? "inline-flex items-center gap-1" : "block"} role="timer" aria-label={`${label} ${formatCountdown(remaining)}`}>
      <span className="text-[11px] font-semibold uppercase tracking-normal text-[var(--muted)]">{label}</span>
      <span className={`${compact ? "text-sm" : "mt-1 block text-lg"} font-semibold tabular-nums text-[var(--foreground)]`}>
        {formatCountdown(remaining)}
      </span>
    </span>
  );
}
