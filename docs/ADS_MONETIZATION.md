# Ads Monetization

RiFiTV now has a centralized client-side advertising system under `frontend/lib/ads` and reusable UI components under `frontend/components`.

## Configuration

Ads are off by default. The kill switches live in frontend environment variables:

```text
NEXT_PUBLIC_RIFITV_ADS_ENABLED=false
NEXT_PUBLIC_RIFITV_NORMAL_ADS_ENABLED=true
NEXT_PUBLIC_RIFITV_AGGRESSIVE_ADS_ENABLED=false
NEXT_PUBLIC_RIFITV_MOBILE_ADS_ENABLED=true
NEXT_PUBLIC_RIFITV_TABLET_ADS_ENABLED=true
NEXT_PUBLIC_RIFITV_DESKTOP_ADS_ENABLED=true
NEXT_PUBLIC_RIFITV_TV_ADS_ENABLED=false
NEXT_PUBLIC_RIFITV_PREWATCH_AD_ENABLED=true
NEXT_PUBLIC_RIFITV_AGGRESSIVE_COOLDOWN=20
NEXT_PUBLIC_RIFITV_MAX_AGGRESSIVE_PER_SESSION=2
NEXT_PUBLIC_RIFITV_DIRECT_LINK_COOLDOWN=30
NEXT_PUBLIC_RIFITV_VIGNETTE_COOLDOWN=20
```

Per-zone switches:

```text
NEXT_PUBLIC_RIFITV_ZONE_248721_ENABLED=true
NEXT_PUBLIC_RIFITV_ZONE_11137945_ENABLED=true
NEXT_PUBLIC_RIFITV_ZONE_11137952_ENABLED=true
NEXT_PUBLIC_RIFITV_ZONE_11137954_ENABLED=true
NEXT_PUBLIC_RIFITV_ZONE_11137969_ENABLED=true
NEXT_PUBLIC_RIFITV_ZONE_250801_ENABLED=true
```

## Architecture

- `config.ts`: zones, placement mapping, route policy, device switches, and frequency values.
- `AdManager.ts`: script loading, dedupe, route/device eligibility, weighted selection, direct-link opening, timeouts, and analytics.
- `ad-frequency.ts`: local/session caps for aggressive formats and the pre-watch gate.
- `device.ts`: broad mobile/tablet/desktop/TV capability detection.
- `AdPlacement.tsx`: reserved, client-only ad slot component.
- `PreWatchAdGate.tsx`: optional once-per-session transition before playback starts.

## Placements

- Homepage: one placement after the live/next match hero.
- Matches page: in-feed opportunity after every fifth fixture within a competition group.
- Live page: one placement between the live/next block and later-today schedule.
- Match page: one placement below the player/countdown area and one sidebar placement.
- Pre-watch: optional transition before player initialization when aggressive ads are enabled and frequency allows.

No ads are rendered in admin, login, API, health, internal tooling, or fullscreen/player controls.

## Device Rules

- Mobile/tablet/desktop can receive normal placements when enabled.
- Aggressive formats require `NEXT_PUBLIC_RIFITV_AGGRESSIVE_ADS_ENABLED=true`.
- TV ads default off. Aggressive zones are blocked on TV even if TV ads are later enabled.
- Player fullscreen is a no-ad route policy.

## Frequency Rules

- Global aggressive cooldown: 20 minutes by default.
- Max aggressive ads per session: 2 by default.
- Direct-link cooldown: 30 minutes.
- Vignette cooldown: 20 minutes.
- Pre-watch gate: once per session by default.
- Channel switching does not trigger aggressive ads.

## Analytics

RiFiTV-side events are sent through the existing first-party pipeline:

- `ad_eligible`
- `ad_loaded`
- `ad_impression`
- `ad_failed`
- `ad_blocked`
- `ad_transition_shown`
- `ad_transition_completed`

The `/admin/monetization` page shows ad opportunities, script loads, RiFiTV-side impressions, blocks, failures, transition completion, zones, placements, formats, and blocked reasons. It does not fabricate revenue, RPM, CTR, or fill rate.

## A/B Strategy

Run one experiment at a time. Good first experiments:

- Group A: 15-minute aggressive cooldown.
- Group B: 25-minute aggressive cooldown.

Compare provider revenue/session, pages/session, watch clicks, player starts, transition completion, bounce, and returning visitors. Do not optimize CTR alone.

## Troubleshooting

- If ads break UX: set `NEXT_PUBLIC_RIFITV_ADS_ENABLED=false`.
- If only aggressive formats are problematic: set `NEXT_PUBLIC_RIFITV_AGGRESSIVE_ADS_ENABLED=false`.
- If one zone breaks: disable its per-zone env var.
- If CSP blocks a provider call: inspect the exact blocked host in staging before adding it. Do not use wildcard script/connect sources.
- If ad blockers block scripts: RiFiTV remains fully functional and records failures/blocked outcomes where possible.
