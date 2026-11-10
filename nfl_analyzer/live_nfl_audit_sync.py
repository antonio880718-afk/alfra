"""
live_nfl_audit_sync.py - Sincronizador en Vivo de Marcadores y Boxscores de ESPN para NFL y NCAAF.
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
    "NFL": {
        "scoreboard": "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard",
        "sport": "football",
        "league": "nfl"
    },
    "NCAAF": {
        "scoreboard": "https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard",
        "sport": "football",
        "league": "college-football"
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

def extract_athletes_from_nfl_summary(summary_data: dict) -> dict:
    athletes = {}
    box = summary_data.get("boxscore", {})
    for pt in box.get("players", []):
        tm_name = pt.get("team", {}).get("displayName", "")
        for sg in pt.get("statistics", []):
            cat = sg.get("name", "").lower()
            labels = sg.get("labels", [])
            for a in sg.get("athletes", []):
                name = a.get("athlete", {}).get("displayName", "").strip()
                if not name:
                    continue
                stats_raw = a.get("stats", [])
                d = dict(zip(labels, stats_raw))
                key = name.lower()
                
                if key not in athletes:
                    athletes[key] = {
                        "name": name,
                        "team": tm_name,
                        "pass_yds": 0.0,
                        "pass_tds": 0.0,
                        "pass_int": 0.0,
                        "rush_yds": 0.0,
                        "rush_tds": 0.0,
                        "rec_yds": 0.0,
                        "rec_tds": 0.0,
                        "receptions": 0.0,
                        "anytime_td": 0
                    }
                
                if "passing" in cat:
                    try:
                        athletes[key]["pass_yds"] = float(d.get("YDS", 0))
                    except Exception:
                        pass
                    try:
                        athletes[key]["pass_tds"] = float(d.get("TD", 0))
                    except Exception:
                        pass
                    try:
                        athletes[key]["pass_int"] = float(d.get("INT", 0))
                    except Exception:
                        pass
                elif "rushing" in cat:
                    try:
                        athletes[key]["rush_yds"] = float(d.get("YDS", 0))
                    except Exception:
                        pass
                    try:
                        tds = float(d.get("TD", 0))
                        athletes[key]["rush_tds"] = tds
                        if tds > 0:
                            athletes[key]["anytime_td"] += int(tds)
                    except Exception:
                        pass
                elif "receiving" in cat:
                    try:
                        athletes[key]["rec_yds"] = float(d.get("YDS", 0))
                    except Exception:
                        pass
                    try:
                        athletes[key]["receptions"] = float(d.get("REC", 0))
                    except Exception:
                        pass
                    try:
                        tds = float(d.get("TD", 0))
                        athletes[key]["rec_tds"] = tds
                        if tds > 0:
                            athletes[key]["anytime_td"] += int(tds)
                    except Exception:
                        pass
    return athletes

def sync_nfl_date_from_espn(date_str: str) -> list:
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
        print(f"No events found for NFL/NCAAF on {date_str}")
        return []

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
        ou_val = float(odds_arr[0].get("overUnder", 46.5 if l_key == "NFL" else 54.5)) if odds_arr and odds_arr[0].get("overUnder") else (46.5 if l_key == "NFL" else 54.5)

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

        venue_name = comp.get("venue", {}).get("fullName", "Estadio Oficial")
        is_dome = comp.get("venue", {}).get("indoor", False)

        s_data = event_summaries.get(eid, {})
        box_athletes = extract_athletes_from_nfl_summary(s_data)

        stars = []
        if box_athletes:
            # Pick top passers, rushers, receivers
            for ath in box_athletes.values():
                if ath["pass_yds"] >= 50 or ath["rush_yds"] >= 30 or ath["rec_yds"] >= 30:
                    role_desc = f"{ath['team']}: "
                    if ath["pass_yds"] > 0:
                        role_desc += f"{ath['pass_yds']} YDS Pass, {int(ath['pass_tds'])} TD"
                    elif ath["rush_yds"] > 0:
                        role_desc += f"{ath['rush_yds']} YDS Rush"
                    elif ath["rec_yds"] > 0:
                        role_desc += f"{ath['rec_yds']} YDS Rec"
                    stars.append({
                        "name": ath["name"],
                        "team": ath["team"],
                        "pos": "QB/RB/WR",
                        "jersey": "0",
                        "pass_yds": ath["pass_yds"],
                        "pass_tds": ath["pass_tds"],
                        "rush_yds": ath["rush_yds"],
                        "rec_yds": ath["rec_yds"],
                        "anytime_td_pct": 60.0 if ath["anytime_td"] > 0 else 25.0,
                        "role": role_desc
                    })

        if not stars:
            try:
                from nfl_data_api import NFL_DEFAULT_STARS
                stars = list(NFL_DEFAULT_STARS.get(h_team, [])) + list(NFL_DEFAULT_STARS.get(a_team, []))
            except Exception:
                stars = []

        if not stars:
            h_short = h_team.split()[-1]
            a_short = a_team.split()[-1]
            stars = [
                {"name": f"QB {h_short}", "pos": "QB", "jersey": "1", "pass_yds": 235.0, "pass_tds": 1.6, "rush_yds": 12.0, "rec_yds": 0.0, "anytime_td_pct": 20.0, "role": f"QB Titular {h_team}"},
                {"name": f"QB {a_short}", "pos": "QB", "jersey": "2", "pass_yds": 220.0, "pass_tds": 1.4, "rush_yds": 8.0, "rec_yds": 0.0, "anytime_td_pct": 18.0, "role": f"QB Titular {a_team}"}
            ]

        try:
            from nfl_data_api import NFL_DEFENSE_PROFILES
            h_def = NFL_DEFENSE_PROFILES.get(h_team, {"def_rank": 16, "pass_yds_allowed": 225.0, "rush_yds_allowed": 115.0, "pts_allowed": 22.0, "style": "Defensa Promedio"})
            a_def = NFL_DEFENSE_PROFILES.get(a_team, {"def_rank": 17, "pass_yds_allowed": 228.0, "rush_yds_allowed": 118.0, "pts_allowed": 23.0, "style": "Defensa Promedio"})
        except Exception:
            h_def = {"def_rank": 16, "pass_yds_allowed": 225.0, "rush_yds_allowed": 115.0, "pts_allowed": 22.0, "style": "Defensa Promedio"}
            a_def = {"def_rank": 17, "pass_yds_allowed": 228.0, "rush_yds_allowed": 118.0, "pts_allowed": 23.0, "style": "Defensa Promedio"}

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
            "is_dome": is_dome,
            "venue": venue_name,
            "home_defense": h_def,
            "away_defense": a_def,
            "stars": stars,
            "boxscore_athletes": box_athletes
        })

    games.sort(key=lambda x: (x.get("time_cdmx", "18:00"), x.get("league", "NFL")))

    cache_file = os.path.join(DATA_DIR, f"football_schedule_{date_str}.json")
    with open(cache_file, "w", encoding="utf-8") as f:
        json.dump(games, f, ensure_ascii=False, indent=2)

    print(f"Sincronizados exitosamente {len(games)} juegos de NFL/NCAAF para {date_str} en {cache_file}")
    return games

if __name__ == "__main__":
    for d in ["20261109", "20261110"]:
        res = sync_nfl_date_from_espn(d)
        print(f"Fecha {d}: {len(res)} juegos actualizados.")
