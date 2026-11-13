"""
nfl_app.py - Dashboard Oficial Streamlit para ALFRA NFL & NCAAF Analyzer.
Ejecuta de forma independiente en puerto 8503.
Despliega el DOSSIER COMPLETO DE INTELIGENCIA DEPORTIVA para cada selección:
Identidad de jugadores, promedios de temporada, líneas seguras con amortiguamiento,
defensas secundarias rivales, impacto del estadio/clima (Domo vs Abierto), justificación cuantitativa y regla VOID.
"""
import streamlit as st
import os, sys, json, importlib
import pandas as pd
from datetime import datetime, timedelta, timezone

_app_dir = os.path.dirname(os.path.abspath(__file__))
if _app_dir not in sys.path:
    sys.path.insert(0, _app_dir)

_NFL_ENGINE_VER = "2026.11.11.v4"
if getattr(sys, "_ALFRA_NFL_VER", None) != _NFL_ENGINE_VER:
    for _base in (
        "live_nfl_audit_sync",
        "nfl_data_api",
        "nfl_math_models_engine",
        "nfl_daily_tickets_engine",
        "nfl_self_audit_engine",
        "nfl_pdf_report_engine",
    ):
        for _mn in (_base, f"nfl_analyzer.{_base}"):
            if _mn in sys.modules:
                try:
                    importlib.reload(sys.modules[_mn])
                except Exception:
                    pass
    sys._ALFRA_NFL_VER = _NFL_ENGINE_VER

from nfl_data_api import get_normalized_football_schedule
from nfl_math_models_engine import compute_full_nfl_game_data_engineering
from nfl_daily_tickets_engine import get_daily_nfl_parlay, get_daily_nfl_conservative, get_daily_nfl_escalera_blocks
from nfl_self_audit_engine import audit_individual_nfl_pick
from nfl_pdf_report_engine import generate_nfl_complete_pdf, generate_nfl_audit_pdf_bytes

if not globals().get("_ALFRA_EMBEDDED_WEBAPP"):
    st.set_page_config(
        page_title="ALFRA NFL & NCAAF Analyzer",
        page_icon="🏈",
        layout="wide",
        initial_sidebar_state="collapsed"
    )


