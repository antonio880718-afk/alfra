# -*- coding: utf-8 -*-
"""
live_nfl_audit_sync.py - Sincronizador en Vivo de Marcadores, Parciales (1H/Q) y Boxscores ESPN para NFL y NCAAF.
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
    except Exception:
        return {}


def _to_float(val, default=0.0) -> float:
    try:
        return float(str(val).strip())
    except Exception:
        return default


def _parse_linescores(comp_entry: dict) -> tuple:
    """Extrae Q1 y 1H (Q1+Q2) desde competitor['linescores']."""
    ls = comp_entry.get("linescores", []) or []
    vals = []
    for item in ls:
        v = item.get("value")
        if v is None:
            v = item.get("displayValue")
        if v is not None:
            vals.append(int(round(_to_float(v, 0.0))))
    if len(vals) >= 2:
        return vals[0], vals[0] + vals[1], True
    if len(vals) == 1:
        return vals[0], vals[0], True
    return None, None, False


def _games_played_from_competitor(comp_entry: dict) -> int:
    for rec in comp_entry.get("records", []) or []:
        if rec.get("type") in ("total", "overall", None) or not rec.get("type"):
            summary = str(rec.get("summary", ""))
            nums = [int(n) for n in re.findall(r"\d+", summary)]
            if len(nums) >= 2:
                gp = sum(nums[:3])
                if 1 <= gp <= 22:
                    return gp
    return 9


def _extract_scoreboard_football_stars(comp_entry: dict, team_name: str) -> list:
    """Extrae QB, RB y WR reales con promedios por juego desde competitor['leaders'] de ESPN."""
    gp = _games_played_from_competitor(comp_entry)
    stars = []
    seen = set()

    for cat in comp_entry.get("leaders", []) or []:
        c_name = cat.get("name", "").lower()
        for ldr in (cat.get("leaders", []) or [])[:1]:
            ath = ldr.get("athlete", {})
            p_name = ath.get("displayName", "").strip()
            if not p_name:
                continue
            dval = str(ldr.get("displayValue", ""))
            jersey = str(ath.get("jersey", "0") or "0")
            pos_raw = ath.get("position", {}).get("abbreviation", "")

            yds_m = re.search(r"(\d+(?:\.\d+)?)\s*YDS", dval.upper())
            td_m = re.search(r"(\d+)\s*TD", dval.upper())
            rec_m = re.search(r"(\d+)\s*REC", dval.upper())
            car_m = re.search(r"(\d+)\s*CAR", dval.upper())

            tot_yds = float(yds_m.group(1)) if yds_m else 0.0
            tot_tds = float(td_m.group(1)) if td_m else 0.0
            tot_rec = float(rec_m.group(1)) if rec_m else 0.0
            tot_car = float(car_m.group(1)) if car_m else 0.0

            # Estimar juegos reales si el récord no venía disponible
            est_gp = gp
            if not comp_entry.get("records"):
                if tot_car >= 10:
                    est_gp = max(2, min(11, round(tot_car / 14.0)))
                elif tot_rec >= 5:
                    est_gp = max(2, min(11, round(tot_rec / 5.0)))
                elif tot_yds > 250:
                    est_gp = max(2, min(11, round(tot_yds / 215.0)))

            per_g_yds = round(tot_yds / max(1, est_gp), 1)
            per_g_tds = round(tot_tds / max(1, est_gp), 2)
            per_g_rec = round(tot_rec / max(1, est_gp), 1)

            key = p_name.lower()
            if key in seen:
                existing = next((s for s in stars if s["name"].lower() == key), None)
                if existing and "rushing" in c_name:
                    existing["rush_yds"] = max(existing["rush_yds"], per_g_yds)
                    existing["anytime_td_pct"] = max(existing["anytime_td_pct"], min(78.0, round(30.0 + per_g_tds * 45.0, 1)))
                continue
            seen.add(key)

            if "passing" in c_name:
                stars.append({
                    "name": p_name,
                    "team": team_name,
                    "pos": pos_raw if pos_raw == "QB" else "QB",
                    "jersey": jersey,
                    "pass_yds": max(155.0, per_g_yds),
                    "pass_tds": max(1.1, per_g_tds),
                    "rush_yds": 15.0,
                    "rec_yds": 0.0,
                    "receptions": 0.0,
                    "anytime_td_pct": 22.0,
                    "role": f"QB Líder {team_name} ({per_g_yds:.1f} YDS/g, {per_g_tds:.1f} TD/g)"
                })
            elif "rushing" in c_name:
                stars.append({
                    "name": p_name,
                    "team": team_name,
                    "pos": "RB",
                    "jersey": jersey,
                    "pass_yds": 0.0,
                    "pass_tds": 0.0,
                    "rush_yds": max(48.0, per_g_yds),
                    "rec_yds": 14.0,
                    "receptions": 1.8,
                    "anytime_td_pct": max(42.0, min(80.0, round(34.0 + per_g_tds * 46.0, 1))),
                    "role": f"RB Líder {team_name} ({per_g_yds:.1f} YDS/g)"
                })
            elif "receiving" in c_name:
                stars.append({
                    "name": p_name,
                    "team": team_name,
                    "pos": pos_raw if pos_raw in ("WR", "TE") else "WR",
                    "jersey": jersey,
                    "pass_yds": 0.0,
                    "pass_tds": 0.0,
                    "rush_yds": 0.0,
                    "rec_yds": max(45.0, per_g_yds),
                    "receptions": max(3.2, per_g_rec),
                    "anytime_td_pct": max(38.0, min(74.0, round(30.0 + per_g_tds * 48.0, 1))),
                    "role": f"WR/TE Líder {team_name} ({per_g_yds:.1f} YDS/g, {per_g_rec:.1f} REC/g)"
                })
    return stars


def extract_athletes_from_nfl_summary(summary_data: dict) -> dict:
    athletes = {}
    box = summary_data.get("boxscore", {})
    for pt in box.get("players", []) or []:
        tm_name = pt.get("team", {}).get("displayName", "")
        for sg in pt.get("statistics", []) or []:
            cat = sg.get("name", "").lower()
            labels = sg.get("labels", [])
            for a in sg.get("athletes", []) or []:
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
                        "pass_comp": 0.0,
                        "pass_att": 0.0,
                        "rush_yds": 0.0,
                        "rush_tds": 0.0,
                        "rec_yds": 0.0,
                        "rec_tds": 0.0,
                        "receptions": 0.0,
                        "scrimmage_yds": 0.0,
                        "anytime_td": 0
                    }

                if "passing" in cat:
                    athletes[key]["pass_yds"] = _to_float(d.get("YDS", 0), athletes[key]["pass_yds"])
                    athletes[key]["pass_tds"] = _to_float(d.get("TD", 0), athletes[key]["pass_tds"])
                    athletes[key]["pass_int"] = _to_float(d.get("INT", 0), athletes[key]["pass_int"])
                    catt = str(d.get("C/ATT", ""))
                    if "/" in catt:
                        parts = catt.split("/")
                        athletes[key]["pass_comp"] = _to_float(parts[0], 0.0)
                        athletes[key]["pass_att"] = _to_float(parts[1], 0.0)
                elif "rushing" in cat:
                    athletes[key]["rush_yds"] = _to_float(d.get("YDS", 0), athletes[key]["rush_yds"])
                    tds = _to_float(d.get("TD", 0), 0.0)
                    athletes[key]["rush_tds"] = tds
                    if tds > 0:
                        athletes[key]["anytime_td"] += int(tds)
                elif "receiving" in cat:
                    athletes[key]["rec_yds"] = _to_float(d.get("YDS", 0), athletes[key]["rec_yds"])
                    athletes[key]["receptions"] = _to_float(d.get("REC", 0), athletes[key]["receptions"])
                    tds = _to_float(d.get("TD", 0), 0.0)
                    athletes[key]["rec_tds"] = tds
                    if tds > 0:
                        athletes[key]["anytime_td"] += int(tds)

    for v in athletes.values():
        v["scrimmage_yds"] = round(v["rush_yds"] + v["rec_yds"], 1)
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

        h_score = int(_to_float(h.get("score", 0), 0.0)) if h.get("score") else 0
        a_score = int(_to_float(a.get("score", 0), 0.0)) if a.get("score") else 0
        h_q1, h_1h, h_has_ls = _parse_linescores(h)
        a_q1, a_1h, a_has_ls = _parse_linescores(a)

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

        # Estrellas priorizando líderes reales de temporada (scoreboard + defaults + boxscore con pos real)
        stars = _extract_scoreboard_football_stars(h, h_team) + _extract_scoreboard_football_stars(a, a_team)
        try:
            from nfl_data_api import NFL_DEFAULT_STARS
            for def_s in list(NFL_DEFAULT_STARS.get(h_team, [])) + list(NFL_DEFAULT_STARS.get(a_team, [])):
                if not any(s["name"].lower() == def_s["name"].lower() for s in stars):
                    s_copy = dict(def_s)
                    s_copy.setdefault("team", h_team if def_s in NFL_DEFAULT_STARS.get(h_team, []) else a_team)
                    s_copy.setdefault("receptions", 4.5 if s_copy.get("pos") in ("WR", "TE") else 2.0)
                    stars.append(s_copy)
        except Exception:
            pass

        if box_athletes and len(stars) < 8:
            for ath in box_athletes.values():
                if any(s["name"].lower() == ath["name"].lower() for s in stars):
                    continue
                if ath["pass_yds"] < 50 and ath["rush_yds"] < 25 and ath["rec_yds"] < 25:
                    continue
                if ath["pass_yds"] >= 40:
                    real_pos = "QB"
                    role_desc = f"QB {ath['team']} ({ath['pass_yds']:.0f} YDS Pass, {int(ath['pass_tds'])} TD)"
                elif ath["rush_yds"] >= ath["rec_yds"]:
                    real_pos = "RB"
                    role_desc = f"RB {ath['team']} ({ath['rush_yds']:.0f} YDS Rush)"
                else:
                    real_pos = "WR"
                    role_desc = f"WR/TE {ath['team']} ({ath['rec_yds']:.0f} YDS Rec)"
                stars.append({
                    "name": ath["name"],
                    "team": ath["team"],
                    "pos": real_pos,
                    "jersey": "0",
                    "pass_yds": max(150.0, round(ath["pass_yds"] * 0.88, 1)) if real_pos == "QB" else 0.0,
                    "pass_tds": max(1.0, round(ath["pass_tds"] * 0.85, 1)) if real_pos == "QB" else 0.0,
                    "rush_yds": max(35.0, round(ath["rush_yds"] * 0.85, 1)) if ath["rush_yds"] > 15 else 0.0,
                    "rec_yds": max(35.0, round(ath["rec_yds"] * 0.85, 1)) if ath["rec_yds"] > 15 else 0.0,
                    "receptions": max(2.5, round(ath.get("receptions", 3.0) * 0.85, 1)) if ath["rec_yds"] > 15 else 0.0,
                    "anytime_td_pct": 58.0 if ath["anytime_td"] > 0 else 36.0,
                    "role": role_desc
                })
                if len(stars) >= 10:
                    break

        if not stars:
            h_short = h_team.split()[-1]
            a_short = a_team.split()[-1]
            stars = [
                {"name": f"QB {h_short}", "team": h_team, "pos": "QB", "jersey": "1", "pass_yds": 235.0, "pass_tds": 1.6, "rush_yds": 12.0, "rec_yds": 0.0, "receptions": 0.0, "anytime_td_pct": 22.0, "role": f"QB Titular {h_team}"},
                {"name": f"RB {h_short}", "team": h_team, "pos": "RB", "jersey": "24", "pass_yds": 0.0, "pass_tds": 0.0, "rush_yds": 68.0, "rec_yds": 16.0, "receptions": 2.0, "anytime_td_pct": 54.0, "role": f"RB #1 {h_team}"},
                {"name": f"QB {a_short}", "team": a_team, "pos": "QB", "jersey": "2", "pass_yds": 220.0, "pass_tds": 1.4, "rush_yds": 8.0, "rec_yds": 0.0, "receptions": 0.0, "anytime_td_pct": 20.0, "role": f"QB Titular {a_team}"},
                {"name": f"RB {a_short}", "team": a_team, "pos": "RB", "jersey": "26", "pass_yds": 0.0, "pass_tds": 0.0, "rush_yds": 64.0, "rec_yds": 14.0, "receptions": 1.8, "anytime_td_pct": 50.0, "role": f"RB #1 {a_team}"}
            ]

        try:
            from nfl_data_api import NFL_DEFENSE_PROFILES
            h_def = NFL_DEFENSE_PROFILES.get(h_team, {"pass_def_rank": 16, "pass_yds_allowed": 225.0, "rush_def_rank": 16, "rush_yds_allowed": 115.0, "pts_allowed": 22.0, "style": "Defensa Promedio"})
            a_def = NFL_DEFENSE_PROFILES.get(a_team, {"pass_def_rank": 17, "pass_yds_allowed": 228.0, "rush_def_rank": 17, "rush_yds_allowed": 118.0, "pts_allowed": 23.0, "style": "Defensa Promedio"})
        except Exception:
            h_def = {"pass_def_rank": 16, "pass_yds_allowed": 225.0, "rush_def_rank": 16, "rush_yds_allowed": 115.0, "pts_allowed": 22.0, "style": "Defensa Promedio"}
            a_def = {"pass_def_rank": 17, "pass_yds_allowed": 228.0, "rush_def_rank": 17, "rush_yds_allowed": 118.0, "pts_allowed": 23.0, "style": "Defensa Promedio"}

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
            "is_dome": is_dome,
            "venue": venue_name,
            "home_defense": h_def,
            "away_defense": a_def,
            "stars": stars[:10],
            "boxscore_athletes": box_athletes
        })

    games.sort(key=lambda x: (x.get("time_cdmx", "18:00"), x.get("league", "NFL")))

    cache_file = os.path.join(DATA_DIR, f"football_schedule_{date_str}.json")
    with open(cache_file, "w", encoding="utf-8") as f:
        json.dump(games, f, ensure_ascii=False, indent=2)

    print(f"Sincronizados exitosamente {len(games)} juegos de NFL/NCAAF para {date_str} en {cache_file}")
    return games
