import type { MatchStatus } from "@/lib/types";

const labels: Record<MatchStatus, string> = {
  scheduled: "Scheduled",
  live: "LIVE",
  halftime: "HT",
  finished: "FT",
  postponed: "Postponed",
  cancelled: "Cancelled",
};

export function StatusBadge({ status }: { status: MatchStatus }) {
  const live = status === "live";

  return (
    <span
      className={`inline-flex h-6 items-center rounded-full border px-2 text-[11px] font-semibold uppercase tracking-normal ${
        live
          ? "border-[var(--live)]/30 bg-[var(--live)]/15 text-[var(--live)]"
          : "border-[var(--border)] bg-[var(--surface-muted)] text-[var(--muted)]"
      }`}
    >
      {labels[status]}
    </span>
  );
}
