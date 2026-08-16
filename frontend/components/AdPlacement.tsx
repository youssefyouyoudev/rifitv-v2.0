const enabled = process.env.NEXT_PUBLIC_RIFITV_ADS_ENABLED === "true";

export type AdPlacementName =
  | "homepage_top"
  | "homepage_between_sections"
  | "match_sidebar"
  | "match_below_player"
  | "mobile_match_bottom";

export function AdPlacement({ name }: { name: AdPlacementName }) {
  if (!enabled) {
    return null;
  }

  return (
    <aside
      aria-label="Advertisement"
      data-ad-placement={name}
      className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-3 text-center text-xs uppercase tracking-normal text-[var(--muted)]"
    >
      Advertisement
    </aside>
  );
}
