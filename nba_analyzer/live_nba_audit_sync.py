"""
live_nba_audit_sync.py - Sincronizador en Vivo de Marcadores y Boxscores de ESPN para NBA y NCAAB.
"""
import os, sys, json, urllib.request
from datetime import datetime, timezone, timedelta
from concurrent.futures import ThreadPoolExecutor

CDMX_TZ = timezone(timedelta(hours=-6))
DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
os.makedirs(DATA_DIR, exist_ok=True)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

LEAGUE_CONFIGS = {
    "NBA": {
        "scoreboard": "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard",
        "sport": "basketball",
        "league": "nba"
    },
    "NCAAB": {
        "scoreboard": "https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard",
        "sport": "basketball",
        "league": "mens-college-basketball"
    }
}

def fetch_espn_summary(event_id: str, sport: str, league: str) -> dict:
    url = f"https://site.api.espn.com/apis/site/v2/sports/{sport}/{league}/summary?event={event_id}"
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=10) as r:
            return json.loads(r.read().decode("utf-8"))
    except Exception as e:
        return {}

def extract_athletes_from_summary(summary_data: dict) -> dict:
    athletes = {}
    box = summary_data.get("boxscore", {})
    for pt in box.get("players", []):
        tm_name = pt.get("team", {}).get("displayName", "")
        for sg in pt.get("statistics", []):
            labels = sg.get("labels", [])
            for a in sg.get("athletes", []):
                name = a.get("athlete", {}).get("displayName", "").strip()
                if not name:
                    continue
                stats_raw = a.get("stats", [])
                d = dict(zip(labels, stats_raw))
                
                min_str = str(d.get("MIN", "0"))
                try:
                    pts = float(d.get("PTS", 0))
                except Exception:
                    pts = 0.0
                try:
                    reb = float(d.get("REB", 0))
                except Exception:
                    reb = 0.0
                try:
                    ast = float(d.get("AST", 0))
                except Exception:
                    ast = 0.0
                
                three_str = str(d.get("3PT", "0-0"))
                try:
                    threes = float(three_str.split("-")[0]) if "-" in three_str else float(three_str)
                except Exception:
                    threes = 0.0
                
                is_dnp = (min_str == "0" or min_str == "" or min_str == "--" or "DNP" in str(d))
                
                athletes[name.lower()] = {
                    "name": name,
                    "team": tm_name,
                    "min": min_str,
                    "pts": pts,
                    "reb": reb,
                    "ast": ast,
                    "threes": threes,
                    "pra": round(pts + reb + ast, 1),
                    "dnp": is_dnp
                }
    return athletes

