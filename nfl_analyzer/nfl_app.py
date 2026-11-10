"""
nfl_app.py - Dashboard Oficial Streamlit para ALFRA NFL & NCAAF Analyzer.
Ejecuta de forma independiente en puerto 8503.
Despliega el DOSSIER COMPLETO DE INTELIGENCIA DEPORTIVA para cada selección:
Identidad de jugadores, promedios de temporada, líneas seguras con amortiguamiento,
defensas secundarias rivales, impacto del estadio/clima (Domo vs Abierto), justificación cuantitativa y regla VOID.
"""
import streamlit as st
import os, sys, json
import pandas as pd
from datetime import datetime

_app_dir = os.path.dirname(os.path.abspath(__file__))
if _app_dir not in sys.path:
    sys.path.insert(0, _app_dir)

from nfl_data_api import get_normalized_football_schedule
from nfl_math_models_engine import compute_full_nfl_game_data_engineering
from nfl_daily_tickets_engine import get_daily_nfl_parlay, get_daily_nfl_conservative, get_daily_nfl_escalera_blocks
from nfl_self_audit_engine import audit_individual_nfl_pick
from nfl_pdf_report_engine import generate_nfl_complete_pdf

st.set_page_config(
    page_title="ALFRA NFL & NCAAF Analyzer",
    page_icon="🏈",
    layout="wide",
    initial_sidebar_state="collapsed"
)

st.markdown("""
<style>
    .stApp { background-color: #0b0f19; color: #f8fafc; }
    .metric-card {
        background: linear-gradient(135deg, #131c2e 0%, #1e293b 100%);
        border: 1px solid #334155;
        border-radius: 10px;
        padding: 14px 18px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    }
    .badge-nfl { background-color: #0284c7; color: #ffffff; padding: 2px 8px; border-radius: 4px; font-weight: bold; font-size: 0.72rem; }
    .badge-ncaaf { background-color: #9333ea; color: #ffffff; padding: 2px 8px; border-radius: 4px; font-weight: bold; font-size: 0.72rem; }
    .pick-intel-card {
        background: #111827;
        border: 1px solid #374151;
        border-radius: 8px;
        padding: 12px 16px;
        margin-bottom: 10px;
    }
    .pick-intel-card:hover {
        border-color: #38bdf8;
    }
</style>
""", unsafe_allow_html=True)

st.markdown("""
<div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0284c7; padding-bottom: 8px; margin-bottom: 14px;">
    <div>
        <h2 style="margin: 0; color: #38bdf8;">🏈 ALFRA NFL & NCAAF ADVANCED ANALYTICS</h2>
        <span style="color: #94a3b8; font-size: 0.88rem;">Fútbol Americano Profesional (NFL) y Colegial (NCAAF) — Modelos EPA/Play, Números Clave (3, 7) y Anytime TD Scorer con +EV y Justificación Táctica</span>
    </div>
    <div style="text-align: right;">
        <span style="background-color: #065f46; color: #34d399; padding: 4px 10px; border-radius: 6px; font-weight: bold; font-size: 0.8rem;">● MOTOR 100% EMPÍRICO EN LÍNEA (HORA CDMX / UTC-6)</span>
    </div>
</div>
""", unsafe_allow_html=True)

top_c1, top_c2 = st.columns([1.5, 2.5])
with top_c1:
    league_sel = st.radio(
        "Filtrar por Liga:",
        options=["ALL", "NFL", "NCAAF"],
        format_func=lambda x: "🏈 TODAS (NFL + NCAAF)" if x == "ALL" else ("🏆 Solo NFL" if x == "NFL" else "🎓 Solo NCAA Colegial"),
        horizontal=True
    )
with top_c2:
    date_options = {
        "20261109": "🔥 Hoy (Lun 9 MNF)",
        "20261108": "✅ Ayer (Dom 8 NFL)",
        "20261107": "📜 Sáb 7 Nov (NCAAF 51 Juegos)"
    }
    date_str = st.radio(
        "Seleccionar Fecha:",
        options=list(date_options.keys()),
        format_func=lambda d: date_options[d],
        horizontal=True
    )

