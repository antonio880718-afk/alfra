# -*- coding: utf-8 -*-
"""
nfl_self_audit_engine.py - Motor de Auditoría Empírica Completa para NFL y NCAAF.
Audita totales, mitades (1H), totales por equipo, Moneyline, Hándicaps y Player Props (Pase, TDs, Carrera, Recepción, Recepciones, Scrimmage, Anytime TD).
"""
import os
import sys
import unicodedata

_dir = os.path.dirname(os.path.abspath(__file__))
if _dir not in sys.path:
    sys.path.insert(0, _dir)

from nfl_data_api import get_normalized_football_schedule


def _norm_name(txt: str) -> str:
    clean = unicodedata.normalize("NFKD", str(txt or "")).encode("ascii", "ignore").decode("ascii").lower()
    for ch in (".", ",", "'", "-"):
        clean = clean.replace(ch, " ")
    tokens = [t for t in clean.split() if t not in ("jr", "sr", "ii", "iii", "iv")]
    return " ".join(tokens)


def _match_player_box(player_name: str, box_ath: dict):
    p_norm = _norm_name(player_name)
    if not p_norm or not box_ath:
        return None
    p_parts = p_norm.split()
    for k, v in box_ath.items():
        k_norm = _norm_name(k)
        if not k_norm:
            continue
        if p_norm == k_norm or p_norm in k_norm or k_norm in p_norm:
            return v
        k_parts = k_norm.split()
        if len(p_parts) >= 2 and len(k_parts) >= 2 and p_parts[-1] == k_parts[-1] and p_parts[0][:1] == k_parts[0][:1]:
            return v
    return None


