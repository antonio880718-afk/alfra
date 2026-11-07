# -*- coding: utf-8 -*-
"""
MOTOR ESPECIALIZADO DE EXPLORACIÓN HISTÓRICA POR EQUIPO Y ÁRBITRO
Permite al usuario seleccionar cualquier club de cualquier liga oficial y desglosar:
1. Córners ejecutados (a favor) en casa, fuera y global
2. Córners concedidos (en contra) en casa, fuera y global
3. Frecuencia de Over 7.5, 8.5, 9.5, 10.5 córners
4. Tarjetas recibidas, tarjetas provocadas al rival y faltas
5. Desglose detallado por ÁRBITRO: cuántas tarjetas saca cada colegiado a ese equipo y en la liga
6. Goles, tiros a puerta y registro completo partido a partido
"""

import urllib.request
import pandas as pd
import numpy as np
from typing import Dict, Any, List

LEAGUE_FILES = {
    "Premier League (Inglaterra)": {"code": "E0", "country": "Inglaterra"},
    "Championship (Inglaterra 2)": {"code": "E1", "country": "Inglaterra"},
    "League One (Inglaterra 3)": {"code": "E2", "country": "Inglaterra"},
    "LaLiga (España)": {"code": "SP1", "country": "España"},
    "LaLiga 2 (España 2)": {"code": "SP2", "country": "España"},
    "Serie A (Italia)": {"code": "I1", "country": "Italia"},
    "Serie B (Italia 2)": {"code": "I2", "country": "Italia"},
    "Bundesliga (Alemania)": {"code": "D1", "country": "Alemania"},
    "Ligue 1 (Francia)": {"code": "F1", "country": "Francia"},
    "Eredivisie (Países Bajos)": {"code": "N1", "country": "Países Bajos"},
    "Belgian Pro League (Bélgica)": {"code": "B1", "country": "Bélgica"},
    "Super Lig (Turquía)": {"code": "T1", "country": "Turquía"},
    "Super League (Grecia)": {"code": "G1", "country": "Grecia"}
}

_HISTORICAL_CACHE = {}

def load_league_history(league_name: str, include_prev_season: bool = True) -> pd.DataFrame:
    cache_key = f"{league_name}_{include_prev_season}"
    if cache_key in _HISTORICAL_CACHE:
        return _HISTORICAL_CACHE[cache_key]

    meta = LEAGUE_FILES.get(league_name)
    if not meta:
        return pd.DataFrame()

    code = meta["code"]
    seasons = ["2627"]
    if include_prev_season:
        seasons.append("2526")

    dfs = []
    for s in seasons:
        url = f"https://www.football-data.co.uk/mmz4281/{s}/{code}.csv"
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            df_s = pd.read_csv(urllib.request.urlopen(req, timeout=6), encoding="latin1")
            df_s["_Season"] = "2026-2027" if s == "2627" else "2025-2026"
            dfs.append(df_s)
        except Exception:
            pass

    if dfs:
        combined = pd.concat(dfs, ignore_index=True)
        for c in ["HC", "AC", "HY", "AY", "HR", "AR", "HF", "AF", "FTHG", "FTAG", "HS", "AS", "HST", "AST"]:
            if c in combined.columns:
                combined[c] = pd.to_numeric(combined[c], errors="coerce").fillna(0)
        _HISTORICAL_CACHE[cache_key] = combined
        return combined

    return pd.DataFrame()

def get_teams_in_league(df: pd.DataFrame) -> List[str]:
    if df.empty or "HomeTeam" not in df.columns:
        return []
    teams = df["HomeTeam"].dropna().unique().tolist()
    return sorted([t for t in teams if str(t).strip() != ""])

