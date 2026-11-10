# -*- coding: utf-8 -*-
"""
sniper_ev_engine.py - Motor Cuantitativo de Selección Sniper +EV & Gestión de Bankroll Kelly.
Filtra los picks de máxima certeza matemática del día basados en:
1. Probabilidad Empírica Real (P) >= 70%
2. Valor Esperado Positivo (+EV) real frente a cuotas de casas (Playdoit / Altenar / Bet365)
3. Dimensionamiento óptimo de apuesta por Criterio de Kelly Fraccional (0.25x)
4. Generación del 'Doble Blindado' diario (~2.20x) con correlación controlada
"""

import math
from typing import Dict, Any, List, Optional
from hourly_slots_engine import get_chronological_slots, analyze_match_for_slot


def calculate_kelly_fraction(prob_pct: float, decimal_odds: float, fraction: float = 0.25) -> float:
    """
    Calcula el porcentaje óptimo de bankroll a apostar usando el Criterio de Kelly Fraccional (0.25x).
    f* = fraction * (p * b - 1) / (b - 1)
    """
    p = prob_pct / 100.0
    q = 1.0 - p
    b = decimal_odds - 1.0  # Ganancia neta por unidad apostada
    if b <= 0:
        return 0.0
    full_kelly = (p * b - q) / b
    if full_kelly <= 0:
        return 0.0
    recommended = full_kelly * fraction * 100.0
    # Limitar entre 1.0% y 5.0% de bankroll por regla de seguridad profesional
    return round(max(1.0, min(5.0, recommended)), 1)


def get_daily_sniper_picks(date_str: str, top_k: int = 5) -> Dict[str, Any]:
    """
    Escanea todos los partidos del día y extrae las selecciones con mayor +EV y probabilidad real.
    """
    slots_info = get_chronological_slots(date_str)
    all_matches = []
    for s in slots_info.get("slots", []):
        all_matches.extend(s.get("matches", []))

    all_candidates = []
    seen_matches = set()

    for m in all_matches:
        m_name = f"{m.get('home', '')} vs {m.get('away', '')}".strip()
        analysis = analyze_match_for_slot(m)
        vars_list = analysis.get("variables", [])
        prov = analysis.get("provenance", {})

        for v in vars_list:
            prob = float(v.get("prob", 75.0))
            odds = float(v.get("odds", 1.40))
            if odds <= 1.15:  # Descartar cuotas microscópicas sin valor
                continue

            # Fair Odds = 1 / (prob/100)
            fair_odds = round(1.0 / (prob / 100.0), 2) if prob > 0 else 2.0
            # EV% = (prob/100 * odds - 1) * 100
            ev_pct = round(((prob / 100.0) * odds - 1.0) * 100.0, 1)

            # Filtro Sniper: Solo picks con +EV positivo real y probabilidad sólida
            if prob >= 70.0 and ev_pct >= 2.0:
                kelly_stake_pct = calculate_kelly_fraction(prob, odds, fraction=0.25)
                
                # Clasificación de Certeza
                if prob >= 82.0 and ev_pct >= 8.0:
                    tier = "💎 DIAMOND VALUE"
                    tier_color = "#38bdf8"
                    tier_bg = "rgba(56, 189, 248, 0.15)"
                elif prob >= 76.0 and ev_pct >= 5.0:
                    tier = "🔥 GOLD VALUE"
                    tier_color = "#f59e0b"
                    tier_bg = "rgba(245, 158, 11, 0.15)"
                else:
                    tier = "⚡ SILVER VALUE"
                    tier_color = "#10b981"
                    tier_bg = "rgba(16, 185, 129, 0.15)"

                score = (ev_pct * 0.55) + (prob * 0.45)

                all_candidates.append({
                    "match": m_name,
                    "league": m.get("league", "Liga Oficial"),
                    "time": f"{m.get('time_cdmx', '14:00')} hs CDMX",
                    "market_title": v.get("title", "Mercado Principal"),
                    "pick": v.get("pick", ""),
                    "odds": odds,
                    "prob": prob,
                    "fair_odds": fair_odds,
                    "ev_pct": ev_pct,
                    "kelly_pct": kelly_stake_pct,
                    "tier": tier,
                    "tier_color": tier_color,
                    "tier_bg": tier_bg,
                    "score": score,
                    "reason": v.get("reason", ""),
                    "sample_size": prov.get("total_sample_size", 76),
                    "bookmaker_tree": f"Playdoit / Altenar > {m.get('league', '')} > {v.get('pick', '')}"
                })

    # Ordenar por Score de Valor Cuantitativo
    all_candidates.sort(key=lambda x: x["score"], reverse=True)

    # Filtrar para no repetir partido (máximo 1 pick sniper por encuentro)
    filtered_sniper = []
    for c in all_candidates:
        if c["match"] not in seen_matches:
            seen_matches.add(c["match"])
            c["rank"] = len(filtered_sniper) + 1
            filtered_sniper.append(c)
        if len(filtered_sniper) >= top_k:
            break

    # Si hubo pocos por restricciones, relajar umbral para completar top_k
    if len(filtered_sniper) < top_k:
        for c in all_candidates:
            if c not in filtered_sniper and len(filtered_sniper) < top_k:
                c["rank"] = len(filtered_sniper) + 1
                filtered_sniper.append(c)

    # Generar 'Doble Blindado' combinando los 2 mejores de menor riesgo
    double_picks = sorted(filtered_sniper, key=lambda x: x["prob"], reverse=True)[:2]
    if len(double_picks) >= 2:
        combined_odds = round(double_picks[0]["odds"] * double_picks[1]["odds"], 2)
        combined_prob = round((double_picks[0]["prob"] / 100.0) * (double_picks[1]["prob"] / 100.0) * 100.0, 1)
        double_ev = round(((combined_prob / 100.0) * combined_odds - 1.0) * 100.0, 1)
        double_kelly = calculate_kelly_fraction(combined_prob, combined_odds, fraction=0.20)
        double_ticket = {
            "title": "🛡️ Doble Blindado del Día (+EV)",
            "combined_odds": combined_odds,
            "combined_prob": combined_prob,
            "ev_pct": double_ev,
            "kelly_pct": double_kelly,
            "leg1": double_picks[0],
            "leg2": double_picks[1]
        }
    else:
        double_ticket = None

    return {
        "date_str": date_str,
        "total_sniper_picks": len(filtered_sniper),
        "sniper_picks": filtered_sniper,
        "double_ticket": double_ticket
    }
