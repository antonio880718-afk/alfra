"""
nfl_daily_tickets_engine.py - Generador de Boletos de Alto Rendimiento para Fútbol Americano (NFL y NCAAF).
Preserva el DOSSIER COMPLETO DE INTELIGENCIA (promedios, defensa rival, +EV, colchón y justificación).
"""
import os, sys
_dir = os.path.dirname(os.path.abspath(__file__))
if _dir not in sys.path:
    sys.path.insert(0, _dir)

from nfl_data_api import get_normalized_football_schedule
from nfl_math_models_engine import compute_full_nfl_game_data_engineering

def get_daily_nfl_parlay(date_str: str = None, league_filter: str = "ALL") -> list:
    games = get_normalized_football_schedule(date_str, league_filter)
    picks = []
    for g in games:
        de = compute_full_nfl_game_data_engineering(g)
        bp = de.get("best_pick")
        if bp and bp.get("prob_num", 0) >= 78.0:
            pick_item = dict(bp)
            pick_item.update({
                "n": len(picks) + 1,
                "time": g.get("time_cdmx", "12:00"),
                "league": g.get("league", "NFL"),
                "match": g.get("match", ""),
                "prob": bp.get("prob_num", 80.0),
                "odds_str": bp.get("odds", "@1.25"),
                "venue": g.get("venue", "Estadio Oficial")
            })
            picks.append(pick_item)
        if len(picks) >= 10:
            break
    return picks

def get_daily_nfl_conservative(date_str: str = None, league_filter: str = "ALL") -> list:
    all_p = get_daily_nfl_parlay(date_str, league_filter)
    return [p for p in all_p if p.get("prob", 0) >= 81.0][:8]

def get_daily_nfl_escalera_blocks(date_str: str = None, league_filter: str = "ALL") -> dict:
    games = get_normalized_football_schedule(date_str, league_filter)
    f1_picks, f2_picks, f3_picks = [], [], []

    for g in games:
        t = g.get("time_cdmx", "12:00")
        hh = int(t.split(":")[0]) if ":" in t else 12
        de = compute_full_nfl_game_data_engineering(g)
        bp = de.get("best_pick")
        if not bp:
            continue

        item = dict(bp)
        item.update({
            "time": t,
            "league": g.get("league", "NFL"),
            "match": g.get("match", ""),
            "prob": bp.get("prob_num", 80.0),
            "odds_str": bp.get("odds", "@1.25"),
            "venue": g.get("venue", "Estadio Oficial")
        })

        if hh < 15 and len(f1_picks) < 2:
            item["phase"] = "F1 (Turno Mediodía)"
            f1_picks.append(item)
        elif 15 <= hh < 19 and len(f2_picks) < 2:
            item["phase"] = "F2 (Turno Tarde)"
            f2_picks.append(item)
        elif hh >= 19 and len(f3_picks) < 2:
            item["phase"] = "F3 (Horario Estelar / Prime Time)"
            f3_picks.append(item)

    return {
        "fase1": f1_picks,
        "fase2": f2_picks,
        "fase3": f3_picks,
        "total_picks": len(f1_picks) + len(f2_picks) + len(f3_picks)
    }
