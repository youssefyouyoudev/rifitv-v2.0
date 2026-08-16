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
      return;
    }

    const timer = window.setInterval(() => {
      setRemaining((current) => (current === null ? null : Math.max(0, current - 1)));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [seconds]);

  return (
    <span className={compact ? "inline-flex items-center gap-1" : "block"}>
      <span className="text-[11px] font-semibold uppercase tracking-normal text-[var(--muted)]">{label}</span>
      <span className={`${compact ? "text-sm" : "mt-1 block text-lg"} font-semibold tabular-nums text-[var(--foreground)]`}>
        {formatCountdown(remaining)}
      </span>
    </span>
  );
}