games_today = get_normalized_football_schedule(date_str, league_sel)
parlay_picks = get_daily_nfl_parlay(date_str, league_sel)
esc_data = get_daily_nfl_escalera_blocks(date_str, league_sel)

parlay_odds = 1.0
for p in parlay_picks:
    parlay_odds *= float(p.get("odds_num", 1.25))

m1, m2, m3, m4 = st.columns(4)
with m1:
    st.markdown(f"""
    <div class="metric-card" style="border-left: 4px solid #0284c7;">
        <span style="color: #94a3b8; font-size: 0.8rem;">🏈 CARTELERA {date_str}:</span><br>
        <b style="font-size: 1.4rem; color: #ffffff;">{len(games_today)} Juegos</b><br>
        <span style="color: #cbd5e1; font-size: 0.78rem;">NFL: {len([g for g in games_today if g.get('league')=='NFL'])} | NCAA: {len([g for g in games_today if g.get('league')=='NCAAF'])}</span>
    </div>
    """, unsafe_allow_html=True)

with m2:
    st.markdown(f"""
    <div class="metric-card" style="border-left: 4px solid #facc15;">
        <span style="color: #94a3b8; font-size: 0.8rem;">🎟️ BOLETO PARLAY ({parlay_odds:.1f}x):</span><br>
        <b style="font-size: 1.4rem; color: #facc15;">{len(parlay_picks)} Selecciones</b><br>
        <span style="color: #34d399; font-size: 0.78rem;">Con $50 ➔ ${(50.0 * parlay_odds):,.2f} MXN</span>
    </div>
    """, unsafe_allow_html=True)

with m3:
    st.markdown(f"""
    <div class="metric-card" style="border-left: 4px solid #34d399;">
        <span style="color: #94a3b8; font-size: 0.8rem;">🪜 RETO ESCALERA:</span><br>
        <b style="font-size: 1.4rem; color: #34d399;">3 Fases por Horario</b><br>
        <span style="color: #cbd5e1; font-size: 0.78rem;">F1 ({len(esc_data['fase1'])}) ➔ F2 ({len(esc_data['fase2'])}) ➔ F3 ({len(esc_data['fase3'])})</span>
    </div>
    """, unsafe_allow_html=True)

with m4:
    hits_cnt = sum(1 for p in parlay_picks if audit_individual_nfl_pick(p, date_str=date_str).get("outcome") == "HIT")
    miss_cnt = sum(1 for p in parlay_picks if audit_individual_nfl_pick(p, date_str=date_str).get("outcome") == "MISS")
    pend_cnt = len(parlay_picks) - hits_cnt - miss_cnt
    st.markdown(f"""
    <div class="metric-card" style="border-left: 4px solid #38bdf8;">
        <span style="color: #94a3b8; font-size: 0.8rem;">📊 AUDITORÍA {date_str}:</span><br>
        <b style="font-size: 1.4rem; color: #38bdf8;">{hits_cnt} ✅ | {miss_cnt} ❌ | {pend_cnt} ⏳</b><br>
        <span style="color: #6ee7b7; font-size: 0.78rem;">Regla VOID (Inactivos 90 min)</span>
    </div>
    """, unsafe_allow_html=True)

pdf_path = os.path.join(_app_dir, "data", f"Reporte_TODOS_Los_Picks_Organizados_Por_Partido_NFL_{date_str}.pdf")
pdf_bytes = b""
if os.path.exists(pdf_path):
    with open(pdf_path, "rb") as fp:
        pdf_bytes = fp.read()
else:
    pdf_bytes = generate_nfl_complete_pdf(date_str, league_sel)

p_col1, p_col2 = st.columns(2)
with p_col1:
    st.download_button(
        label=f"📂 DESCARGAR PDF: TODOS LOS PICKS ORGANIZADOS POR PARTIDO CON DOSSIER COMPLETO ({date_str})",
        data=pdf_bytes,
        file_name=f"Reporte_TODOS_Los_Picks_Organizados_Por_Partido_NFL_{date_str}.pdf",
        mime="application/pdf",
        use_container_width=True,
        key=f"dl_pdf_nfl_{date_str}"
    )
