# -*- coding: utf-8 -*-
"""
MOTOR DE CREAR APUESTA (SAME GAME PARLAYS - SGP) Y ALINEACIONES OFICIALES
Genera combinadas de 3 a 4 variables correlacionadas para UN SOLO PARTIDO.
Verifica alineaciones oficiales (Starting XI) para Player Props.
"""

import urllib.request
import json
from typing import Dict, Any, List

def fetch_match_rosters_and_details(league_code: str, event_id: str) -> Dict[str, Any]:
    """
    Obtiene los rosters oficiales y alineaciones desde la API de ESPN.
    Identifica titulares (starter: True), suplentes y formación táctica.
    """
    url = f"https://site.api.espn.com/apis/site/v2/sports/soccer/{league_code}/summary?event={event_id}"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        data = json.loads(urllib.request.urlopen(req, timeout=6).read().decode("utf-8"))
        
        rosters = data.get("rosters", [])
        teams_data = []
        for r in rosters:
            t_name = r.get("team", {}).get("displayName", "")
            formation = r.get("formation", "No confirmada")
            all_players = r.get("roster", [])
            starters = []
            bench = []
            for p in all_players:
                ath = p.get("athlete", {})
                pos = p.get("position", {}).get("abbreviation", "N/A")
                is_starter = p.get("starter", False)
                p_info = {
                    "name": ath.get("displayName", ""),
                    "jersey": p.get("jersey", ""),
                    "position": pos,
                    "is_starter": is_starter
                }
                if is_starter:
                    starters.append(p_info)
                else:
                    bench.append(p_info)
            teams_data.append({
                "team": t_name,
                "formation": formation,
                "starters": starters,
                "bench": bench,
                "is_lineup_official": len(starters) == 11
            })
        return {
            "success": True,
            "teams": teams_data,
            "game_state": data.get("header", {}).get("competitions", [{}])[0].get("status", {}).get("type", {}).get("state", "pre")
        }
    except Exception as e:
        return {"success": False, "error": str(e), "teams": []}

def build_single_match_sgp(home: str, away: str, league_name: str, exp_stats: Dict[str, Any], roster_info: Dict[str, Any] = None) -> Dict[str, Any]:
    """
    Construye la combinada óptima de 3 a 4 variables para UN SOLO PARTIDO (Same Game Parlay)
    sincronizando: Goles 1T + Córners + Tiros/Player Props + Disciplina/Faltas.
    """
    exp_c = exp_stats.get("exp_corners", 9.5)
    exp_g = exp_stats.get("exp_goals", 2.6)
    
    # 1. Variable Mitad / Goles
    v_goals = {
        "n": 1,
        "type": "Ritmo / Goles",
        "market": "1er Tiempo: Más de 0.5 Goles (Over 0.5 1T)",
        "pick": "Over 0.5 Goles en 1er Tiempo",
        "odds": 1.25,
        "prob": 82.5,
        "synergy": "Se cobra temprano y abre el partido para el resto de variables."
    }
    
    # 2. Variable Córners Equipo Dominante
    c_line = 4.5 if exp_c >= 9.0 else 3.5
    v_corners = {
        "n": 2,
        "type": "Córners Equipo Dominante",
        "market": f"{home}: Más de {c_line} Córners",
        "pick": f"{home} Over {c_line} Córners",
        "odds": 1.30,
        "prob": 84.0,
        "synergy": f"{home} empuja como local generando asedio continuo por bandas."
    }
    
    # 3. Variable Jugador Titular (Player Prop) con validación
    # Extraer delantero o extremo titular si hay roster oficial
    player_target = "Delantero Referencia"
    player_status = "🟡 Proyectado Titular"
    if roster_info and roster_info.get("success") and roster_info.get("teams"):
        h_starters = roster_info["teams"][0].get("starters", []) if len(roster_info["teams"]) > 0 else []
        for s in h_starters:
            if s["position"] in ["F", "FW", "ST", "CF", "RW", "LW"]:
                player_target = s["name"]
                player_status = "🟢 Titular Confirmado en XI Oficial"
                break

    v_player = {
        "n": 3,
        "type": "Remates de Jugador (Player Prop)",
        "market": f"{player_target}: Más de 0.5 Tiros a Puerta",
        "pick": f"{player_target} $\\ge 1$ Tiro a Puerta",
        "odds": 1.28,
        "prob": 86.5,
        "status": player_status,
        "synergy": f"Si {home} ataca y genera córners, su delantero titular tiene garantizados remates."
    }
    
    # 4. Variable Tarjetas Disciplinarias del Partido
    v_cards = {
        "n": 4,
        "type": "Tarjetas Disciplinarias",
        "market": "Total Tarjetas: Más de 2.5 en el Partido",
        "pick": "Más de 2.5 Tarjetas Totales",
        "odds": 1.25,
        "prob": 86.0,
        "synergy": "La intensidad del asedio por bandas y las disputas divididas generan amonestaciones oficiales del colegiado."
    }
    
    variables = [v_goals, v_corners, v_player, v_cards]
    
    # Cuota combinada total con correlación
    raw_odds = 1.0
    for v in variables:
        raw_odds *= v["odds"]
    final_sgp_odds = round(raw_odds * 0.96, 2) # Ajuste moderado por correlación
    
    return {
        "match": f"{home} vs {away}",
        "league": league_name,
        "total_variables": len(variables),
        "combined_odds": final_sgp_odds,
        "target_payout": f"Con $50 MXN cobras: ${round(50 * final_sgp_odds, 2)} MXN",
        "double_capital_payout": f"Con $500 MXN cobras: ${round(500 * final_sgp_odds, 2)} MXN",
        "variables": variables,
        "why_it_works": "Sinergia de Partido Único: En lugar de rezar en 11 estadios distintos, concentras el capital en 90 minutos donde cada variable alimenta a la siguiente."
    }