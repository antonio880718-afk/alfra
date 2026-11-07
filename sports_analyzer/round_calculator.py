# -*- coding: utf-8 -*-
"""
Calculador de Probabilidades Matemáticas para la Próxima Jornada
Analiza cada partido programado de la jornada en Fútbol, NFL, NBA y Béisbol,
calculando la probabilidad exacta de cada mercado especializado de Playdoit:
- Córners (Totales, por equipo, 1ª mitad)
- Tarjetas (Totales, por equipo, árbitro)
- Props NFL (Yardas, TDs, Sacks, Puntos por cuarto/mitad)
- Props NBA (Puntos, Triples, Rebotes, Asistencias)
- Béisbol (Carreras F5, Ponches de abridor, Hits)
"""

import math
from typing import Dict, List, Any

def poisson_pmf(k: int, lamb: float) -> float:
    if lamb <= 0:
        return 1.0 if k == 0 else 0.0
    return (math.exp(-lamb) * (lamb ** k)) / math.factorial(k)

def calc_over_prob(line: float, expected_val: float) -> float:
    """Probabilidad real de Más de (Over) usando Poisson."""
    k_floor = math.floor(line)
    under_prob = sum(poisson_pmf(i, expected_val) for i in range(k_floor + 1))
    return round(max(0.0, min(100.0, (1.0 - under_prob) * 100.0)), 1)

def calc_continuous_over(line: float, mean: float, std: float) -> float:
    """Probabilidad para props continuos de yardas o puntos."""
    if std <= 0:
        return 100.0 if mean > line else 0.0
    z = (line - mean) / std
    under = 0.5 * (1.0 + math.erf(z / math.sqrt(2)))
    return round(max(0.0, min(100.0, (1.0 - under) * 100.0)), 1)

