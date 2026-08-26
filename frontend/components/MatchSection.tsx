import type { Match } from "@/lib/types";
import type { AdPlacementName } from "@/lib/ads/config";
import { AdPlacement } from "./AdPlacement";
import { MatchCard } from "./MatchCard";

export function MatchSection({
  title,
  matches,
  serverDate,
  adPlacementName,
}: {
  title: string;
  matches: Match[];
  serverDate?: string;
  adPlacementName?: AdPlacementName;
}) {
  if (matches.length === 0) {
    return null;
  }

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold text-[var(--foreground)]">{title}</h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {matches.map((match, index) => (
          <div key={match.id} className="contents">
            <MatchCard match={match} serverDate={serverDate} />
            {adPlacementName && (index + 1) % 5 === 0 ? (
              <div className="sm:col-span-2 xl:col-span-3">
                <AdPlacement name={adPlacementName} />
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
