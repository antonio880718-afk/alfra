# -*- coding: utf-8 -*-
import urllib.request
import pandas as pd
from typing import Dict, Any

CSV_LEAGUE_MAP = {
    "eng.1": {"code": "E0", "name": "Premier League"},
    "eng.2": {"code": "E1", "name": "Championship"},
    "eng.3": {"code": "E2", "name": "League One"},
    "esp.1": {"code": "SP1", "name": "LaLiga"},
    "esp.2": {"code": "SP2", "name": "LaLiga 2"},
    "ita.1": {"code": "I1", "name": "Serie A"},
    "ita.2": {"code": "I2", "name": "Serie B"},
    "ger.1": {"code": "D1", "name": "Bundesliga"},
    "fra.1": {"code": "F1", "name": "Ligue 1"},
    "ned.1": {"code": "N1", "name": "Eredivisie"},
    "bel.1": {"code": "B1", "name": "Belgian Pro"},
    "tur.1": {"code": "T1", "name": "Super Lig Turquia"},
    "gre.1": {"code": "G1", "name": "Super League Grecia"}
}

_CSV_CACHE = {}

def get_league_df(league_key: str):
    if league_key in _CSV_CACHE:
        return _CSV_CACHE[league_key]
    info = CSV_LEAGUE_MAP.get(league_key)
    if not info:
        return None
    import os
    dfs = []
    for s in ["2627", "2526"]:
        path = f"sports_analyzer/data/{s}_{info['code']}.csv"
        if os.path.exists(path):
            try:
                dfs.append(pd.read_csv(path, encoding="latin1"))
            except Exception:
                pass
    if dfs:
        comb = pd.concat(dfs, ignore_index=True)
        _CSV_CACHE[league_key] = comb
        return comb
    url = f"https://www.football-data.co.uk/mmz4281/2627/{info['code']}.csv"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        df = pd.read_csv(urllib.request.urlopen(req, timeout=8), encoding="latin1")
        _CSV_CACHE[league_key] = df
        return df
    except Exception:
        return None

def get_team_exact_stats(df: pd.DataFrame, team_name: str) -> Dict[str, Any]:
    if df is None or df.empty:
        return {"avg_corners": 9.8, "over_8_5_corners_pct": 72.0, "avg_cards": 4.2, "found": False}
    
    clean_name = team_name.lower().strip()
    home = df[df["HomeTeam"].str.lower().str.contains(clean_name[:4], na=False)]
    away = df[df["AwayTeam"].str.lower().str.contains(clean_name[:4], na=False)]
    
    total = len(home) + len(away)
    if total == 0:
        return {"avg_corners": 9.8, "over_8_5_corners_pct": 72.0, "avg_cards": 4.2, "found": False}
        
    tot_c = 0
    tot_cards = 0
    over_85 = 0
    
    for _, r in home.iterrows():
        c = (r.get("HC", 0) or 0) + (r.get("AC", 0) or 0)
        card = (r.get("HY", 0) or 0) + (r.get("AY", 0) or 0) + ((r.get("HR", 0) or 0) + (r.get("AR", 0) or 0)) * 2
        tot_c += c
        tot_cards += card
        if c > 8.5:
            over_85 += 1
            
    for _, r in away.iterrows():
        c = (r.get("HC", 0) or 0) + (r.get("AC", 0) or 0)
        card = (r.get("HY", 0) or 0) + (r.get("AY", 0) or 0) + ((r.get("HR", 0) or 0) + (r.get("AR", 0) or 0)) * 2
        tot_c += c
        tot_cards += card
        if c > 8.5:
            over_85 += 1
            
    return {
        "avg_corners": round(tot_c / total, 2),
        "over_8_5_corners_pct": round((over_85 / total) * 100.0, 1),
        "avg_cards": round(tot_cards / total, 2),
        "sample_games": total,
        "found": True
    }