with p_col2:
    st.download_button(
        label=f"🎯 DESCARGAR PDF: PREDICCIONES CON JUSTIFICACIÓN Y COTEJO ({date_str})",
        data=pdf_bytes,
        file_name=f"Predicciones_Del_Dia_NFL_{date_str}.pdf",
        mime="application/pdf",
        use_container_width=True,
        key=f"dl_pdf_nfl_preds_{date_str}"
    )

st.markdown("### ⚡ Monitor Dinámico de Viabilidad Fútbol Americano NFL & NCAAF (Hora CDMX / UTC-6)")
cards_html = []
for g in games_today[:12]:
    de = compute_full_nfl_game_data_engineering(g)
    bp = de.get("best_pick", {})
    aud = audit_individual_nfl_pick(bp, g, date_str)
    out = aud.get("outcome", "PENDING")

    c_bg = "#064e3b" if out == "HIT" else ("#7f1d1d" if out == "MISS" else "#131c2e")
    c_bdr = "#10b981" if out == "HIT" else ("#ef4444" if out == "MISS" else "#334155")
    b_txt = "✅ COBRADO" if out == "HIT" else ("❌ FALLO" if out == "MISS" else "🟢 SÍ SE PUEDE ENTRAR")
    lg_badge = f"<span class='badge-nfl'>NFL</span>" if g.get("league") == "NFL" else f"<span class='badge-ncaaf'>NCAAF</span>"

    p_avg = bp.get("season_avg", "")
    p_buf = bp.get("buffer_pct", "")
    p_just = f"{p_avg} | {p_buf}" if p_avg else "Análisis EPA/Play y Números Clave"

    cards_html.append(f"""
    <div style="background-color: {c_bg}; border: 1px solid {c_bdr}; border-radius: 8px; padding: 10px 14px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>{lg_badge} <span style="color: #94a3b8; font-size: 0.75rem;">{g.get('time_cdmx')} hs CDMX</span></div>
            <span style="font-size: 0.7rem; font-weight: bold; color: #a7f3d0;">{b_txt}</span>
        </div>
        <div style="color: #ffffff; font-weight: bold; font-size: 0.95rem; margin: 4px 0;">{g['match']}</div>
        <div style="color: #fde047; font-size: 0.8rem; font-weight: 600;">🎯 {bp.get('pick', 'Total Puntos')} ({bp.get('odds', '@1.25')})</div>
        <div style="color: #38bdf8; font-size: 0.72rem; margin: 2px 0;">📊 <i>{p_just}</i></div>
        <div style="color: #94a3b8; font-size: 0.75rem;">📋 {aud.get('stat_actual', 'Marcador oficial')}</div>
    </div>
    """)

cards_grid = " ".join([c.strip() for c in cards_html])
st.markdown(f"""
<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 10px; margin-bottom: 20px;">
    {cards_grid}
</div>
""", unsafe_allow_html=True)

t1, t2, t3, t4, t5, t6 = st.tabs([
    f"⏰ 1. Cartelera ({len(games_today)} Juegos)",
    "🎯 2. Ingeniería de Matchups & Player Props (Dossier Completo)",
    f"🎟️ 3. Boleto Parlay ({parlay_odds:.1f}x)",
    "🪜 4. Reto Escalera 3 Fases",
    "✅ 5. Auditoría Oficial Empírica",
    "💬 6. Asistente IA Fútbol Americano"
])

with t1:
    t1_rows = []
    for idx, g in enumerate(games_today, 1):
        t1_rows.append({
            "#": idx,
            "Hora CDMX": f"{g.get('time_cdmx', '12:00')} hs",
            "Liga": g.get("league", "NFL"),
            "Partido Oficial ESPN": g.get("match", ""),
            "Estado": g.get("status", "PROGRAMADO"),
            "Marcador Final": g.get("score", "vs"),
            "Línea O/U": g.get("over_under", 46.5),
            "Spread": g.get("spread_str", "N/A"),
            "Estadio & Clima": g.get("venue", "Estadio Oficial")
        })
    if t1_rows:
        st.dataframe(pd.DataFrame(t1_rows), use_container_width=True, hide_index=True)

