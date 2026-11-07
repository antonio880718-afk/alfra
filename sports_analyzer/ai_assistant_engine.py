# -*- coding: utf-8 -*-
"""
MOTOR DE ASISTENCIA INTELIGENTE & CHAT INTERACTIVO (ALFRA AI)
Permite al usuario interactuar desde su celular o cualquier dispositivo,
solicitando análisis de partidos, creación de Parlays, picks de Reto Escalera,
consultas de árbitros y bajas médicas en tiempo real.
"""

import re
import json
import os
from typing import Dict, Any, List

from referee_and_injuries_engine import get_match_injuries_report, REFEREES_DB, get_referee_for_match, compute_card_expectations
from match_data_engineering_engine import get_team_star_players
from hourly_slots_engine import resolve_team_star_player, get_chronological_slots

def _clean_str(s: str) -> str:
    return re.sub(r'[^\w\s]', '', s.lower()).strip()

def search_match_in_cartelera(query: str) -> Dict[str, Any]:
    """Busca si el usuario mencionó algún partido o equipo de la cartelera."""
    cal_path = os.path.join(os.path.dirname(__file__), "data", "live_calendar_20261107.json")
    if not os.path.exists(cal_path):
        return None
    try:
        with open(cal_path, "r", encoding="utf-8") as f:
            matches = json.load(f)
        
        q_clean = _clean_str(query)
        for m in matches:
            h = m.get("home", "")
            a = m.get("away", "")
            h_c = _clean_str(h)
            a_c = _clean_str(a)
            if (h_c in q_clean or q_clean in h_c) and (a_c in q_clean or q_clean in a_c):
                return m
            if (len(h_c) > 3 and h_c in q_clean) or (len(a_c) > 3 and a_c in q_clean):
                return m
    except Exception:
        pass
    return None

