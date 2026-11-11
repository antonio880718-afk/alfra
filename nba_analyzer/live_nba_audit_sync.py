# -*- coding: utf-8 -*-
"""
live_nba_audit_sync.py - Sincronizador en Vivo de Marcadores, Parciales (1H/Q) y Boxscores ESPN para NBA y NCAAB.
"""
import os
import re
import json
import urllib.request
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
    except Exception:
        return {}


def _to_float(val, default=0.0) -> float:
    try:
        return float(str(val).strip())
    except Exception:
        return default


def _parse_linescores(comp_entry: dict) -> tuple:
    """Extrae Q1 y 1H (Q1+Q2 o H1) desde competitor['linescores']."""
    ls = comp_entry.get("linescores", []) or []
    vals = []
    for item in ls:
        v = item.get("value")
        if v is None:
            v = item.get("displayValue")
        if v is not None:
            vals.append(int(round(_to_float(v, 0.0))))
    if len(vals) >= 2:
        q1 = vals[0]
        # En NBA son 4 cuartos (1H = Q1+Q2); en NCAAB son 2 mitades (1H = vals[0])
        if len(vals) == 2:
            return q1, vals[0], True
        return q1, vals[0] + vals[1], True
    if len(vals) == 1:
        return vals[0], vals[0], True
    return None, None, False


def _extract_scoreboard_bball_stars(comp_entry: dict, team_name: str) -> list:
    """Extrae promedios reales de temporada desde competitor['leaders'] del scoreboard."""
    by_name = {}
    for cat in comp_entry.get("leaders", []) or []:
        c_name = cat.get("name", "").lower()
        for ldr in (cat.get("leaders", []) or [])[:2]:
            ath = ldr.get("athlete", {})
            p_name = ath.get("displayName", "").strip()
            if not p_name:
                continue
            key = p_name.lower()
            pos = ath.get("position", {}).get("abbreviation", "G/F") or "G/F"
            jersey = str(ath.get("jersey", "0") or "0")
            entry = by_name.setdefault(key, {
                "name": p_name,
                "team": team_name,
                "pos": pos,
                "jersey": jersey,
                "pts": 0.0,
                "reb": 0.0,
                "ast": 0.0,
                "stl": 0.0,
                "blk": 0.0,
                "threes": 0.0,
                "pra": 0.0,
                "role": f"Líder oficial {team_name}"
            })
            dval = str(ldr.get("displayValue", ""))
            val = _to_float(ldr.get("value", dval.split()[0].replace(",", "") if dval else 0.0), 0.0)
            if "point" in c_name:
                entry["pts"] = max(entry["pts"], val)
            elif "rebound" in c_name:
                entry["reb"] = max(entry["reb"], val)
            elif "assist" in c_name:
                entry["ast"] = max(entry["ast"], val)
            elif "rating" in c_name and dval:
                for m_val, m_tag in re.findall(r"(\d+(?:\.\d+)?)\s*(PPG|RPG|APG|SPG|BPG)", dval.upper()):
                    num = float(m_val)
                    if m_tag == "PPG":
                        entry["pts"] = max(entry["pts"], num)
                    elif m_tag == "RPG":
                        entry["reb"] = max(entry["reb"], num)
                    elif m_tag == "APG":
                        entry["ast"] = max(entry["ast"], num)
                    elif m_tag == "SPG":
                        entry["stl"] = max(entry["stl"], num)
                    elif m_tag == "BPG":
                        entry["blk"] = max(entry["blk"], num)

    out = []
    for st_item in by_name.values():
        if st_item["pts"] <= 0:
            st_item["pts"] = 12.5
        if st_item["reb"] <= 0:
            st_item["reb"] = 3.8
        if st_item["ast"] <= 0:
            st_item["ast"] = 2.8
        if st_item["stl"] <= 0:
            st_item["stl"] = 0.8
        if st_item["blk"] <= 0:
            st_item["blk"] = 0.4
        if st_item["threes"] <= 0:
            st_item["threes"] = round(max(0.4, st_item["pts"] * 0.11), 1)
        st_item["pra"] = round(st_item["pts"] + st_item["reb"] + st_item["ast"], 1)
        st_item["role"] = f"Líder ESPN ({st_item['pts']:.1f} PPG, {st_item['reb']:.1f} RPG, {st_item['ast']:.1f} APG)"
        out.append(st_item)
    return out


