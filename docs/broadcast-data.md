# Broadcast Data

RiFiTV stores broadcast rights metadata separately from playable stream sources.

## MENA Baseline

All imported 2026/27 Premier League and LALIGA EA SPORTS fixtures receive:

- Broadcaster: `beIN SPORTS MENA`
- Territory: `MENA`
- Assignment status: `network_confirmed`
- Channel: `null` until an exact channel is officially assigned or manually entered
- Languages: `ar`, `en`

All imported PSG Ligue 1 fixtures receive:

- Broadcaster: `beIN SPORTS MENA`
- Territory: `MENA`
- Assignment status: `tbc`
- Channel: `null` until a match-specific assignment is verified
- Languages: `ar`, `en`

This lets public match pages show network availability without implying a playable source exists.

## Playback Separation

`match_broadcasts` describes broadcast availability. Existing `channels`, `stream_sources`, and `match_channels` continue to power the playback engine.

No production fixture import seeds playable stream URLs or unauthorized stream sources.
