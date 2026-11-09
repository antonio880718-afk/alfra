"""
nba_daily_tickets_engine.py - Generador de Boletos de Alto Rendimiento para Baloncesto (NBA y NCAAB).
"""
import os, sys
_dir = os.path.dirname(os.path.abspath(__file__))
if _dir not in sys.path:
    sys.path.insert(0, _dir)

from nba_data_api import get_normalized_bball_schedule
from nba_math_models_engine import compute_full_nba_game_data_engineering

def get_daily_nba_parlay(date_str: str = "20261109", league_filter: str = "ALL") -> list:
    """Retorna un boleto parlay de 8 a 10 selecciones de alta certeza."""
    games = get_normalized_bball_schedule(date_str, league_filter)
    picks = []
    for g in games:
        de = compute_full_nba_game_data_engineering(g)
        bp = de.get("best_pick")
        if bp and bp.get("prob_num", 0) >= 78.0:
            picks.append({
                "n": len(picks) + 1,
                "time": g.get("time_cdmx", "18:00"),
                "league": g.get("league", "NBA"),
                "match": g.get("match", ""),
                "pick": bp.get("pick", ""),
                "prob": bp.get("prob_num", 80.0),
                "odds": bp.get("odds_num", 1.25),
                "odds_str": bp.get("odds", "@1.25"),
                "ev": bp.get("ev", "+5.0%"),
                "stat_type": bp.get("stat_type", ""),
                "threshold": bp.get("threshold", 0.0),
                "direction": bp.get("direction", "OVER"),
                "player": bp.get("player", "")
            })
        if len(picks) >= 10:
            break
    return picks

def get_daily_nba_conservative(date_str: str = "20261109", league_filter: str = "ALL") -> list:
    all_p = get_daily_nba_parlay(date_str, league_filter)
    return [p for p in all_p if p.get("prob", 0) >= 81.0][:8]

def get_daily_nba_escalera_blocks(date_str: str = "20261109", league_filter: str = "ALL") -> dict:
    games = get_normalized_bball_schedule(date_str, league_filter)
    f1_picks, f2_picks, f3_picks = [], [], []

    for g in games:
        t = g.get("time_cdmx", "18:00")
        hh = int(t.split(":")[0]) if ":" in t else 18
        de = compute_full_nba_game_data_engineering(g)
        bp = de.get("best_pick")
        if not bp:
            continue

        item = {
            "time": t,
            "league": g.get("league", "NBA"),
            "match": g.get("match", ""),
            "pick": bp.get("pick", ""),
            "prob": bp.get("prob_num", 80.0),
            "odds": bp.get("odds_num", 1.25),
            "odds_str": bp.get("odds", "@1.25"),
            "stat_type": bp.get("stat_type", ""),
            "threshold": bp.get("threshold", 0.0),
            "direction": bp.get("direction", "OVER"),
            "player": bp.get("player", "")
        }

        if hh < 19 and len(f1_picks) < 2:
            item["phase"] = "F1 (Turno Temprano)"
            f1_picks.append(item)
        elif 19 <= hh < 21 and len(f2_picks) < 2:
            item["phase"] = "F2 (Turno Central)"
            f2_picks.append(item)
        elif hh >= 21 and len(f3_picks) < 2:
            item["phase"] = "F3 (Costa Oeste)"
            f3_picks.append(item)

    return {
        "fase1": f1_picks,
        "fase2": f2_picks,
        "fase3": f3_picks,
        "total_picks": len(f1_picks) + len(f2_picks) + len(f3_picks)
    }

if __name__ == "__main__":
    p = get_daily_nba_parlay("20261109", "ALL")
    print(f"Boleto Parlay Generado: {len(p)} selecciones")
    for item in p:
        print(f" #{item['n']} [{item['time']} | {item['league']}] {item['match']} -> {item['pick']} ({item['odds_str']})")