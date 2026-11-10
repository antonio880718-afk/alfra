"""
nfl_self_audit_engine.py - Motor de Auditoría Empírica Automática para NFL y NCAAF.
Coteja cada pick individual contra el boxscore oficial de ESPN con Regla VOID por inactividad.
"""
import os, sys, json
_dir = os.path.dirname(os.path.abspath(__file__))
if _dir not in sys.path:
    sys.path.insert(0, _dir)

from nfl_data_api import get_normalized_football_schedule

def audit_individual_nfl_pick(pick_item: dict, game_info: dict = None, date_str: str = "20261109") -> dict:
    if not game_info:
        sched = get_normalized_football_schedule(date_str)
        m_title = pick_item.get("match", "")
        game_info = next((g for g in sched if g.get("match") == m_title), {})

    status = game_info.get("status", "PROGRAMADO")
    if "FINAL" not in status:
        return {
            "outcome": "PENDING",
            "stat_actual": f"Por jugar ({game_info.get('time_cdmx', '18:00')} hs)",
            "match_status": status
        }

    stat_type = pick_item.get("stat_type", "")
    thresh = float(pick_item.get("threshold", 0.0))
    direction = pick_item.get("direction", "OVER")
    h_score = int(game_info.get("home_score", 0))
    a_score = int(game_info.get("away_score", 0))
    tot_pts = h_score + a_score

    # 1. TOTALES DE PUNTOS
    if stat_type == "total_points":
        hit = (tot_pts > thresh) if direction == "OVER" else (tot_pts < thresh)
        return {
            "outcome": "HIT" if hit else "MISS",
            "stat_actual": f"Puntos Reales: {tot_pts} ({a_score}-{h_score})",
            "match_status": status
        }

    # 2. HÁNDICAPS
    if "spread" in stat_type:
        diff = (h_score - a_score) if "home" in stat_type else (a_score - h_score)
        hit = (diff + thresh) > 0
        return {
            "outcome": "HIT" if hit else "MISS",
            "stat_actual": f"Margen Real: {diff:+d} pts ({a_score}-{h_score})",
            "match_status": status
        }

    # 3. PLAYER PROPS (Cotejo contra Boxscore Oficial de ESPN)
    player_name = pick_item.get("player", "")
    box_ath = game_info.get("boxscore_athletes", {})
    
    match_ath = None
    p_lower = player_name.lower().strip()
    for k, v in box_ath.items():
        if p_lower == k or p_lower in k or k in p_lower or (len(p_lower.split()) > 1 and p_lower.split()[-1] in k):
            match_ath = v
            break

    if match_ath:
        pass_yds = match_ath.get("pass_yds", 0.0)
        pass_tds = match_ath.get("pass_tds", 0.0)
        rush_yds = match_ath.get("rush_yds", 0.0)
        rec_yds = match_ath.get("rec_yds", 0.0)
        anytime_td = match_ath.get("anytime_td", 0)

        actual_val = 0.0
        unit = "Yardas"
        
        if "pass_yds" in stat_type:
            actual_val = pass_yds
            unit = "YDS por Pase"
        elif "pass_tds" in stat_type:
            actual_val = pass_tds
            unit = "Pases de TD"
        elif "rush_yds" in stat_type:
            actual_val = rush_yds
            unit = "YDS Terrestres"
        elif "rec_yds" in stat_type:
            actual_val = rec_yds
            unit = "YDS por Recepción"
        elif "anytime_td" in stat_type:
            actual_val = float(anytime_td)
            unit = "TD Anotados"
            hit = (actual_val >= 1.0)
            return {
                "outcome": "HIT" if hit else "MISS",
                "stat_actual": f"{match_ath.get('name', player_name)}: {int(actual_val)} TD en el partido",
                "match_status": status
            }

        hit = (actual_val > thresh) if direction == "OVER" else (actual_val < thresh)
        res_str = f"{match_ath.get('name', player_name)}: {actual_val:g} {unit} oficiales (Lín {thresh:g})"
        return {
            "outcome": "HIT" if hit else "MISS",
            "stat_actual": res_str,
            "match_status": status
        }

    # Si el partido no ha finalizado
    if "FINAL" not in status:
        return {
            "outcome": "IN_PROGRESS" if ("EN VIVO" in status or "CUARTO" in status or "1Q" in status or "2Q" in status or "3Q" in status or "4Q" in status) else "PENDING",
            "stat_actual": f"{player_name}: En juego / Por iniciar",
            "match_status": status
        }

    # Si finalizó y el jugador no tuvo snaps o no participó:
    # Regla Bookmaker Oficial (Garantía Playdoit / Altenar / Bet365: Inactivo/0 snaps = VOID Cuota 1.00)
    return {
        "outcome": "VOID",
        "stat_actual": f"{player_name}: Inactivo / 0 snaps oficiales (Protección VOID 1.00)",
        "match_status": status
    }

if __name__ == "__main__":
    t_pick = {"match": "Buffalo Bills @ Minnesota Vikings", "stat_type": "rb_rush_yds", "player": "James Cook III", "threshold": 73.5, "direction": "OVER"}
    with open("nfl_analyzer/data/football_schedule_20261109.json", encoding="utf-8") as f:
        t_game = json.load(f)[0]
    res = audit_individual_nfl_pick(t_pick, t_game)
    print("Test NFL Audit:", res)
