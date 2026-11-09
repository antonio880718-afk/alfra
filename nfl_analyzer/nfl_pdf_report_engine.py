"""
nfl_pdf_report_engine.py - Generador de Reportes PDF Completos para Fútbol Americano (NFL y NCAAF).
Exporta el 100% de los picks organizados partido a partido con % de ocurrencia y auditoría empírica.
"""
import os, io, sys
from datetime import datetime

_dir = os.path.dirname(os.path.abspath(__file__))
if _dir not in sys.path:
    sys.path.insert(0, _dir)

from nfl_data_api import get_normalized_football_schedule
from nfl_math_models_engine import compute_full_nfl_game_data_engineering
from nfl_self_audit_engine import audit_individual_nfl_pick

DATA_DIR = os.path.join(_dir, "data")

def _clean(txt):
    if not txt:
        return ""
    return str(txt).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

def generate_nfl_complete_pdf(date_str: str = "20261109", league_filter: str = "ALL") -> bytes:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import letter, landscape
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import inch
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle

    games = get_normalized_football_schedule(date_str, league_filter)
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=landscape(letter),
        leftMargin=0.35 * inch,
        rightMargin=0.35 * inch,
        topMargin=0.35 * inch,
        bottomMargin=0.35 * inch,
        title=f"Reporte Completo NFL y NCAAF - {date_str}"
    )

    styles = getSampleStyleSheet()
    t_style = ParagraphStyle("T", parent=styles["Heading1"], fontSize=14, leading=17, textColor=colors.HexColor("#0f172a"))
    sub_style = ParagraphStyle("S", parent=styles["Normal"], fontSize=8.5, leading=11, textColor=colors.HexColor("#334155"))
    h2_style = ParagraphStyle("H2", parent=styles["Heading2"], fontSize=10.5, leading=13, textColor=colors.HexColor("#1e293b"))
    c_style = ParagraphStyle("C", parent=styles["Normal"], fontSize=7.2, leading=9.0)
    b_style = ParagraphStyle("B", parent=c_style, fontName="Helvetica-Bold")

    story = []
    story.append(Paragraph(_clean(f"ALFRA NFL & NCAAF QUANTITATIVE ENGINE — REPORTE DE TODOS LOS PICKS ({date_str})"), t_style))
    story.append(Paragraph(_clean(f"Total Partidos Evaluados: {len(games)} | Modelos: EPA/Play + Números Clave (3, 7) + Target Share + Red Zone TD Share"), sub_style))
    story.append(Spacer(1, 8))

    for idx, g in enumerate(games, 1):
        m_title = g.get("match", "")
        lg = g.get("league", "NFL")
        t_cdmx = g.get("time_cdmx", "12:00")
        sc = g.get("score", "vs")
        st = g.get("status", "PROGRAMADO")
        ou = g.get("over_under", 46.5)
        sp = g.get("spread_str", "N/A")
        ven = g.get("venue", "Estadio Oficial")

        story.append(Paragraph(_clean(f"#{idx} [{t_cdmx} | {lg}] {m_title} — Marcador Oficial: {sc} ({st}) | O/U: {ou} | Spread: {sp} | {ven}"), h2_style))
        story.append(Spacer(1, 3))

        de = compute_full_nfl_game_data_engineering(g)
        t_rows = [["Categoría / Mercado", "Predicción Sugerida", "% Ocurrencia", "Momio", "Cuota Justa", "EV%", "Récord", "Resultado Oficial", "Dato en Acta"]]
        t_styles = [
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f172a")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 6.8),
            ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#cbd5e1")),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("ALIGN", (2, 0), (6, -1), "CENTER"),
        ]

        r_idx = 1
        for cat in de.get("categories", []):
            cat_name = cat.get("category", "")
            for opt in cat.get("options", []):
                aud = audit_individual_nfl_pick(opt, g, date_str)
                out_icon = "ACIERTO" if aud.get("outcome") == "HIT" else ("FALLO" if aud.get("outcome") == "MISS" else "PENDIENTE")
                t_rows.append([
                    Paragraph(_clean(cat_name), c_style),
                    Paragraph(_clean(opt.get("pick", "")), b_style),
                    f"{opt.get('prob_num', 80.0):.1f}%",
                    str(opt.get("odds", "")),
                    str(opt.get("fair_odds", "")),
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

        tbl = Table(t_rows, colWidths=[1.4*inch, 2.2*inch, 0.75*inch, 0.65*inch, 0.65*inch, 0.65*inch, 0.9*inch, 0.85*inch, 1.95*inch], repeatRows=1)
        tbl.setStyle(TableStyle(t_styles))
        story.append(tbl)
        story.append(Spacer(1, 10))

    doc.build(story)
    pdf_bytes = buf.getvalue()
    buf.close()

    out_file = os.path.join(DATA_DIR, f"Reporte_TODOS_Los_Picks_Organizados_Por_Partido_NFL_{date_str}.pdf")
    try:
        with open(out_file, "wb") as f:
            f.write(pdf_bytes)
    except Exception:
        pass

    return pdf_bytes

if __name__ == "__main__":
    for d in ["20261109", "20261108", "20261107"]:
        b = generate_nfl_complete_pdf(d, "ALL")
        print(f"NFL PDF {d} Generado: {len(b)} bytes")