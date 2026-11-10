"""
nfl_data_api.py - Conector Oficial de Datos ESPN API para NFL y NCAA College Football (NCAAF).
Convierte automáticamente los horarios a HORA OFICIAL DE LA CIUDAD DE MÉXICO (CDMX / UTC-6).
"""
import os, sys, json, urllib.request
from datetime import datetime, timezone, timedelta

CDMX_TZ = timezone(timedelta(hours=-6))  # Hora Centro de México (CDMX / UTC-6)
DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
os.makedirs(DATA_DIR, exist_ok=True)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

LEAGUE_ENDPOINTS = {
    "NFL": {
        "scoreboard": "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard",
        "summary": "https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event="
    },
    "NCAAF": {
        "scoreboard": "https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard",
        "summary": "https://site.api.espn.com/apis/site/v2/sports/football/college-football/summary?event="
    }
}

NFL_DEFAULT_STARS = {
    "Buffalo Bills": [
        {"name": "Josh Allen", "pos": "QB", "pass_yds": 258.4, "pass_tds": 2.1, "rush_yds": 42.5, "anytime_td_pct": 55.0},
        {"name": "James Cook", "pos": "RB", "rush_yds": 78.5, "rec_yds": 24.2, "anytime_td_pct": 65.0},
        {"name": "Khalil Shakir", "pos": "WR", "rec_yds": 58.2, "catches": 4.8, "anytime_td_pct": 38.0}
    ],
    "Minnesota Vikings": [
        {"name": "Sam Darnold", "pos": "QB", "pass_yds": 245.2, "pass_tds": 1.9, "rush_yds": 12.0, "anytime_td_pct": 15.0},
        {"name": "Justin Jefferson", "pos": "WR", "rec_yds": 94.6, "catches": 6.8, "anytime_td_pct": 62.0},
        {"name": "Aaron Jones", "pos": "RB", "rush_yds": 68.4, "rec_yds": 26.5, "anytime_td_pct": 48.0}
    ],
    "Kansas City Chiefs": [
        {"name": "Patrick Mahomes", "pos": "QB", "pass_yds": 262.5, "pass_tds": 2.0, "rush_yds": 22.0, "anytime_td_pct": 20.0},
        {"name": "Travis Kelce", "pos": "TE", "rec_yds": 62.4, "catches": 5.4, "anytime_td_pct": 45.0},
        {"name": "Kareem Hunt", "pos": "RB", "rush_yds": 64.2, "rec_yds": 18.0, "anytime_td_pct": 58.0}
    ],
    "Baltimore Ravens": [
        {"name": "Lamar Jackson", "pos": "QB", "pass_yds": 242.0, "pass_tds": 2.2, "rush_yds": 54.5, "anytime_td_pct": 42.0},
        {"name": "Derrick Henry", "pos": "RB", "rush_yds": 98.4, "rec_yds": 12.0, "anytime_td_pct": 82.0},
        {"name": "Zay Flowers", "pos": "WR", "rec_yds": 68.2, "catches": 5.2, "anytime_td_pct": 35.0}
    ]
}

def fetch_football_scoreboard(league_key: str, date_str: str) -> list:
    ep = LEAGUE_ENDPOINTS.get(league_key, {}).get("scoreboard")
    if not ep:
        return []
    url = f"{ep}?dates={date_str}"
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=8) as r:
            data = json.loads(r.read().decode("utf-8"))
            return data.get("events", [])
    except Exception as e:
        print(f"Error fetching {league_key} {date_str}: {e}")
        return []

