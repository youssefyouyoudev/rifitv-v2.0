import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(frontendRoot, "..");
const publicRoot = path.join(frontendRoot, "public");
const manifestPath = path.join(publicRoot, "football", "logo-manifest.json");
const datasetRoot = path.join(repoRoot, "backend", "database", "data", "2026-27");

const competitionLogos = new Map([
  ["premier-league", "/football/competitions/premier-league.png"],
  ["laliga-ea-sports", "/football/competitions/laliga.png"],
  ["ligue-1", "/football/competitions/ligue-1.png"],
  ["uefa-champions-league", "/football/competitions/champions-league.png"],
]);

const datasets = [
  "premier-league-rifitv.json",
  "laliga-rifitv.json",
  "ligue1-psg.json",
];

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

function slug(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function publicFile(localPath) {
  return path.join(publicRoot, ...localPath.split("/").filter(Boolean));
}

function sha256(file) {
  return `sha256:${createHash("sha256").update(readFileSync(file)).digest("hex")}`;
}

const failures = [];

if (!existsSync(manifestPath)) {
  failures.push("Missing frontend/public/football/logo-manifest.json");
} else {
  const manifest = readJson(manifestPath);
  const manifestByPath = new Map((manifest.assets ?? []).map((asset) => [asset.local_path, asset]));
  const required = new Set(competitionLogos.values());

  for (const file of datasets) {
    const payload = readJson(path.join(datasetRoot, file));
    if (competitionLogos.has(payload.competition)) {
      required.add(competitionLogos.get(payload.competition));
    }

    for (const fixture of payload.fixtures ?? []) {
      required.add(`/football/clubs/${slug(fixture.home_team)}.png`);
      required.add(`/football/clubs/${slug(fixture.away_team)}.png`);
    }
  }

  for (const localPath of [...required].sort()) {
    if (!localPath.startsWith("/football/")) {
      failures.push(`Football asset path is not local: ${localPath}`);
      continue;
    }

    const file = publicFile(localPath);
    if (!existsSync(file)) {
      failures.push(`Missing football asset file: ${localPath}`);
      continue;
    }

    const manifestEntry = manifestByPath.get(localPath);
    if (!manifestEntry) {
      failures.push(`Football asset is missing from logo manifest: ${localPath}`);
      continue;
    }

    if (manifestEntry.checksum && manifestEntry.checksum !== sha256(file)) {
      failures.push(`Football asset checksum mismatch: ${localPath}`);
    }

    if (!manifestEntry.mime_type?.startsWith("image/")) {
      failures.push(`Football asset manifest has invalid mime type: ${localPath}`);
    }
  }
}

if (failures.length > 0) {
  console.error("Football asset validation failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Football asset validation passed.");
