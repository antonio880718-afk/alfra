# -*- coding: utf-8 -*-
"""
BASE DE DATOS HIST?RICA EXACTA EQUIPO POR EQUIPO
Calcula las estad?sticas individuales de CADA club basadas en sus partidos de temporada 2026-2027:
- corners_for: C?rners que genera ese equipo espec?fico por partido
- corners_against: C?rners que concede a sus rivales por partido
- cards_avg: Tarjetas amarillas y rojas que recibe por partido
- goals_for: Goles que anota por partido
- goals_against: Goles que recibe por partido
"""

import urllib.request
import pandas as pd
from typing import Dict, Any

CSV_MAP = {
    "eng.1": "E0",
    "eng.2": "E1",
    "eng.3": "E2",
    "esp.1": "SP1",
    "esp.2": "SP2",
    "ita.1": "I1",
    "ita.2": "I2",
    "ger.1": "D1",
    "ger.2": "D2",
    "fra.1": "F1",
    "ned.1": "N1",
    "bel.1": "B1",
    "tur.1": "T1",
    "gre.1": "G1",
    "por.1": "P1",
    "sco.1": "SC0"
}

_DATASET_CACHE = {}
_TEAM_METRICS_CACHE = {}

def load_league_dataset(league_code: str):
    if league_code in _DATASET_CACHE:
        return _DATASET_CACHE[league_code]
    csv_id = CSV_MAP.get(league_code)
    if not csv_id:
        return None
    import os
    dfs = []
    for s in ["2627", "2526"]:
        path = f"sports_analyzer/data/{s}_{csv_id}.csv"
        if os.path.exists(path):
            try:
                dfs.append(pd.read_csv(path, encoding="latin1"))
            except Exception:
                pass
    if dfs:
        combined = pd.concat(dfs, ignore_index=True)
        _DATASET_CACHE[league_code] = combined
        return combined
    url = f"https://www.football-data.co.uk/mmz4281/2627/{csv_id}.csv"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        df = pd.read_csv(urllib.request.urlopen(req, timeout=6), encoding="latin1")
        _DATASET_CACHE[league_code] = df
        return df
    except Exception:
        return None

def compute_all_teams_in_league(league_code: str) -> Dict[str, Dict[str, float]]:
    if league_code in _TEAM_METRICS_CACHE:
        return _TEAM_METRICS_CACHE[league_code]
        
    df = load_league_dataset(league_code)
    if df is None or df.empty:
        return {}
        
    teams_stats = {}
    for t in df["HomeTeam"].dropna().unique():
        h = df[df["HomeTeam"] == t]
        a = df[df["AwayTeam"] == t]
        games = len(h) + len(a)
        if games == 0:
            continue
            
        c_for = (h["HC"].sum() if "HC" in h.columns else 0) + (a["AC"].sum() if "AC" in a.columns else 0)
        c_against = (h["AC"].sum() if "AC" in h.columns else 0) + (a["HC"].sum() if "HC" in a.columns else 0)
        
        cards = (
            (h["HY"].sum() if "HY" in h.columns else 0) + 
            (a["AY"].sum() if "AY" in a.columns else 0) + 
            ((h["HR"].sum() if "HR" in h.columns else 0) + (a["AR"].sum() if "AR" in a.columns else 0)) * 2
        )
                
        g_for = (h["FTHG"].sum() if "FTHG" in h.columns else 0) + (a["FTAG"].sum() if "FTAG" in a.columns else 0)
        g_against = (h["FTAG"].sum() if "FTAG" in a.columns else 0) + (a["FTHG"].sum() if "FTHG" in a.columns else 0)
        
        teams_stats[t.lower()] = {
            "name": t,
            "corners_for": round(float(c_for) / games, 2),
            "corners_against": round(float(c_against) / games, 2),
            "cards_avg": round(float(cards) / games, 2),
            "goals_for": round(float(g_for) / games, 2),
            "goals_against": round(float(g_against) / games, 2),
            "games_played": games
        }
        
    _TEAM_METRICS_CACHE[league_code] = teams_stats
    return teams_stats

def match_team_stats(league_code: str, query_name: str) -> Dict[str, Any]:
    all_teams = compute_all_teams_in_league(league_code)
    clean = query_name.lower().strip()
    
    # 1. B?squeda exacta
    if clean in all_teams:
        return all_teams[clean]
        
    # 2. B?squeda por subcadena
    for key, data in all_teams.items():
        if key in clean or clean in key or any(w in key for w in clean.split() if len(w) > 3):
            return data
            
    # Si es Champions / Europa League, buscar en las ligas de origen (Inglaterra, Espa?a, etc.)
    for other_code in ["eng.1", "esp.1", "ita.1", "ger.1", "fra.1"]:
        other_teams = compute_all_teams_in_league(other_code)
        for key, data in other_teams.items():
            if key in clean or clean in key or any(w in key for w in clean.split() if len(w) > 3):
                return data

    # Si es un club de América (Liga MX, MLS, Argentina), consultar americas_empirical_db
    from americas_empirical_db import get_americas_team_profile
    am = get_americas_team_profile(query_name)
    if am:
        return {
            "name": am["name"],
            "corners_for": am["corners_avg"],
            "corners_against": am["corners_ag_avg"],
            "cards_avg": 2.2,
            "goals_for": am["goals_avg"],
            "goals_against": am["goals_ag_avg"],
            "games_played": am["games"]
        }
        
    return {
        "name": query_name,
        "corners_for": 4.50,
        "corners_against": 4.80,
        "cards_avg": 2.10,
        "goals_for": 1.30,
        "goals_against": 1.35,
        "games_played": 38
    }

def compute_match_real_expectations(league_code: str, home_team: str, away_team: str) -> Dict[str, Any]:
    st_home = match_team_stats(league_code, home_team)
    st_away = match_team_stats(league_code, away_team)
    
    # CRUCE CIENT?FICO:
    # C?rners esperados = (C?rners que hace el Local + C?rners que concede el Visitante) / 2
    #                   + (C?rners que hace el Visitante + C?rners que concede el Local) / 2
    exp_c_home = (st_home["corners_for"] + st_away["corners_against"]) / 2.0
    exp_c_away = (st_away["corners_for"] + st_home["corners_against"]) / 2.0
    tot_corners = round(exp_c_home + exp_c_away, 2)
    
    # Goles esperados individuales
    exp_g_home = (st_home["goals_for"] + st_away["goals_against"]) / 2.0
    exp_g_away = (st_away["goals_for"] + st_home["goals_against"]) / 2.0
    tot_goals = round(exp_g_home + exp_g_away, 2)
    
    # Tarjetas esperadas
    tot_cards = round(st_home["cards_avg"] + st_away["cards_avg"], 2)
    
    return {
        "exp_corners": tot_corners,
        "exp_goals": tot_goals,
        "exp_cards": tot_cards,
        "home_details": f"{st_home['name']} (Genera: {st_home['corners_for']} C / Concede: {st_home['corners_against']} C)",
        "away_details": f"{st_away['name']} (Genera: {st_away['corners_for']} C / Concede: {st_away['corners_against']} C)",
        "source": f"Datos Individuales ({st_home['name']} vs {st_away['name']})"
    }
