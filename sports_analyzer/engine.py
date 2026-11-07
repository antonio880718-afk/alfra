import math
from typing import Dict, Any, List

def american_to_decimal(american: float) -> float:
    if american > 0:
        return 1.0 + (american / 100.0)
    else:
        return 1.0 + (100.0 / abs(american))

def decimal_to_implied(decimal: float) -> float:
    if decimal <= 1.0:
        return 100.0
    return (1.0 / decimal) * 100.0

def poisson_pmf(k: int, lamb: float) -> float:
    if lamb <= 0:
        return 1.0 if k == 0 else 0.0
    return (math.exp(-lamb) * (lamb ** k)) / math.factorial(k)

def poisson_over(k_line: float, lamb: float) -> float:
    k_floor = math.floor(k_line)
    under_prob = sum(poisson_pmf(i, lamb) for i in range(k_floor + 1))
    return max(0.0, min(1.0, 1.0 - under_prob)) * 100.0

def normal_over(line: float, mean: float, std_dev: float) -> float:
    if std_dev <= 0:
        return 100.0 if mean > line else 0.0
    z = (line - mean) / std_dev
    prob_under = 0.5 * (1.0 + math.erf(z / math.sqrt(2)))
    return (1.0 - prob_under) * 100.0

def calculate_ev(real_prob_pct: float, decimal_odds: float) -> float:
    prob = real_prob_pct / 100.0
    ev = (prob * (decimal_odds - 1.0)) - (1.0 - prob)
    return round(ev * 100.0, 1)

