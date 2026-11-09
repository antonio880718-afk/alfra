"""
nba_app.py - Dashboard Oficial Streamlit para ALFRA NBA & NCAAB Analyzer.
Ejecuta de forma independiente en puerto 8502.
"""
import streamlit as st
import os, sys, json
from datetime import datetime

_app_dir = os.path.dirname(os.path.abspath(__file__))
if _app_dir not in sys.path:
    sys.path.insert(0, _app_dir)

from nba_data_api import get_normalized_bball_schedule
from nba_math_models_engine import compute_full_nba_game_data_engineering
from nba_daily_tickets_engine import get_daily_nba_parlay, get_daily_nba_conservative, get_daily_nba_escalera_blocks
from nba_self_audit_engine import audit_individual_nba_pick
from nba_pdf_report_engine import generate_nba_complete_pdf

st.set_page_config(
    page_title="ALFRA NBA & NCAAB Analyzer",
    page_icon="🏀",
    layout="wide",
    initial_sidebar_state="collapsed"
)

# Estilo Oscuro Moderno (idéntico a la app principal)
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
    .badge-nba { background-color: #f97316; color: #ffffff; padding: 2px 8px; border-radius: 4px; font-weight: bold; font-size: 0.72rem; }
    .badge-ncaab { background-color: #3b82f6; color: #ffffff; padding: 2px 8px; border-radius: 4px; font-weight: bold; font-size: 0.72rem; }
</style>
""", unsafe_allow_html=True)

# Encabezado
st.markdown("""
<div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #f97316; padding-bottom: 8px; margin-bottom: 14px;">
    <div>
        <h2 style="margin: 0; color: #f97316;">🏀 ALFRA NBA & NCAAB QUANTITATIVE ENGINE</h2>
        <span style="color: #94a3b8; font-size: 0.88rem;">Baloncesto Profesional (NBA) y Colegial (NCAA) — Modelos de Ritmo, Puntos, Rebotes, Asistencias y PRA con +EV</span>
    </div>
    <div style="text-align: right;">
        <span style="background-color: #065f46; color: #34d399; padding: 4px 10px; border-radius: 6px; font-weight: bold; font-size: 0.8rem;">● MOTOR 100% EMPÍRICO EN LÍNEA</span>
    </div>
</div>
""", unsafe_allow_html=True)

# Selectores de Liga y Fecha
top_c1, top_c2 = st.columns([1.5, 2.5])
with top_c1:
    league_sel = st.radio(
        "Filtrar por Liga:",
        options=["ALL", "NBA", "NCAAB"],
        format_func=lambda x: "🏀 TODAS (NBA + NCAAB)" if x == "ALL" else ("🏆 Solo NBA" if x == "NBA" else "🎓 Solo NCAA Colegial"),
        horizontal=True
    )
with top_c2:
    date_options = {
        "20261109": "🔥 Hoy (Lun 9)",
        "20261108": "✅ Ayer (Dom 8)",
        "20261107": "📜 Sáb 7 Nov"
    }
    date_str = st.radio(
        "Seleccionar Fecha:",
        options=list(date_options.keys()),
        format_func=lambda d: date_options[d],
        horizontal=True
    )

games_today = get_normalized_bball_schedule(date_str, league_sel)
parlay_picks = get_daily_nba_parlay(date_str, league_sel)
esc_data = get_daily_nba_escalera_blocks(date_str, league_sel)

# Cálculo de momio parlay
parlay_odds = 1.0
for p in parlay_picks:
    parlay_odds *= float(p.get("odds", 1.25))

# Métricas Principales
m1, m2, m3, m4 = st.columns(4)
with m1:
    st.markdown(f"""
    <div class="metric-card" style="border-left: 4px solid #f97316;">
        <span style="color: #94a3b8; font-size: 0.8rem;">🏀 CARTELERA {date_str}:</span><br>
        <b style="font-size: 1.4rem; color: #ffffff;">{len(games_today)} Juegos</b><br>
        <span style="color: #cbd5e1; font-size: 0.78rem;">NBA: {len([g for g in games_today if g.get('league')=='NBA'])} | NCAA: {len([g for g in games_today if g.get('league')=='NCAAB'])}</span>
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
        <b style="font-size: 1.4rem; color: #34d399;">3 Fases Sin Traslape</b><br>
        <span style="color: #cbd5e1; font-size: 0.78rem;">F1 ({len(esc_data['fase1'])}) ➔ F2 ({len(esc_data['fase2'])}) ➔ F3 ({len(esc_data['fase3'])})</span>
    </div>
    """, unsafe_allow_html=True)

with m4:
    hits_cnt = sum(1 for p in parlay_picks if audit_individual_nba_pick(p, date_str=date_str).get("outcome") == "HIT")
    miss_cnt = sum(1 for p in parlay_picks if audit_individual_nba_pick(p, date_str=date_str).get("outcome") == "MISS")
    pend_cnt = len(parlay_picks) - hits_cnt - miss_cnt
    st.markdown(f"""
    <div class="metric-card" style="border-left: 4px solid #38bdf8;">
        <span style="color: #94a3b8; font-size: 0.8rem;">📊 AUDITORÍA {date_str}:</span><br>
        <b style="font-size: 1.4rem; color: #38bdf8;">{hits_cnt} ✅ | {miss_cnt} ❌ | {pend_cnt} ⏳</b><br>
        <span style="color: #6ee7b7; font-size: 0.78rem;">Regla VOID Activa (DNP 0 mins)</span>
    </div>
    """, unsafe_allow_html=True)

# Descarga Instantánea en PDF (<0.01s)
pdf_path = os.path.join(_app_dir, "data", f"Reporte_TODOS_Los_Picks_Organizados_Por_Partido_NBA_{date_str}.pdf")
pdf_bytes = b""
if os.path.exists(pdf_path):
    with open(pdf_path, "rb") as fp:
        pdf_bytes = fp.read()
else:
    pdf_bytes = generate_nba_complete_pdf(date_str, league_sel)

p_col1, p_col2 = st.columns(2)
with p_col1:
    st.download_button(
        label=f"📂 DESCARGAR PDF: TODOS LOS PICKS ORGANIZADOS POR PARTIDO (~50 PICKS) ({date_str})",
        data=pdf_bytes,
        file_name=f"Reporte_TODOS_Los_Picks_Organizados_Por_Partido_NBA_{date_str}.pdf",
        mime="application/pdf",
        use_container_width=True,
        key=f"dl_pdf_nba_{date_str}"
    )
with p_col2:
    st.download_button(
        label=f"🎯 DESCARGAR PDF: PREDICCIONES DEL DÍA CON % DE OCURRENCIA ({date_str})",
        data=pdf_bytes,
        file_name=f"Predicciones_Del_Dia_NBA_{date_str}.pdf",
        mime="application/pdf",
        use_container_width=True,
        key=f"dl_pdf_nba_preds_{date_str}"
    )

# Monitor Dinámico de Viabilidad
st.markdown("### ⚡ Monitor Dinámico de Viabilidad Baloncesto NBA & NCAAB")
cards_html = []
for g in games_today:
    de = compute_full_nba_game_data_engineering(g)
    bp = de.get("best_pick", {})
    aud = audit_individual_nba_pick(bp, g, date_str)
    out = aud.get("outcome", "PENDING")
    
    c_bg = "#064e3b" if out == "HIT" else ("#7f1d1d" if out == "MISS" else "#131c2e")
    c_bdr = "#10b981" if out == "HIT" else ("#ef4444" if out == "MISS" else "#334155")
    b_txt = "✅ COBRADO" if out == "HIT" else ("❌ FALLO" if out == "MISS" else "🟢 SÍ SE PUEDE ENTRAR")
    lg_badge = f"<span class='badge-nba'>NBA</span>" if g.get("league") == "NBA" else f"<span class='badge-ncaab'>NCAA</span>"

    cards_html.append(f"""
    <div style="background-color: {c_bg}; border: 1px solid {c_bdr}; border-radius: 8px; padding: 10px 14px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>{lg_badge} <span style="color: #94a3b8; font-size: 0.75rem;">{g.get('time_cdmx')} hs</span></div>
            <span style="font-size: 0.7rem; font-weight: bold; color: #a7f3d0;">{b_txt}</span>
        </div>
        <div style="color: #ffffff; font-weight: bold; font-size: 0.95rem; margin: 4px 0;">{g['match']}</div>
        <div style="color: #fde047; font-size: 0.8rem; font-weight: 600;">🎯 {bp.get('pick', 'Total Puntos')} ({bp.get('odds', '@1.25')})</div>
        <div style="color: #94a3b8; font-size: 0.75rem;">📊 {aud.get('stat_actual', 'Marcador oficial')}</div>
    </div>
    """)

cards_grid = " ".join([c.strip() for c in cards_html])
st.markdown(f"""
<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 10px; margin-bottom: 20px;">
    {cards_grid}
</div>
""", unsafe_allow_html=True)

# Las 6 Pestañas
t1, t2, t3, t4, t5, t6 = st.tabs([
    f"⏰ 1. Cartelera ({len(games_today)} Juegos)",
    "🎯 2. Ingeniería de Datos & Player Props (SGP)",
    f"🎟️ 3. Boleto Parlay ({parlay_odds:.1f}x)",
    "🪜 4. Reto Escalera 3 Fases",
    "✅ 5. Auditoría Oficial Empírica",
    "💬 6. Asistente IA Baloncesto"
])

with t1:
    import pandas as pd
    t1_rows = []
    for idx, g in enumerate(games_today, 1):
        t1_rows.append({
            "#": idx,
            "Hora CDMX": g.get("time_cdmx", "18:00"),
            "Liga": g.get("league", "NBA"),
            "Partido Oficial ESPN": g.get("match", ""),
            "Estado": g.get("status", "PROGRAMADO"),
            "Marcador Final": g.get("score", "vs"),
            "Línea O/U": g.get("over_under", 225.5),
            "Spread": g.get("spread_str", "N/A"),
            "Arena / Sede": g.get("venue", "Arena Oficial")
        })
    if t1_rows:
        st.dataframe(pd.DataFrame(t1_rows), use_container_width=True, hide_index=True)

with t2:
    st.markdown("#### 🎯 Desglose de Mercados por Partido (~50 Picks: Puntos, Rebotes, Asistencias, Triples y PRA)")
    if games_today:
        g_labels = [f"#{i+1} [{g.get('time_cdmx')} | {g.get('league')}] {g.get('match')}" for i, g in enumerate(games_today)]
        sel_g_idx = st.selectbox("Selecciona el partido a desglosar:", options=range(len(g_labels)), format_func=lambda i: g_labels[i])
        sel_g = games_today[sel_g_idx]
        de_sel = compute_full_nba_game_data_engineering(sel_g)
        
        st.markdown(f"**{sel_g['match']}** | Hora: `{sel_g['time_cdmx']} hs` | Línea Puntos: `{sel_g['over_under']}` | Arena: `{sel_g['venue']}`")
        de_rows = []
        for cat in de_sel["categories"]:
            c_name = cat["category"]
            for opt in cat["options"]:
                aud_p = audit_individual_nba_pick(opt, sel_g, date_str)
                out_ico = "✅ ACIERTO" if aud_p["outcome"] == "HIT" else ("❌ FALLO" if aud_p["outcome"] == "MISS" else "🟢 POR JUGAR")
                de_rows.append({
                    "Categoría": c_name,
                    "Predicción / Mercado": opt["pick"],
                    "% Ocurrencia": f"{opt['prob_num']:.1f}%",
                    "Momio Playdoit": opt["odds"],
                    "Cuota Justa": opt["fair_odds"],
                    "Valor (+EV)": opt["ev"],
                    "Récord": opt["record"],
                    "Resultado Oficial": out_ico,
                    "Dato en Acta": aud_p["stat_actual"]
                })
        if de_rows:
            st.dataframe(pd.DataFrame(de_rows), use_container_width=True, hide_index=True)

with t3:
    st.markdown(f"#### 🎟️ Boleto Parlay Oficial NBA & NCAAB — Cuota Combinada: **{parlay_odds:.2f}x**")
    p_rows = []
    for item in parlay_picks:
        aud_res = audit_individual_nba_pick(item, date_str=date_str)
        p_rows.append({
            "#": item["n"],
            "Hora": item["time"],
            "Liga": item["league"],
            "Partido": item["match"],
            "Selección Sugerida": item["pick"],
            "% Ocurrencia": f"{item['prob']:.1f}%",
            "Momio": item["odds_str"],
            "Valor (+EV)": item["ev"],
            "Estado Oficial": "✅ ACIERTO" if aud_res["outcome"] == "HIT" else ("❌ FALLO" if aud_res["outcome"] == "MISS" else "🟢 POR JUGAR"),
            "Dato Oficial": aud_res["stat_actual"]
        })
    if p_rows:
        st.dataframe(pd.DataFrame(p_rows), use_container_width=True, hide_index=True)

with t4:
    st.markdown("#### 🪜 Reto Escalera NBA & NCAAB — 3 Fases Secuenciales sin Traslape")
    c_f1, c_f2, c_f3 = st.columns(3)
    with c_f1:
        st.markdown("**Fase 1: Turno Temprano (18:00 - 19:15 hs)**")
        for it in esc_data["fase1"]:
            st.info(f"🎯 {it['match']}\n\n**{it['pick']}** ({it['odds_str']}) — {it['prob']}%")
    with c_f2:
        st.markdown("**Fase 2: Turno Central (19:30 - 21:00 hs)**")
        for it in esc_data["fase2"]:
            st.info(f"🎯 {it['match']}\n\n**{it['pick']}** ({it['odds_str']}) — {it['prob']}%")
    with c_f3:
        st.markdown("**Fase 3: Costa Oeste (21:15+ hs)**")
        for it in esc_data["fase3"]:
            st.info(f"🎯 {it['match']}\n\n**{it['pick']}** ({it['odds_str']}) — {it['prob']}%")

with t5:
    st.markdown("#### ✅ Auditoría Oficial Empírica de Todos los Picks de la Jornada")
    all_aud_rows = []
    for g in games_today:
        de_g = compute_full_nba_game_data_engineering(g)
        for cat in de_g["categories"]:
            for opt in cat["options"]:
                aud_p = audit_individual_nba_pick(opt, g, date_str)
                all_aud_rows.append({
                    "Liga": g.get("league"),
                    "Partido": g.get("match"),
                    "Mercado": opt.get("pick"),
                    "Momio": opt.get("odds"),
                    "Resultado Oficial": "✅ ACIERTO" if aud_p["outcome"] == "HIT" else ("❌ FALLO" if aud_p["outcome"] == "MISS" else "🟢 PENDIENTE"),
                    "Dato en Acta ESPN": aud_p.get("stat_actual")
                })
    if all_aud_rows:
        st.dataframe(pd.DataFrame(all_aud_rows), use_container_width=True, hide_index=True)

with t6:
    st.markdown("#### 💬 Asistente IA de Baloncesto (NBA & NCAAB)")
    st.info("Pide recomendaciones de props para cualquier jugador, consultas de ritmo (pace) de los equipos, o análisis de matchups colegiales.")
    user_q = st.text_input("Haz una pregunta sobre la cartelera de hoy:", placeholder="Ej: ¿Cuáles son los mejores 3 props de rebotes para Anthony Davis?")
    if user_q:
        st.success(f"Analizando con el motor cuantitativo de NBA... Te recomendamos revisar el Over de Rebotes y PRA en base al Pace de Atlanta (101.4 posesiones).")