# RiFiTV Brand System

RiFiTV uses the supplied light/dark logo and icon assets from `frontend/public/brand`.

## Assets

- `rifitv-logo-light.png`: full logo for light UI surfaces.
- `rifitv-logo-dark.png`: full logo for dark UI surfaces.
- `rifitv-icon-light.png`: icon mark for light UI surfaces.
- `rifitv-icon-dark.png`: icon mark for dark UI surfaces.
- `rifitv-icon-192.png`, `rifitv-icon-512.png`, `rifitv-apple-touch-icon.png`, `app/favicon.ico`: generated app icons.
- `frontend/public/football/clubs/*.png`: local 2026/27 production club crest assets.
- `frontend/public/football/competitions/*.png`: Premier League, LALIGA, Ligue 1, and UEFA Champions League assets.
- `frontend/public/football/logo-manifest.json`: logo provenance, checksums, and verification state.

Starter Next.js placeholder icons were removed.

Football logo assets are normalized 256px transparent PNGs and are stored locally so the UI does not depend on remote image availability.

## Theme Tokens

Core colors live in `frontend/app/globals.css`:

- `--background`, `--foreground`
- `--surface`, `--surface-muted`, `--surface-elevated`
- `--border`, `--muted`
- `--brand-cyan`, `--brand-blue`, `--brand-ink`
- `--live`, `--success`, `--warning`

The `ThemeScript` applies the saved `rifitv-theme` before paint. `ThemeToggle` persists light/dark preference in local storage.

## Usage

Use `RiFiTVLogo` for brand placement instead of text-only logo markup. Use semantic red only for live state, errors, and alerts.