MARKETS_DATA = {
    "NFL": {
        "event": "Baltimore Ravens vs Jacksonville Jaguars",
        "date": "Hoy / 19:15",
        "categories": [
            {
                "category": "Pases y Yardas de QB (Lamar Jackson)",
                "markets": [
                    {
                        "name": "Yardas de pase Más / Menos (Lamar Jackson)",
                        "line": 218.5,
                        "stat_basis": "Promedia 232.4 yd/juego. JAX defensiva aérea permite 244.1 yd/juego (Rango 28)",
                        "model_projected": 236.0,
                        "model_std": 38.0,
                        "selection_over": "Más de 218.5",
                        "selection_under": "Menos de 218.5",
                        "playdoit_odds_over": -115,
                        "playdoit_odds_under": -115,
                        "calc_type": "continuous"
                    },
                    {
                        "name": "Touchdowns de pase Más / Menos (Lamar Jackson)",
                        "line": 1.5,
                        "stat_basis": "Promedia 1.83 TDs/juego. JAX permite 1.9 TDs aéreos por juego.",
                        "model_projected": 1.85,
                        "selection_over": "Más de 1.5",
                        "selection_under": "Menos de 1.5",
                        "playdoit_odds_over": 110,
                        "playdoit_odds_under": -140,
                        "calc_type": "poisson"
                    },
                    {
                        "name": "Intercepciones de QB (Lamar Jackson)",
                        "line": 0.5,
                        "stat_basis": "Promedia 0.38 INT/juego. JAX fuerza 0.6 INT por juego.",
                        "model_projected": 0.45,
                        "selection_over": "Más de 0.5",
                        "selection_under": "Menos de 0.5",
                        "playdoit_odds_over": 125,
                        "playdoit_odds_under": -165,
                        "calc_type": "poisson"
                    }
                ]
            },
            {
                "category": "Acarreo y Recepción",
                "markets": [
                    {
                        "name": "Derrick Henry - Yardas por tierra Más / Menos",
                        "line": 84.5,
                        "stat_basis": "Promedia 94.2 yd/juego con 19.5 acarreos. JAX permite 112.5 yd terrestres.",
                        "model_projected": 92.5,
                        "model_std": 22.0,
                        "selection_over": "Más de 84.5",
                        "selection_under": "Menos de 84.5",
                        "playdoit_odds_over": -115,
                        "playdoit_odds_under": -115,
                        "calc_type": "continuous"
                    },
                    {
                        "name": "Brian Thomas Jr. - Yardas de recepción Más / Menos",
                        "line": 52.5,
                        "stat_basis": "Promedia 63.8 yd con 6.2 targets. BAL permite 68.2 yd a receptores externos.",
                        "model_projected": 59.0,
                        "model_std": 19.5,
                        "selection_over": "Más de 52.5",
                        "selection_under": "Menos de 52.5",
                        "playdoit_odds_over": -110,
                        "playdoit_odds_under": -120,
                        "calc_type": "continuous"
                    }
                ]
            },
            {
                "category": "Touchdowns y Defensiva",
                "markets": [
                    {
                        "name": "Anotador de Touchdown en Cualquier Momento (Derrick Henry)",
                        "line": 0.5,
                        "stat_basis": "Anotó en 11 de 14 juegos (78.5% histórico esta temporada). 85% de toques en línea de gol.",
                        "model_projected": 1.15,
                        "selection_over": "Sí (Anota TD)",
                        "selection_under": "No anota",
                        "playdoit_odds_over": -175,
                        "playdoit_odds_under": 135,
                        "calc_type": "poisson"
                    },
                    {
                        "name": "Total de Sacks en el Partido",
                        "line": 4.5,
                        "stat_basis": "BAL genera 3.1 sacks/juego, JAX permite 2.8 sacks concedidos por presión.",
                        "model_projected": 5.2,
                        "selection_over": "Más de 4.5",
                        "selection_under": "Menos de 4.5",
                        "playdoit_odds_over": -105,
                        "playdoit_odds_under": -125,
                        "calc_type": "poisson"
                    },
                    {
                        "name": "Total de Goles de Campo completados",
                        "line": 3.5,
                        "stat_basis": "Tucker + Little promedian combinado 3.8 intentos FG por juego.",
                        "model_projected": 3.65,
                        "selection_over": "Más de 3.5",
                        "selection_under": "Menos de 3.5",
                        "playdoit_odds_over": 115,
                        "playdoit_odds_under": -145,
                        "calc_type": "poisson"
                    }
                ]
            }
        ]
    },
    "NBA": {
        "event": "Orlando Magic at Phoenix Suns",
        "date": "Hoy / 20:00",
        "categories": [
            {
                "category": "Puntos y Anotación de Jugador",
                "markets": [
                    {
                        "name": "Puntos de Jugador - Devin Booker",
                        "line": 26.5,
                        "stat_basis": "Promedia 27.4 pts en 35.8 min. Orlando permite 25.1 pts a escoltas rivales.",
                        "model_projected": 27.8,
                        "model_std": 5.8,
                        "selection_over": "Más de 26.5",
                        "selection_under": "Menos de 26.5",
                        "playdoit_odds_over": -115,
                        "playdoit_odds_under": -115,
                        "calc_type": "continuous"
                    },
                    {
                        "name": "Puntos de Jugador - Franz Wagner",
                        "line": 22.5,
                        "stat_basis": "Promedia 23.8 pts sin Banchero (USG% sube a 31.2%). Phoenix ritmo alto (101.4).",
                        "model_projected": 24.6,
                        "model_std": 5.2,
                        "selection_over": "Más de 22.5",
                        "selection_under": "Menos de 22.5",
                        "playdoit_odds_over": -110,
                        "playdoit_odds_under": -120,
                        "calc_type": "continuous"
                    }
                ]
            },
            {
                "category": "Triples, Rebotes y Asistencias",
                "markets": [
                    {
                        "name": "Triples anotados de Jugador - Devin Booker",
                        "line": 2.5,
                        "stat_basis": "Promedia 2.9 triples en 7.4 intentos (39.1% acierto). Orlando ranking 18 defendiendo perímetro.",
                        "model_projected": 2.95,
                        "selection_over": "Más de 2.5",
                        "selection_under": "Menos de 2.5",
                        "playdoit_odds_over": 110,
                        "playdoit_odds_under": -140,
                        "calc_type": "poisson"
                    },
                    {
                        "name": "Rebotes de Jugador - Jusuf Nurkic",
                        "line": 10.5,
                        "stat_basis": "Promedia 10.8 rebotes en 27 min. Magic top 5 en permitir rebotes ofensivos.",
                        "model_projected": 11.4,
                        "model_std": 3.1,
                        "selection_over": "Más de 10.5",
                        "selection_under": "Menos de 10.5",
                        "playdoit_odds_over": -105,
                        "playdoit_odds_under": -125,
                        "calc_type": "continuous"
                    },
                    {
                        "name": "Asistencias de Jugador - Devin Booker",
                        "line": 6.5,
                        "stat_basis": "Promedia 6.8 asistencias como armador principal. 12.3 asistencias potenciales por juego.",
                        "model_projected": 7.1,
                        "model_std": 2.3,
                        "selection_over": "Más de 6.5",
                        "selection_under": "Menos de 6.5",
                        "playdoit_odds_over": 100,
                        "playdoit_odds_under": -130,
                        "calc_type": "continuous"
                    }
                ]
            },
            {
                "category": "Hitos y Defensa",
                "markets": [
                    {
                        "name": "Hacer un Doble-Doble (Jusuf Nurkic)",
                        "line": 0.5,
                        "stat_basis": "Registra doble-doble en 48% de sus partidos jugados esta temporada.",
                        "model_projected": 0.52,
                        "selection_over": "Sí",
                        "selection_under": "No",
                        "playdoit_odds_over": 115,
                        "playdoit_odds_under": -145,
                        "calc_type": "poisson"
                    },
                    {
                        "name": "Bloqueos de Jugador - Goga Bitadze",
                        "line": 1.5,
                        "stat_basis": "Promedia 1.9 bloqueos como titular (2.3 en últimos 5). Phoenix sufre tapones en la pintura.",
                        "model_projected": 1.95,
                        "selection_over": "Más de 1.5",
                        "selection_under": "Menos de 1.5",
                        "playdoit_odds_over": 120,
                        "playdoit_odds_under": -155,
                        "calc_type": "poisson"
                    }
                ]
            }
        ]
    },
    "FUTBOL": {
        "event": "Everton vs Coventry City",
        "date": "Hoy / 14:00",
        "categories": [
            {
                "category": "Tiros de Esquina (Córners)",
                "markets": [
                    {
                        "name": "Total Tiros de Esquina del Partido",
                        "line": 9.5,
                        "stat_basis": "Everton promedia 5.4 córners a favor / 5.8 concedidos. Coventry promedia 5.1 / 4.9. Suma combinada = 10.6 córners/juego.",
                        "model_projected": 10.6,
                        "selection_over": "Más de 9.5 Córners",
                        "selection_under": "Menos de 9.5 Córners",
                        "playdoit_odds_over": -115,
                        "playdoit_odds_under": -115,
                        "calc_type": "poisson"
                    },
                    {
                        "name": "Everton - Total Tiros de Esquina",
                        "line": 5.5,
                        "stat_basis": "Everton de local genera 6.2 córners por partido. Coventry recibe 5.4 de visita.",
                        "model_projected": 6.1,
                        "selection_over": "Más de 5.5 Everton",
                        "selection_under": "Menos de 5.5 Everton",
                        "playdoit_odds_over": 105,
                        "playdoit_odds_under": -135,
                        "calc_type": "poisson"
                    },
                    {
                        "name": "1ª Mitad - Total Tiros de Esquina",
                        "line": 4.5,
                        "stat_basis": "Promedio 4.8 córners en primeros 45 min entre ambos.",
                        "model_projected": 4.85,
                        "selection_over": "Más de 4.5 en 1ª Mitad",
                        "selection_under": "Menos de 4.5 en 1ª Mitad",
                        "playdoit_odds_over": -105,
                        "playdoit_odds_under": -125,
                        "calc_type": "poisson"
                    }
                ]
            },
            {
                "category": "Tarjetas y Faltas",
                "markets": [
                    {
                        "name": "Total de Tarjetas del Partido",
                        "line": 3.5,
                        "stat_basis": "Árbitro asignado promedia 4.4 tarjetas por juego. Everton comete 12.8 faltas y Coventry 13.5.",
                        "model_projected": 4.35,
                        "selection_over": "Más de 3.5 Tarjetas",
                        "selection_under": "Menos de 3.5 Tarjetas",
                        "playdoit_odds_over": -120,
                        "playdoit_odds_under": -110,
                        "calc_type": "poisson"
                    },
                    {
                        "name": "Tarjetas Everton - Total",
                        "line": 1.5,
                        "stat_basis": "Everton recibe al menos 2 amarillas en el 72% de sus juegos de local.",
                        "model_projected": 2.1,
                        "selection_over": "Más de 1.5 Everton",
                        "selection_under": "Menos de 1.5 Everton",
                        "playdoit_odds_over": -140,
                        "playdoit_odds_under": 105,
                        "calc_type": "poisson"
                    }
                ]
            },
            {
                "category": "Especiales de Jugador (Props)",
                "markets": [
                    {
                        "name": "Goleador en cualquier momento (Dominic Calvert-Lewin)",
                        "line": 0.5,
                        "stat_basis": "xG por 90 min de 0.58. Patea penales del equipo. Coventry recibe 1.4 goles de visitante.",
                        "model_projected": 0.62,
                        "selection_over": "Sí (Anota Gol)",
                        "selection_under": "No anota",
                        "playdoit_odds_over": 160,
                        "playdoit_odds_under": -220,
                        "calc_type": "poisson"
                    },
                    {
                        "name": "Tiros a Puerta de Jugador (Dwight McNeil)",
                        "line": 0.5,
                        "stat_basis": "Promedia 1.2 tiros a puerta por partido. Patea tiros libres directos.",
                        "model_projected": 1.15,
                        "selection_over": "Más de 0.5 al arco",
                        "selection_under": "Menos de 0.5 al arco",
                        "playdoit_odds_over": -145,
                        "playdoit_odds_under": 110,
                        "calc_type": "poisson"
                    }
                ]
            }
        ]
    }
}