def get_normalized_football_schedule(date_str: str = "20261109", league_filter: str = "ALL") -> list:
    cache_file = os.path.join(DATA_DIR, f"football_schedule_{date_str}.json")
    if os.path.exists(cache_file):
        try:
            with open(cache_file, "r", encoding="utf-8") as f:
                all_games = json.load(f)
                if league_filter != "ALL":
                    return [g for g in all_games if g.get("league") == league_filter]
                return all_games
        except Exception:
            pass

    leagues_to_fetch = ["NFL", "NCAAF"] if league_filter == "ALL" else [league_filter]
    games = []

    for l_key in leagues_to_fetch:
        raw_events = fetch_football_scoreboard(l_key, date_str)
        for e in raw_events:
            comp = e.get("competitions", [{}])[0]
            competitors = comp.get("competitors", [])
            h = next((c for c in competitors if c.get("homeAway") == "home"), {})
            a = next((c for c in competitors if c.get("homeAway") == "away"), {})

            h_team = h.get("team", {}).get("displayName", "Home Team")
            a_team = a.get("team", {}).get("displayName", "Away Team")
            h_score = int(h.get("score", 0)) if h.get("score") and str(h.get("score")).isdigit() else 0
            a_score = int(a.get("score", 0)) if a.get("score") and str(a.get("score")).isdigit() else 0

            odds_arr = comp.get("odds", [])
            spread_str = odds_arr[0].get("details", "") if odds_arr else ""
            ou_val = float(odds_arr[0].get("overUnder", 46.5 if l_key == "NFL" else 54.5)) if odds_arr and odds_arr[0].get("overUnder") else (46.5 if l_key == "NFL" else 54.5)

            status_obj = comp.get("status", {}).get("type", {})
            status_desc = status_obj.get("description", "Scheduled")
            is_final = "Final" in status_desc or status_obj.get("completed", False)

            # CONVERSIÓN EXACTA A HORA CDMX (UTC-6)
            dt_raw = comp.get("date", "")
            time_cdmx = "12:00"
            if dt_raw:
                try:
                    utc_dt = datetime.fromisoformat(dt_raw.replace("Z", "+00:00"))
                    cdmx_dt = utc_dt.astimezone(CDMX_TZ)
                    time_cdmx = cdmx_dt.strftime("%H:%M")
                except Exception:
                    pass

            venue_name = comp.get("venue", {}).get("fullName", "Estadio Oficial")
            city = comp.get("venue", {}).get("address", {}).get("city", "")
            is_dome = comp.get("venue", {}).get("indoor", False)

            stars = NFL_DEFAULT_STARS.get(h_team, []) + NFL_DEFAULT_STARS.get(a_team, [])
            if not stars:
                stars = [
                    {"name": f"{h_team.split()[-1]} Starting QB", "pos": "QB", "pass_yds": 235.0, "pass_tds": 1.8, "rush_yds": 15.0, "anytime_td_pct": 25.0},
                    {"name": f"{h_team.split()[-1]} Lead RB", "pos": "RB", "rush_yds": 72.0, "rec_yds": 18.0, "anytime_td_pct": 60.0},
                    {"name": f"{a_team.split()[-1]} Starting QB", "pos": "QB", "pass_yds": 228.0, "pass_tds": 1.6, "rush_yds": 12.0, "anytime_td_pct": 20.0},
                    {"name": f"{a_team.split()[-1]} Lead RB", "pos": "RB", "rush_yds": 68.0, "rec_yds": 15.0, "anytime_td_pct": 55.0}
                ]

            games.append({
                "id": e.get("id", ""),
                "league": l_key,
                "match": f"{a_team} @ {h_team}",
                "home": h_team,
                "away": a_team,
                "time_cdmx": time_cdmx,
                "status": "FINALIZADO" if is_final else ("EN JUEGO" if "In Progress" in status_desc else "PROGRAMADO"),
                "score": f"{a_score} - {h_score}" if (h_score > 0 or a_score > 0) else "vs",
                "home_score": h_score,
                "away_score": a_score,
                "total_points": h_score + a_score,
                "spread_str": spread_str,
                "over_under": ou_val,
                "venue": f"{venue_name} ({city}) {'[DOMO]' if is_dome else '[ABIERTO]'}",
                "stars": stars
            })

    # Ordenar cronológicamente por hora CDMX
    games.sort(key=lambda x: (x.get("time_cdmx", "12:00"), x.get("league", "NFL")))

    if games:
        try:
            with open(cache_file, "w", encoding="utf-8") as f:
                json.dump(games, f, ensure_ascii=False, indent=2)
        except Exception:
            pass

    return games

if __name__ == "__main__":
    for d in ["20261109", "20261108", "20261107"]:
        c = os.path.join(DATA_DIR, f"football_schedule_{d}.json")
        if os.path.exists(c):
            os.remove(c)
        res = get_normalized_football_schedule(d, "ALL")
        print(f"NFL/NCAAF {d} sincronizado: {len(res)} juegos")
        for g in res[:4]:
            print(f"   [{g['league']}] {g['time_cdmx']} hs CDMX | {g['match']}")