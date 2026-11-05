# -*- coding: utf-8 -*-
import streamlit as st
import pandas as pd
from escalera_engine import (
    ALL_LEAGUES_MARKETS, 
    generate_parleys_for_doubling, 
    calculate_escalera_schedule
)

st.set_page_config(
    page_title="Reto Escalera 100k Semanales - Playdoit Analyzer",
    page_icon="🚀",
    layout="wide"
)

# Custom Styling Deportivo y de Apuestas
st.markdown("""
<style>
    .main { background-color: #0d1117; color: #f0f6fc; }
    .card-parley {
        background-color: #161b22;
        border-radius: 10px;
        padding: 18px;
        margin-bottom: 20px;
        border: 2px solid #238636;
    }
    .card-market {
        background-color: #161b22;
        border-radius: 8px;
        padding: 14px;
        margin-bottom: 12px;
        border: 1px solid #30363d;
    }
    .stat-pill {
        background-color: #21262d;
        color: #58a6ff;
        padding: 4px 10px;
        border-radius: 6px;
        font-size: 0.85rem;
        font-weight: 600;
        display: inline-block;
        margin-top: 6px;
    }
    .odds-badge {
        background-color: #f78166;
        color: #000;
        padding: 3px 8px;
        border-radius: 4px;
        font-weight: 800;
        font-size: 0.9rem;
    }
    .prob-badge {
        background-color: #2ea043;
        color: #fff;
        padding: 3px 8px;
        border-radius: 4px;
        font-weight: 800;
        font-size: 0.9rem;
    }
</style>
""", unsafe_allow_html=True)

# Encabezado Principal
st.title("🚀 RETO ESCALERA: META 100K SEMANALES")
st.subheader("Estrategia: Iniciar en  ➜ Doblar (Cuota ~2.00) ➜ Asegurar 50% en Bank ➜ Reanudar")
st.caption("Filtro Estadístico Extremo: Selecciones de 80% a 95% de probabilidad histórica en mercados especializados de Playdoit.")

# Pestañas
tab_plan, tab_parleys, tab_fijas = st.tabs([
    "📈 1. PLAN DE PROGRESIÓN ( a ,000+)", 
    "🔥 2. MEJORES COMBINADAS CUOTA 2.00 (DOBLAR)", 
    "🎯 3. TODAS LAS SELECCIONES FIJAS (POR DEPORTE)"
])

# ----------------- TAB 1: PLAN MATEMÁTICO -----------------
with tab_plan:
    st.markdown("### 📊 ¿Cómo llegar a ,000 asegurando ganancias en cada paso?")
    st.write("""
    Siguiendo tu regla exacta: **Apuestas 500**, al doblar ganas 500 netos. Guardas la mitad (250) en tu Bank intocable y vuelves a apostar los otros 750 (los 500 base + 250 de ganancia). 
    En cada paso **tu dinero real ya está retirado y a salvo**, mientras tu apuesta crece exponencialmente.
    """)
    
    schedule = calculate_escalera_schedule(initial_bank=500.0, target_weekly=100000.0)
    df_schedule = pd.DataFrame(schedule)
    st.dataframe(df_schedule, use_container_width=True)
    
    c1, c2, c3 = st.columns(3)
    c1.metric("Paso Inicial", " MXN", "Cuota 2.00")
    c2.metric("Pasos para la Meta", "7 a 8 Pasos", "Cuotas 1.95 - 2.05")
    c3.metric("Capital Total Asegurado", ",000+ MXN", "Semanal")

# ----------------- TAB 2: COMBINADAS CUOTA 2.00 -----------------
with tab_parleys:
    st.markdown("### 🔥 Combinadas Diseñadas Específicamente para Doblar (Cuota 1.95 - 2.05)")
    st.write("Ninguna de estas jugadas es al azar. Cada línea une selecciones reducidas de altísima frecuencia basadas en los mercados que mostraste en Playdoit:")
    
    parleys = generate_parleys_for_doubling()
    
    for p in parleys:
        st.markdown(f"""
        <div class="card-parley">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <h3 style="margin: 0; color: #58a6ff;">{p['name']}</h3>
                <div>
                    <span class="odds-badge">CUOTA PLAYDOIT: {p['target_odds']}x</span>
                    <span class="prob-badge">PROBABILIDAD CONJUNTA: {p['joint_probability']}%</span>
                </div>
            </div>
            <p style="color: #8b949e; margin: 8px 0 15px 0;"><i>{p['description']}</i></p>
        """, unsafe_allow_html=True)
        
        for pick in p["picks"]:
            st.markdown(f"""
            <div style="background-color: #0d1117; padding: 12px; border-radius: 6px; margin-bottom: 8px; border-left: 4px solid #238636;">
                <div style="display: flex; justify-content: space-between;">
                    <b>🏅 [{pick['sport']}] {pick['match']}</b>
                    <span style="color: #f78166; font-weight: bold;">Momio: {pick['odds']}</span>
                </div>
                <div style="font-size: 1.05rem; color: #f0f6fc; margin: 4px 0;">
                    👉 <b>Mercado Playdoit:</b> <span style="color: #7ee787;">{pick['pick']}</span>
                </div>
                <div style="font-size: 0.85rem; color: #8b949e;">
                    📊 <b>Datos que lo respaldan:</b> {pick['stat']}
                </div>
            </div>
            """, unsafe_allow_html=True)
            
        st.markdown("</div>", unsafe_allow_html=True)

# ----------------- TAB 3: SELECCIONES FIJAS POR DEPORTE -----------------
with tab_fijas:
    st.markdown("### 🎯 Todos los Mercados Especializados Filtrados por Deporte")
    st.write("Aquí están desglosados los mercados de tus fotos (Tiros de esquina, Faltas/Tarjetas, Touchdowns, Pases, Triples, Puntos y Rebotes) con sus datos de respaldo:")
    
    sports = ["TODOS", "NFL", "NBA", "FÚTBOL", "BÉISBOL"]
    sel_sport = st.selectbox("Filtrar por deporte:", sports)
    
    filtered_markets = ALL_LEAGUES_MARKETS
    if sel_sport != "TODOS":
        filtered_markets = [m for m in ALL_LEAGUES_MARKETS if m["sport"] == sel_sport]
        
    for m in filtered_markets:
        prob = m["real_probability"]
        american_str = f"+{m['playdoit_american']}" if m['playdoit_american'] > 0 else f"{m['playdoit_american']}"
        
        with st.container():
            st.markdown(f"""
            <div class="card-market">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: #58a6ff; font-weight: bold;">🏅 [{m['sport']}] {m['match']}</span>
                    <div>
                        <span class="odds-badge">Playdoit: {american_str} ({m['playdoit_decimal']})</span>
                        <span class="prob-badge">Éxito Real: {prob}%</span>
                    </div>
                </div>
                <h4 style="margin: 6px 0; color: #7ee787;">{m['selection']}</h4>
                <div style="font-size: 0.9rem; color: #c9d1d9;">
                    📁 <b>Categoría Playdoit:</b> {m['market_category']} | <b>Línea:</b> {m['playdoit_line']}
                </div>
                <div class="stat-pill">
                    📊 Respaldo Estadístico: {m['stat_data']}
                </div>
            </div>
            """, unsafe_allow_html=True)