def audit_individual_nfl_pick(pick_item: dict, game_info: dict = None, date_str: str = None) -> dict:
    if not game_info:
        sched = get_normalized_football_schedule(date_str)
        m_title = pick_item.get("match", "")
        game_info = next((g for g in sched if g.get("match") == m_title), {})

    status = game_info.get("status", "PROGRAMADO")
    if "FINAL" not in status:
        return {
            "outcome": "IN_PROGRESS" if "EN JUEGO" in status else "PENDING",
            "stat_actual": f"En juego ({game_info.get('score', 'vs')})" if "EN JUEGO" in status else f"Por jugar ({game_info.get('time_cdmx', '18:00')} hs)",
            "match_status": status
        }

    stat_type = pick_item.get("stat_type", "")
    thresh = float(pick_item.get("threshold", 0.0))
    direction = pick_item.get("direction", "OVER")
    h_score = int(game_info.get("home_score", 0))
    a_score = int(game_info.get("away_score", 0))
    tot_pts = h_score + a_score

    # 1. TOTALES DE PUNTOS PARTIDO
    if stat_type == "total_points":
        if tot_pts == thresh:
            return {"outcome": "VOID", "stat_actual": f"Push exacto: {tot_pts} ({a_score}-{h_score})", "match_status": status}
        hit = (tot_pts > thresh) if direction == "OVER" else (tot_pts < thresh)
        return {"outcome": "HIT" if hit else "MISS", "stat_actual": f"Puntos Reales: {tot_pts} ({a_score}-{h_score})", "match_status": status}

    # 2. TOTALES POR EQUIPO
    if stat_type in ("home_points", "away_points"):
        tm_pts = h_score if stat_type == "home_points" else a_score
        hit = (tm_pts > thresh) if direction == "OVER" else (tm_pts < thresh)
        lbl = game_info.get("home", "Local") if stat_type == "home_points" else game_info.get("away", "Visita")
        return {"outcome": "HIT" if hit else "MISS", "stat_actual": f"{lbl}: {tm_pts} PTS finales (Lín {thresh:g})", "match_status": status}

    # 3. PRIMERA MITAD (1H)
    if stat_type in ("half_points", "home_half_points", "away_half_points"):
        h_1h = game_info.get("home_1h_score")
        a_1h = game_info.get("away_1h_score")
        tot_1h = game_info.get("total_1h_points")
        if stat_type == "half_points" and tot_1h is not None:
            hit = (tot_1h > thresh) if direction == "OVER" else (tot_1h < thresh)
            return {"outcome": "HIT" if hit else "MISS", "stat_actual": f"1ra Mitad Real: {tot_1h} PTS ({a_1h}-{h_1h})", "match_status": status}
        if stat_type == "home_half_points" and h_1h is not None:
            hit = (h_1h > thresh) if direction == "OVER" else (h_1h < thresh)
            return {"outcome": "HIT" if hit else "MISS", "stat_actual": f"1H Local Real: {h_1h} PTS (Lín {thresh:g})", "match_status": status}
        if stat_type == "away_half_points" and a_1h is not None:
            hit = (a_1h > thresh) if direction == "OVER" else (a_1h < thresh)
            return {"outcome": "HIT" if hit else "MISS", "stat_actual": f"1H Visita Real: {a_1h} PTS (Lín {thresh:g})", "match_status": status}
        return {"outcome": "PENDING", "stat_actual": "Sin parciales 1H en acta ESPN (pulsa Sincronizar)", "match_status": status}

    # 4. MONEYLINE
    if stat_type in ("moneyline_home", "moneyline_away"):
        if h_score == a_score:
            return {"outcome": "VOID", "stat_actual": f"Empate ({a_score}-{h_score})", "match_status": status}
        hit = (h_score > a_score) if stat_type == "moneyline_home" else (a_score > h_score)
        return {"outcome": "HIT" if hit else "MISS", "stat_actual": f"Marcador Final: {a_score}-{h_score}", "match_status": status}

    # 5. HÁNDICAPS (SPREAD)
    if "spread" in stat_type:
        diff = (h_score - a_score) if "home" in stat_type else (a_score - h_score)
        if diff + thresh == 0:
            return {"outcome": "VOID", "stat_actual": f"Push Spread ({diff:+d} vs {thresh:+g})", "match_status": status}
        hit = (diff + thresh) > 0
        return {"outcome": "HIT" if hit else "MISS", "stat_actual": f"Margen Real: {diff:+d} pts ({a_score}-{h_score})", "match_status": status}

    # 6. PLAYER PROPS
    player_name = pick_item.get("player", "").strip()
    box_ath = game_info.get("boxscore_athletes", {}) or {}
    if not player_name:
        return {"outcome": "PENDING", "stat_actual": f"Mercado equipo ({stat_type})", "match_status": status}
    if not box_ath:
        return {"outcome": "PENDING", "stat_actual": "Boxscore ESPN aún sin jugadores (pulsa Sincronizar)", "match_status": status}

    match_ath = _match_player_box(player_name, box_ath)
    if match_ath:
        pass_yds = float(match_ath.get("pass_yds", 0.0))
        pass_tds = float(match_ath.get("pass_tds", 0.0))
        rush_yds = float(match_ath.get("rush_yds", 0.0))
        rec_yds = float(match_ath.get("rec_yds", 0.0))
        receptions = float(match_ath.get("receptions", 0.0))
        scrimmage_yds = float(match_ath.get("scrimmage_yds", rush_yds + rec_yds))
        anytime_td = int(match_ath.get("anytime_td", 0))

        if "anytime_td" in stat_type:
            hit = anytime_td >= 1
            return {
                "outcome": "HIT" if hit else "MISS",
                "stat_actual": f"{match_ath.get('name', player_name)}: {anytime_td} TD en el partido",
                "match_status": status
            }

        actual_val = 0.0
        unit = "Yardas"
        if "pass_yds" in stat_type:
            actual_val, unit = pass_yds, "YDS Pase"
        elif "pass_tds" in stat_type:
            actual_val, unit = pass_tds, "Pases TD"
        elif "rush_yds" in stat_type:
            actual_val, unit = rush_yds, "YDS Terrestres"
        elif "rec_yds" in stat_type:
            actual_val, unit = rec_yds, "YDS Recepción"
        elif "receptions" in stat_type:
            actual_val, unit = receptions, "Recepciones"
        elif "scrimmage" in stat_type:
            actual_val, unit = scrimmage_yds, "YDS Totales (Rush+Rec)"

        hit = (actual_val > thresh) if direction == "OVER" else (actual_val < thresh)
        res_str = f"{match_ath.get('name', player_name)}: {actual_val:g} {unit} oficiales (Lín {thresh:g})"
        return {"outcome": "HIT" if hit else "MISS", "stat_actual": res_str, "match_status": status}

    return {
        "outcome": "VOID",
        "stat_actual": f"{player_name}: Inactivo / 0 snaps oficiales (Protección VOID 1.00)",
        "match_status": status
    }
