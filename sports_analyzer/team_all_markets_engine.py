# -*- coding: utf-8 -*-
"""
MOTOR DE LOS 50+ MERCADOS HISTÓRICOS POR EQUIPO (PLAYDOIT / ALTENAR SPORTSBOOK TREE)
Calcula la tasa de acierto empírica real (%) en los 45+ partidos oficiales de la base de datos:
1. Mercados de Córners (Totales, a Favor, Concedidos, 1H/2H, Hándicap, Carreras)
2. Mercados de Tarjetas y Disciplina (Totales, por Equipo, Rival, Rojas, Faltas)
3. Mercados de Goles (Totales, Individuales, BTTS, Clean Sheet, por Mitad)
4. Mercados de Disparos & Props (Tiros a Puerta, Tiros Totales a Favor y Contra)
5. Mercados de Descanso / Final (HT/FT, Gana ambas mitades, Remontadas)
6. Mercados de Hándicap Asiático (Líneas de gol con reembolso y ventaja)
7. Marcadores Exactos Históricos más repetidos
"""

import pandas as pd
import numpy as np
from typing import Dict, Any, List

def compute_all_50_markets_for_team(df: pd.DataFrame, team: str, condition: str = "Todos") -> List[Dict[str, Any]]:
    if df.empty:
        return []

    home = df[df["HomeTeam"] == team].copy()
    away = df[df["AwayTeam"] == team].copy()

    if condition == "Solo de Local":
        matches = home
    elif condition == "Solo de Visitante":
        matches = away
    else:
        matches = pd.concat([home, away], ignore_index=True)

    N = len(matches)
    if N == 0:
        return []

    cf_v = []
    ca_v = []
    tot_c_v = []
    
    cards_team_v = []
    cards_opp_v = []
    cards_tot_v = []
    red_card_game_v = []
    
    fouls_team_v = []
    fouls_tot_v = []

    gf_v = []
    ga_v = []
    tot_g_v = []
    btts_v = []
    clean_sheet_v = []
    
    gf_1h_v = []
    ga_1h_v = []
    tot_g_1h_v = []
    
    gf_2h_v = []
    ga_2h_v = []
    tot_g_2h_v = []
    
    score_both_halves_v = []
    win_both_halves_v = []

    sot_for_v = []
    sot_opp_v = []
    shots_for_v = []
    shots_tot_v = []

    ht_res_v = []
    ft_res_v = []
    exact_scores_v = []

    for _, r in matches.iterrows():
        is_home = (r["HomeTeam"] == team)
        
        cf = int(r.get("HC", 0)) if is_home else int(r.get("AC", 0))
        ca = int(r.get("AC", 0)) if is_home else int(r.get("HC", 0))
        cf_v.append(cf)
        ca_v.append(ca)
        tot_c_v.append(cf + ca)

        yt = int(r.get("HY", 0)) if is_home else int(r.get("AY", 0))
        rt = int(r.get("HR", 0)) if is_home else int(r.get("AR", 0))
        yo = int(r.get("AY", 0)) if is_home else int(r.get("HY", 0))
        ro = int(r.get("AR", 0)) if is_home else int(r.get("HR", 0))
        ct = yt + rt * 2
        co = yo + ro * 2
        cards_team_v.append(ct)
        cards_opp_v.append(co)
        cards_tot_v.append(ct + co)
        red_card_game_v.append(1 if (rt + ro) > 0 else 0)

        ft = int(r.get("HF", 0)) if is_home else int(r.get("AF", 0))
        fo = int(r.get("AF", 0)) if is_home else int(r.get("HF", 0))
        fouls_team_v.append(ft)
        fouls_tot_v.append(ft + fo)

        hg = int(r.get("FTHG", 0))
        ag = int(r.get("FTAG", 0))
        gf = hg if is_home else ag
        ga = ag if is_home else hg
        gf_v.append(gf)
        ga_v.append(ga)
        tot_g_v.append(gf + ga)
        btts_v.append(1 if (gf > 0 and ga > 0) else 0)
        clean_sheet_v.append(1 if ga == 0 else 0)
        exact_scores_v.append(f"{gf}-{ga}")

        if gf > ga:
            ft_res_v.append("W")
        elif gf == ga:
            ft_res_v.append("D")
        else:
            ft_res_v.append("L")

        hthg = int(r.get("HTHG", 0))
        htag = int(r.get("HTAG", 0))
        gf1 = hthg if is_home else htag
        ga1 = htag if is_home else hthg
        gf_1h_v.append(gf1)
        ga_1h_v.append(ga1)
        tot_g_1h_v.append(gf1 + ga1)

        gf2 = max(0, gf - gf1)
        ga2 = max(0, ga - ga1)
        gf_2h_v.append(gf2)
        ga_2h_v.append(ga2)
        tot_g_2h_v.append(gf2 + ga2)

        score_both_halves_v.append(1 if (gf1 > 0 and gf2 > 0) else 0)
        win_both_halves_v.append(1 if (gf1 > ga1 and gf2 > ga2) else 0)

        if gf1 > ga1:
            ht_res_v.append("W")
        elif gf1 == ga1:
            ht_res_v.append("D")
        else:
            ht_res_v.append("L")

        sf = int(r.get("HS", 0)) if is_home else int(r.get("AS", 0))
        so = int(r.get("AS", 0)) if is_home else int(r.get("HS", 0))
        sotf = int(r.get("HST", 0)) if is_home else int(r.get("AST", 0))
        soto = int(r.get("AST", 0)) if is_home else int(r.get("HST", 0))
        shots_for_v.append(sf)
        shots_tot_v.append(sf + so)
        sot_for_v.append(sotf)
        sot_opp_v.append(soto)

    cf_s = pd.Series(cf_v)
    ca_s = pd.Series(ca_v)
    tot_c_s = pd.Series(tot_c_v)
    
    ct_s = pd.Series(cards_team_v)
    co_s = pd.Series(cards_opp_v)
    cards_tot_s = pd.Series(cards_tot_v)
    red_s = pd.Series(red_card_game_v)
    ft_s = pd.Series(fouls_team_v)
    fouls_tot_s = pd.Series(fouls_tot_v)

    gf_s = pd.Series(gf_v)
    ga_s = pd.Series(ga_v)
    tot_g_s = pd.Series(tot_g_v)
    btts_s = pd.Series(btts_v)
    clean_s = pd.Series(clean_sheet_v)
    
    tot_g_1h_s = pd.Series(tot_g_1h_v)
    tot_g_2h_s = pd.Series(tot_g_2h_v)
    sbh_s = pd.Series(score_both_halves_v)
    wbh_s = pd.Series(win_both_halves_v)

    sot_for_s = pd.Series(sot_for_v)
    sot_opp_s = pd.Series(sot_opp_v)
    shots_for_s = pd.Series(shots_for_v)
    shots_tot_s = pd.Series(shots_tot_v)

    ht_res_s = pd.Series(ht_res_v)
    ft_res_s = pd.Series(ft_res_v)

    def _opt(pick_label: str, condition_series: pd.Series) -> Dict[str, Any]:
        count = int(condition_series.sum())
        rate = round((count / N) * 100.0, 1)
        prob = max(0.01, rate / 100.0)
        fair_odd = round(1.0 / prob, 2)
        book_odd = round(max(1.05, fair_odd * 1.08), 2)
        is_escalera = (rate >= 85.0)
        return {
            "pick": pick_label,
            "hit_rate": f"{rate}%",
            "rate_num": rate,
            "record": f"{count}/{N} partidos",
            "fair_odds": f"{fair_odd}x",
            "odds": f"{book_odd}x",
            "is_escalera": is_escalera
        }

    categories = []

    # 1. CÓRNERS
    cat_corners = {
        "category": "🚩 Mercados de Córners (Totales, a Favor, Concedidos y Hándicap)",
        "icon": "🚩",
        "markets": [
            {
                "title": "Córners Totales del Partido (Over / Under)",
                "options": [
                    _opt("Más de 6.5 Córners", tot_c_s > 6.5),
                    _opt("Más de 7.5 Córners", tot_c_s > 7.5),
                    _opt("Más de 8.5 Córners", tot_c_s > 8.5),
                    _opt("Más de 9.5 Córners", tot_c_s > 9.5),
                    _opt("Más de 10.5 Córners", tot_c_s > 10.5),
                    _opt("Menos de 11.5 Córners", tot_c_s < 11.5)
                ]
            },
            {
                "title": f"Córners Ejecutados a Favor por {team}",
                "options": [
                    _opt(f"{team} Más de 2.5 Córners", cf_s > 2.5),
                    _opt(f"{team} Más de 3.5 Córners", cf_s > 3.5),
                    _opt(f"{team} Más de 4.5 Córners", cf_s > 4.5),
                    _opt(f"{team} Más de 5.5 Córners", cf_s > 5.5),
                    _opt(f"{team} Más de 6.5 Córners", cf_s > 6.5)
                ]
            },
            {
                "title": f"Córners Concedidos a Rivales por {team}",
                "options": [
                    _opt("Rival Más de 3.5 Córners", ca_s > 3.5),
                    _opt("Rival Más de 4.5 Córners", ca_s > 4.5),
                    _opt("Rival Más de 5.5 Córners", ca_s > 5.5),
                    _opt("Rival Menos de 6.5 Córners", ca_s < 6.5)
                ]
            },
            {
                "title": "Córners Hándicap & Carreras",
                "options": [
                    _opt(f"{team} saca más Córners que el rival", cf_s > ca_s),
                    _opt(f"{team} Hándicap Córners +1.5", (cf_s + 1.5) > ca_s),
                    _opt(f"{team} Hándicap Córners +2.5", (cf_s + 2.5) > ca_s),
                    _opt(f"Carrera a 3 Córners ({team} llega primero)", cf_s >= 3)
                ]
            }
        ]
    }
    categories.append(cat_corners)

    # 2. TARJETAS Y DISCIPLINA
    cat_cards = {
        "category": "🟨 Mercados de Tarjetas, Faltas y Disciplina",
        "icon": "🟨",
        "markets": [
            {
                "title": "Tarjetas Totales del Partido",
                "options": [
                    _opt("Más de 2.5 Tarjetas", cards_tot_s > 2.5),
                    _opt("Más de 3.5 Tarjetas", cards_tot_s > 3.5),
                    _opt("Más de 4.5 Tarjetas", cards_tot_s > 4.5),
                    _opt("Más de 5.5 Tarjetas", cards_tot_s > 5.5),
                    _opt("Menos de 5.5 Tarjetas", cards_tot_s < 5.5)
                ]
            },
            {
                "title": f"Tarjetas Recibidas por {team}",
                "options": [
                    _opt(f"{team} Más de 0.5 Tarjetas", ct_s > 0.5),
                    _opt(f"{team} Más de 1.5 Tarjetas", ct_s > 1.5),
                    _opt(f"{team} Más de 2.5 Tarjetas", ct_s > 2.5),
                    _opt(f"{team} Menos de 3.5 Tarjetas", ct_s < 3.5)
                ]
            },
            {
                "title": "Tarjetas Provocadas a Rivales & Expulsiones",
                "options": [
                    _opt("Rival Más de 1.5 Tarjetas", co_s > 1.5),
                    _opt("Rival Más de 2.5 Tarjetas", co_s > 2.5),
                    _opt("Tarjeta Roja en el Partido (Sí)", red_s > 0),
                    _opt("Sin Tarjeta Roja en el Partido (No)", red_s == 0)
                ]
            },
            {
                "title": f"Faltas de {team} y Faltas Totales",
                "options": [
                    _opt(f"{team} Más de 8.5 Faltas", ft_s > 8.5),
                    _opt(f"{team} Más de 9.5 Faltas", ft_s > 9.5),
                    _opt(f"{team} Más de 10.5 Faltas", ft_s > 10.5),
                    _opt("Más de 20.5 Faltas Totales", fouls_tot_s > 20.5),
                    _opt("Más de 22.5 Faltas Totales", fouls_tot_s > 22.5)
                ]
            }
        ]
    }
    categories.append(cat_cards)

    # 3. GOLES
    cat_goals = {
        "category": "⚽ Mercados de Goles (Totales, Individuales, BTTS y Portería a Cero)",
        "icon": "⚽",
        "markets": [
            {
                "title": "Goles Totales del Partido (Over / Under)",
                "options": [
                    _opt("Más de 0.5 Goles (Al menos 1 gol)", tot_g_s > 0.5),
                    _opt("Más de 1.5 Goles", tot_g_s > 1.5),
                    _opt("Más de 2.5 Goles", tot_g_s > 2.5),
                    _opt("Más de 3.5 Goles", tot_g_s > 3.5),
                    _opt("Menos de 3.5 Goles", tot_g_s < 3.5),
                    _opt("Menos de 4.5 Goles", tot_g_s < 4.5)
                ]
            },
            {
                "title": f"Goles Individuales de {team}",
                "options": [
                    _opt(f"{team} anota Más de 0.5 Goles", gf_s > 0.5),
                    _opt(f"{team} anota Más de 1.5 Goles", gf_s > 1.5),
                    _opt(f"{team} anota Más de 2.5 Goles", gf_s > 2.5),
                    _opt(f"Portería a Cero de {team} (Clean Sheet)", clean_s > 0)
                ]
            },
            {
                "title": "Ambos Equipos Anotan (BTTS)",
                "options": [
                    _opt("Ambos Equipos Anotan (Sí)", btts_s > 0),
                    _opt("Ambos Equipos Anotan (No)", btts_s == 0),
                    _opt("Ambos Anotan y Más de 2.5 Goles", (btts_s > 0) & (tot_g_s > 2.5))
                ]
            },
            {
                "title": "Goles por Mitad",
                "options": [
                    _opt("1ra Mitad: Más de 0.5 Goles", tot_g_1h_s > 0.5),
                    _opt("1ra Mitad: Más de 1.5 Goles", tot_g_1h_s > 1.5),
                    _opt("2da Mitad: Más de 0.5 Goles", tot_g_2h_s > 0.5),
                    _opt("2da Mitad: Más de 1.5 Goles", tot_g_2h_s > 1.5),
                    _opt(f"{team} anota en Ambas Mitades", sbh_s > 0)
                ]
            }
        ]
    }
    categories.append(cat_goals)

    # 4. DISPAROS Y PROPS
    cat_shots = {
        "category": "🎯 Mercados de Tiros a Puerta y Disparos Totales (Props)",
        "icon": "🎯",
        "markets": [
            {
                "title": f"Tiros a Puerta (Shots on Target) de {team}",
                "options": [
                    _opt(f"{team} Más de 2.5 Tiros a Puerta", sot_for_s > 2.5),
                    _opt(f"{team} Más de 3.5 Tiros a Puerta", sot_for_s > 3.5),
                    _opt(f"{team} Más de 4.5 Tiros a Puerta", sot_for_s > 4.5),
                    _opt(f"{team} Más de 5.5 Tiros a Puerta", sot_for_s > 5.5)
                ]
            },
            {
                "title": "Tiros a Puerta Concedidos al Rival",
                "options": [
                    _opt("Rival Más de 2.5 Tiros a Puerta", sot_opp_s > 2.5),
                    _opt("Rival Más de 3.5 Tiros a Puerta", sot_opp_s > 3.5),
                    _opt("Rival Más de 4.5 Tiros a Puerta", sot_opp_s > 4.5),
                    _opt("Rival Menos de 5.5 Tiros a Puerta", sot_opp_s < 5.5)
                ]
            },
            {
                "title": f"Tiros Totales de {team} y del Partido",
                "options": [
                    _opt(f"{team} Más de 8.5 Tiros Totales", shots_for_s > 8.5),
                    _opt(f"{team} Más de 10.5 Tiros Totales", shots_for_s > 10.5),
                    _opt(f"{team} Más de 12.5 Tiros Totales", shots_for_s > 12.5),
                    _opt("Más de 20.5 Tiros Totales Partido", shots_tot_s > 20.5),
                    _opt("Más de 23.5 Tiros Totales Partido", shots_tot_s > 23.5)
                ]
            }
        ]
    }
    categories.append(cat_shots)

    # 5. DESCANSO / FINAL
    cat_halves = {
        "category": "⏱️ Mercados de Descanso / Final y Doble Oportunidad",
        "icon": "⏱️",
        "markets": [
            {
                "title": f"Resultado al Descanso (1X2 1H) para {team}",
                "options": [
                    _opt(f"{team} o Empate al Descanso (1X 1H)", ht_res_s != "L"),
                    _opt(f"{team} Gana al Descanso", ht_res_s == "W"),
                    _opt("Empate al Descanso", ht_res_s == "D"),
                    _opt(f"{team} Pierde al Descanso", ht_res_s == "L")
                ]
            },
            {
                "title": f"Doble Oportunidad Final (1X2) para {team}",
                "options": [
                    _opt(f"{team} o Empate (1X / Victoria o Empate)", ft_res_s != "L"),
                    _opt(f"{team} Gana el Partido (Victoria directa)", ft_res_s == "W"),
                    _opt(f"{team} o Rival Ganador (No hay empate / 12)", ft_res_s != "D")
                ]
            },
            {
                "title": "Mercados Especiales de Mitad",
                "options": [
                    _opt(f"{team} Gana Ambas Mitades", wbh_s > 0),
                    _opt(f"{team} Gana sin Conceder Gol (Win to Nil)", (ft_res_s == "W") & (clean_s > 0))
                ]
            }
        ]
    }
    categories.append(cat_halves)

    # 6. HÁNDICAP ASIÁTICO
    cat_ah = {
        "category": "⚖️ Mercados de Hándicap Asiático y Líneas con Reembolso",
        "icon": "⚖️",
        "markets": [
            {
                "title": f"Hándicap Asiático de Goles para {team}",
                "options": [
                    _opt(f"{team} Hándicap Asiático +1.5", (gf_s + 1.5) > ga_s),
                    _opt(f"{team} Hándicap Asiático +0.5", (gf_s + 0.5) > ga_s),
                    _opt(f"{team} Hándicap Asiático -0.5", (gf_s - 0.5) > ga_s),
                    _opt(f"{team} Hándicap Asiático +2.5", (gf_s + 2.5) > ga_s)
                ]
            },
            {
                "title": "Líneas Asiáticas de Gol (Con Reembolso Push)",
                "options": [
                    _opt("Más de 1.0 Gol Asiático (Reembolso si hay 1)", tot_g_s > 0),
                    _opt("Más de 2.0 Goles Asiáticos (Reembolso si hay 2)", tot_g_s > 1),
                    _opt("Menos de 3.0 Goles Asiáticos (Reembolso si hay 3)", tot_g_s < 4)
                ]
            }
        ]
    }
    categories.append(cat_ah)

    # 7. TOP MARCADORES
    score_counts = pd.Series(exact_scores_v).value_counts()
    top_scores = score_counts.head(8)
    score_opts = []
    for sc, cnt in top_scores.items():
        rt = round((cnt / N) * 100.0, 1)
        score_opts.append({
            "pick": f"Marcador Exacto {sc} ({team}-Rival)",
            "hit_rate": f"{rt}%",
            "rate_num": rt,
            "record": f"{cnt}/{N} partidos",
            "fair_odds": f"{round(100.0/max(0.1, rt), 2)}x",
            "odds": f"{round(100.0/max(0.1, rt) * 1.12, 2)}x",
            "is_escalera": False
        })

    cat_exact = {
        "category": "🔢 Marcadores Exactos Más Frecuentes",
        "icon": "🔢",
        "markets": [
            {
                "title": "Top Marcadores Finales Registrados",
                "options": score_opts
            }
        ]
    }
    categories.append(cat_exact)

    return categories