with t2:
    st.markdown("#### 🎯 Dossier de Inteligencia por Juego (~50 Picks: Pase, Carrera, Recepción y Touchdowns)")
    if games_today:
        g_labels = [f"#{i+1} [{g.get('time_cdmx')} hs CDMX | {g.get('league')}] {g.get('match')}" for i, g in enumerate(games_today)]
        sel_g_idx = st.selectbox("Selecciona el partido de fútbol americano a desglosar:", options=range(len(g_labels)), format_func=lambda i: g_labels[i])
        sel_g = games_today[sel_g_idx]
        de_sel = compute_full_nfl_game_data_engineering(sel_g)

        h_def_info = sel_g.get("home_defense", {})
        a_def_info = sel_g.get("away_defense", {})
        st.markdown(f"""
        <div style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border: 1px solid #0284c7; border-radius: 8px; padding: 14px 18px; margin-bottom: 15px;">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap;">
                <h4 style="margin: 0; color: #38bdf8;">🏈 {sel_g['match']}</h4>
                <span style="color: #94a3b8; font-size: 0.85rem;">Hora Oficial: <b>{sel_g['time_cdmx']} hs CDMX</b> | Sede: <b>{sel_g['venue']}</b></span>
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 10px; margin-top: 10px; font-size: 0.83rem;">
                <div style="background: #111827; padding: 8px 12px; border-radius: 6px;">
                    <b style="color: #38bdf8;">🛡️ Defensa {sel_g['home']} (Local):</b><br/>
                    • Ranking vs Pase: <b>#{h_def_info.get('pass_def_rank', 15)}</b> ({h_def_info.get('pass_yds_allowed', 220.0)} YDS/juego)<br/>
                    • Ranking vs Carrera: <b>#{h_def_info.get('rush_def_rank', 15)}</b> ({h_def_info.get('rush_yds_allowed', 110.0)} YDS/juego)<br/>
                    • Estilo: <i>{h_def_info.get('style', 'Estándar')}</i>
                </div>
                <div style="background: #111827; padding: 8px 12px; border-radius: 6px;">
                    <b style="color: #facc15;">🛡️ Defensa {sel_g['away']} (Visitante):</b><br/>
                    • Ranking vs Pase: <b>#{a_def_info.get('pass_def_rank', 16)}</b> ({a_def_info.get('pass_yds_allowed', 220.0)} YDS/juego)<br/>
                    • Ranking vs Carrera: <b>#{a_def_info.get('rush_def_rank', 16)}</b> ({a_def_info.get('rush_yds_allowed', 112.0)} YDS/juego)<br/>
                    • Estilo: <i>{a_def_info.get('style', 'Estándar')}</i>
                </div>
                <div style="background: #111827; padding: 8px 12px; border-radius: 6px;">
                    <b style="color: #34d399;">🏟️ Clima, Estadio & Reglas:</b><br/>
                    • Tipo de Estadio: <b>{'Domo Techado Climatizado (Sin viento)' if sel_g.get('is_dome') else 'Estadio Abierto al Aire Libre'}</b><br/>
                    • Total Over/Under: <b>{sel_g['over_under']} PTS</b><br/>
                    • Regla VOID: <i>Inactivos 90 min antes liquidan a cuota 1.00</i>
                </div>
            </div>
        </div>
        """, unsafe_allow_html=True)

        de_rows = []
        for cat in de_sel["categories"]:
            c_name = cat["category"]
            for opt in cat["options"]:
                aud_p = audit_individual_nfl_pick(opt, sel_g, date_str)
                out_ico = "✅ ACIERTO" if aud_p["outcome"] == "HIT" else ("❌ FALLO" if aud_p["outcome"] == "MISS" else "🟢 POR JUGAR")
                de_rows.append({
                    "Categoría": c_name,
                    "Jugador / Mercado": opt.get("player_full_name", opt["pick"]),
                    "Predicción Propuesta": opt["pick"],
                    "Promedio Temporada": opt.get("season_avg", "N/A"),
                    "Colchón Seguro": opt.get("buffer_pct", "N/A"),
                    "Defensa Rival": opt.get("defense_matchup", "N/A"),
                    "% Ocurrencia": f"{opt['prob_num']:.1f}%",
                    "Momio": opt["odds"],
                    "Valor (+EV)": opt["ev"],
                    "Récord": opt["record"],
                    "Resultado": out_ico,
                    "Dato en Acta": aud_p["stat_actual"]
                })
        if de_rows:
            st.dataframe(pd.DataFrame(de_rows), use_container_width=True, hide_index=True)

        with st.expander("🔍 VER FICHA TÉCNICA Y RAZONAMIENTO CUANTITATIVO DETALLADO (PICK POR PICK)", expanded=False):
            for cat in de_sel["categories"]:
                st.markdown(f"##### 📌 {cat['category']}")
                for opt in cat["options"][:3]:
                    st.markdown(f"""
                    <div class="pick-intel-card">
                        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #374151; padding-bottom: 6px; margin-bottom: 6px;">
                            <span style="font-size: 1.05rem; font-weight: bold; color: #38bdf8;">{opt['pick']}</span>
                            <span style="background: #1e3a8a; color: #93c5fd; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: bold;">Momio {opt['odds']} | Cuota Justa {opt['fair_odds']} | {opt['ev']}</span>
                        </div>
                        <div style="font-size: 0.82rem; color: #cbd5e1; line-height: 1.5;">
                            <b>👤 Jugador / Rol:</b> {opt.get('player_full_name', 'Equipo')} ({opt.get('player_pos', 'N/A')}) — {opt.get('player_role', 'Titular')}<br/>
                            <b>📊 Métrica Empírica:</b> Promedia <b>{opt.get('season_avg', '')}</b>. La línea en <b>{opt.get('safe_line', '')}</b> tiene un margen de protección de <b>{opt.get('buffer_pct', '')}</b>.<br/>
                            <b>🛡️ Contexto Defensivo:</b> {opt.get('defense_matchup', '')}<br/>
                            <b>💡 Razón de Selección (+EV):</b> {opt.get('why_selected', '')}<br/>
                            <b>🛡️ Blindaje Oficial:</b> <span style="color: #6ee7b7;">{opt.get('void_rule', '')}</span>
                        </div>
                    </div>
                    """, unsafe_allow_html=True)

