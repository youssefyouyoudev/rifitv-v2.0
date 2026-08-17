# RiFiTV Ads Audit

Date: 2026-08-17

## Method

The ad sources were fetched as script text/headers in a safe local audit. They were not executed inside RiFiTV pages during development. The scripts are minified/obfuscated, so classifications are conservative and should be validated in a provider-approved staging environment before production activation.

## Findings

| Zone | Provider | Source | Observed behavior | Compatibility | Aggressiveness | Recommended placement | Frequency | Disable on TV | Video interference |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `248721` | `quge5.com` | `https://quge5.com/88/tag.min.js` | 95 KB JS, references click/onclick/pop/push/localStorage/MutationObserver. Classified as onclick/pop-capable. | Desktop/mobile likely; TV unproven. | High | Aggressive arbitration only, never default page load. | Global cooldown, max session cap. | Yes | Could interfere if fired during playback; pre-watch only. |
| `250801` | `quge5.com` | `https://quge5.com/88/tag.min.js` | Same provider script as `248721` with different zone id. | Desktop/mobile likely; TV unproven. | High | Aggressive arbitration only. | Global cooldown, max session cap. | Yes | Could interfere if fired during playback; pre-watch only. |
| `11137945` | `5gvci.com` | `https://5gvci.com/act/files/tag.min.js?z=11137945` | 29 KB obfuscated script. No clear static click/pop tokens in first audit pass. Classified unknown/normal until staging proves otherwise. | Likely broad web compatibility. | Medium/unknown | Strategic non-blocking placements after football content. | Script load once, route/device policy. | No by default, but monitor. | Should not overlay player; kept outside player. |
| `11137952` | `nap5k.com` | `https://nap5k.com/tag.min.js` | 162 KB obfuscated script, static `pop` and MutationObserver references. Classified unknown with aggressive risk. | Mobile/desktop likely; TV unproven. | Medium/high | Non-blocking placement only while measured; no TV. | Load once only; duplicate explicitly prevented. | Yes | Kept outside player; monitor in staging. |
| `11137954` | `n6wxm.com` | `https://n6wxm.com/vignette.min.js` | 167 KB obfuscated script and filename indicates vignette/interstitial. | Mobile/desktop likely; TV risky. | High | Aggressive arbitration/pre-watch only. | Vignette cooldown plus global cap. | Yes | Do not trigger during active playback. |
| `11137969` | `omg10.com` | `https://omg10.com/4/11137969` | Direct URL returned HTTP 200. Classified direct-link. | Depends on browser popup rules. | High | Intentional eligible user action only through `requestAggressiveAd`. | Direct-link cooldown plus global cap. | Yes | Do not trigger during active playback or channel switch. |

## Duplicate Handling

Zone `11137952` was provided twice in the request. RiFiTV defines it once in `AD_ZONES`, and the runtime maintains both module-level and `window.__rifitvLoadedAdZones` registries. Unit coverage verifies zone `11137952` does not append twice across repeated placement requests.

## CSP Notes

The production CSP was updated only for the provided domains:

- `quge5.com`
- `5gvci.com`
- `nap5k.com`
- `n6wxm.com`
- `omg10.com`

No wildcard `script-src *` was added. Additional domains contacted by provider code must be verified in staging before widening CSP.

## Recommendation

Start with `NEXT_PUBLIC_RIFITV_ADS_ENABLED=false` in development and tests. In staging, enable normal ads first, measure page speed and player funnel, then enable aggressive ads with the default caps. Keep TV aggressive formats disabled unless real TV-browser testing proves they are usable.
