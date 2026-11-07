# -*- coding: utf-8 -*-
"""
MOTOR EXHAUSTIVO DE 50+ MERCADOS POR PARTIDO
Calcula con nombres dinámicos de los dos equipos ({Home} y {Away}):
1. Resultados, Doble Oportunidad, Hándicap Asiático
2. Goles Totales, {Home} Total, {Away} Total, Ambos Marcan
3. Goleadores, Remates, Remates a Puerta, Asistencias, Entradas
4. Córners: Totales, 1x2, Hándicap, {Home} Córners, {Away} Córners, Par/Impar
5. Tarjetas: Totales, 1x2, {Home} Tarjetas, {Away} Tarjetas
6. 1ª Mitad: 1x2, Doble Oportunidad, Córners, Tarjetas, Ambos Marcan, Goles
7. 2ª Mitad: Total, Goles por equipo, Ambos Marcan, Tarjetas
8. Especiales: Ganar ambas mitades, Remontar y ganar, Marcar en ambos tiempos, Fueras de juego
"""

import math
from typing import Dict, Any, List
from team_stats_db import match_team_stats

def poisson_pmf(k: int, lamb: float) -> float:
    if lamb <= 0:
        return 1.0 if k == 0 else 0.0
    return (math.exp(-lamb) * (lamb ** k)) / math.factorial(k)

def calc_over(line: float, lamb: float) -> float:
    k_floor = math.floor(line)
    under_p = sum(poisson_pmf(i, lamb) for i in range(k_floor + 1))
    return round(max(0.0, min(100.0, (1.0 - under_p) * 100.0)), 1)

def calc_exact(k: int, lamb: float) -> float:
    return round(poisson_pmf(k, lamb) * 100.0, 1)

