"""
nfl_daily_tickets_engine.py - Generador de Boletos para Fútbol Americano (NFL y NCAAF).
Construye:
1. Boleto Parlay Oficial (Sunday Slate / Saturday NCAAF) (30x - 60x)
2. Boleto Conservador 11x
3. Reto Escalera 3 Fases Secuenciales (12:00 PM -> 15:25 PM -> 19:15 PM)
"""
import os, sys
_dir = os.path.dirname(os.path.abspath(__file__))
if _dir not in sys.path:
    sys.path.insert(0, _dir)

from nfl_data_api import get_normalized_football_schedule
from nfl_math_models_engine import compute_full_nfl_game_data_engineering

def get_daily_nfl_parlay(date_str: str = "20261109", league_filter: str = "ALL") -> list:
    games = get_normalized_football_schedule(date_str, league_filter)
    picks = []
    for g in games:
        de = compute_full_nfl_game_data_engineering(g)
        bp = de.get("best_pick")
        if bp and bp.get("prob_num", 0) >= 78.0:
            picks.append({
                "n": len(picks) + 1,
                "time": g.get("time_cdmx", "12:00"),
                "league": g.get("league", "NFL"),
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

def get_daily_nfl_conservative(date_str: str = "20261109", league_filter: str = "ALL") -> list:
    all_p = get_daily_nfl_parlay(date_str, league_filter)
    return [p for p in all_p if p.get("prob", 0) >= 81.0][:8]

def get_daily_nfl_escalera_blocks(date_str: str = "20261109", league_filter: str = "ALL") -> dict:
    games = get_normalized_football_schedule(date_str, league_filter)
    f1_picks, f2_picks, f3_picks = [], [], []

    for g in games:
        t = g.get("time_cdmx", "12:00")
        hh = int(t.split(":")[0]) if ":" in t else 12
        de = compute_full_nfl_game_data_engineering(g)
        bp = de.get("best_pick")
        if not bp:
            continue

        item = {
            "time": t,
            "league": g.get("league", "NFL"),
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

        if hh < 15 and len(f1_picks) < 2:
            item["phase"] = "F1 (Ventana Temprana 12:00 PM)"
            f1_picks.append(item)
        elif 15 <= hh < 18 and len(f2_picks) < 2:
            item["phase"] = "F2 (Ventana Vespertina 3:25 PM)"
            f2_picks.append(item)
        elif hh >= 18 and len(f3_picks) < 2:
            item["phase"] = "F3 (Juego Nocturno SNF/MNF)"
            f3_picks.append(item)

    return {
        "fase1": f1_picks,
        "fase2": f2_picks,
        "fase3": f3_picks,
        "total_picks": len(f1_picks) + len(f2_picks) + len(f3_picks)
    }

if __name__ == "__main__":
    p = get_daily_nfl_parlay("20261108", "ALL")
    print(f"Boleto Parlay NFL Domingo: {len(p)} selecciones")
    for item in p:
        print(f" #{item['n']} [{item['time']} | {item['league']}] {item['match']} -> {item['pick']} ({item['odds_str']})")