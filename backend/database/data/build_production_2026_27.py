from __future__ import annotations

import hashlib
import json
import re
import unicodedata
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

from PIL import Image


ROOT = Path(__file__).resolve().parents[3]
DATA = ROOT / "backend" / "database" / "data" / "2026-27"
FOOTBALL = ROOT / "frontend" / "public" / "football"
UA = "Mozilla/5.0 RiFiTV production dataset builder"

SELECTED_SLUGS = {
    "premier-league": {
        "arsenal",
        "chelsea",
        "liverpool",
        "manchester-city",
        "manchester-united",
        "tottenham-hotspur",
    },
    "laliga-ea-sports": {"fc-barcelona", "real-madrid", "atletico-de-madrid"},
}


def fix_mojibake(value: str) -> str:
    if "Ã" not in value and "Â" not in value:
        return value

    try:
        return value.encode("latin1").decode("utf-8")
    except UnicodeError:
        return value


def canonical(name: str) -> str:
    name = fix_mojibake(name)

    return {
        "Paris": "Paris Saint-Germain",
        "Rennes": "Stade Rennais",
        "LOSC": "LOSC Lille",
        "Bournemouth": "AFC Bournemouth",
        "Brighton": "Brighton & Hove Albion",
        "Ipswich": "Ipswich Town",
        "Liverpool FC": "Liverpool",
        "Newcastle": "Newcastle United",
        "Tottenham": "Tottenham Hotspur",
        "Athletic Club Bilbao": "Athletic Club",
        "Atletico Madrid": "Atlético de Madrid",
        "Barcelona": "FC Barcelona",
        "Celta": "RC Celta",
        "Deportivo": "Deportivo Alavés",
        "Deportivo La Coruńa": "RC Deportivo",
        "Deportivo La Coruna": "RC Deportivo",
        "Elche": "Elche CF",
        "Espanyol": "RCD Espanyol de Barcelona",
        "Getafe": "Getafe CF",
        "Levante": "Levante UD",
        "Málaga": "Málaga CF",
        "Malaga": "Málaga CF",
        "Osasuna": "CA Osasuna",
        "Racing Santander": "R. Racing Club",
        "Sevilla": "Sevilla FC",
        "Valencia": "Valencia CF",
        "Villarreal": "Villarreal CF",
    }.get(name, name)


