"use client";

import { Bell, BellRing, Star } from "lucide-react";
import { useCallback, useSyncExternalStore } from "react";
import { trackEvent } from "@/lib/analytics";

export function MatchPreferences({
  matchSlug,
  homeTeam,
  awayTeam,
  competition,
  kickoffAt,
}: {
  matchSlug: string;
  homeTeam: { slug: string; name: string };
  awayTeam: { slug: string; name: string };
  competition: { slug: string; name: string };
  kickoffAt: string | null;
}) {
  const homeFavorite = usePreference(`team:${homeTeam.slug}`);
  const awayFavorite = usePreference(`team:${awayTeam.slug}`);
  const competitionFavorite = usePreference(`competition:${competition.slug}`);
  const reminder = usePreference(`reminder:${matchSlug}`);

  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Match preferences">
      <PreferenceButton active={homeFavorite} label={`${homeFavorite ? "Following" : "Follow"} ${homeTeam.name}`} onClick={() => togglePreference(`team:${homeTeam.slug}`, !homeFavorite, "team")} />
      <PreferenceButton active={awayFavorite} label={`${awayFavorite ? "Following" : "Follow"} ${awayTeam.name}`} onClick={() => togglePreference(`team:${awayTeam.slug}`, !awayFavorite, "team")} />
      <PreferenceButton active={competitionFavorite} label={`${competitionFavorite ? "Following" : "Follow"} ${competition.name}`} onClick={() => togglePreference(`competition:${competition.slug}`, !competitionFavorite, "competition")} />
      <PreferenceButton
        active={reminder}
        disabled={!kickoffAt}
        label={reminder ? "Reminder saved" : kickoffAt ? "Remind me before kickoff" : "Reminder unavailable until kickoff is confirmed"}
        onClick={() => togglePreference(`reminder:${matchSlug}`, !reminder, "reminder")}
        reminder
      />
    </div>
  );
}

function PreferenceButton({ active, disabled = false, label, onClick, reminder = false }: { active: boolean; disabled?: boolean; label: string; onClick: () => void; reminder?: boolean }) {
  const Icon = reminder ? (active ? BellRing : Bell) : Star;

  return (
    <button
      type="button"
      className={`inline-flex min-h-10 items-center gap-2 rounded-md border px-3 text-xs font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${active ? "border-[var(--brand-cyan)] bg-[var(--brand-cyan)]/10 text-[var(--foreground)]" : "border-[var(--border)] text-[var(--muted)] hover:bg-[var(--surface-muted)]"} disabled:cursor-not-allowed disabled:opacity-50`}
      aria-pressed={active}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}

function usePreference(key: string): boolean {
  const getSnapshot = useCallback(() => readPreference(key), [key]);
  const getServerSnapshot = useCallback(() => false, []);

  return useSyncExternalStore(subscribePreferences, getSnapshot, getServerSnapshot);
}

function subscribePreferences(listener: () => void): () => void {
  window.addEventListener("storage", listener);
  window.addEventListener("rifitv:preferences", listener);

  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener("rifitv:preferences", listener);
  };
}

function readPreference(key: string): boolean {
  try {
    return window.localStorage.getItem(`rifitv:preference:${key}`) === "1";
  } catch {
    return false;
  }
}

function togglePreference(key: string, enabled: boolean, target: "team" | "competition" | "reminder"): void {
  try {
    const storageKey = `rifitv:preference:${key}`;
    if (enabled) {
      window.localStorage.setItem(storageKey, "1");
    } else {
      window.localStorage.removeItem(storageKey);
    }
    window.dispatchEvent(new Event("rifitv:preferences"));
    trackEvent(target === "reminder" ? "reminder_toggled" : "favorite_toggled", { target, enabled });
  } catch {
    return;
  }
}