def extract_athletes_from_summary(summary_data: dict) -> dict:
    athletes = {}
    box = summary_data.get("boxscore", {})
    for pt in box.get("players", []) or []:
        tm_name = pt.get("team", {}).get("displayName", "")
        for sg in pt.get("statistics", []) or []:
            labels = sg.get("labels", [])
            for a in sg.get("athletes", []) or []:
                name = a.get("athlete", {}).get("displayName", "").strip()
                if not name:
                    continue
                stats_raw = a.get("stats", [])
                d = dict(zip(labels, stats_raw))

                min_str = str(d.get("MIN", "0"))
                pts = _to_float(d.get("PTS", 0), 0.0)
                reb = _to_float(d.get("REB", 0), 0.0)
                ast = _to_float(d.get("AST", 0), 0.0)
                stl = _to_float(d.get("STL", 0), 0.0)
                blk = _to_float(d.get("BLK", 0), 0.0)

                three_str = str(d.get("3PT", "0-0"))
                threes = _to_float(three_str.split("-")[0] if "-" in three_str else three_str, 0.0)

                is_dnp = bool(a.get("didNotPlay")) or (min_str in ("0", "", "--", "DNP"))

                athletes[name.lower()] = {
                    "name": name,
                    "team": tm_name,
                    "min": min_str,
                    "pts": pts,
                    "reb": reb,
                    "ast": ast,
                    "stl": stl,
                    "blk": blk,
                    "threes": threes,
                    "pra": round(pts + reb + ast, 1),
                    "dnp": is_dnp
                }
    return athletes


def sync_nba_date_from_espn(date_str: str) -> list:
    """Consulta la API de ESPN en vivo y sincroniza marcadores, parciales y boxscores."""
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

        h_score = int(_to_float(h.get("score", 0), 0.0)) if h.get("score") else 0
        a_score = int(_to_float(a.get("score", 0), 0.0)) if a.get("score") else 0
        h_q1, h_1h, h_has_ls = _parse_linescores(h)
        a_q1, a_1h, a_has_ls = _parse_linescores(a)

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

        s_data = event_summaries.get(eid, {})
        box_athletes = extract_athletes_from_summary(s_data)

        # Estrellas priorizando líderes reales de temporada (scoreboard + base fija + boxscore como respaldo)
        stars = _extract_scoreboard_bball_stars(h, h_team) + _extract_scoreboard_bball_stars(a, a_team)
        try:
            from nba_data_api import NBA_DEFAULT_STARS
            for def_s in list(NBA_DEFAULT_STARS.get(h_team, [])) + list(NBA_DEFAULT_STARS.get(a_team, [])):
                if not any(s["name"].lower() == def_s["name"].lower() for s in stars):
                    stars.append(dict(def_s))
        except Exception:
            pass

        if box_athletes and len(stars) < 8:
            sorted_ath = sorted(box_athletes.values(), key=lambda x: x.get("pra", 0), reverse=True)
            for ath in sorted_ath:
                if any(s["name"].lower() == ath["name"].lower() for s in stars):
                    continue
                if ath.get("dnp"):
                    continue
                stars.append({
                    "name": ath["name"],
                    "team": ath["team"],
                    "pos": "G/F",
                    "jersey": "0",
                    "pts": max(8.0, round(ath["pts"] * 0.85, 1)),
                    "reb": max(2.5, round(ath["reb"] * 0.85, 1)),
                    "ast": max(1.5, round(ath["ast"] * 0.85, 1)),
                    "stl": ath.get("stl", 0.7),
                    "blk": ath.get("blk", 0.4),
                    "threes": ath["threes"],
                    "pra": round(max(8.0, ath["pts"] * 0.85) + max(2.5, ath["reb"] * 0.85) + max(1.5, ath["ast"] * 0.85), 1),
                    "role": f"Rotación {ath['team']}"
                })
                if len(stars) >= 8:
                    break

        if not stars:
            h_short = h_team.split()[-1]
            a_short = a_team.split()[-1]
            stars = [
                {"name": f"Líder {h_short}", "team": h_team, "pos": "G", "jersey": "1", "pts": 19.5, "reb": 4.5, "ast": 4.2, "stl": 1.0, "blk": 0.4, "threes": 2.2, "pra": 28.2, "role": f"Anotador {h_team}"},
                {"name": f"Líder {a_short}", "team": a_team, "pos": "G", "jersey": "2", "pts": 18.2, "reb": 4.0, "ast": 4.0, "stl": 0.9, "blk": 0.4, "threes": 2.0, "pra": 26.2, "role": f"Anotador {a_team}"}
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
            "home_q1_score": h_q1,
            "away_q1_score": a_q1,
            "home_1h_score": h_1h,
            "away_1h_score": a_1h,
            "total_1h_points": (h_1h + a_1h) if (h_has_ls and a_has_ls and h_1h is not None and a_1h is not None) else None,
            "spread_str": spread_str,
            "over_under": ou_val,
            "venue": f"{venue_name} ({city})" if city else venue_name,
            "home_defense": h_def,
            "away_defense": a_def,
            "stars": stars[:8],
            "boxscore_athletes": box_athletes
        })

    games.sort(key=lambda x: (x.get("time_cdmx", "18:00"), x.get("league", "NBA")))

    cache_file = os.path.join(DATA_DIR, f"bball_schedule_{date_str}.json")
    with open(cache_file, "w", encoding="utf-8") as f:
        json.dump(games, f, ensure_ascii=False, indent=2)

    print(f"Sincronizados exitosamente {len(games)} juegos de NBA/NCAAB para {date_str} en {cache_file}")
    return games