def compute_team_deep_stats(df: pd.DataFrame, team: str, condition: str = "Todos") -> Dict[str, Any]:
    if df.empty:
        return {}

    home = df[df["HomeTeam"] == team].copy()
    away = df[df["AwayTeam"] == team].copy()

    if condition == "Solo de Local":
        matches_df = home
        condition_label = "Solo en Casa (Local)"
    elif condition == "Solo de Visitante":
        matches_df = away
        condition_label = "Solo a Domicilio (Visitante)"
    else:
        matches_df = pd.concat([home, away], ignore_index=True)
        condition_label = "Todos los Partidos (Global)"

    total_games = len(matches_df)
    if total_games == 0:
        return {}

    # 1. CÓRNERS (A Favor, En Contra, Totales)
    cf_home = home["HC"].sum() if "HC" in home.columns else 0
    cf_away = away["AC"].sum() if "AC" in away.columns else 0
    total_cf = (home["HC"].sum() if condition != "Solo de Visitante" else 0) + (away["AC"].sum() if condition != "Solo de Local" else 0)

    ca_home = home["AC"].sum() if "AC" in home.columns else 0
    ca_away = away["HC"].sum() if "HC" in away.columns else 0
    total_ca = (home["AC"].sum() if condition != "Solo de Visitante" else 0) + (away["HC"].sum() if condition != "Solo de Local" else 0)

    avg_cf = round(total_cf / total_games, 2)
    avg_ca = round(total_ca / total_games, 2)
    avg_tot_corners = round((total_cf + total_ca) / total_games, 2)

    match_total_corners = []
    for _, r in matches_df.iterrows():
        c = (r.get("HC", 0) or 0) + (r.get("AC", 0) or 0)
        match_total_corners.append(c)
    
    match_total_corners = pd.Series(match_total_corners)
    pct_over_75_c = round((match_total_corners > 7.5).mean() * 100.0, 1)
    pct_over_85_c = round((match_total_corners > 8.5).mean() * 100.0, 1)
    pct_over_95_c = round((match_total_corners > 9.5).mean() * 100.0, 1)
    pct_over_105_c = round((match_total_corners > 10.5).mean() * 100.0, 1)

    # 2. TARJETAS Y FALTAS
    cards_team = 0
    cards_opp = 0
    fouls_team = 0
    fouls_opp = 0
    match_cards_total = []

    for _, r in matches_df.iterrows():
        is_home = (r.get("HomeTeam") == team)
        y_team = r.get("HY", 0) if is_home else r.get("AY", 0)
        r_team = r.get("HR", 0) if is_home else r.get("AR", 0)
        y_opp = r.get("AY", 0) if is_home else r.get("HY", 0)
        r_opp = r.get("AR", 0) if is_home else r.get("HR", 0)
        
        f_team = r.get("HF", 0) if is_home else r.get("AF", 0)
        f_opp = r.get("AF", 0) if is_home else r.get("HF", 0)

        tot_card_game = y_team + y_opp + (r_team + r_opp) * 2
        match_cards_total.append(tot_card_game)

        cards_team += y_team + (r_team * 2)
        cards_opp += y_opp + (r_opp * 2)
        fouls_team += f_team
        fouls_opp += f_opp

    avg_cards_team = round(cards_team / total_games, 2)
    avg_cards_opp = round(cards_opp / total_games, 2)
    avg_cards_total = round((cards_team + cards_opp) / total_games, 2)
    avg_fouls_team = round(fouls_team / total_games, 2)
    avg_fouls_opp = round(fouls_opp / total_games, 2)
    
    match_cards_total = pd.Series(match_cards_total)
    pct_over_35_cards = round((match_cards_total > 3.5).mean() * 100.0, 1)
    pct_over_45_cards = round((match_cards_total > 4.5).mean() * 100.0, 1)

    # 3. GOLES Y RESULTADOS
    gf = 0
    ga = 0
    wins = 0
    draws = 0
    losses = 0
    btts_count = 0
    over_15_g_count = 0
    over_25_g_count = 0

    for _, r in matches_df.iterrows():
        is_home = (r.get("HomeTeam") == team)
        hg = r.get("FTHG", 0)
        ag = r.get("FTAG", 0)
        team_g = hg if is_home else ag
        opp_g = ag if is_home else hg
        gf += team_g
        ga += opp_g

        if team_g > opp_g:
            wins += 1
        elif team_g == opp_g:
            draws += 1
        else:
            losses += 1

        if team_g > 0 and opp_g > 0:
            btts_count += 1
        if (team_g + opp_g) > 1.5:
            over_15_g_count += 1
        if (team_g + opp_g) > 2.5:
            over_25_g_count += 1

    avg_gf = round(gf / total_games, 2)
    avg_ga = round(ga / total_games, 2)
    win_rate = round((wins / total_games) * 100.0, 1)
    btts_pct = round((btts_count / total_games) * 100.0, 1)
    over_15_pct = round((over_15_g_count / total_games) * 100.0, 1)
    over_25_pct = round((over_25_g_count / total_games) * 100.0, 1)

    return {
        "team": team,
        "total_games": total_games,
        "condition": condition_label,
        "record": f"{wins}V - {draws}E - {losses}D ({win_rate}% Victorias)",
        "corners": {
            "for_avg": avg_cf,
            "for_home": round(cf_home / max(1, len(home)), 2),
            "for_away": round(cf_away / max(1, len(away)), 2),
            "against_avg": avg_ca,
            "against_home": round(ca_home / max(1, len(home)), 2),
            "against_away": round(ca_away / max(1, len(away)), 2),
            "total_match_avg": avg_tot_corners,
            "over_75_pct": pct_over_75_c,
            "over_85_pct": pct_over_85_c,
            "over_95_pct": pct_over_95_c,
            "over_105_pct": pct_over_105_c
        },
        "cards": {
            "team_avg": avg_cards_team,
            "opp_avg": avg_cards_opp,
            "total_match_avg": avg_cards_total,
            "over_35_pct": pct_over_35_cards,
            "over_45_pct": pct_over_45_cards,
            "fouls_committed_avg": avg_fouls_team,
            "fouls_received_avg": avg_fouls_opp
        },
        "goals": {
            "for_avg": avg_gf,
            "against_avg": avg_ga,
            "total_avg": round(avg_gf + avg_ga, 2),
            "btts_pct": btts_pct,
            "over_15_pct": over_15_pct,
            "over_25_pct": over_25_pct
        }
    }