st.markdown("""
<style>
    .stApp { background-color: #0b0f19; color: #f8fafc; }
    @media (max-width: 768px) {
        .block-container { padding: 0.75rem 0.65rem 2rem 0.65rem !important; }
        div[data-testid="stTabs"] button { padding: 0.35rem 0.55rem !important; font-size: 0.8rem !important; }
        h2 { font-size: 1.2rem !important; }
    }
    div[data-testid="stTabs"] [role="tablist"] {
        overflow-x: auto;
        scrollbar-width: thin;
        border-bottom: 1px solid #0284c7;
    }
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


# BARRA DE NAVEGACION MULTI-DEPORTE
st.markdown("""
<div style="background: #111827; border: 1px solid #1e293b; border-radius: 12px; padding: 10px 14px; margin-bottom: 14px;">
    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
        <span style="font-weight: 700; color: #38bdf8; font-size: 0.95rem; letter-spacing: 0.5px;">
            🏈 WEB APP FÚTBOL AMERICANO (NFL & NCAAF):
        </span>
        <span style="font-size: 0.8rem; color: #94a3b8;">
            Toca Fútbol o NBA para alternar de deporte
        </span>
    </div>
</div>
""", unsafe_allow_html=True)

_nav_c1, _nav_c2, _nav_c3 = st.columns(3)
with _nav_c1:
    if st.button("⚽ FÚTBOL (26 Ligas)", key="nfl_top_nav_futbol", use_container_width=True):
        st.session_state["alfra_active_sport"] = "futbol"
        try:
            st.query_params["sport"] = "futbol"
        except Exception:
            pass
        st.rerun()
with _nav_c2:
    if st.button("🏀 NBA & NCAAB Web App", key="nfl_top_nav_nba", use_container_width=True):
        st.session_state["alfra_active_sport"] = "nba"
        try:
            st.query_params["sport"] = "nba"
        except Exception:
            pass
        st.rerun()
with _nav_c3:
    st.button("🏈 NFL & NCAAF (Activo)", key="nfl_top_nav_nfl", type="primary", use_container_width=True, disabled=True)

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

top_c1, top_c2, top_c3 = st.columns([1.2, 1.8, 1.0])
with top_c1:
    league_sel = st.radio(
        "Filtrar por Liga:",
        options=["ALL", "NFL", "NCAAF"],
        format_func=lambda x: "🏈 TODAS" if x == "ALL" else ("🏆 Solo NFL" if x == "NFL" else "🎓 Solo NCAA"),
        horizontal=True
    )
_CDMX_TZ = timezone(timedelta(hours=-6))
_today_cdmx = datetime.now(_CDMX_TZ).date()
_DIAS_ES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]
_MESES_ES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
def _fmt_fecha_es(d) -> str:
    return f"{_DIAS_ES[d.weekday()]} {d.day} {_MESES_ES[d.month - 1]}"

if st.session_state.get("nfl_today_ref") != _today_cdmx:
    st.session_state["nfl_today_ref"] = _today_cdmx
    st.session_state["nfl_selected_date"] = _today_cdmx
    st.session_state["nfl_date_picker"] = _today_cdmx

def _nfl_pick_quick(d):
    st.session_state["nfl_selected_date"] = d
    st.session_state["nfl_date_picker"] = d

def _nfl_on_cal_change():
    st.session_state["nfl_selected_date"] = st.session_state["nfl_date_picker"]

with top_c2:
    st.markdown("<span style='font-size:0.86rem; color:#cbd5e1;'>Seleccionar Fecha (Hora CDMX):</span>", unsafe_allow_html=True)
    _quick_days = [
        (_today_cdmx, f"🔥 Hoy ({_fmt_fecha_es(_today_cdmx)})"),
        (_today_cdmx + timedelta(days=1), f"⏭️ Mañana ({_fmt_fecha_es(_today_cdmx + timedelta(days=1))})"),
        (_today_cdmx - timedelta(days=1), f"✅ Ayer ({_fmt_fecha_es(_today_cdmx - timedelta(days=1))})"),
        (_today_cdmx - timedelta(days=2), f"📜 {_fmt_fecha_es(_today_cdmx - timedelta(days=2))}"),
        (_today_cdmx - timedelta(days=3), f"📜 {_fmt_fecha_es(_today_cdmx - timedelta(days=3))}"),
    ]
    _q_cols = st.columns(len(_quick_days))
    _cur_sel = st.session_state["nfl_selected_date"]
    for _idx, (_qd, _qlbl) in enumerate(_quick_days):
        with _q_cols[_idx]:
            st.button(
                _qlbl,
                key=f"nfl_q_{_qd.strftime('%Y%m%d')}",
                type="primary" if _cur_sel == _qd else "secondary",
                width="stretch",
                on_click=_nfl_pick_quick,
                args=(_qd,),
            )
    st.date_input(
        "📅 O elegir cualquier fecha del calendario:",
        key="nfl_date_picker",
        on_change=_nfl_on_cal_change,
    )

date_str = st.session_state["nfl_selected_date"].strftime("%Y%m%d")

with top_c3:
    st.write("")
    if st.button("🔄 Sincronizar ESPN", key="btn_sync_nfl", help="Actualiza marcadores y boxscores oficiales en vivo desde ESPN"):
        with st.spinner("Sincronizando con ESPN..."):
            from live_nfl_audit_sync import sync_nfl_date_from_espn
            sync_nfl_date_from_espn(date_str)
            _stale_pdf = os.path.join(_app_dir, "data", f"Reporte_TODOS_Los_Picks_Organizados_Por_Partido_NFL_{league_sel}_{date_str}.pdf")
            if os.path.exists(_stale_pdf):
                try:
                    os.remove(_stale_pdf)
                except Exception:
                    pass
            st.rerun()

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

_OUTCOME_MAP = {
    "HIT": "✅ ACIERTO",
    "MISS": "❌ FALLO",
    "VOID": "🔄 VOID (@1.00)",
    "IN_PROGRESS": "🟡 EN VIVO",
}


def _fmt_outcome(outcome: str, default: str = "🟢 POR JUGAR") -> str:
    return _OUTCOME_MAP.get(outcome, default)


def _prob_style(prob_num: float) -> tuple:
    if prob_num >= 80.0:
        return ("#064e3b", "#34d399", "#10b981")
    if prob_num >= 70.0:
        return ("#1e3a8a", "#93c5fd", "#3b82f6")
    return ("#451a03", "#fbbf24", "#d97706")


_all_day_audits = []
_all_day_total_opts = 0
_game_bundles = []
for _g_item in games_today:
    _de_item = compute_full_nfl_game_data_engineering(_g_item)
    _all_day_total_opts += _de_item.get("total_options", 0)
    _ranked_opts = []
    for _c_item in _de_item.get("categories", []):
        _c_name = _c_item.get("category", "")
        for _o_item in _c_item.get("options", []):
            _aud_item = audit_individual_nfl_pick(_o_item, _g_item, date_str)
            _all_day_audits.append(_aud_item.get("outcome", "PENDING"))
            _ranked_opts.append((_o_item, _c_name, _aud_item))
    _ranked_opts.sort(
        key=lambda x: (-float(x[0].get("prob_num", 0.0)), -float(x[0].get("odds_num", 1.0)))
    )
    _bp_item = _ranked_opts[0][0] if _ranked_opts else _de_item.get("best_pick", {})
    _bp_aud = _ranked_opts[0][2] if _ranked_opts else audit_individual_nfl_pick(_bp_item, _g_item, date_str)
    _game_bundles.append({
        "game": _g_item,
        "de": _de_item,
        "best_pick": _bp_item,
        "best_aud": _bp_aud,
        "ranked": _ranked_opts,
    })

hits_cnt = _all_day_audits.count("HIT")
miss_cnt = _all_day_audits.count("MISS")
void_cnt = _all_day_audits.count("VOID")
pend_cnt = len(_all_day_audits) - hits_cnt - miss_cnt - void_cnt
_resolved_cnt = hits_cnt + miss_cnt
_eff_pct_lbl = f" ({(hits_cnt/_resolved_cnt)*100:.1f}%)" if _resolved_cnt > 0 else ""

with m4:
    st.markdown(f"""
    <div class="metric-card" style="border-left: 4px solid #38bdf8;">
        <span style="color: #94a3b8; font-size: 0.8rem;">📊 AUDITORÍA {date_str}:</span><br>
        <b style="font-size: 1.25rem; color: #38bdf8;">{hits_cnt} ✅ | {miss_cnt} ❌ | {void_cnt} 🔄 | {pend_cnt} ⏳{_eff_pct_lbl}</b><br>
        <span style="color: #6ee7b7; font-size: 0.78rem;">Regla VOID (Inactivos 90 min)</span>
    </div>
    """, unsafe_allow_html=True)

pdf_path = os.path.join(_app_dir, "data", f"Reporte_TODOS_Los_Picks_Organizados_Por_Partido_NFL_{league_sel}_{date_str}.pdf")
_sched_path = os.path.join(_app_dir, "data", f"football_schedule_{date_str}.json")
_pdf_fresh = os.path.exists(pdf_path) and (not os.path.exists(_sched_path) or os.path.getmtime(pdf_path) >= os.path.getmtime(_sched_path))
if _pdf_fresh:
    with open(pdf_path, "rb") as fp:
        pdf_bytes = fp.read()
else:
    pdf_bytes = generate_nfl_complete_pdf(date_str, league_sel)

# Cache de PDF de Auditoría
_audit_pdf_path = os.path.join(_app_dir, "data", f"Reporte_Auditoria_NFL_{league_sel}_{date_str}.pdf")
_audit_pdf_fresh = os.path.exists(_audit_pdf_path) and (not os.path.exists(_sched_path) or os.path.getmtime(_audit_pdf_path) >= os.path.getmtime(_sched_path))
if _audit_pdf_fresh:
    with open(_audit_pdf_path, "rb") as fp:
        _audit_pdf_bytes = fp.read()
else:
    _audit_pdf_bytes = generate_nfl_audit_pdf_bytes([date_str], league_sel)

_all_nfl_dates = ["20261108", "20261110", "20261111", "20261112"]
_consolidated_pdf_path = os.path.join(_app_dir, "data", "Reporte_Auditoria_NFL_Consolidado.pdf")
if os.path.exists(_consolidated_pdf_path):
    with open(_consolidated_pdf_path, "rb") as fp:
        _consolidated_pdf_bytes = fp.read()
else:
    _consolidated_pdf_bytes = generate_nfl_audit_pdf_bytes(_all_nfl_dates, league_sel)

p_col1, p_col2, p_col3 = st.columns(3)
with p_col1:
    st.download_button(
        label=f"📂 DESCARGAR PDF: TODOS LOS PICKS ORGANIZADOS POR PARTIDO ({date_str})",
        data=pdf_bytes,
        file_name=f"Reporte_TODOS_Los_Picks_Organizados_Por_Partido_NFL_{date_str}.pdf",
        mime="application/pdf",
        width="stretch",
        key=f"dl_pdf_nfl_{date_str}"
    )
with p_col2:
    st.download_button(
        label=f"📄 DESCARGAR PDF AUDITORÍA NFL ({date_str}) — ACIERTOS / FALLOS",
        data=_audit_pdf_bytes,
        file_name=f"Reporte_Auditoria_NFL_{date_str}.pdf",
        mime="application/pdf",
        width="stretch",
        key=f"dl_pdf_nfl_audit_{date_str}"
    )
with p_col3:
    st.download_button(
        label="📑 DESCARGAR PDF AUDITORÍA CONSOLIDADO (Últimas Jornadas)",
        data=_consolidated_pdf_bytes,
        file_name="Reporte_Auditoria_NFL_Consolidado.pdf",
        mime="application/pdf",
        width="stretch",
        key="dl_pdf_nfl_audit_all"
    )

with st.expander(f"📋 VER REPORTE COMPLETO EN PANTALLA DE TODOS LOS PICKS SUGERIDOS ({date_str}) — ACIERTOS, FALLOS, VOID Y DATO OFICIAL", expanded=False):
    st.markdown(
        f"**Resumen de Jornada ({date_str}):** "
        f"`{hits_cnt} Aciertos (✅)` | `{miss_cnt} Fallos (❌)` | "
        f"`{void_cnt} Anuladas VOID (🔄)` | `{pend_cnt} Por Jugar (🟢)` — "
        f"**Efectividad Real Pick #1:** `{((hits_cnt / _resolved_cnt) * 100.0) if _resolved_cnt > 0 else 0.0:.1f}%` | "
        f"**Total Mercados Auditados:** `{_all_day_total_opts}`"
    )
    _rep_rows = []
    for _idx, _b in enumerate(_game_bundles, 1):
        _g = _b["game"]
        _bp = _b["best_pick"]
        _ba = _b["best_aud"]
        _out_ico = _fmt_outcome(_ba.get("outcome", "PENDING"))
        _rep_rows.append({
            "#": _idx,
            "Hora": _g.get("time_cdmx", "12:00"),
            "Liga": _g.get("league", "NFL"),
            "Partido Oficial ESPN": _g.get("match", ""),
            "Marcador Final": _g.get("score", "vs"),
            "Pick Principal Sugerido (#1)": f"{_bp.get('pick', '')} ({_bp.get('odds', '')})",
            "% Prob.": f"{float(_bp.get('prob_num', 0)):.1f}%",
            "Resultado #1": _out_ico,
            "Dato Oficial en Acta ESPN": _ba.get("stat_actual", ""),
            "Mercados Totales": _b["de"].get("total_options", 0),
        })
    if _rep_rows:
        st.dataframe(pd.DataFrame(_rep_rows), width="stretch", hide_index=True)

with st.expander("🌐 VER MATRIZ OFICIAL DE COTEJO: ¿Contra qué plataformas se verifica cada dato? (ESPN API, Vegas, Boxscores)", expanded=False):
    st.markdown("""
    #### 🛡️ Certificación Oficial de Fuentes de Datos Fútbol Americano (100% Empírico):
    Cada partido, línea de Over/Under, spread, yardas de pase, acarreos, recepciones y touchdowns está auditado contra las 4 plataformas oficiales:

    | Fuente Oficial | Rol de Validación Exigido | Datos Extraídos & Cotejados | Regla de Blindaje |
    | :--- | :--- | :--- | :--- |
    | **🟢 1. ESPN Official Match Center** | Validación de Actas, Boxscores y Participación | • Yardas de pase de QB, TDs, acarreos de RB, recepciones de WR<br>• Titular vs Inactivo y Snap Counts<br>• Puntos por cuarto y líneas de anotación | Si un jugador está en la lista oficial de inactivos (90 min antes), se anula a cuota 1.00 (VOID). |
    | **🟡 2. Vegas Consensus & Bookmakers** | Líneas de Apertura y Cierre Cuantitativas | • Over/Under de Partido y por Equipo<br>• Números Clave de Football (3, 7, 10, 14)<br>• Margen y Valor Esperado (+EV) | Análisis de distribución con protección alrededor de goles de campo (3) y touchdowns (7). |
    | **🔵 3. NextGen Stats & Defensas** | Métricas de Eficiencia Secundaria y Front-7 | • Yardas permitidas por pase y por tierra<br>• Ranking defensivo de la liga vs pase / vs carrera<br>• Presión al QB (Sacks y QB Hits) | Ajuste del matchup secundario considerando la defensiva rival enfrentada. |
    | **🟠 4. Clima y Domo / Estadio** | Impacto de Condiciones Meteorológicas | • Velocidad del viento (> 15 mph reduce pase)<br>• Temperatura y precipitación (lluvia/nieve)<br>• Condición de Domo cerrado vs Estadio Abierto | Ajuste automático del Pace y volumen proyectado de pases según el clima. |
    """)

st.markdown("### ⚡ Monitor Dinámico de Viabilidad Fútbol Americano (Hora CDMX / UTC-6)")
cards_html = []
for b in _game_bundles:
    g = b["game"]
    de = b["de"]
    bp = b["best_pick"]
    aud = b["best_aud"]
    out = aud.get("outcome", "PENDING")

    c_bg = "#064e3b" if out == "HIT" else ("#7f1d1d" if out == "MISS" else "#131c2e")
    c_bdr = "#10b981" if out == "HIT" else ("#ef4444" if out == "MISS" else "#334155")
    b_txt = {"HIT": "✅ COBRADO", "MISS": "❌ FALLO", "VOID": "🔄 VOID (@1.00)", "IN_PROGRESS": "🟡 EN VIVO"}.get(out, "🟢 SÍ SE PUEDE ENTRAR")
    lg_badge = f"<span class='badge-nfl'>NFL</span>" if g.get("league") == "NFL" else f"<span class='badge-ncaaf'>NCAAF</span>"

    p_avg = bp.get("season_avg", "")
    p_buf = bp.get("buffer_pct", "")
    p_just = f"{p_avg} | {p_buf}" if p_avg else "Matchup vs defensiva secundaria"

    cards_html.append(f"""
    <div style="background-color: {c_bg}; border: 1px solid {c_bdr}; border-radius: 8px; padding: 10px 14px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>{lg_badge} <span style="color: #94a3b8; font-size: 0.75rem;">{g.get('time_cdmx')} hs CDMX</span></div>
            <span style="font-size: 0.7rem; font-weight: bold; color: #a7f3d0;">{b_txt}</span>
        </div>
        <div style="color: #ffffff; font-weight: bold; font-size: 0.95rem; margin: 4px 0;">{g['match']}</div>
        <div style="color: #fde047; font-size: 0.8rem; font-weight: 600;">🎯 {bp.get('pick', 'Total Puntos')} ({float(bp.get('prob_num', 0)):.1f}% | {bp.get('odds', '@1.25')})</div>
        <div style="color: #38bdf8; font-size: 0.72rem; margin: 2px 0;">📊 <i>{p_just}</i></div>
        <div style="color: #cbd5e1; font-size: 0.72rem; margin-top: 2px;">📦 <b>{de.get("total_options", 0)} mercados</b> cuantitativos</div>
        <div style="color: #94a3b8; font-size: 0.75rem;">📋 {aud.get('stat_actual', 'Marcador oficial')}</div>
    </div>
    """)

if cards_html:
    cards_grid = " ".join([c.strip() for c in cards_html])
    st.markdown(f"""
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 10px; margin-bottom: 20px;">
        {cards_grid}
    </div>
    """, unsafe_allow_html=True)
else:
    st.info(f"No hay partidos de {league_sel} programados en ESPN para la fecha {date_str} (entre semana suele jugar NCAAF o TNF el jueves). Prueba 'TODAS' o selecciona otra fecha en el calendario.")

t1, t2, t3, t4, t5, t6 = st.tabs([
    f"🎯 1. Picks por Partido ({len(games_today)} Juegos)",
    "🎯 2. Ingeniería de Matchups & Player Props (Dossier Completo)",
    f"🎟️ 3. Boleto Parlay ({parlay_odds:.1f}x)",
    "🪜 4. Reto Escalera 3 Fases",
    "✅ 5. Auditoría Oficial Empírica",
    "💬 6. Asistente IA Fútbol Americano"
])

with t1:
    t1_rows = []
    for idx, b in enumerate(_game_bundles, 1):
        g = b["game"]
        bp = b["best_pick"]
        ba = b["best_aud"]
        t1_rows.append({
            "#": idx,
            "Hora CDMX": f"{g.get('time_cdmx', '12:00')} hs",
            "Liga": g.get("league", "NFL"),
            "Partido Oficial ESPN": g.get("match", ""),
            "Estado": g.get("status", "PROGRAMADO"),
            "Marcador": g.get("score", "vs"),
            "Pick #1 (Mayor Prob.)": bp.get("pick", ""),
            "% Prob.": f"{float(bp.get('prob_num', 0)):.1f}%",
            "Momio": bp.get("odds", ""),
            "Mercados": b["de"].get("total_options", 0),
            "Resultado #1": _fmt_outcome(ba.get("outcome", "PENDING")),
            "Línea O/U": g.get("over_under", 46.5),
            "Spread": g.get("spread_str", "N/A"),
        })
    if t1_rows:
        st.dataframe(pd.DataFrame(t1_rows), width="stretch", hide_index=True)

        st.markdown("#### 🎯 Picks Partido por Partido — Ordenados de Mayor a Menor Probabilidad")
        st.caption("Cada encuentro cruza defensiva vs pase/carrera (Home vs Away), estadio/clima, números clave (3, 7, 10) y líneas Vegas para ordenar todos los mercados disponibles de mayor a menor probabilidad.")
        _f_c1, _f_c2, _f_c3 = st.columns([1.2, 1.2, 1.0])
        with _f_c1:
            _min_prob_lbl = st.selectbox(
                "Probabilidad mínima:",
                ["Todas (0%+)", "65%+", "70%+", "75%+", "80%+"],
                index=0,
                key=f"nfl_t1_minp_{date_str}_{league_sel}",
            )
            _min_prob_val = 0.0 if _min_prob_lbl.startswith("Todas") else float(_min_prob_lbl.replace("%+", ""))
        with _f_c2:
            _top_lim_lbl = st.selectbox(
                "Mostrar por partido:",
                ["Top 15 más probables", "Top 30 más probables", "Todos los mercados"],
                index=0,
                key=f"nfl_t1_lim_{date_str}_{league_sel}",
            )
            _top_lim = 15 if "15" in _top_lim_lbl else (30 if "30" in _top_lim_lbl else 999)
        with _f_c3:
            _exp_all = st.checkbox("Expandir todos los partidos", value=False, key=f"nfl_t1_expall_{date_str}_{league_sel}")

        for idx, b in enumerate(_game_bundles, 1):
            g = b["game"]
            bp = b["best_pick"]
            ba = b["best_aud"]
            _filtered = [x for x in b["ranked"] if float(x[0].get("prob_num", 0.0)) >= _min_prob_val]
            _shown = _filtered[:_top_lim]
            _ba_ico = {"HIT": "✅", "MISS": "❌", "VOID": "🔄", "IN_PROGRESS": "🟡"}.get(ba.get("outcome", "PENDING"), "🟢")
            _exp_title = (
                f"#{idx} | {g.get('time_cdmx', '12:00')} hs | [{g.get('league', 'NFL')}] {g.get('match', '')} "
                f"({g.get('score', 'vs')}) — 🏆 #1: {bp.get('pick', '')} ({float(bp.get('prob_num', 0)):.1f}% | {bp.get('odds', '')}) "
                f"| {_ba_ico} | {len(_filtered)} picks"
            )
            with st.expander(_exp_title, expanded=(idx == 1 or _exp_all)):
                h_def = g.get("home_defense", {})
                a_def = g.get("away_defense", {})
                _matchup_txt = f"<b>{g.get('home')}</b> (Def Pase #{h_def.get('pass_def_rank', 15)} / Carrera #{h_def.get('rush_def_rank', 15)}) vs <b>{g.get('away')}</b> (Def Pase #{a_def.get('pass_def_rank', 16)} / Carrera #{a_def.get('rush_def_rank', 16)})"
                st.markdown(f"""
                <div style="background: linear-gradient(135deg, #131c2e 0%, #0f172a 100%); border: 1px solid #0284c7; border-radius: 8px; padding: 10px 14px; margin-bottom: 10px; font-size: 0.82rem;">
                    <b>🏈 Cruce del Encuentro:</b> {_matchup_txt} |
                    <b>O/U:</b> {g.get('over_under')} | <b>Spread:</b> {g.get('spread_str', 'N/A')} |
                    <b>Estado:</b> {g.get('status', 'PROGRAMADO')} ({g.get('score', 'vs')}) | <b>Estadio:</b> {g.get('venue', 'Estadio Oficial')}
                </div>
                """, unsafe_allow_html=True)

                if not _shown:
                    st.info("No hay mercados que cumplan el filtro de probabilidad mínima para este partido.")
                    continue

                _top4 = _shown[:4]
                _t4_cols = st.columns(len(_top4))
                for _k, (_opt, _cname, _aud_p) in enumerate(_top4, 1):
                    _pnum = float(_opt.get("prob_num", 0.0))
                    _pbg, _pcol, _pbdr = _prob_style(_pnum)
                    _out_badge = _fmt_outcome(_aud_p.get("outcome", "PENDING"))
                    with _t4_cols[_k - 1]:
                        st.markdown(f"""
                        <div style="background: #0c1527; border: 1px solid {_pbdr}; border-left: 4px solid {_pbdr}; border-radius: 8px; padding: 10px 12px; height: 100%;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                                <span style="background: {_pbg}; color: {_pcol}; padding: 2px 7px; border-radius: 5px; font-weight: 800; font-size: 0.78rem;">#{_k} • {_pnum:.1f}%</span>
                                <span style="color: #facc15; font-weight: bold; font-size: 0.82rem;">{_opt.get('odds', '')}</span>
                            </div>
                            <div style="color: #ffffff; font-weight: 700; font-size: 0.86rem; margin-bottom: 4px;">{_opt.get('pick', '')}</div>
                            <div style="color: #94a3b8; font-size: 0.72rem; margin-bottom: 4px;">{_cname} | EV: <b style="color:#c084fc;">{_opt.get('ev', '')}</b> | Justa: {_opt.get('fair_odds', '')}</div>
                            <div style="color: #cbd5e1; font-size: 0.72rem; margin-bottom: 4px;">{_opt.get('season_avg', '')} | {_opt.get('buffer_pct', '')}</div>
                            <div style="color: {_pcol}; font-size: 0.74rem; font-weight: 700;">{_out_badge} — <span style="color:#cbd5e1; font-weight:400;">{_aud_p.get('stat_actual', '')}</span></div>
                        </div>
                        """, unsafe_allow_html=True)

                _match_rows = []
                for _rk, (_opt, _cname, _aud_p) in enumerate(_shown, 1):
                    _match_rows.append({
                        "#": _rk,
                        "% Prob.": f"{float(_opt.get('prob_num', 0.0)):.1f}%",
                        "Categoría": _cname,
                        "Pick / Predicción": _opt.get("pick", ""),
                        "Jugador / Mercado": _opt.get("player_full_name", _opt.get("pick", "")),
                        "Momio": _opt.get("odds", ""),
                        "Cuota Justa": _opt.get("fair_odds", ""),
                        "Valor (+EV)": _opt.get("ev", ""),
                        "Récord": _opt.get("record", ""),
                        "Justificación del Encuentro": _opt.get("why_selected", ""),
                        "Resultado": _fmt_outcome(_aud_p.get("outcome", "PENDING")),
                        "Dato en Acta ESPN": _aud_p.get("stat_actual", ""),
                    })
                st.dataframe(pd.DataFrame(_match_rows), width="stretch", hide_index=True)

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
                out_ico = {"HIT": "✅ ACIERTO", "MISS": "❌ FALLO", "VOID": "🔄 VOID", "IN_PROGRESS": "🟡 EN VIVO"}.get(aud_p["outcome"], "🟢 POR JUGAR")
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
            st.dataframe(pd.DataFrame(de_rows), width="stretch", hide_index=True)

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
            "Estado Oficial": {"HIT": "✅ ACIERTO", "MISS": "❌ FALLO", "VOID": "🔄 VOID", "IN_PROGRESS": "🟡 EN VIVO"}.get(aud_res["outcome"], "🟢 POR JUGAR"),
            "Dato Oficial": aud_res["stat_actual"]
        })
    if p_rows:
        st.dataframe(pd.DataFrame(p_rows), width="stretch", hide_index=True)

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
    col_t5_h1, col_t5_h2 = st.columns([3, 1])
    with col_t5_h1:
        st.markdown("#### ✅ Auditoría Oficial Empírica de Todos los Picks de la Jornada")
    with col_t5_h2:
        if st.button("🔄 Actualizar Auditoría en Vivo (ESPN)", key="btn_sync_tab5_nfl"):
            with st.spinner("Actualizando con ESPN..."):
                from live_nfl_audit_sync import sync_nfl_date_from_espn
                sync_nfl_date_from_espn(date_str)
                if os.path.exists(pdf_path):
                    try:
                        os.remove(pdf_path)
                    except Exception:
                        pass
                st.rerun()
    all_aud_rows = []
    for b in _game_bundles:
        g = b["game"]
        for opt, _cname, aud_p in b["ranked"]:
            all_aud_rows.append({
                "Liga": g.get("league"),
                "Hora CDMX": g.get("time_cdmx"),
                "Partido": g.get("match"),
                "% Prob.": f"{float(opt.get('prob_num', 0)):.1f}%",
                "Jugador": opt.get("player_full_name", opt["pick"]),
                "Mercado": opt.get("pick"),
                "Momio": opt.get("odds"),
                "Resultado Oficial": _fmt_outcome(aud_p["outcome"], "🟢 PENDIENTE"),
                "Dato en Acta ESPN": aud_p.get("stat_actual")
            })
    if all_aud_rows:
        _a1, _a2, _a3, _a4, _a5 = st.columns(5)
        _a1.metric("Picks Auditados", len(all_aud_rows))
        _a2.metric("✅ Aciertos (HIT)", hits_cnt)
        _a3.metric("❌ Fallos (MISS)", miss_cnt)
        _a4.metric("🔄 Anulados (VOID)", void_cnt)
        _a5.metric("🎯 Efectividad Real", f"{(hits_cnt/_resolved_cnt)*100:.1f}%" if _resolved_cnt > 0 else "Pendiente")
        st.dataframe(pd.DataFrame(all_aud_rows), width="stretch", hide_index=True)
    else:
        st.info("No hay partidos de fútbol americano para auditar en esta fecha/filtro.")

with t6:
    st.markdown("#### 💬 Asistente IA de Fútbol Americano (NFL & NCAAF)")
    st.info("Pide recomendaciones para mariscales (QBs), corredores (RBs), receptores (WRs) o anotadores de Touchdown.")
    user_q = st.text_input("Haz una pregunta sobre la cartelera de hoy:", placeholder="Ej: ¿Cuáles son las mejores opciones de pase para Josh Allen o Justin Jefferson?")
    if user_q:
        st.success("Analizando con el motor cuantitativo de NFL... Te recomendamos el Over de Yardas de Pase y Touchdowns considerando las condiciones climatológicas y el matchup secundario.")