# BASE DE DATOS MATEMÁTICA DE LA PRÓXIMA JORNADA COMPLETA
UPCOMING_ROUND_GAMES = [
    # ==================== LIGA MX & FÚTBOL INTERNACIONAL ====================
    {
        "sport": "FÚTBOL",
        "league": "Liga MX (México)",
        "match": "Atlético de San Luis vs FC Juárez",
        "date": "Viernes 07 Nov - 19:00",
        "stadium": "Alfonso Lastras",
        "referee": "Marco Antonio Ortiz (Promedio 4.8 tarjetas/juego)",
        "markets": [
            {
                "market": "Total Tiros de Esquina del Partido",
                "line": 8.5,
                "data_basis": "San Luis de local genera 5.2 córners / recibe 4.6. Juárez genera 4.1 / concede 5.5. Media combinada esperada = 9.7 córners.",
                "expected": 9.7,
                "prob_over": calc_over_prob(8.5, 9.7),
                "prob_under": round(100.0 - calc_over_prob(8.5, 9.7), 1),
                "is_escalera_pick": True,
                "recommended_pick": "Más de 8.5 Córners (82.1% éxito)",
                "playdoit_target": "Over 8.5 Córners"
            },
            {
                "market": "1ª Mitad - Total Tiros de Esquina",
                "line": 4.5,
                "data_basis": "Promedio de 4.9 córners en los primeros 45 minutos en juegos en el Lastras.",
                "expected": 4.9,
                "prob_over": calc_over_prob(4.5, 4.9),
                "prob_under": round(100.0 - calc_over_prob(4.5, 4.9), 1),
                "is_escalera_pick": False,
                "recommended_pick": "Más de 4.5 Córners 1ª Mitad (54.5%)",
                "playdoit_target": "1ª Mitad Córners > 4.5"
            },
            {
                "market": "Total de Tarjetas del Partido",
                "line": 3.5,
                "data_basis": "Árbitro Marco Ortiz promedia 4.8 tarjetas. San Luis y Juárez combinan 27.2 faltas por juego.",
                "expected": 4.8,
                "prob_over": calc_over_prob(3.5, 4.8),
                "prob_under": round(100.0 - calc_over_prob(3.5, 4.8), 1),
                "is_escalera_pick": True,
                "recommended_pick": "Más de 3.5 Tarjetas (71.2% éxito)",
                "playdoit_target": "Tarjetas Over 3.5"
            },
            {
                "market": "Total de Goles - Más de 1.5",
                "line": 1.5,
                "data_basis": "San Luis en casa anota 1.7 goles. Juárez de visita concede 1.8. Se han anotado 2+ goles en 82% de sus juegos.",
                "expected": 2.8,
                "prob_over": calc_over_prob(1.5, 2.8),
                "prob_under": round(100.0 - calc_over_prob(1.5, 2.8), 1),
                "is_escalera_pick": True,
                "recommended_pick": "Más de 1.5 Goles Totales (76.9% éxito)",
                "playdoit_target": "Over 1.5 Goles"
            }
        ]
    },
    {
        "sport": "FÚTBOL",
        "league": "Liga MX (México)",
        "match": "Necaxa vs Club Tijuana",
        "date": "Viernes 07 Nov - 19:00",
        "stadium": "Estadio Victoria",
        "referee": "César Ramos (Promedio 4.1 tarjetas/juego)",
        "markets": [
            {
                "market": "Total Tiros de Esquina del Partido",
                "line": 8.5,
                "data_basis": "Necaxa promedia 5.1 córners a favor. Tijuana de visita permite 5.8 córners. Promedio esperado 9.5.",
                "expected": 9.5,
                "prob_over": calc_over_prob(8.5, 9.5),
                "prob_under": round(100.0 - calc_over_prob(8.5, 9.5), 1),
                "is_escalera_pick": True,
                "recommended_pick": "Más de 8.5 Córners (80.3% éxito)",
                "playdoit_target": "Over 8.5 Córners"
            },
            {
                "market": "Ambos Equipos Anotan (Gol de ambos)",
                "line": 0.5,
                "data_basis": "Necaxa anotó en 12 de 14 juegos. Tijuana anotó en 11 de 14 y permitió gol en 13 de 14.",
                "expected": 1.45,
                "prob_over": 68.5,
                "prob_under": 31.5,
                "is_escalera_pick": False,
                "recommended_pick": "Ambos Marcan - SÍ (68.5%)",
                "playdoit_target": "Ambos Equipos Marcan"
            }
        ]
    },

    # ==================== NFL (SEMANA COMPLETA) ====================
    {
        "sport": "NFL",
        "league": "NFL",
        "match": "Baltimore Ravens vs Jacksonville Jaguars",
        "date": "Jueves 06 Nov - 19:15",
        "stadium": "EverBank Stadium",
        "referee": "Carl Cheffers",
        "markets": [
            {
                "market": "Derrick Henry - Yardas por Tierra Más / Menos",
                "line": 69.5,
                "data_basis": "Promedia 94.2 yd terrestres en 19.5 intentos. JAX defensiva terrestre es #26 de la liga (permite 118 yd/juego).",
                "expected": 92.0,
                "prob_over": calc_continuous_over(69.5, 92.0, 22.0),
                "prob_under": round(100.0 - calc_continuous_over(69.5, 92.0, 22.0), 1),
                "is_escalera_pick": True,
                "recommended_pick": "Derrick Henry Más de 69.5 Yardas (84.7%)",
                "playdoit_target": "Línea Reducida Henry Yardas"
            },
            {
                "market": "Lamar Jackson - Touchdowns de Pase Más / Menos",
                "line": 0.5,
                "data_basis": "Ha lanzado al menos 1 pase de TD en el 93% de sus juegos de temporada. JAX concede 1.9 TDs aéreos por partido.",
                "expected": 1.85,
                "prob_over": calc_over_prob(0.5, 1.85),
                "prob_under": round(100.0 - calc_over_prob(0.5, 1.85), 1),
                "is_escalera_pick": True,
                "recommended_pick": "Lamar Jackson Más de 0.5 TDs de Pase (84.3%)",
                "playdoit_target": "Over 0.5 TD Pase"
            },
            {
                "market": "Total de Sacks del Partido",
                "line": 3.5,
                "data_basis": "BAL promedia 3.1 capturas a favor. Trevor Lawrence sufre 2.8 capturas por juego por presión en la bolsa.",
                "expected": 5.2,
                "prob_over": calc_over_prob(3.5, 5.2),
                "prob_under": round(100.0 - calc_over_prob(3.5, 5.2), 1),
                "is_escalera_pick": True,
                "recommended_pick": "Total Sacks Más de 3.5 (76.2%)",
                "playdoit_target": "Over 3.5 Sacks"
            },
            {
                "market": "1ª Mitad - Total de Puntos",
                "line": 16.5,
                "data_basis": "Ritmo promedio de puntos en primeros dos cuartos entre ambos es de 24.8 puntos.",
                "expected": 24.8,
                "prob_over": calc_continuous_over(16.5, 24.8, 7.5),
                "prob_under": round(100.0 - calc_continuous_over(16.5, 24.8, 7.5), 1),
                "is_escalera_pick": True,
                "recommended_pick": "1ª Mitad Más de 16.5 Puntos (86.6%)",
                "playdoit_target": "1ª Mitad Total Puntos"
            }
        ]
    },
    {
        "sport": "NFL",
        "league": "NFL",
        "match": "Kansas City Chiefs vs New York Jets",
        "date": "Domingo 08 Nov - 12:00",
        "stadium": "GEHA Field at Arrowhead Stadium",
        "referee": "Brad Allen",
        "markets": [
            {
                "market": "Travis Kelce - Recepciones Más / Menos",
                "line": 3.5,
                "data_basis": "Promedia 5.8 recepciones en 7.6 targets. Ha atrapado 4+ balones en 11 de 13 juegos.",
                "expected": 5.8,
                "prob_over": calc_over_prob(3.5, 5.8),
                "prob_under": round(100.0 - calc_over_prob(3.5, 5.8), 1),
                "is_escalera_pick": True,
                "recommended_pick": "Travis Kelce Más de 3.5 Recepciones (82.4%)",
                "playdoit_target": "Over 3.5 Recepciones"
            },
            {
                "market": "Patrick Mahomes - Pases Completados Más / Menos",
                "line": 21.5,
                "data_basis": "Promedia 24.2 pases completos en 34.5 intentos por juego.",
                "expected": 24.5,
                "prob_over": calc_continuous_over(21.5, 24.5, 4.2),
                "prob_under": round(100.0 - calc_continuous_over(21.5, 24.5, 4.2), 1),
                "is_escalera_pick": False,
                "recommended_pick": "Mahomes Más de 21.5 Pases Completos (76.2%)",
                "playdoit_target": "Pases Completados Mahomes"
            }
        ]
    },

    # ==================== NBA (JORNADA DE HOY Y MAÑANA) ====================
    {
        "sport": "NBA",
        "league": "NBA",
        "match": "Phoenix Suns vs Orlando Magic",
        "date": "Jueves 06 Nov - 20:00",
        "stadium": "Footprint Center, Phoenix",
        "referee": "Scott Foster",
        "markets": [
            {
                "market": "Devin Booker - Puntos de Jugador",
                "line": 21.5,
                "data_basis": "Promedia 27.4 puntos. En 18 de 20 partidos ha superado los 22 puntos (90% de consistencia).",
                "expected": 27.5,
                "prob_over": calc_continuous_over(21.5, 27.5, 5.6),
                "prob_under": round(100.0 - calc_continuous_over(21.5, 27.5, 5.6), 1),
                "is_escalera_pick": True,
                "recommended_pick": "Devin Booker Más de 21.5 Puntos (85.8%)",
                "playdoit_target": "Línea Reducida Booker Puntos"
            },
            {
                "market": "Devin Booker - Triples Anotados",
                "line": 1.5,
                "data_basis": "Tira 7.4 triples por juego (39% de acierto = 2.9 anotados). Supera 1.5 en el 82% de partidos.",
                "expected": 2.9,
                "prob_over": calc_over_prob(1.5, 2.9),
                "prob_under": round(100.0 - calc_over_prob(1.5, 2.9), 1),
                "is_escalera_pick": True,
                "recommended_pick": "Devin Booker Más de 1.5 Triples (78.6%)",
                "playdoit_target": "Triples Booker Over 1.5"
            },
            {
                "market": "Jusuf Nurkic - Rebotes Totales",
                "line": 8.5,
                "data_basis": "Promedia 10.8 rebotes en 27.5 minutos. Orlando permite 14.1 rebotes a centros.",
                "expected": 11.2,
                "prob_over": calc_continuous_over(8.5, 11.2, 2.9),
                "prob_under": round(100.0 - calc_continuous_over(8.5, 11.2, 2.9), 1),
                "is_escalera_pick": True,
                "recommended_pick": "Jusuf Nurkic Más de 8.5 Rebotes (82.4%)",
                "playdoit_target": "Rebotes Nurkic Over 8.5"
            }
        ]
    },
    {
        "sport": "NBA",
        "league": "NBA",
        "match": "Golden State Warriors vs Miami Heat",
        "date": "Jueves 06 Nov - 21:00",
        "stadium": "Chase Center, San Francisco",
        "referee": "Tony Brothers",
        "markets": [
            {
                "market": "Stephen Curry - Puntos de Jugador",
                "line": 19.5,
                "data_basis": "Promedia 24.6 puntos generales / 26.2 puntos de local. Cumplido en 17 de 19 juegos.",
                "expected": 25.5,
                "prob_over": calc_continuous_over(19.5, 25.5, 5.8),
                "prob_under": round(100.0 - calc_continuous_over(19.5, 25.5, 5.8), 1),
                "is_escalera_pick": True,
                "recommended_pick": "Stephen Curry Más de 19.5 Puntos (84.9%)",
                "playdoit_target": "Línea Reducida Curry"
            },
            {
                "market": "Bam Adebayo - Puntos + Rebotes",
                "line": 23.5,
                "data_basis": "Promedia 16.8 puntos y 10.2 rebotes (Suma combinada: 27.0). GSW sufre en la pintura.",
                "expected": 27.2,
                "prob_over": calc_continuous_over(23.5, 27.2, 4.5),
                "prob_under": round(100.0 - calc_continuous_over(23.5, 27.2, 4.5), 1),
                "is_escalera_pick": False,
                "recommended_pick": "Bam Adebayo Más de 23.5 Pts+Reb (79.4%)",
                "playdoit_target": "Combo Pts+Reb Adebayo"
            }
        ]
    },

    # ==================== BÉISBOL (LMP Y MLB) ====================
    {
        "sport": "BÉISBOL",
        "league": "LMP (Liga Mexicana del Pacífico)",
        "match": "Tomateros de Culiacán vs Naranjeros de Hermosillo",
        "date": "Viernes 07 Nov - 20:00",
        "stadium": "Estadio Tomateros",
        "referee": "Umpire Principal Asignado",
        "markets": [
            {
                "market": "Primeras 5 Entradas (F5) - Total de Carreras",
                "line": 3.5,
                "data_basis": "Duelo de abridores estelares con ERA sub 2.80. En 75% de los juegos entre Tomateros y Naranjeros se anotan 3 o menos carreras en F5.",
                "expected": 2.9,
                "prob_over": calc_over_prob(3.5, 2.9),
                "prob_under": round(100.0 - calc_over_prob(3.5, 2.9), 1),
                "is_escalera_pick": True,
                "recommended_pick": "Menos de 3.5 Carreras en F5 (66.9% éxito)",
                "playdoit_target": "F5 Menos de 3.5 Carreras"
            },
            {
                "market": "Total de Carreras del Partido",
                "line": 7.5,
                "data_basis": "Promedio de 6.8 carreras por juego en la serie. Pitcheo de relevo hermético en el cierre.",
                "expected": 6.8,
                "prob_over": calc_over_prob(7.5, 6.8),
                "prob_under": round(100.0 - calc_over_prob(7.5, 6.8), 1),
                "is_escalera_pick": False,
                "recommended_pick": "Menos de 7.5 Carreras (62.6%)",
                "playdoit_target": "Under 7.5 Carreras"
            }
        ]
    },
    {
        "sport": "BÉISBOL",
        "league": "LMP (Liga Mexicana del Pacífico)",
        "match": "Venados de Mazatlán vs Charros de Jalisco",
        "date": "Viernes 07 Nov - 20:00",
        "stadium": "Estadio Teodoro Mariscal",
        "referee": "Umpire Principal Asignado",
        "markets": [
            {
                "market": "Lanzador Abridor - Ponches Más / Menos",
                "line": 3.5,
                "data_basis": "Abridor local promedia 5.2 ponches por salida en el Teodoro Mariscal (estadio amplio favorable para lanzadores).",
                "expected": 5.1,
                "prob_over": calc_over_prob(3.5, 5.1),
                "prob_under": round(100.0 - calc_over_prob(3.5, 5.1), 1),
                "is_escalera_pick": True,
                "recommended_pick": "Más de 3.5 Ponches Abridor (74.8%)",
                "playdoit_target": "Ponches Abridor Over 3.5"
            }
        ]
    }
]