def compute_referees_for_team(df: pd.DataFrame, team: str) -> pd.DataFrame:
    if df.empty or "Referee" not in df.columns:
        return pd.DataFrame()

    matches = df[(df["HomeTeam"] == team) | (df["AwayTeam"] == team)].copy()
    if matches.empty:
        return pd.DataFrame()

    ref_data = []
    for ref_name, group in matches.groupby("Referee"):
        if not ref_name or str(ref_name).strip() == "" or str(ref_name).lower() == "nan":
            continue
        
        games = len(group)
        c_team = 0
        c_opp = 0
        fouls_tot = 0
        team_wins = 0

        for _, r in group.iterrows():
            is_home = (r["HomeTeam"] == team)
            y_t = r.get("HY", 0) if is_home else r.get("AY", 0)
            r_t = r.get("HR", 0) if is_home else r.get("AR", 0)
            y_o = r.get("AY", 0) if is_home else r.get("HY", 0)
            r_o = r.get("AR", 0) if is_home else r.get("HR", 0)
            
            c_team += y_t + (r_t * 2)
            c_opp += y_o + (r_o * 2)
            fouls_tot += (r.get("HF", 0) or 0) + (r.get("AF", 0) or 0)

            hg = r.get("FTHG", 0)
            ag = r.get("FTAG", 0)
            if (is_home and hg > ag) or (not is_home and ag > hg):
                team_wins += 1

        avg_c_team = round(c_team / games, 2)
        avg_c_opp = round(c_opp / games, 2)
        avg_c_tot = round((c_team + c_opp) / games, 2)
        avg_fouls = round(fouls_tot / games, 1)

        if avg_c_tot >= 4.8:
            severity = "🔴 Muy Severo (Tarjetero)"
        elif avg_c_tot >= 3.8:
            severity = "🟡 Moderado"
        else:
            severity = "🟢 Permisivo (Deja jugar)"

        ref_data.append({
            "Árbitro": ref_name,
            "Partidos Pitados": games,
            "Tarjetas a " + team: avg_c_team,
            "Tarjetas al Rival": avg_c_opp,
            "Total Tarjetas/PJ": avg_c_tot,
            "Faltas/PJ": avg_fouls,
            "Perfil Disciplinario": severity,
            "Victorias": f"{team_wins}/{games}"
        })

    if not ref_data:
        return pd.DataFrame()

    res_df = pd.DataFrame(ref_data)
    res_df.sort_values(by=["Partidos Pitados", "Total Tarjetas/PJ"], ascending=[False, False], inplace=True)
    return res_df

def get_team_match_log(df: pd.DataFrame, team: str, ref_filter: str = "Todos") -> pd.DataFrame:
    if df.empty:
        return pd.DataFrame()

    matches = df[(df["HomeTeam"] == team) | (df["AwayTeam"] == team)].copy()
    if ref_filter != "Todos" and "Referee" in matches.columns:
        matches = matches[matches["Referee"] == ref_filter]

    rows = []
    for _, r in matches.iterrows():
        is_home = (r.get("HomeTeam") == team)
        opp = r.get("AwayTeam") if is_home else r.get("HomeTeam")
        cond = "Local" if is_home else "Visitante"
        hg = int(r.get("FTHG", 0))
        ag = int(r.get("FTAG", 0))
        score = f"{hg}-{ag}" if is_home else f"{ag}-{hg}"
        res = "Victoria" if (is_home and hg > ag) or (not is_home and ag > hg) else ("Empate" if hg == ag else "Derrota")

        cf = int(r.get("HC", 0)) if is_home else int(r.get("AC", 0))
        ca = int(r.get("AC", 0)) if is_home else int(r.get("HC", 0))
        tot_c = cf + ca

        yt = int(r.get("HY", 0)) if is_home else int(r.get("AY", 0))
        rt = int(r.get("HR", 0)) if is_home else int(r.get("AR", 0))
        yo = int(r.get("AY", 0)) if is_home else int(r.get("HY", 0))
        ro = int(r.get("AR", 0)) if is_home else int(r.get("HR", 0))

        ft = int(r.get("HF", 0)) if is_home else int(r.get("AF", 0))
        ref = r.get("Referee", "TBA")
        season = r.get("_Season", "2026-2027")

        rows.append({
            "Temporada": season,
            "Fecha": r.get("Date", ""),
            "Rival": opp,
            "Condición": cond,
            "Marcador": score,
            "Resultado": res,
            "Córners a Favor": cf,
            "Córners Concedidos": ca,
            "Córners Totales": tot_c,
            "Tarjetas Recibidas": yt + rt * 2,
            "Tarjetas Rival": yo + ro * 2,
            "Faltas": ft,
            "Árbitro": ref
        })

    return pd.DataFrame(rows)