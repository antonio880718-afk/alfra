"""
nba_self_audit_engine.py - Motor de Auditoría Empírica Automática para NBA y NCAAB.
Coteja cada pick individual contra el boxscore oficial de ESPN con Regla VOID por DNP (0 minutos).
"""
import os, sys, json
_dir = os.path.dirname(os.path.abspath(__file__))
if _dir not in sys.path:
    sys.path.insert(0, _dir)

from nba_data_api import get_normalized_bball_schedule

def audit_individual_nba_pick(pick_item: dict, game_info: dict = None, date_str: str = "20261109") -> dict:
    """
    Audita un pick de baloncesto contrastándolo contra el resultado oficial.
    Retorna outcome ('HIT', 'MISS', 'VOID', 'PENDING') y stat_actual con el dato oficial.
    """
    if not game_info:
        sched = get_normalized_bball_schedule(date_str)
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
    # Match exact or partial name
    for k, v in box_ath.items():
        if p_lower == k or p_lower in k or k in p_lower or (len(p_lower.split()) > 1 and p_lower.split()[-1] in k):
            match_ath = v
            break

    if match_ath:
        # Check VOID / DNP rule
        if match_ath.get("dnp") or str(match_ath.get("min", "0")) in ["0", "--", "DNP", ""]:
            return {
                "outcome": "VOID",
                "stat_actual": f"{match_ath.get('name', player_name)}: DNP (0 min / Inactivo - Cuota @1.00)",
                "match_status": status
            }

        pts = match_ath.get("pts", 0.0)
        reb = match_ath.get("reb", 0.0)
        ast = match_ath.get("ast", 0.0)
        threes = match_ath.get("threes", 0.0)
        pra = match_ath.get("pra", pts + reb + ast)

        actual_val = 0.0
        unit = "PTS"
        if "three" in stat_type:
            actual_val = threes
            unit = "Triples (3PM)"
        elif "pra" in stat_type:
            actual_val = pra
            unit = f"PRA ({int(pts)}P/{int(reb)}R/{int(ast)}A)"
        elif "pts" in stat_type:
            actual_val = pts
            unit = "PTS"
        elif "reb" in stat_type:
            actual_val = reb
            unit = "REB"
        elif "ast" in stat_type:
            actual_val = ast
            unit = "AST"

        hit = (actual_val > thresh) if direction == "OVER" else (actual_val < thresh)
        res_str = f"{match_ath.get('name', player_name)}: {actual_val:g} {unit} en {match_ath.get('min')}m (Lín {thresh:g})"
        return {
            "outcome": "HIT" if hit else "MISS",
            "stat_actual": res_str,
            "match_status": status
        }

    # Si el partido no ha finalizado
    if "FINAL" not in status:
        return {
            "outcome": "IN_PROGRESS" if ("EN VIVO" in status or "CUARTO" in status) else "PENDING",
            "stat_actual": f"{player_name}: En juego / Por iniciar",
            "match_status": status
        }

    # Si finalizó y el jugador no vio minutos o no aparece en el roster activo:
    # Regla Bookmaker Oficial (Garantía Playdoit / Altenar / Bet365: DNP = VOID Cuota 1.00)
    return {
        "outcome": "VOID",
        "stat_actual": f"{player_name}: DNP / Sin minutos registrados (Protección VOID 1.00)",
        "match_status": status
    }

if __name__ == "__main__":
    t_pick = {"match": "Los Angeles Lakers @ Atlanta Hawks", "stat_type": "total_points", "threshold": 225.5, "direction": "OVER"}
    t_game = {"match": "Los Angeles Lakers @ Atlanta Hawks", "status": "FINALIZADO", "home_score": 114, "away_score": 124}
    res = audit_individual_nba_pick(t_pick, t_game)
    print("Test NBA Audit:", res)
