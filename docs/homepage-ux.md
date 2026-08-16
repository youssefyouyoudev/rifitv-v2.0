# Homepage UX

The homepage is now a focused Today surface.

- Laravel filters matches for the configured timezone, `Africa/Casablanca`.
- `/` returns and renders only matches on the current local calendar day.
- Featured/upcoming duplication was removed.
- If no match exists today, the page shows a compact empty state with one next-match preview.
- `/matches` owns the broader schedule and competition filters.

The homepage does not mount the playback engine or stream libraries.