def analyze_market(m: Dict[str, Any]) -> Dict[str, Any]:
    calc_type = m.get("calc_type", "poisson")
    line = m["line"]
    
    if calc_type == "continuous":
        mean = m["model_projected"]
        std = m.get("model_std", 10.0)
        prob_over_real = normal_over(line, mean, std)
    else:
        lamb = m["model_projected"]
        prob_over_real = poisson_over(line, lamb)
        
    prob_under_real = 100.0 - prob_over_real
    
    dec_over = american_to_decimal(m["playdoit_odds_over"])
    dec_under = american_to_decimal(m["playdoit_odds_under"])
    
    imp_over = decimal_to_implied(dec_over)
    imp_under = decimal_to_implied(dec_under)
    
    ev_over = calculate_ev(prob_over_real, dec_over)
    ev_under = calculate_ev(prob_under_real, dec_under)
    
    return {
        "market_name": m["name"],
        "line": m["line"],
        "stat_basis": m["stat_basis"],
        "model_projection": m["model_projected"],
        "over": {
            "label": m["selection_over"],
            "playdoit_odds": m["playdoit_odds_over"],
            "playdoit_dec": round(dec_over, 2),
            "playdoit_implied": round(imp_over, 1),
            "real_prob": round(prob_over_real, 1),
            "ev": ev_over,
            "has_value": ev_over >= 3.5
        },
        "under": {
            "label": m["selection_under"],
            "playdoit_odds": m["playdoit_odds_under"],
            "playdoit_dec": round(dec_under, 2),
            "playdoit_implied": round(imp_under, 1),
            "real_prob": round(prob_under_real, 1),
            "ev": ev_under,
            "has_value": ev_under >= 3.5
        }
    }