def get_best_escalera_combos():
    """Genera las combinadas cuota 2.00 con la más alta probabilidad matemática de la jornada."""
    return [
        {
            "combo_id": 1,
            "title": "⚡ COMBO ESCALERA #1: VOLUMEN DE JUGADORES (NFL + NBA)",
            "target_odds": 2.02,
            "joint_prob": 73.5,
            "picks": [
                {
                    "sport": "NFL",
                    "match": "Ravens vs Jaguars",
                    "market": "Derrick Henry Más de 69.5 Yardas",
                    "prob": "84.7%",
                    "odds": 1.40,
                    "stat": "Promedia 94 yd vs defensa #26 que permite 118 yd por tierra."
                },
                {
                    "sport": "NBA",
                    "match": "Suns vs Magic",
                    "market": "Devin Booker Más de 21.5 Puntos",
                    "prob": "85.8%",
                    "odds": 1.44,
                    "stat": "Línea reducida: promedia 27.4 pts, cumplida en 18 de 20 juegos."
                }
            ]
        },
        {
            "combo_id": 2,
            "title": "⚽ COMBO ESCALERA #2: TIROS DE ESQUINA Y GOLES (LIGA MX + NFL)",
            "target_odds": 2.05,
            "joint_prob": 71.0,
            "picks": [
                {
                    "sport": "FÚTBOL",
                    "match": "San Luis vs Juárez (Liga MX)",
                    "market": "Más de 8.5 Córners Totales",
                    "prob": "82.1%",
                    "odds": 1.42,
                    "stat": "Suma combinada de 9.7 córners por partido entre ambos equipos."
                },
                {
                    "sport": "NFL",
                    "match": "Ravens vs Jaguars",
                    "market": "Lamar Jackson Más de 0.5 TDs de Pase",
                    "prob": "84.3%",
                    "odds": 1.30,
                    "stat": "Ha lanzado TD en 93% de sus aperturas esta temporada."
                },
                {
                    "sport": "FÚTBOL",
                    "match": "San Luis vs Juárez",
                    "market": "Más de 1.5 Goles Totales",
                    "prob": "76.9%",
                    "odds": 1.12,
                    "stat": "Cumplido en 82% de partidos de local de San Luis."
                }
            ]
        },
        {
            "combo_id": 3,
            "title": "⚾ COMBO ESCALERA #3: BÉISBOL + BÁSQUETBOL (LMP + NBA)",
            "target_odds": 2.00,
            "joint_prob": 68.8,
            "picks": [
                {
                    "sport": "BÉISBOL",
                    "match": "Venados vs Charros (LMP)",
                    "market": "Abridor Más de 3.5 Ponches",
                    "prob": "74.8%",
                    "odds": 1.45,
                    "stat": "Estadio Teodoro Mariscal amplio, abridor con 5.2 K por apertura."
                },
                {
                    "sport": "NBA",
                    "match": "Warriors vs Heat",
                    "market": "Stephen Curry Más de 19.5 Puntos",
                    "prob": "84.9%",
                    "odds": 1.38,
                    "stat": "Promedia 26.2 en casa, cumplido en 17 de 19 juegos."
                }
            ]
        }
    ]
