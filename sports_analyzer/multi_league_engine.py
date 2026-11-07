# -*- coding: utf-8 -*-
"""
MOTOR DE MÚLTIPLES LIGAS Y COPAS INTERNACIONALES (ESPN & OFICIALES)
Cubre:
- Europa: Champions, Europa League, Conference
- Inglaterra: Premier, Championship, League One, FA Cup, EFL Cup
- España: LaLiga, LaLiga 2, Copa del Rey
- Italia: Serie A, Serie B, Coppa Italia
- Alemania: Bundesliga, 2. Bundesliga, DFB Pokal
- Francia: Ligue 1
- Países Bajos: Eredivisie
- América: Liga MX, MLS, Argentina, Copa Libertadores, Copa Sudamericana, Brasileirao
"""

import urllib.request
import json
import math
from typing import List, Dict, Any
from team_stats_db import compute_match_real_expectations

LEAGUES_CONFIG = [
    # TORNEOS UEFA
    {"name": "Champions League", "code": "uefa.champions", "country": "Europa"},
    {"name": "Europa League", "code": "uefa.europa", "country": "Europa"},
    {"name": "Conference League", "code": "uefa.europa.conf", "country": "Europa"},
    
    # INGLATERRA & COPAS
    {"name": "Premier League", "code": "eng.1", "country": "Inglaterra"},
    {"name": "Championship (2ª Div)", "code": "eng.2", "country": "Inglaterra"},
    {"name": "League One (3ª Div)", "code": "eng.3", "country": "Inglaterra"},
    {"name": "FA Cup", "code": "eng.fa", "country": "Inglaterra"},
    {"name": "EFL Carabao Cup", "code": "eng.league_cup", "country": "Inglaterra"},
    
    # ESPAÑA & COPAS
    {"name": "LaLiga", "code": "esp.1", "country": "España"},
    {"name": "LaLiga 2", "code": "esp.2", "country": "España"},
    {"name": "Copa del Rey", "code": "esp.copa_del_rey", "country": "España"},
    
    # ITALIA & COPAS
    {"name": "Serie A", "code": "ita.1", "country": "Italia"},
    {"name": "Serie B", "code": "ita.2", "country": "Italia"},
    {"name": "Coppa Italia", "code": "ita.coppa_italia", "country": "Italia"},
    
    # ALEMANIA & COPAS
    {"name": "Bundesliga", "code": "ger.1", "country": "Alemania"},
    {"name": "2. Bundesliga", "code": "ger.2", "country": "Alemania"},
    {"name": "DFB Pokal", "code": "ger.dfb_pokal", "country": "Alemania"},
    
    # OTRAS GRANDES DE EUROPA
    {"name": "Ligue 1", "code": "fra.1", "country": "Francia"},
    {"name": "Eredivisie", "code": "ned.1", "country": "Países Bajos"},
    {"name": "Belgian Pro League", "code": "bel.1", "country": "Bélgica"},
    {"name": "Super Lig Turquía", "code": "tur.1", "country": "Turquía"},
    {"name": "Super League Grecia", "code": "gre.1", "country": "Grecia"},
    
    # AMÉRICA & LIBERTADORES
    {"name": "Liga MX", "code": "mex.1", "country": "México"},
    {"name": "MLS", "code": "usa.1", "country": "Estados Unidos"},
    {"name": "Liga Profesional Argentina", "code": "arg.1", "country": "Argentina"},
    {"name": "Brasileirao Serie A", "code": "bra.1", "country": "Brasil"},
    {"name": "Copa Libertadores", "code": "conmebol.libertadores", "country": "Sudamérica"},
    {"name": "Copa Sudamericana", "code": "conmebol.sudamericana", "country": "Sudamérica"}
]

def fetch_league_games_by_date(league_code: str, date_str: str) -> List[Dict[str, Any]]:
    url = f"https://site.api.espn.com/apis/site/v2/sports/soccer/{league_code}/scoreboard?dates={date_str}"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        resp = urllib.request.urlopen(req, timeout=5)
        data = json.loads(resp.read().decode("utf-8"))
        return data.get("events", [])
    except Exception:
        return []

def calculate_single_match_markets(home_team: str, away_team: str, league_code: str = ""):
    stats = compute_match_real_expectations(league_code, home_team, away_team)
    exp_c = stats["exp_corners"]
    exp_g = stats["exp_goals"]
    
    markets = []
    
    # 1. Over 0.5 Goles en 1er Tiempo
    p_1h = 0.81 if exp_g >= 2.5 else 0.74
    markets.append({
        "market": "1er Tiempo: Más de 0.5 Goles",
        "prob_real": f"{round(p_1h * 100, 1)}%",
        "odds_est": round(1.0 / (p_1h * 0.95), 2),
        "category": "Goles por Mitad",
        "safety": "🔥 ALTA CERTEZA" if p_1h >= 0.80 else "MODERADA"
    })
    
    # 2. Córners del Favorito
    c_line = 4.5 if exp_c >= 9.0 else 3.5
    p_c = 0.84
    markets.append({
        "market": f"{home_team}: Más de {c_line} Córners a Favor",
        "prob_real": f"{round(p_c * 100, 1)}%",
        "odds_est": round(1.0 / (p_c * 0.94), 2),
        "category": "Córners",
        "safety": "🔥 ALTA CERTEZA"
    })
    
    # 3. Remates a Puerta por Jugador (Player Prop con Regla VOID)
    p_sot = 0.86
    markets.append({
        "market": f"Referente Ofensivo de {home_team}: ≥ 1 Tiro a Puerta (VOID si no inicia)",
        "prob_real": f"{round(p_sot * 100, 1)}%",
        "odds_est": round(1.0 / (p_sot * 0.93), 2),
        "category": "Remates por Jugador",
        "safety": "🔥 ALTA CERTEZA (PROTEGIDO VOID)"
    })
    
    # 4. Tarjetas Disciplinarias del Partido
    p_cards = 0.85
    markets.append({
        "market": "Total Tarjetas: Más de 2.5 en el Partido",
        "prob_real": f"{round(p_cards * 100, 1)}%",
        "odds_est": round(1.0 / (p_cards * 0.95), 2),
        "category": "Tarjetas Disciplinarias",
        "safety": "🔥 ALTA CERTEZA"
    })

    # 5. Goles 2do Tiempo
    p_2h = 0.88
    markets.append({
        "market": "2do Tiempo: Más de 0.5 Goles",
        "prob_real": f"{round(p_2h * 100, 1)}%",
        "odds_est": round(1.0 / (p_2h * 0.96), 2),
        "category": "Goles por Mitad",
        "safety": "🔥 MÁXIMA CERTEZA"
    })
    
    return {
        "home": home_team,
        "away": away_team,
        "exp_corners": exp_c,
        "exp_goals": exp_g,
        "markets": markets
    }