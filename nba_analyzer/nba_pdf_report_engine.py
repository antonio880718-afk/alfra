"""
nba_pdf_report_engine.py - Generador de Reportes PDF Completos para Baloncesto (NBA y NCAAB).
Exporta el 100% de los picks organizados partido a partido con % de ocurrencia, justificación táctica,
promedios de temporada, defensas rivales y auditoría empírica.
"""
import os, io, sys
from datetime import datetime, timedelta, timezone

_dir = os.path.dirname(os.path.abspath(__file__))
if _dir not in sys.path:
    sys.path.insert(0, _dir)

from nba_data_api import get_normalized_bball_schedule
from nba_math_models_engine import compute_full_nba_game_data_engineering
from nba_self_audit_engine import audit_individual_nba_pick

DATA_DIR = os.path.join(_dir, "data")

def _clean(txt):
    if not txt:
        return ""
    return str(txt).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

def generate_nba_complete_pdf(date_str: str = None, league_filter: str = "ALL") -> bytes:
    if not date_str:
        date_str = datetime.now(timezone(timedelta(hours=-6))).strftime("%Y%m%d")
    """Genera un PDF exhaustivo con todos los picks de cada juego de NBA + NCAAB y su justificación completa."""
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import letter, landscape
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import inch
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle

    games = get_normalized_bball_schedule(date_str, league_filter)
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=landscape(letter),
        leftMargin=0.3 * inch,
        rightMargin=0.3 * inch,
        topMargin=0.35 * inch,
        bottomMargin=0.35 * inch,
        title=f"Reporte Completo NBA y NCAAB - {date_str}"
    )

    styles = getSampleStyleSheet()
    t_style = ParagraphStyle("T", parent=styles["Heading1"], fontSize=13, leading=16, textColor=colors.HexColor("#0f172a"))
    sub_style = ParagraphStyle("S", parent=styles["Normal"], fontSize=8.0, leading=10, textColor=colors.HexColor("#334155"))
    h2_style = ParagraphStyle("H2", parent=styles["Heading2"], fontSize=9.5, leading=12, textColor=colors.HexColor("#1e293b"))
    c_style = ParagraphStyle("C", parent=styles["Normal"], fontSize=6.8, leading=8.5)
    b_style = ParagraphStyle("B", parent=c_style, fontName="Helvetica-Bold")
    j_style = ParagraphStyle("J", parent=c_style, fontSize=6.2, leading=7.8, textColor=colors.HexColor("#1e3a8a"))

    story = []
    story.append(Paragraph(_clean(f"ALFRA NBA & NCAAB QUANTITATIVE ENGINE — DOSSIER DE INTELIGENCIA DE TODOS LOS PICKS ({date_str})"), t_style))
    story.append(Paragraph(_clean(f"Total Partidos Evaluados: {len(games)} | Horarios Oficiales CDMX (UTC-6) | Modelos: Pace-Adjusted Possessions + Usage Redistribution + Opta PRA + Playdoit EV%"), sub_style))
    story.append(Spacer(1, 6))

    for idx, g in enumerate(games, 1):
        m_title = g.get("match", "")
        lg = g.get("league", "NBA")
        t_cdmx = g.get("time_cdmx", "18:00")
        sc = g.get("score", "vs")
        st = g.get("status", "PROGRAMADO")
        ou = g.get("over_under", 225.5)
        sp = g.get("spread_str", "N/A")
        ven = g.get("venue", "Arena Oficial")

        story.append(Paragraph(_clean(f"#{idx} [{t_cdmx} hs CDMX | {lg}] {m_title} — Marcador Oficial: {sc} ({st}) | Línea O/U: {ou} | Spread: {sp} | {ven}"), h2_style))
        story.append(Spacer(1, 2))

        de = compute_full_nba_game_data_engineering(g)
        t_rows = [["Categoría / Mercado", "Selección Sugerida", "Justificación Táctica & Matchup (Métrica vs Línea)", "% Ocurr", "Momio", "EV%", "Récord", "Auditoría", "Dato Oficial en Acta"]]
        t_styles = [
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f172a")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 6.5),
            ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#cbd5e1")),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("ALIGN", (3, 0), (6, -1), "CENTER"),
        ]

        r_idx = 1
        for cat in de.get("categories", []):
            cat_name = cat.get("category", "")
            for opt in cat.get("options", []):
                aud = audit_individual_nba_pick(opt, g, date_str)
                out_icon = {"HIT": "ACIERTO", "MISS": "FALLO", "VOID": "VOID", "IN_PROGRESS": "EN VIVO"}.get(aud.get("outcome"), "PENDIENTE")
                
                # Construcción del texto de justificación
                justif_txt = f"{opt.get('season_avg', '')} | {opt.get('buffer_pct', '')}<br/>{opt.get('defense_matchup', '')}"
                
                t_rows.append([
                    Paragraph(_clean(cat_name), c_style),
                    Paragraph(_clean(opt.get("pick", "")), b_style),
                    Paragraph(justif_txt, j_style),
                    f"{opt.get('prob_num', 80.0):.1f}%",
                    str(opt.get("odds", "")),
                    str(opt.get("ev", "")),
                    str(opt.get("record", "")),
                    out_icon,
                    Paragraph(_clean(aud.get("stat_actual", "")), c_style)
                ])
                if aud.get("outcome") == "HIT":
                    t_styles.append(("BACKGROUND", (7, r_idx), (7, r_idx), colors.HexColor("#dcfce7")))
                elif aud.get("outcome") == "MISS":
                    t_styles.append(("BACKGROUND", (7, r_idx), (7, r_idx), colors.HexColor("#fee2e2")))
                r_idx += 1

        tbl = Table(t_rows, colWidths=[1.1*inch, 1.8*inch, 2.6*inch, 0.65*inch, 0.55*inch, 0.55*inch, 0.75*inch, 0.75*inch, 1.65*inch], repeatRows=1)
        tbl.setStyle(TableStyle(t_styles))
        story.append(tbl)
        story.append(Spacer(1, 8))

    doc.build(story)
    pdf_bytes = buf.getvalue()
    buf.close()

    out_file = os.path.join(DATA_DIR, f"Reporte_TODOS_Los_Picks_Organizados_Por_Partido_NBA_{league_filter}_{date_str}.pdf")
    try:
        with open(out_file, "wb") as f:
            f.write(pdf_bytes)
    except Exception:
        pass

    return pdf_bytes