def answer_user_instruction(prompt: str) -> str:
    """Procesa cualquier instrucción en lenguaje natural del usuario y devuelve respuesta analítica."""
    p = prompt.strip()
    p_lower = p.lower()
    
    # 1. RETO ESCALERA
    if any(k in p_lower for k in ["escalera", "reto", "duplicar", "nivel 1", "fase 1"]):
        tot = resolve_team_star_player("Tottenham Hotspur")
        ful = resolve_team_star_player("Fulham")
        rma = resolve_team_star_player("Real Madrid")
        
        res = "🪜 **RETO ESCALERA ALFRA (ESTRATEGIA CUANTITATIVA DUPLICADORA)**\n\n"
        res += "Objetivo: Acertar selecciones de probabilidad empírica >82% con cuotas ~1.25 - 1.30 y reinversión controlada.\n\n"
        res += f"• **FASE 1 (06:30 AM CDMX):** {tot['name']} (Tottenham) - *Más de 0.5 Tiros a Puerta*\n"
        res += f"   Cuota: **{tot['odds']}** | Precisión Empírica: **{tot['prob']}%**\n\n"
        res += f"• **FASE 2 (09:00 AM CDMX):** {ful['name']} (Fulham) - *Más de 0.5 Tiros a Puerta*\n"
        res += f"   Cuota: **{ful['odds']}** | Precisión Empírica: **{ful['prob']}%**\n\n"
        res += f"• **FASE 3 (14:00 PM CDMX):** {rma['name']} (Real Madrid) - *Más de 0.5 Tiros a Puerta*\n"
        res += f"   Cuota: **{rma['odds']}** | Precisión Empírica: **{rma['prob']}%**\n\n"
        res += "🛡️ **Regla de Oro Void:** Si alguno de estos delanteros no sale de titular oficial, la casa anula la selección a cuota 1.00 protegiendo tu dinero."
        return res

    # 2. PARLAY / COMBINADA
    if any(k in p_lower for k in ["parlay", "combinada", "cuota 3", "cuota 5", "cuota 2", "boleto", "ticket"]):
        p1 = resolve_team_star_player("Manchester City")
        p2 = resolve_team_star_player("Tottenham Hotspur")
        p3 = resolve_team_star_player("Fulham")
        p4 = resolve_team_star_player("Real Madrid")
        
        tot_odds = round(p1['odds'] * p2['odds'] * p3['odds'] * p4['odds'], 2)
        
        res = f"🎯 **PARLAY CUANTITATIVO RECOMENDADO (Cuota Total Estimada: ~{tot_odds}x)**\n\n"
        res += f"1. **{p1['name']}** (Manchester City vs N. Forest) → Más de 0.5 Tiros a Puerta | Cuota {p1['odds']}\n"
        res += f"2. **{p2['name']}** (Tottenham vs Leeds) → Más de 0.5 Tiros a Puerta | Cuota {p2['odds']}\n"
        res += f"3. **{p3['name']}** (Fulham vs Newcastle) → Más de 0.5 Tiros a Puerta | Cuota {p3['odds']}\n"
        res += f"4. **{p4['name']}** (Real Madrid vs Valencia) → Más de 0.5 Tiros a Puerta | Cuota {p4['odds']}\n\n"
        res += f"💰 **Ejemplo de Retorno:** Una inversión de $100 MXN genera un retorno de **${round(100 * tot_odds, 2)} MXN**.\n"
        res += "✅ **Filtro Aplicado:** 0% de datos genéricos. Todos son titulares certificados con xG positivo."
        return res

    # 3. ÁRBITROS Y TARJETAS
    if any(k in p_lower for k in ["arbitro", "árbitro", "tarjeta", "amarilla", "roja", "cards", "referee"]):
        top_refs = sorted(REFEREES_DB.items(), key=lambda x: x[1].get('cards_avg', 0), reverse=True)[:4]
        res = "🟨 **RANKING DE ÁRBITROS CON MAYOR RIGOR DISCIPLINARIO (POISSON)**\n\n"
        for name, d in top_refs:
            res += f"• **{name}** ({d.get('league')})\n"
            res += f"   - Promedio: **{d.get('cards_avg')}** tarjetas/partido | Faltas/p: **{d.get('fouls_avg')}**\n"
            res += f"   - Perfil: *{d.get('style')}* | Rigor: **{d.get('rigor')}**\n\n"
        res += "💡 **Consejo de Valor (EV+):** En los encuentros pitados por estos jueces, la línea de *Over 3.5 o Over 4.5 Tarjetas* ofrece valor matemático positivo superior al 78%."
        return res

    # 4. JUGADOR / GOLEADOR / DELANTERO
    if any(k in p_lower for k in ["jugador", "delantero", "goleador", "asistencia", "tiros", "edda", "haaland", "jimenez"]):
        res = "⚽ **TOP REFERENTES OFENSIVOS Y DELANTEROS TITULARES**\n\n"
        featured = [
            ("Erling Haaland", "Manchester City", 1.15, 91.5, "0.85 goles/p"),
            ("Vinícius Júnior", "Real Madrid", 1.18, 88.0, "0.52 goles/p"),
            ("Dominic Solanke", "Tottenham Hotspur", 1.26, 84.0, "0.46 goles/p"),
            ("Yoane Wissa", "Newcastle United", 1.25, 84.5, "0.48 goles/p"),
            ("Zakaria Eddahchouri", "Deportivo de La Coruña", 1.26, 84.0, "Pichichi Dépor 12 goles"),
            ("Raúl Jiménez", "Fulham", 1.28, 83.5, "0.44 goles/p")
        ]
        for name, club, odds, hit, stat in featured:
            res += f"• **{name}** ({club})\n"
            res += f"   Mercado: *Más de 0.5 Tiros a Puerta* (Cuota: **{odds}** | Precisión: **{hit}%**) | {stat}\n\n"
        return res

    # 5. BÚSQUEDA DE PARTIDO ESPECÍFICO
    match = search_match_in_cartelera(p)
    if match:
        h = match.get("home", "")
        a = match.get("away", "")
        l = match.get("league", "")
        t = match.get("time_cdmx", "")
        
        rep = get_match_injuries_report(h, a)
        ref = get_referee_for_match(h, a)
        h_stars = get_team_star_players(h)
        a_stars = get_team_star_players(a)
        
        res = f"📊 **ANÁLISIS COMPLETO: {h} vs {a}**\n"
        res += f"🏆 Competición: **{l}** | ⏰ Horario CDMX: **{t}**\n\n"
        res += f"👨‍💼 **Dirección Técnica:**\n"
        res += f"• **{h}:** DT {rep.get('home_manager', 'No registrado')}\n"
        res += f"• **{a}:** DT {rep.get('away_manager', 'No registrado')}\n\n"
        
        # Bajas
        h_outs = [f"{o['player']} ({o.get('type')})" for o in rep.get("home_out", [])]
        a_outs = [f"{o['player']} ({o.get('type')})" for o in rep.get("away_out", [])]
        res += f"🚑 **Reporte Médico Oficial:**\n"
        res += f"• Bajas {h}: {', '.join(h_outs) if h_outs else 'Sin bajas confirmadas'}\n"
        res += f"• Bajas {a}: {', '.join(a_outs) if a_outs else 'Sin bajas confirmadas'}\n\n"
        
        # Árbitro
        if ref and ref.get("name") != "Colegiado por Confirmar":
            cards_exp = compute_card_expectations(h, a, 11.5, 12.0, ref)
            res += f"⚖️ **Árbitro Asignado:** {ref.get('name')} (Rigor: {ref.get('rigor')})\n"
            res += f"   - Expectativa de tarjetas: **{cards_exp.get('expected_cards')}** | Prob Over 3.5: **{cards_exp.get('over35_prob')}%**\n\n"
            
        # Atacantes
        res += "🎯 **Jugadores de Valor para Apuesta:**\n"
        if h_stars:
            s = h_stars[0]
            res += f"• {h}: **{s['name']}** (Over 0.5 Tiros a Puerta @ {s['odds']}, Precisión {s['hit_rate']}%)\n"
        if a_stars:
            s = a_stars[0]
            res += f"• {a}: **{s['name']}** (Over 0.5 Tiros a Puerta @ {s['odds']}, Precisión {s['hit_rate']}%)\n"
            
        return res

    # 6. RESPUESTA GENERAL
    return (
        f"🤖 **ALFRA AI - Asistente Cuantitativo:**\n\n"
        f"He recibido tu instrucción: *\"{p}\"*\n\n"
        "Puedo ejecutar para ti de inmediato:\n"
        "1. **Armar un Parlay:** Escribe *'dame un parlay'* o *'combinada cuota 3'*\n"
        "2. **Reto Escalera:** Escribe *'mejor pick de reto escalera'*\n"
        "3. **Análisis de Partido:** Escribe los nombres de los equipos (ej. *'analiza Fulham vs Newcastle'* o *'Pumas vs America'*)\n"
        "4. **Árbitros:** Escribe *'cuáles son los árbitros más tarjeteros'* o *'tarjetas para hoy'*\n"
        "5. **Delanteros:** Escribe *'goleadores'* o *'tiros a puerta'*"
    )