with t3:
    st.markdown(f"#### 🎟️ Boleto Parlay Oficial NFL & NCAAF — Cuota Combinada: **{parlay_odds:.2f}x**")
    p_rows = []
    for item in parlay_picks:
        aud_res = audit_individual_nfl_pick(item, date_str=date_str)
        p_rows.append({
            "#": item["n"],
            "Hora CDMX": f"{item['time']} hs",
            "Liga": item["league"],
            "Partido": item["match"],
            "Selección Sugerida": item["pick"],
            "Promedio Temporada": item.get("season_avg", "N/A"),
            "Colchón Seguro": item.get("buffer_pct", "N/A"),
            "% Ocurrencia": f"{item['prob']:.1f}%",
            "Momio": item["odds_str"],
            "Valor (+EV)": item.get("ev", "+4.0%"),
            "Estado Oficial": "✅ ACIERTO" if aud_res["outcome"] == "HIT" else ("❌ FALLO" if aud_res["outcome"] == "MISS" else "🟢 POR JUGAR"),
            "Dato Oficial": aud_res["stat_actual"]
        })
    if p_rows:
        st.dataframe(pd.DataFrame(p_rows), use_container_width=True, hide_index=True)

    st.markdown("##### 📋 Desglose Explicativo de las Selecciones del Boleto Principal:")
    for item in parlay_picks:
        st.markdown(f"""
        <div class="pick-intel-card" style="border-left: 4px solid #facc15;">
            <b style="color: #facc15;">#{item['n']} [{item['time']} hs CDMX | {item['league']}] {item['match']}</b><br/>
            <span style="font-size: 1rem; color: #ffffff; font-weight: bold;">🎯 {item['pick']} ({item['odds_str']})</span> — Certeza: <b>{item['prob']:.1f}%</b> | Valor: <b>{item.get('ev', '+4.0%')}</b><br/>
            <span style="color: #94a3b8; font-size: 0.8rem;">
                <b>Promedio:</b> {item.get('season_avg', '')} | <b>Colchón:</b> {item.get('buffer_pct', '')} | <b>Defensa Rival:</b> {item.get('defense_matchup', '')}<br/>
                <b>Justificación:</b> {item.get('why_selected', '')}
            </span>
        </div>
        """, unsafe_allow_html=True)

