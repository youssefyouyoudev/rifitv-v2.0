from __future__ import annotations

import json
import os
import re
from datetime import datetime
from html.parser import HTMLParser
from pathlib import Path


ROOT = Path(__file__).resolve().parent
OUT = ROOT / "2026-27"
PL_SOURCE = Path(os.environ.get("TEMP", "")) / "pl2627.html"
LALIGA_SOURCE = Path(os.environ.get("TEMP", "")) / "laliga-calendar-102-1.json"


class PremierLeagueParagraphParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.in_p = False
        self.parts: list[str] = []
        self.rows: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == "p":
            self.in_p = True
            self.parts = []
        elif self.in_p and tag == "br":
            self.parts.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if tag == "p" and self.in_p:
            text = "".join(self.parts).strip()
            if re.search(r"\b\d{1,2}\s+\w+", text) and " v " in text:
                self.rows.append(text)
            self.in_p = False

    def handle_data(self, data: str) -> None:
        if self.in_p:
            self.parts.append(data)


def parse_english_date(label: str, current_year: int | None) -> tuple[str, int]:
    match = re.match(r"^\w+\s+(\d{1,2}\s+\w+)(?:\s+(\d{4}))?$", label)
    if not match:
        raise ValueError(f"Unexpected date label: {label}")

    if match.group(2):
        current_year = int(match.group(2))
    if current_year is None:
        current_year = 2026

    parsed = datetime.strptime(f"{match.group(1)} {current_year}", "%d %B %Y")
    return parsed.date().isoformat(), current_year


def build_premier_league() -> dict:
    parser = PremierLeagueParagraphParser()
    parser.feed(PL_SOURCE.read_text(encoding="utf-8"))

    fixtures = []
    current_year: int | None = None
    source_url = "https://www.premierleague.com/en/news/4675097/all-380-fixtures-for-202627-premier-league-season"

    for row in parser.rows:
        lines = [line.strip() for line in row.split("\n") if line.strip()]
        scheduled_date, current_year = parse_english_date(lines[0], current_year)

        for line in lines[1:]:
            if line.startswith("*") or " v " not in line:
                continue

            note = None
            note_match = re.search(r"\(([^)]+)\)\**$", line)
            if note_match:
                note = note_match.group(1)
                line = line[: note_match.start()].strip()

            line = line.rstrip("*").strip()
            time_match = re.match(r"^(\d{2}:\d{2})\s+(.+)$", line)
            kickoff_time = None
            if time_match:
                kickoff_time = time_match.group(1)
                line = time_match.group(2)

            home, away = [part.strip() for part in line.split(" v ", 1)]
            number = len(fixtures) + 1
            fixtures.append(
                {
                    "provider": "official-premier-league",
                    "external_id": f"pl-2026-27-{number:03d}",
                    "matchday": ((number - 1) // 10) + 1,
                    "scheduled_date": scheduled_date,
                    "kickoff_time_local": kickoff_time,
                    "kickoff_precision": "confirmed" if kickoff_time else "date_only",
                    "source_timezone": "Europe/London",
                    "home_team": home,
                    "away_team": away,
                    "source_broadcaster_note": note,
                    "source_url": source_url,
                }
            )

    return {
        "season": "2026-27",
        "competition": {
            "name": "Premier League",
            "slug": "premier-league",
            "short_name": "PL",
            "country_code": "GB",
            "source_url": source_url,
        },
        "fixtures": fixtures,
    }


def build_laliga() -> dict:
    data = json.loads(LALIGA_SOURCE.read_text(encoding="utf-8-sig"))
    source_url = "https://www.laliga.com/en-GB/laliga-easports/calendar"
    fixtures = []

    for block in data.values():
        matchday = int(block["gameweek_week"])
        scheduled_date = datetime.strptime(block["gameweek_date"], "%d.%m.%Y").date().isoformat()

        for row in block["matches"]:
            fixtures.append(
                {
                    "provider": "official-laliga",
                    "external_id": f"laliga-{row['match_id']}",
                    "matchday": matchday,
                    "round_label": block["gameweek_name"],
                    "scheduled_date": scheduled_date,
                    "kickoff_time_local": None,
                    "kickoff_precision": "provisional",
                    "source_timezone": "Europe/Madrid",
                    "home_team": row["local_name"],
                    "home_team_slug": row["local_slug"],
                    "away_team": row["away_name"],
                    "away_team_slug": row["away_slug"],
                    "source_url": source_url,
                }
            )

    return {
        "season": "2026-27",
        "competition": {
            "name": "LALIGA EA SPORTS",
            "slug": "laliga-ea-sports",
            "short_name": "LALIGA",
            "country_code": "ES",
            "source_url": source_url,
        },
        "fixtures": fixtures,
    }


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    datasets = {
        "premier-league.json": build_premier_league(),
        "laliga.json": build_laliga(),
    }

    for filename, payload in datasets.items():
        path = OUT / filename
        path.write_text(json.dumps(payload, ensure_ascii=True, indent=2) + "\n", encoding="utf-8")
        print(f"{filename}: {len(payload['fixtures'])} fixtures")


if __name__ == "__main__":
    main()
