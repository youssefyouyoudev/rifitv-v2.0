# Ads Implementation Report

Date: 2026-08-17

## Scripts Discovered

- `248721`: `quge5.com/88/tag.min.js`, onclick/pop-capable risk.
- `11137945`: `5gvci.com/act/files/tag.min.js?z=11137945`, unknown/normal until staging validation.
- `11137952`: `nap5k.com/tag.min.js`, unknown with pop-risk indicators.
- `11137954`: `n6wxm.com/vignette.min.js`, vignette/interstitial.
- `11137969`: `omg10.com/4/11137969`, direct-link.
- `250801`: `quge5.com/88/tag.min.js`, onclick/pop-capable risk.

## Duplicate Fixed

Zone `11137952` is defined once and protected by runtime dedupe. The test `AdManager never loads zone 11137952 twice` verifies duplicate initialization is blocked.

## Placements

- `/`: one placement after the primary live/next-match signal.
- `/matches`: one in-feed placement after every fifth fixture.
- `/live`: one placement around live/next/later-today content.
- `/match/[slug]`: one below player/countdown and one sidebar placement.
- Optional pre-watch transition: once per session, before player initialization, never during active playback.

## Device Behavior

- Mobile/tablet/desktop: normal placements allowed when enabled.
- TV: disabled by default; aggressive formats blocked by zone/device policy.
- Admin/internal pages: blocked by route policy and no placements are rendered.

## Frequency Rules

- Aggressive cooldown: 20 minutes.
- Max aggressive per session: 2.
- Direct-link cooldown: 30 minutes.
- Vignette cooldown: 20 minutes.
- Pre-watch: once per session.

## Performance

- Ads are disabled by default in development/tests.
- Ad scripts load client-side after content render via idle callback/setTimeout fallback.
- Slots reserve stable height to reduce CLS.
- Script failures/timeouts resolve locally and do not block match data, countdowns, navigation, or player UI.
- No new package dependency was added.

## UX Protection

- Ads do not cover player, countdown, channel selector, mobile nav, or TV focus controls.
- Active playback is not interrupted.
- Channel switching does not request aggressive ads.
- Smart TV aggressive formats are disabled by default.
- Ad blockers do not break RiFiTV functionality.

## Analytics

Implemented RiFiTV-side events:

- `ad_eligible`
- `ad_loaded`
- `ad_impression`
- `ad_failed`
- `ad_blocked`
- `ad_transition_shown`
- `ad_transition_completed`

Admin `/admin/monetization` reports these events and explicitly avoids fabricated revenue.

## CSP

Production CSP now permits only the provided ad domains for scripts/connect as needed. Any additional provider subresources must be captured in staging and added deliberately.

## Remaining External Work

- Provider dashboard/API credentials for actual revenue, RPM, CTR, fill rate, and payment reporting.
- Privacy/legal review for cookie/consent requirements in target markets.
- Staging execution of provider scripts to confirm actual behavior and downstream CSP domains.
- Real-device validation on iPhone Safari, Android Chrome, iPad, desktop browsers, Samsung/LG TV browsers, Android TV, and TV boxes.
- Revenue/session and player funnel monitoring after rollout.