def slug(name: str) -> str:
    value = unicodedata.normalize("NFKD", canonical(name)).encode("ascii", "ignore").decode("ascii")

    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def checksum(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def save_png(url: str, out: Path) -> None:
    data = urlopen(Request(url, headers={"User-Agent": UA}), timeout=30).read()
    image = Image.open(BytesIO(data)).convert("RGBA")
    image.thumbnail((256, 256), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (256, 256), (0, 0, 0, 0))
    canvas.alpha_composite(image, ((256 - image.width) // 2, (256 - image.height) // 2))
    out.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(out)


def selected_fixture(fixture: dict, competition: str) -> bool:
    return slug(fixture["home_team"]) in SELECTED_SLUGS[competition] or slug(fixture["away_team"]) in SELECTED_SLUGS[competition]


def convert_fixture(fixture: dict, competition: str) -> dict:
    precision = fixture.get("kickoff_precision")

    return {
        "competition": competition,
        "season": "2026-27",
        "provider": fixture["provider"],
        "external_id": fixture["external_id"],
        "matchday": fixture["matchday"],
        "round_label": fixture.get("round_label") or f"Matchday {fixture['matchday']}",
        "home_team": canonical(fixture["home_team"]),
        "away_team": canonical(fixture["away_team"]),
        "scheduled_date": fixture["scheduled_date"],
        "kickoff_local": fixture.get("kickoff_time_local"),
        "source_timezone": fixture["source_timezone"],
        "kickoff_status": "confirmed" if precision == "confirmed" else ("tbc" if precision == "date_only" else "provisional"),
        "status": "scheduled",
        "source_reference": fixture["source_url"],
        "broadcast": {
            "network": "beIN SPORTS MENA",
            "territory": "MENA / Morocco",
            "status": "network_confirmed",
            "specific_channel": None,
            "streaming_platform": "TOD",
        },
    }


def write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def build_snapshots(retrieved_at: str, sources: dict) -> dict[str, str]:
    output_files = {}
    specs = [
        ("premier-league.json", "premier-league", "premier-league-rifitv.json"),
        ("laliga.json", "laliga-ea-sports", "laliga-rifitv.json"),
    ]

    for source_file, competition, output_file in specs:
        raw = json.loads((ROOT / "backend" / "database" / "fixtures" / "2026-27" / source_file).read_text(encoding="utf-8"))
        fixtures = [convert_fixture(fixture, competition) for fixture in raw["fixtures"] if selected_fixture(fixture, competition)]
        path = DATA / output_file
        write_json(path, {"competition": competition, "season": "2026-27", "retrieved_at": retrieved_at, "source": sources[competition], "fixtures": fixtures})
        output_files[output_file] = checksum(path)
        print(output_file, len(fixtures))

    api_url = sources["ligue-1-psg-api"]
    payload = json.loads(urlopen(Request(api_url.replace(" ", "%20"), headers={"User-Agent": UA, "Accept-Language": "en", "psg-fe": "true"}), timeout=30).read().decode("utf-8"))
    fixtures = []
    logo_sources = {}

    for item in payload["items"]:
        match = item["properties"]["mdmMatch"]
        home = canonical(match["home_team_id"]["Name_official"])
        away = canonical(match["away_team_id"]["Name_official"])
        utc = datetime.fromisoformat(match["timeUtc"].replace("Z", "+00:00")) if match.get("timeUtc") else None
        local = utc.astimezone(ZoneInfo("Europe/Paris")).strftime("%H:%M") if utc and not match.get("matchtime_tbc") else None

        for side in ["home_team_id", "away_team_id"]:
            logo_sources[canonical(match[side]["Name_official"])] = match[side].get("mdmLogo")

        fixtures.append(
            {
                "competition": "ligue-1",
                "season": "2026-27",
                "provider": "official-psg",
                "external_id": f"psg-l1-{match['id']}",
                "matchday": match["matchweek"],
                "round_label": f"Matchweek {match['matchweek']}",
                "home_team": home,
                "away_team": away,
                "scheduled_date": match["matchDate"],
                "kickoff_local": local,
                "source_timezone": "Europe/Paris",
                "kickoff_status": "confirmed" if local else "tbc",
                "status": "scheduled",
                "source_reference": sources["ligue-1-psg"],
                "broadcast": {
                    "network": "beIN SPORTS MENA",
                    "territory": "MENA / Morocco",
                    "status": "tbc",
                    "specific_channel": None,
                    "streaming_platform": None,
                },
            }
        )

    path = DATA / "ligue1-psg.json"
    write_json(path, {"competition": "ligue-1", "season": "2026-27", "retrieved_at": retrieved_at, "source": sources["ligue-1-psg"], "api_source": api_url, "fixtures": fixtures})
    output_files["ligue1-psg.json"] = checksum(path)
    print("ligue1-psg.json", len(fixtures))

    return output_files | {"_psg_logo_sources": logo_sources}


def build_logo_manifest(retrieved_at: str, psg_logo_sources: dict[str, str | None]) -> None:
    manifest = []

    for folder in [FOOTBALL / "clubs", FOOTBALL / "competitions"]:
        folder.mkdir(parents=True, exist_ok=True)
        for asset in folder.glob("*.png"):
            asset.unlink()

    def add(kind: str, name: str, path: str, source_url: str, state: str) -> None:
        file_path = ROOT / "frontend" / "public" / path.lstrip("/")
        with Image.open(file_path) as image:
            dimensions = {"width": image.width, "height": image.height}
        manifest.append(
            {
                "type": kind,
                "name": name,
                "local_path": path,
                "source_url": source_url,
                "retrieved_at": retrieved_at,
                "mime_type": "image/png",
                "dimensions": dimensions,
                "checksum": "sha256:" + checksum(file_path),
                "verification_state": state,
            }
        )

    for name, path, source, old in [
        ("Premier League", "/football/competitions/premier-league.png", "https://football-logos.cc/england/english-premier-league/", ROOT / "frontend" / "public" / "logos" / "competitions" / "premier-league.png"),
        ("LALIGA EA SPORTS", "/football/competitions/laliga.png", "https://football-logos.cc/spain/la-liga/", ROOT / "frontend" / "public" / "logos" / "competitions" / "laliga.png"),
    ]:
        dest = ROOT / "frontend" / "public" / path.lstrip("/")
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(old.read_bytes())
        add("competition", name, path, source, "third_party_normalized")

    for name, path, source in [
        ("Ligue 1", "/football/competitions/ligue-1.png", "https://api.psg.fr/umbraco/akqa/api/v1.0/sportsImage/Competition/dm5ka0os1e3dxcp3vh05kmp33.png"),
        ("UEFA Champions League", "/football/competitions/champions-league.png", "https://api.psg.fr/umbraco/akqa/api/v1.0/sportsImage/Competition/4oogyu6o156iphvdvphwpck10.png"),
    ]:
        save_png(source, ROOT / "frontend" / "public" / path.lstrip("/"))
        add("competition", name, path, source, "official_psg_api")

    needed = set()
    for file_name in ["premier-league-rifitv.json", "laliga-rifitv.json", "ligue1-psg.json"]:
        for fixture in json.loads((DATA / file_name).read_text(encoding="utf-8"))["fixtures"]:
            needed.add(fixture["home_team"])
            needed.add(fixture["away_team"])

    third_party_sources = {}
    for page in ["https://football-logos.cc/england/english-premier-league/", "https://football-logos.cc/spain/la-liga/"]:
        html = urlopen(Request(page, headers={"User-Agent": UA}), timeout=30).read().decode("utf-8")
        for match in re.finditer(r'background-image:\s*url\((https://assets\.football-logos\.cc/logos/[^)]+?\.png)\);[^>]*></span><span class="[^"]*">([^<]+)</span>', html):
            third_party_sources[slug(match.group(2))] = match.group(1)

    logo_source_aliases = {
        "rc-deportivo": "deportivo-la-coruna",
    }

    missing = []
    for team in sorted(needed):
        path = f"/football/clubs/{slug(team)}.png"
        dest = ROOT / "frontend" / "public" / path.lstrip("/")
        team_slug = slug(team)
        source_slug = logo_source_aliases.get(team_slug, team_slug)
        if team in psg_logo_sources and psg_logo_sources[team]:
            source = psg_logo_sources[team]
            state = "official_psg_api"
            save_png(source, dest)
        elif (ROOT / "frontend" / "public" / "logos" / "clubs" / f"{team_slug}.png").exists():
            old = ROOT / "frontend" / "public" / "logos" / "clubs" / f"{team_slug}.png"
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(old.read_bytes())
            source = f"https://football-logos.cc/ asset page for {team}"
            state = "third_party_normalized"
        elif source_slug in third_party_sources:
            source = third_party_sources[source_slug]
            state = "third_party_normalized"
            save_png(source, dest)
        else:
            missing.append(team)
            continue
        add("club", team, path, source, state)

    write_json(FOOTBALL / "logo-manifest.json", {"generated_at": retrieved_at, "assets": manifest, "missing": missing})
    print("logos", len(manifest), "teams", len([item for item in manifest if item["type"] == "club"]), "missing", missing)


def main() -> None:
    retrieved_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    sources = {
        "premier-league": "https://www.premierleague.com/en/news/4675097/all-380-fixtures-for-202627-premier-league-season",
        "laliga-ea-sports": "https://www.laliga.com/en-GB/laliga-easports/calendar",
        "laliga-json": "https://assets.laliga.com/assets/calendar/calendar-102-1.json",
        "ligue-1-psg": "https://www.psg.fr/en/mens-football/fixtures",
        "ligue-1-psg-api": "https://api.psg.fr/umbraco/delivery/api/v2/content?take=80&filter=contentType:matchSheet&filter=matchSeason:2026-2027&filter=matchTeam:2b3mar72yy8d6uvat1ka6tn3r&filter=matchCompetition:dm5ka0os1e3dxcp3vh05kmp33&sort=matchDate:asc",
    }
    results = build_snapshots(retrieved_at, sources)
    source_report = {
        "retrieved_at": retrieved_at,
        "verified_at": retrieved_at,
        "version": "2026-27-rifitv-production-v1",
        "sources": sources,
    }
    for file_name, file_checksum in results.items():
        if file_name.startswith("_"):
            continue
        source_report[file_name] = {
            "checksum": file_checksum,
            "records": len(json.loads((DATA / file_name).read_text(encoding="utf-8"))["fixtures"]),
        }
    write_json(DATA / "sources.json", source_report)
    build_logo_manifest(retrieved_at, results["_psg_logo_sources"])


if __name__ == "__main__":
    main()