if __name__ == "__main__":
    b = generate_nba_complete_pdf("20261109", "ALL")
    print(f"PDF NBA Generado Exitosamente: {len(b)} bytes")


def generate_nba_audit_pdf_bytes(dates: list = None, league_filter: str = "ALL") -> bytes:
    """Genera el Reporte Oficial en PDF de Auditoría de Aciertos, Fallos y VOID para NBA y NCAAB."""
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import letter, landscape
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import inch
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle

    if not dates:
        dates = [datetime.now(timezone(timedelta(hours=-6))).strftime("%Y%m%d")]

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=landscape(letter),
        leftMargin=0.3 * inch,
        rightMargin=0.3 * inch,
        topMargin=0.35 * inch,
        bottomMargin=0.35 * inch,
        title=f"Reporte de Auditoria NBA y NCAAB - {', '.join(dates)}"
    )

    styles = getSampleStyleSheet()
    t_style = ParagraphStyle("T", parent=styles["Heading1"], fontSize=13, leading=16, textColor=colors.HexColor("#0f172a"))
    sub_style = ParagraphStyle("S", parent=styles["Normal"], fontSize=8.0, leading=10, textColor=colors.HexColor("#334155"))
    h2_style = ParagraphStyle("H2", parent=styles["Heading2"], fontSize=9.0, leading=11, textColor=colors.HexColor("#1e293b"))
    c_style = ParagraphStyle("C", parent=styles["Normal"], fontSize=6.5, leading=8.0)
    b_style = ParagraphStyle("B", parent=c_style, fontName="Helvetica-Bold")
    j_style = ParagraphStyle("J", parent=c_style, fontSize=6.0, leading=7.5, textColor=colors.HexColor("#475569"))

    story = []
    d_label = ", ".join(dates)
    story.append(Paragraph(_clean(f"ALFRA NBA & NCAAB — REPORTE OFICIAL DE AUDITORÍA EMPÍRICA ({d_label})"), t_style))
    story.append(Paragraph(_clean("Auditoría Oficial Empírica de Todos los Picks Sugeridos y Cotejo con Actas Oficiales de ESPN / NBA Stats"), sub_style))
    story.append(Spacer(1, 6))

    all_matches_data = []
    total_hits = 0
    total_misses = 0
    total_voids = 0
    total_pending = 0

    for d_str in dates:
        games = get_normalized_bball_schedule(d_str, league_filter)
        for idx, g in enumerate(games, 1):
            de = compute_full_nba_game_data_engineering(g)
            ranked_opts = []
            for cat in de.get("categories", []):
                cname = cat.get("category", "")
                for opt in cat.get("options", []):
                    aud = audit_individual_nba_pick(opt, g, d_str)
                    ranked_opts.append((opt, cname, aud))
            ranked_opts.sort(key=lambda x: (-float(x[0].get("prob_num", 0.0)), -float(x[0].get("odds_num", 1.0))))

            bp = ranked_opts[0][0] if ranked_opts else de.get("best_pick", {})
            bp_aud = ranked_opts[0][2] if ranked_opts else audit_individual_nba_pick(bp, g, d_str)
            out = bp_aud.get("outcome", "PENDING")

            if out == "HIT":
                total_hits += 1
            elif out == "MISS":
                total_misses += 1
            elif out == "VOID":
                total_voids += 1
            else:
                total_pending += 1

            all_matches_data.append({
                "date": d_str,
                "time": g.get("time_cdmx", "18:00"),
                "league": g.get("league", "NBA"),
                "match": g.get("match", ""),
                "score": g.get("score", "vs"),
                "status": g.get("status", "PROGRAMADO"),
                "best_pick": bp.get("pick", ""),
                "best_odds": bp.get("odds", ""),
                "best_prob": f"{float(bp.get('prob_num', 0)):.1f}%",
                "outcome": out,
                "stat_actual": bp_aud.get("stat_actual", "Marcador oficial"),
                "top4": ranked_opts[:4]
            })

    # Resumen Ejecutivo
    res_dec = total_hits + total_misses
    eff_pct = round(total_hits / res_dec * 100.0, 1) if res_dec > 0 else 0.0
    summary_txt = f"<b>Picks Evaluados:</b> {len(all_matches_data)} | <b>Aciertos (HIT):</b> {total_hits} | <b>Fallos (MISS):</b> {total_misses} | <b>Anulados (VOID):</b> {total_voids} | <b>Pendientes:</b> {total_pending} | <b>Efectividad Real Pick #1:</b> {eff_pct}%"
    story.append(Paragraph(_clean(summary_txt), sub_style))
    story.append(Spacer(1, 8))

    # Tabla de Resultados Partido por Partido
    t_rows = [["#", "Hora", "Liga", "Partido Oficial ESPN", "Marcador", "Pick #1 Sugerido", "Momio", "% Prob.", "Resultado", "Dato Oficial en Acta ESPN"]]
    t_styles = [
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f172a")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 6.5),
        ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#cbd5e1")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (0, 0), (2, -1), "CENTER"),
        ("ALIGN", (6, 0), (8, -1), "CENTER"),
    ]

    for idx, m in enumerate(all_matches_data, 1):
        out_lbl = {"HIT": "ACIERTO", "MISS": "FALLO", "VOID": "VOID", "IN_PROGRESS": "EN VIVO"}.get(m["outcome"], "PENDIENTE")
        t_rows.append([
            str(idx),
            m["time"],
            m["league"],
            Paragraph(_clean(m["match"]), b_style),
            m["score"],
            Paragraph(_clean(m["best_pick"]), c_style),
            str(m["best_odds"]),
            str(m["best_prob"]),
            out_lbl,
            Paragraph(_clean(m["stat_actual"]), c_style)
        ])
        if m["outcome"] == "HIT":
            t_styles.append(("BACKGROUND", (8, idx), (8, idx), colors.HexColor("#dcfce7")))
            t_styles.append(("TEXTCOLOR", (8, idx), (8, idx), colors.HexColor("#166534")))
        elif m["outcome"] == "MISS":
            t_styles.append(("BACKGROUND", (8, idx), (8, idx), colors.HexColor("#fee2e2")))
            t_styles.append(("TEXTCOLOR", (8, idx), (8, idx), colors.HexColor("#991b1b")))
        elif m["outcome"] == "VOID":
            t_styles.append(("BACKGROUND", (8, idx), (8, idx), colors.HexColor("#e2e8f0")))

    tbl = Table(t_rows, colWidths=[0.3*inch, 0.65*inch, 0.6*inch, 2.2*inch, 0.8*inch, 2.0*inch, 0.55*inch, 0.55*inch, 0.75*inch, 2.0*inch], repeatRows=1)
    tbl.setStyle(TableStyle(t_styles))
    story.append(tbl)

    doc.build(story)
    pdf_bytes = buf.getvalue()
    buf.close()

    cache_path = os.path.join(DATA_DIR, f"Reporte_Auditoria_NBA_{'_'.join(dates)}.pdf")
    try:
        with open(cache_path, "wb") as f:
            f.write(pdf_bytes)
    except Exception:
        pass

    return pdf_bytes