def sync_nba_date_from_espn(date_str: str) -> list:
    """Consulta la API de ESPN en vivo y sincroniza marcadores y boxscores."""
    all_events = []
    
    for l_key, conf in LEAGUE_CONFIGS.items():
        url = f"{conf['scoreboard']}?dates={date_str}"
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=10) as r:
                data = json.loads(r.read().decode("utf-8"))
                for ev in data.get("events", []):
                    all_events.append((l_key, conf, ev))
        except Exception as e:
            print(f"Error fetching {l_key} {date_str}: {e}")
            
    if not all_events:
        print(f"No events found for {date_str}")
        return []

    # Fetch summaries in parallel
    event_summaries = {}
    with ThreadPoolExecutor(max_workers=8) as ex:
        futures = {
            ex.submit(fetch_espn_summary, ev.get("id"), conf["sport"], conf["league"]): ev.get("id")
            for l_key, conf, ev in all_events
        }
        for f in futures:
            eid = futures[f]
            try:
                event_summaries[eid] = f.result()
            except Exception:
                event_summaries[eid] = {}

    games = []
    for l_key, conf, e in all_events:
        eid = e.get("id", "")
        comp = e.get("competitions", [{}])[0]
        competitors = comp.get("competitors", [])
        h = next((c for c in competitors if c.get("homeAway") == "home"), {})
        a = next((c for c in competitors if c.get("homeAway") == "away"), {})

        h_team = h.get("team", {}).get("displayName", "Home Team")
        a_team = a.get("team", {}).get("displayName", "Away Team")
        
        try:
            h_score = int(h.get("score", 0)) if h.get("score") else 0
        except Exception:
            h_score = 0
        try:
            a_score = int(a.get("score", 0)) if a.get("score") else 0
        except Exception:
            a_score = 0

        odds_arr = comp.get("odds", [])
        spread_str = odds_arr[0].get("details", "") if odds_arr else ""
        ou_val = float(odds_arr[0].get("overUnder", 226.5 if l_key == "NBA" else 145.5)) if odds_arr and odds_arr[0].get("overUnder") else (226.5 if l_key == "NBA" else 145.5)

        status_obj = comp.get("status", {}).get("type", {})
        status_desc = status_obj.get("description", "Scheduled")
        is_final = "Final" in status_desc or status_obj.get("completed", False)
        is_in_progress = "In Progress" in status_desc or "Halftime" in status_desc or status_obj.get("state") == "in"

        dt_raw = comp.get("date", "")
        time_cdmx = "18:00"
        if dt_raw:
            try:
                utc_dt = datetime.fromisoformat(dt_raw.replace("Z", "+00:00"))
                cdmx_dt = utc_dt.astimezone(CDMX_TZ)
                time_cdmx = cdmx_dt.strftime("%H:%M")
            except Exception:
                pass

        venue_name = comp.get("venue", {}).get("fullName", "Arena Oficial")
        city = comp.get("venue", {}).get("address", {}).get("city", "")

        # Summary boxscore athletes
        s_data = event_summaries.get(eid, {})
        box_athletes = extract_athletes_from_summary(s_data)

        # Build stars from boxscore athletes or defaults
        stars = []
        if box_athletes:
            # Sort by PRA descending to find stars
            sorted_ath = sorted(box_athletes.values(), key=lambda x: x.get("pra", 0), reverse=True)
            for ath in sorted_ath[:8]:
                stars.append({
                    "name": ath["name"],
                    "team": ath["team"],
                    "pos": "G/F",
                    "jersey": "0",
                    "pts": ath["pts"],
                    "reb": ath["reb"],
                    "ast": ath["ast"],
                    "threes": ath["threes"],
                    "pra": ath["pra"],
                    "role": f"Líder {ath['team']} ({ath['pts']} PTS, {ath['reb']} REB, {ath['ast']} AST)"
                })
        
        # If no athletes from summary, load defaults from nba_data_api
        if not stars:
            try:
                from nba_data_api import NBA_DEFAULT_STARS
                stars = list(NBA_DEFAULT_STARS.get(h_team, [])) + list(NBA_DEFAULT_STARS.get(a_team, []))
            except Exception:
                stars = []

        if not stars:
            h_short = h_team.split()[-1]
            a_short = a_team.split()[-1]
            stars = [
                {"name": f"Líder {h_short}", "pos": "G", "jersey": "1", "pts": 19.5, "reb": 4.5, "ast": 4.2, "threes": 2.2, "pra": 28.2, "role": f"Anotador {h_team}"},
                {"name": f"Líder {a_short}", "pos": "G", "jersey": "2", "pts": 18.2, "reb": 4.0, "ast": 4.0, "threes": 2.0, "pra": 26.2, "role": f"Anotador {a_team}"}
            ]

        try:
            from nba_data_api import NBA_DEFENSE_PROFILES
            h_def = NBA_DEFENSE_PROFILES.get(h_team, {"def_rank": 15, "pts_allowed": 113.5, "pace": 100.0, "style": "Defensa Promedio"})
            a_def = NBA_DEFENSE_PROFILES.get(a_team, {"def_rank": 16, "pts_allowed": 114.0, "pace": 100.0, "style": "Defensa Promedio"})
        except Exception:
            h_def = {"def_rank": 15, "pts_allowed": 113.5, "pace": 100.0, "style": "Defensa Promedio"}
            a_def = {"def_rank": 16, "pts_allowed": 114.0, "pace": 100.0, "style": "Defensa Promedio"}

        status_str = "FINALIZADO" if is_final else ("EN JUEGO" if is_in_progress else "PROGRAMADO")
        score_str = f"{a_score} - {h_score}" if (h_score > 0 or a_score > 0) else "vs"

        games.append({
            "id": eid,
            "league": l_key,
            "match": f"{a_team} @ {h_team}",
            "home": h_team,
            "away": a_team,
            "time_cdmx": time_cdmx,
            "status": status_str,
            "score": score_str,
            "home_score": h_score,
            "away_score": a_score,
            "total_points": h_score + a_score,
            "spread_str": spread_str,
            "over_under": ou_val,
            "venue": f"{venue_name} ({city})" if city else venue_name,
            "home_defense": h_def,
            "away_defense": a_def,
            "stars": stars,
            "boxscore_athletes": box_athletes
        })

    games.sort(key=lambda x: (x.get("time_cdmx", "18:00"), x.get("league", "NBA")))

    cache_file = os.path.join(DATA_DIR, f"bball_schedule_{date_str}.json")
    with open(cache_file, "w", encoding="utf-8") as f:
        json.dump(games, f, ensure_ascii=False, indent=2)

    print(f"Sincronizados exitosamente {len(games)} juegos de NBA/NCAAB para {date_str} en {cache_file}")
    return games

if __name__ == "__main__":
    for d in ["20261109", "20261110"]:
        res = sync_nba_date_from_espn(d)
        print(f"Fecha {d}: {len(res)} juegos actualizados.")