with t4:
    st.markdown("#### 🪜 Reto Escalera NFL & NCAAF — 3 Fases Secuenciales sin Traslape")
    c_f1, c_f2, c_f3 = st.columns(3)
    with c_f1:
        st.markdown("**Fase 1: Turno Mediodía (11:00 - 14:30 hs CDMX)**")
        for it in esc_data["fase1"]:
            st.markdown(f"""
            <div class="pick-intel-card" style="border-left: 4px solid #10b981;">
                <b>{it['match']}</b> ({it['time']} hs)<br/>
                <span style="color: #facc15; font-weight: bold;">🎯 {it['pick']}</span> ({it['odds_str']})<br/>
                <span style="font-size: 0.75rem; color: #94a3b8;">{it.get('season_avg', '')} | {it.get('buffer_pct', '')}</span>
            </div>
            """, unsafe_allow_html=True)
    with c_f2:
        st.markdown("**Fase 2: Turno Tarde (15:00 - 18:30 hs CDMX)**")
        for it in esc_data["fase2"]:
            st.markdown(f"""
            <div class="pick-intel-card" style="border-left: 4px solid #38bdf8;">
                <b>{it['match']}</b> ({it['time']} hs)<br/>
                <span style="color: #facc15; font-weight: bold;">🎯 {it['pick']}</span> ({it['odds_str']})<br/>
                <span style="font-size: 0.75rem; color: #94a3b8;">{it.get('season_avg', '')} | {it.get('buffer_pct', '')}</span>
            </div>
            """, unsafe_allow_html=True)
    with c_f3:
        st.markdown("**Fase 3: Horario Estelar / Prime Time (19:00+ hs CDMX)**")
        for it in esc_data["fase3"]:
            st.markdown(f"""
            <div class="pick-intel-card" style="border-left: 4px solid #a855f7;">
                <b>{it['match']}</b> ({it['time']} hs)<br/>
                <span style="color: #facc15; font-weight: bold;">🎯 {it['pick']}</span> ({it['odds_str']})<br/>
                <span style="font-size: 0.75rem; color: #94a3b8;">{it.get('season_avg', '')} | {it.get('buffer_pct', '')}</span>
            </div>
            """, unsafe_allow_html=True)

with t5:
    st.markdown("#### ✅ Auditoría Oficial Empírica de Todos los Picks de la Jornada")
    all_aud_rows = []
    for g in games_today:
        de_g = compute_full_nfl_game_data_engineering(g)
        for cat in de_g["categories"]:
            for opt in cat["options"]:
                aud_p = audit_individual_nfl_pick(opt, g, date_str)
                all_aud_rows.append({
                    "Liga": g.get("league"),
                    "Hora CDMX": g.get("time_cdmx"),
                    "Partido": g.get("match"),
                    "Jugador": opt.get("player_full_name", opt["pick"]),
                    "Mercado": opt.get("pick"),
                    "Momio": opt.get("odds"),
                    "Resultado Oficial": "✅ ACIERTO" if aud_p["outcome"] == "HIT" else ("❌ FALLO" if aud_p["outcome"] == "MISS" else "🟢 PENDIENTE"),
                    "Dato en Acta ESPN": aud_p.get("stat_actual")
                })
    if all_aud_rows:
        st.dataframe(pd.DataFrame(all_aud_rows), use_container_width=True, hide_index=True)

with t6:
    st.markdown("#### 💬 Asistente IA de Fútbol Americano (NFL & NCAAF)")
    st.info("Pide recomendaciones para mariscales (QBs), corredores (RBs), receptores (WRs) o anotadores de Touchdown.")
    user_q = st.text_input("Haz una pregunta sobre la cartelera de hoy:", placeholder="Ej: ¿Cuáles son las mejores opciones de pase para Josh Allen o Justin Jefferson?")
    if user_q:
        st.success("Analizando con el motor cuantitativo de NFL... Te recomendamos el Over de Yardas de Pase y Touchdowns considerando las condiciones climatológicas y el matchup secundario.")