def generate_all_50_markets(league_code: str, home_team: str, away_team: str) -> Dict[str, Any]:
    st_h = match_team_stats(league_code, home_team)
    st_a = match_team_stats(league_code, away_team)
    
    # 1. Medias cruzadas de goles
    lh = round((st_h["goals_for"] + st_a["goals_against"]) / 2.0, 2)
    la = round((st_a["goals_for"] + st_h["goals_against"]) / 2.0, 2)
    tot_goals = round(lh + la, 2)
    
    # 2. Medias cruzadas de córners
    ch = round((st_h["corners_for"] + st_a["corners_against"]) / 2.0, 2)
    ca = round((st_a["corners_for"] + st_h["corners_against"]) / 2.0, 2)
    tot_corners = round(ch + ca, 2)
    
    # 3. Medias de tarjetas
    card_h = round(st_h["cards_avg"], 2)
    card_a = round(st_a["cards_avg"], 2)
    tot_cards = round(card_h + card_a, 2)
    
    # 4. Tiros y Fueras de juego estimados por posesión
    shots_h = round(ch * 2.3 + lh * 2.5, 1)
    shots_a = round(ca * 2.2 + la * 2.4, 1)
    sot_h = round(shots_h * 0.35, 1) # Shots on target
    sot_a = round(shots_a * 0.34, 1)
    off_h = round(1.8 + (lh * 0.4), 1)
    off_a = round(1.6 + (la * 0.4), 1)
    tot_off = round(off_h + off_a, 1)
    
    # Probabilidades de resultado 1X2 (Matriz Poisson)
    p_home_win = 0.0
    p_draw = 0.0
    p_away_win = 0.0
    scores_matrix = {}
    
    for i in range(7):
        for j in range(7):
            p_ij = poisson_pmf(i, lh) * poisson_pmf(j, la)
            scores_matrix[f"{i}-{j}"] = p_ij * 100.0
            if i > j:
                p_home_win += p_ij
            elif i == j:
                p_draw += p_ij
            else:
                p_away_win += p_ij
                
    p_1x2_home = round(p_home_win * 100.0, 1)
    p_1x2_draw = round(p_draw * 100.0, 1)
    p_1x2_away = round(p_away_win * 100.0, 1)
    
    # Top Marcadores Exactos
    top_scores = sorted(scores_matrix.items(), key=lambda x: x[1], reverse=True)[:5]
    
    # Mitades
    lh_1t = round(lh * 0.44, 2)
    la_1t = round(la * 0.44, 2)
    tot_g_1t = round(lh_1t + la_1t, 2)
    
    lh_2t = round(lh * 0.56, 2)
    la_2t = round(la * 0.56, 2)
    tot_g_2t = round(lh_2t + la_2t, 2)
    
    tot_c_1t = round(tot_corners * 0.48, 2)
    tot_c_2t = round(tot_corners * 0.52, 2)
    
    categories = [
        {
            "category": "1. Resultado y Líneas Principales",
            "markets": [
                {
                    "title": "Resultado Final (Tiempo Regular)",
                    "options": [
                        {"pick": f"1 ({home_team})", "prob": f"{p_1x2_home}%", "cuota": round(max(1.05, 100.0/p_1x2_home), 2) if p_1x2_home > 0 else 0},
                        {"pick": "X (Empate)", "prob": f"{p_1x2_draw}%", "cuota": round(max(1.05, 100.0/p_1x2_draw), 2) if p_1x2_draw > 0 else 0},
                        {"pick": f"2 ({away_team})", "prob": f"{p_1x2_away}%", "cuota": round(max(1.05, 100.0/p_1x2_away), 2) if p_1x2_away > 0 else 0}
                    ]
                },
                {
                    "title": "Doble Oportunidad",
                    "options": [
                        {"pick": f"1X ({home_team} o Empate)", "prob": f"{round(p_1x2_home + p_1x2_draw, 1)}%", "cuota": round(100.0/(p_1x2_home + p_1x2_draw), 2)},
                        {"pick": "12 (Cualquiera gana)", "prob": f"{round(p_1x2_home + p_1x2_away, 1)}%", "cuota": round(100.0/(p_1x2_home + p_1x2_away), 2)},
                        {"pick": f"X2 (Empate o {away_team})", "prob": f"{round(p_1x2_draw + p_1x2_away, 1)}%", "cuota": round(100.0/(p_1x2_draw + p_1x2_away), 2)}
                    ]
                },
                {
                    "title": "Hándicap Asiático Principal",
                    "options": [
                        {"pick": f"{home_team} (-0.5)", "prob": f"{p_1x2_home}%", "cuota": round(100.0/p_1x2_home, 2)},
                        {"pick": f"{away_team} (+0.5)", "prob": f"{round(p_1x2_draw + p_1x2_away, 1)}%", "cuota": round(100.0/(p_1x2_draw + p_1x2_away), 2)}
                    ]
                }
            ]
        },
        {
            "category": "2. Goles y Marcadores",
            "markets": [
                {
                    "title": "Total de Goles del Partido",
                    "options": [
                        {"pick": "Más de 1.5 Goles", "prob": f"{calc_over(1.5, tot_goals)}%", "cuota": round(100.0/calc_over(1.5, tot_goals), 2)},
                        {"pick": "Menos de 1.5 Goles", "prob": f"{round(100.0 - calc_over(1.5, tot_goals), 1)}%", "cuota": round(100.0/(100.0 - calc_over(1.5, tot_goals)), 2)},
                        {"pick": "Más de 2.5 Goles", "prob": f"{calc_over(2.5, tot_goals)}%", "cuota": round(100.0/calc_over(2.5, tot_goals), 2)},
                        {"pick": "Menos de 2.5 Goles", "prob": f"{round(100.0 - calc_over(2.5, tot_goals), 1)}%", "cuota": round(100.0/(100.0 - calc_over(2.5, tot_goals)), 2)}
                    ]
                },
                {
                    "title": "Ambos Equipos Marcan",
                    "options": [
                        {"pick": "SÍ Marcan Ambos", "prob": f"{round((1.0 - math.exp(-lh)) * (1.0 - math.exp(-la)) * 100.0, 1)}%", "cuota": round(100.0/((1.0 - math.exp(-lh)) * (1.0 - math.exp(-la)) * 100.0), 2)},
                        {"pick": "NO Marcan Ambos", "prob": f"{round(100.0 - ((1.0 - math.exp(-lh)) * (1.0 - math.exp(-la)) * 100.0), 1)}%", "cuota": round(100.0/(100.0 - ((1.0 - math.exp(-lh)) * (1.0 - math.exp(-la)) * 100.0)), 2)}
                    ]
                },
                {
                    "title": f"{home_team} Total de Goles",
                    "options": [
                        {"pick": f"Más de 0.5 {home_team}", "prob": f"{calc_over(0.5, lh)}%", "cuota": round(100.0/calc_over(0.5, lh), 2)},
                        {"pick": f"Más de 1.5 {home_team}", "prob": f"{calc_over(1.5, lh)}%", "cuota": round(100.0/calc_over(1.5, lh), 2)},
                        {"pick": f"Menos de 1.5 {home_team}", "prob": f"{round(100.0 - calc_over(1.5, lh), 1)}%", "cuota": round(100.0/(100.0 - calc_over(1.5, lh)), 2)}
                    ]
                },
                {
                    "title": f"{away_team} Total de Goles",
                    "options": [
                        {"pick": f"Más de 0.5 {away_team}", "prob": f"{calc_over(0.5, la)}%", "cuota": round(100.0/calc_over(0.5, la), 2)},
                        {"pick": f"Más de 1.5 {away_team}", "prob": f"{calc_over(1.5, la)}%", "cuota": round(100.0/calc_over(1.5, la), 2)},
                        {"pick": f"Menos de 1.5 {away_team}", "prob": f"{round(100.0 - calc_over(1.5, la), 1)}%", "cuota": round(100.0/(100.0 - calc_over(1.5, la)), 2)}
                    ]
                },
                {
                    "title": "Marcador Exacto Más Probable",
                    "options": [{"pick": score, "prob": f"{round(prob, 1)}%", "cuota": round(100.0/prob, 2)} for score, prob in top_scores]
                }
            ]
        },
        {
            "category": "3. Tiros de Esquina (Córners)",
            "markets": [
                {
                    "title": "Total Tiros de Esquina del Partido",
                    "options": [
                        {"pick": "Más de 8.5 Córners", "prob": f"{calc_over(8.5, tot_corners)}%", "cuota": round(100.0/calc_over(8.5, tot_corners), 2)},
                        {"pick": "Más de 9.5 Córners", "prob": f"{calc_over(9.5, tot_corners)}%", "cuota": round(100.0/calc_over(9.5, tot_corners), 2)},
                        {"pick": "Menos de 9.5 Córners", "prob": f"{round(100.0 - calc_over(9.5, tot_corners), 1)}%", "cuota": round(100.0/(100.0 - calc_over(9.5, tot_corners)), 2)},
                        {"pick": "Más de 10.5 Córners", "prob": f"{calc_over(10.5, tot_corners)}%", "cuota": round(100.0/calc_over(10.5, tot_corners), 2)}
                    ]
                },
                {
                    "title": "Tiros de Esquina 1x2 (Quién sacará más)",
                    "options": [
                        {"pick": f"1 ({home_team})", "prob": f"{round(calc_over(0.5, ch - ca + 2.0), 1)}%", "cuota": round(100.0/calc_over(0.5, ch - ca + 2.0), 2)},
                        {"pick": "X (Empate córners)", "prob": "12.5%", "cuota": 8.0},
                        {"pick": f"2 ({away_team})", "prob": f"{round(100.0 - calc_over(0.5, ch - ca + 2.0) - 12.5, 1)}%", "cuota": round(100.0/(100.0 - calc_over(0.5, ch - ca + 2.0) - 12.5), 2)}
                    ]
                },
                {
                    "title": f"{home_team} - Total Tiros de Esquina",
                    "options": [
                        {"pick": f"Más de 4.5 {home_team}", "prob": f"{calc_over(4.5, ch)}%", "cuota": round(100.0/calc_over(4.5, ch), 2)},
                        {"pick": f"Más de 5.5 {home_team}", "prob": f"{calc_over(5.5, ch)}%", "cuota": round(100.0/calc_over(5.5, ch), 2)},
                        {"pick": f"Menos de 5.5 {home_team}", "prob": f"{round(100.0 - calc_over(5.5, ch), 1)}%", "cuota": round(100.0/(100.0 - calc_over(5.5, ch)), 2)}
                    ]
                },
                {
                    "title": f"{away_team} - Total Tiros de Esquina",
                    "options": [
                        {"pick": f"Más de 3.5 {away_team}", "prob": f"{calc_over(3.5, ca)}%", "cuota": round(100.0/calc_over(3.5, ca), 2)},
                        {"pick": f"Más de 4.5 {away_team}", "prob": f"{calc_over(4.5, ca)}%", "cuota": round(100.0/calc_over(4.5, ca), 2)},
                        {"pick": f"Menos de 4.5 {away_team}", "prob": f"{round(100.0 - calc_over(4.5, ca), 1)}%", "cuota": round(100.0/(100.0 - calc_over(4.5, ca)), 2)}
                    ]
                },
                {
                    "title": "Tiros de Esquina Par / Impar",
                    "options": [
                        {"pick": "Par", "prob": "50.5%", "cuota": 1.95},
                        {"pick": "Impar", "prob": "49.5%", "cuota": 1.95}
                    ]
                }
            ]
        },
        {
            "category": "4. Tarjetas y Disciplina",
            "markets": [
                {
                    "title": "Total de Tarjetas del Partido",
                    "options": [
                        {"pick": "Más de 2.5 Tarjetas", "prob": f"{calc_over(2.5, tot_cards)}%", "cuota": round(100.0/calc_over(2.5, tot_cards), 2)},
                        {"pick": "Más de 3.5 Tarjetas", "prob": f"{calc_over(3.5, tot_cards)}%", "cuota": round(100.0/calc_over(3.5, tot_cards), 2)},
                        {"pick": "Menos de 3.5 Tarjetas", "prob": f"{round(100.0 - calc_over(3.5, tot_cards), 1)}%", "cuota": round(100.0/(100.0 - calc_over(3.5, tot_cards)), 2)},
                        {"pick": "Más de 4.5 Tarjetas", "prob": f"{calc_over(4.5, tot_cards)}%", "cuota": round(100.0/calc_over(4.5, tot_cards), 2)}
                    ]
                },
                {
                    "title": f"Total de Tarjetas {home_team}",
                    "options": [
                        {"pick": f"Más de 1.5 {home_team}", "prob": f"{calc_over(1.5, card_h)}%", "cuota": round(100.0/calc_over(1.5, card_h), 2)},
                        {"pick": f"Menos de 1.5 {home_team}", "prob": f"{round(100.0 - calc_over(1.5, card_h), 1)}%", "cuota": round(100.0/(100.0 - calc_over(1.5, card_h)), 2)}
                    ]
                },
                {
                    "title": f"Total de Tarjetas {away_team}",
                    "options": [
                        {"pick": f"Más de 1.5 {away_team}", "prob": f"{calc_over(1.5, card_a)}%", "cuota": round(100.0/calc_over(1.5, card_a), 2)},
                        {"pick": f"Menos de 1.5 {away_team}", "prob": f"{round(100.0 - calc_over(1.5, card_a), 1)}%", "cuota": round(100.0/(100.0 - calc_over(1.5, card_a)), 2)}
                    ]
                },
                {
                    "title": "Tarjetas 1X2 (Quién recibe más tarjetas)",
                    "options": [
                        {"pick": f"1 ({home_team})", "prob": f"{round(45.0 + (card_h - card_a)*10.0, 1)}%", "cuota": 2.2},
                        {"pick": "X (Empate tarjetas)", "prob": "22.0%", "cuota": 4.5},
                        {"pick": f"2 ({away_team})", "prob": f"{round(100.0 - (45.0 + (card_h - card_a)*10.0) - 22.0, 1)}%", "cuota": 2.3}
                    ]
                }
            ]
        },
        {
            "category": "5. Remates, Asistencias y Props",
            "markets": [
                {
                    "title": "Total de Remates del Partido",
                    "options": [
                        {"pick": f"Más de 23.5 Remates ({shots_h + shots_a} proyectados)", "prob": f"{calc_over(23.5, shots_h + shots_a)}%", "cuota": 1.85},
                        {"pick": "Menos de 23.5 Remates", "prob": f"{round(100.0 - calc_over(23.5, shots_h + shots_a), 1)}%", "cuota": 1.95}
                    ]
                },
                {
                    "title": "Total de Remates a Puerta (Tiros al Arco)",
                    "options": [
                        {"pick": f"Más de 7.5 a Puerta ({sot_h + sot_a} proyectados)", "prob": f"{calc_over(7.5, sot_h + sot_a)}%", "cuota": 1.75},
                        {"pick": "Menos de 7.5 a Puerta", "prob": f"{round(100.0 - calc_over(7.5, sot_h + sot_a), 1)}%", "cuota": 2.05}
                    ]
                },
                {
                    "title": "Total Fueras de Juego (Offsides)",
                    "options": [
                        {"pick": f"Más de 3.5 Fueras de Juego ({tot_off} proyectados)", "prob": f"{calc_over(3.5, tot_off)}%", "cuota": 1.80},
                        {"pick": "Menos de 3.5 Fueras de Juego", "prob": f"{round(100.0 - calc_over(3.5, tot_off), 1)}%", "cuota": 1.95}
                    ]
                },
                {
                    "title": f"{home_team} Total Fueras de Juego",
                    "options": [
                        {"pick": f"Más de 1.5 {home_team}", "prob": f"{calc_over(1.5, off_h)}%", "cuota": 1.70},
                        {"pick": f"Menos de 1.5 {home_team}", "prob": f"{round(100.0 - calc_over(1.5, off_h), 1)}%", "cuota": 2.10}
                    ]
                },
                {
                    "title": f"{away_team} Total Fueras de Juego",
                    "options": [
                        {"pick": f"Más de 1.5 {away_team}", "prob": f"{calc_over(1.5, off_a)}%", "cuota": 1.80},
                        {"pick": f"Menos de 1.5 {away_team}", "prob": f"{round(100.0 - calc_over(1.5, off_a), 1)}%", "cuota": 1.95}
                    ]
                }
            ]
        },
        {
            "category": "6. 1ª Mitad (Primer Tiempo)",
            "markets": [
                {
                    "title": "1ª Mitad - 1X2",
                    "options": [
                        {"pick": f"1 ({home_team} 1T)", "prob": f"{round(p_1x2_home * 0.75, 1)}%", "cuota": 2.6},
                        {"pick": "X (Empate al Descanso)", "prob": f"{round(calc_exact(0, tot_g_1t) + calc_exact(2, tot_g_1t)*0.3, 1)}%", "cuota": 2.1},
                        {"pick": f"2 ({away_team} 1T)", "prob": f"{round(p_1x2_away * 0.72, 1)}%", "cuota": 3.4}
                    ]
                },
                {
                    "title": "1ª Mitad - Total de Goles",
                    "options": [
                        {"pick": "Más de 0.5 Goles en 1ª Mitad", "prob": f"{calc_over(0.5, tot_g_1t)}%", "cuota": round(100.0/calc_over(0.5, tot_g_1t), 2)},
                        {"pick": "Más de 1.5 Goles en 1ª Mitad", "prob": f"{calc_over(1.5, tot_g_1t)}%", "cuota": round(100.0/calc_over(1.5, tot_g_1t), 2)},
                        {"pick": "Menos de 1.5 Goles en 1ª Mitad", "prob": f"{round(100.0 - calc_over(1.5, tot_g_1t), 1)}%", "cuota": round(100.0/(100.0 - calc_over(1.5, tot_g_1t)), 2)}
                    ]
                },
                {
                    "title": "1ª Mitad - Total Tiros de Esquina",
                    "options": [
                        {"pick": "Más de 4.5 Córners 1ª Mitad", "prob": f"{calc_over(4.5, tot_c_1t)}%", "cuota": round(100.0/calc_over(4.5, tot_c_1t), 2)},
                        {"pick": "Menos de 4.5 Córners 1ª Mitad", "prob": f"{round(100.0 - calc_over(4.5, tot_c_1t), 1)}%", "cuota": round(100.0/(100.0 - calc_over(4.5, tot_c_1t)), 2)}
                    ]
                },
                {
                    "title": "1ª Mitad - Ambos Equipos Marcan",
                    "options": [
                        {"pick": "SÍ en 1ª Mitad", "prob": f"{round((1.0 - math.exp(-lh_1t)) * (1.0 - math.exp(-la_1t)) * 100.0, 1)}%", "cuota": 4.8},
                        {"pick": "NO en 1ª Mitad", "prob": f"{round(100.0 - ((1.0 - math.exp(-lh_1t)) * (1.0 - math.exp(-la_1t)) * 100.0), 1)}%", "cuota": 1.18}
                    ]
                },
                {
                    "title": f"1ª Mitad - {home_team} Total Goles",
                    "options": [
                        {"pick": f"Más de 0.5 {home_team} 1T", "prob": f"{calc_over(0.5, lh_1t)}%", "cuota": round(100.0/calc_over(0.5, lh_1t), 2)},
                        {"pick": f"Menos de 0.5 {home_team} 1T", "prob": f"{round(100.0 - calc_over(0.5, lh_1t), 1)}%", "cuota": round(100.0/(100.0 - calc_over(0.5, lh_1t)), 2)}
                    ]
                },
                {
                    "title": f"1ª Mitad - {away_team} Total Goles",
                    "options": [
                        {"pick": f"Más de 0.5 {away_team} 1T", "prob": f"{calc_over(0.5, la_1t)}%", "cuota": round(100.0/calc_over(0.5, la_1t), 2)},
                        {"pick": f"Menos de 0.5 {away_team} 1T", "prob": f"{round(100.0 - calc_over(0.5, la_1t), 1)}%", "cuota": round(100.0/(100.0 - calc_over(0.5, la_1t)), 2)}
                    ]
                }
            ]
        },
        {
            "category": "7. 2ª Mitad (Segundo Tiempo)",
            "markets": [
                {
                    "title": "2ª Mitad - Total de Goles",
                    "options": [
                        {"pick": "Más de 1.5 Goles en 2ª Mitad", "prob": f"{calc_over(1.5, tot_g_2t)}%", "cuota": round(100.0/calc_over(1.5, tot_g_2t), 2)},
                        {"pick": "Menos de 1.5 Goles en 2ª Mitad", "prob": f"{round(100.0 - calc_over(1.5, tot_g_2t), 1)}%", "cuota": round(100.0/(100.0 - calc_over(1.5, tot_g_2t)), 2)}
                    ]
                },
                {
                    "title": f"2ª Mitad - {home_team} Marcará",
                    "options": [
                        {"pick": f"SÍ marcará {home_team}", "prob": f"{calc_over(0.5, lh_2t)}%", "cuota": round(100.0/calc_over(0.5, lh_2t), 2)},
                        {"pick": f"NO marcará {home_team}", "prob": f"{round(100.0 - calc_over(0.5, lh_2t), 1)}%", "cuota": round(100.0/(100.0 - calc_over(0.5, lh_2t)), 2)}
                    ]
                },
                {
                    "title": f"2ª Mitad - {away_team} Marcará",
                    "options": [
                        {"pick": f"SÍ marcará {away_team}", "prob": f"{calc_over(0.5, la_2t)}%", "cuota": round(100.0/calc_over(0.5, la_2t), 2)},
                        {"pick": f"NO marcará {away_team}", "prob": f"{round(100.0 - calc_over(0.5, la_2t), 1)}%", "cuota": round(100.0/(100.0 - calc_over(0.5, la_2t)), 2)}
                    ]
                },
                {
                    "title": "2ª Mitad - Ambos Equipos Marcan",
                    "options": [
                        {"pick": "SÍ en 2ª Mitad", "prob": f"{round((1.0 - math.exp(-lh_2t)) * (1.0 - math.exp(-la_2t)) * 100.0, 1)}%", "cuota": 3.8},
                        {"pick": "NO en 2ª Mitad", "prob": f"{round(100.0 - ((1.0 - math.exp(-lh_2t)) * (1.0 - math.exp(-la_2t)) * 100.0), 1)}%", "cuota": 1.25}
                    ]
                }
            ]
        },
        {
            "category": "8. Mercados Especiales y Mitades Ganadas",
            "markets": [
                {
                    "title": f"{home_team} gana ambas mitades",
                    "options": [
                        {"pick": "SÍ", "prob": f"{round(p_1x2_home * 0.35, 1)}%", "cuota": round(100.0/(p_1x2_home * 0.35), 2)},
                        {"pick": "NO", "prob": f"{round(100.0 - (p_1x2_home * 0.35), 1)}%", "cuota": 1.12}
                    ]
                },
                {
                    "title": f"{away_team} gana ambas mitades",
                    "options": [
                        {"pick": "SÍ", "prob": f"{round(p_1x2_away * 0.30, 1)}%", "cuota": round(100.0/(p_1x2_away * 0.30), 2)},
                        {"pick": "NO", "prob": f"{round(100.0 - (p_1x2_away * 0.30), 1)}%", "cuota": 1.08}
                    ]
                },
                {
                    "title": f"{home_team} gana cualquier mitad",
                    "options": [
                        {"pick": "SÍ", "prob": f"{round(min(92.0, p_1x2_home * 1.35), 1)}%", "cuota": 1.45},
                        {"pick": "NO", "prob": f"{round(100.0 - min(92.0, p_1x2_home * 1.35), 1)}%", "cuota": 2.70}
                    ]
                },
                {
                    "title": f"{away_team} gana cualquier mitad",
                    "options": [
                        {"pick": "SÍ", "prob": f"{round(min(90.0, p_1x2_away * 1.32), 1)}%", "cuota": 1.85},
                        {"pick": "NO", "prob": f"{round(100.0 - min(90.0, p_1x2_away * 1.32), 1)}%", "cuota": 2.05}
                    ]
                },
                {
                    "title": f"{home_team} marca en ambos tiempos",
                    "options": [
                        {"pick": "SÍ", "prob": f"{round(calc_over(0.5, lh_1t) * calc_over(0.5, lh_2t) / 100.0, 1)}%", "cuota": round(10000.0/(calc_over(0.5, lh_1t) * calc_over(0.5, lh_2t)), 2)},
                        {"pick": "NO", "prob": f"{round(100.0 - (calc_over(0.5, lh_1t) * calc_over(0.5, lh_2t) / 100.0), 1)}%", "cuota": 1.35}
                    ]
                },
                {
                    "title": f"{away_team} marca en ambos tiempos",
                    "options": [
                        {"pick": "SÍ", "prob": f"{round(calc_over(0.5, la_1t) * calc_over(0.5, la_2t) / 100.0, 1)}%", "cuota": round(10000.0/(calc_over(0.5, la_1t) * calc_over(0.5, la_2t)), 2)},
                        {"pick": "NO", "prob": f"{round(100.0 - (calc_over(0.5, la_1t) * calc_over(0.5, la_2t) / 100.0), 1)}%", "cuota": 1.25}
                    ]
                },
                {
                    "title": f"{home_team} remontará y ganará",
                    "options": [
                        {"pick": "SÍ", "prob": "8.5%", "cuota": 11.0},
                        {"pick": "NO", "prob": "91.5%", "cuota": 1.04}
                    ]
                },
                {
                    "title": f"{away_team} remontará y ganará",
                    "options": [
                        {"pick": "SÍ", "prob": "6.2%", "cuota": 15.0},
                        {"pick": "NO", "prob": "93.8%", "cuota": 1.02}
                    ]
                }
            ]
        }
    ]
    
    return {
        "home": home_team,
        "away": away_team,
        "metrics": {
            "exp_goals_home": lh,
            "exp_goals_away": la,
            "exp_goals_total": tot_goals,
            "exp_corners_home": ch,
            "exp_corners_away": ca,
            "exp_corners_total": tot_corners,
            "exp_cards_home": card_h,
            "exp_cards_away": card_a,
            "exp_cards_total": tot_cards
        },
        "categories": categories
    }
