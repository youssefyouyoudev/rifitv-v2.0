import type { Match } from "@/lib/types";
import { MatchCard } from "./MatchCard";

export function MatchSection({ title, matches, serverDate }: { title: string; matches: Match[]; serverDate?: string }) {
  if (matches.length === 0) {
    return null;
  }

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold text-[var(--foreground)]">{title}</h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {matches.map((match) => (
          <MatchCard key={match.id} match={match} serverDate={serverDate} />
        ))}
      </div>
    </section>
  );
}
