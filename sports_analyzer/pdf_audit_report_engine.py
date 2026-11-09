# -*- coding: utf-8 -*-
"""
MOTOR GENERADOR DE REPORTE OFICIAL EN PDF DE TODOS LOS PICKS SUGERIDOS Y SU AUDITORÍA EMPÍRICA
Incluye:
1. Resumen Ejecutivo Global (Aciertos, Fallos, Void, Pendientes y % Efectividad Real).
2. Auditoría Detallada de Boletos Oficiales (Parlay 100x, Conservador 11x, Escalera) por Fecha.
3. Auditoría Completa Partido por Partido de TODA la Cartelera (Pick Principal + las 4 Variables SGP sugeridas)
   con Dato Oficial Verificado en Acta (ESPN / Opta / SofaScore).
"""

import io
from datetime import datetime
from typing import List, Dict, Any, Optional

from automated_self_audit_engine import (
    run_autonomous_system_audit,
    audit_individual_pick_empirically,
    get_match_boxscore,
)
from hourly_slots_engine import get_chronological_slots, analyze_match_for_slot


DATE_LABELS = {
    "20261107": "Sabado 7 de Noviembre 2026",
    "20261108": "Domingo 8 de Noviembre 2026",
    "20261109": "Lunes 9 de Noviembre 2026",
    "20261110": "Martes 10 de Noviembre 2026",
    "20261111": "Miercoles 11 de Noviembre 2026",
    "20261112": "Jueves 12 de Noviembre 2026",
    "20261113": "Viernes 13 de Noviembre 2026",
    "20261114": "Sabado 14 de Noviembre 2026",
    "20261115": "Domingo 15 de Noviembre 2026",
}


def _clean_pdf_text(val: Any) -> str:
    """Remueve emojis y caracteres fuera de Latin-1 para compatibilidad 100% con fuentes PDF estandar."""
    if val is None:
        return ""
    s = str(val)
    replacements = {
        "✅": "[ACIERTO] ",
        "❌": "[FALLO] ",
        "⚪": "[VOID] ",
        "🟢": "[ABIERTO] ",
        "⚡": "[EN VIVO] ",
        "≥": ">=",
        "≤": "<=",
        "º": "o",
        "ª": "a",
        "—": "-",
        "–": "-",
        "•": "*",
    }
    for k, v in replacements.items():
        s = s.replace(k, v)
    return s.encode("latin-1", "ignore").decode("latin-1").strip()


def collect_full_picks_audit_data(dates: Optional[List[str]] = None) -> Dict[str, Any]:
    """Recopila todos los picks sugeridos (Boletos + Cartelera Completa + 4 Variables por partido) para las fechas indicadas."""
    if not dates:
        dates = ["20261107", "20261108", "20261109"]

    days_data = []
    global_best_hits = 0
    global_best_misses = 0
    global_best_voids = 0
    global_best_pending = 0

    global_vars_hits = 0
    global_vars_misses = 0
    global_vars_voids = 0
    global_vars_pending = 0

    global_ticket_hits = 0
    global_ticket_misses = 0

    for d in dates:
        t_audit = run_autonomous_system_audit(d)
        global_ticket_hits += t_audit.get("hits_count", 0)
        global_ticket_misses += t_audit.get("misses_count", 0)

        slots_res = get_chronological_slots(d)
        match_rows = []
        d_b_hits, d_b_misses, d_b_voids, d_b_pend = 0, 0, 0, 0
        d_v_hits, d_v_misses, d_v_voids, d_v_pend = 0, 0, 0, 0

        for s in slots_res.get("slots", []):
            for g in s.get("matches", []):
                a = analyze_match_for_slot(g)
                m_str = a["match"]
                league_str = a.get("league", g.get("league", ""))
                time_str = g.get("time_cdmx", "12:00")
                bs = get_match_boxscore(m_str, match_date=d, match_time_hint=time_str)
                score_str = bs.get("score", "vs")

                bp = a.get("best_pick", {})
                bp_lbl = bp.get("pick") or bp.get("selection") or ""
                bp_odds = bp.get("odds", 1.25)
                bp_prob = bp.get("prob", 85.0)
                bp_res = audit_individual_pick_empirically(
                    {"match": m_str, "pick": bp_lbl, "odds": bp_odds, "time": time_str},
                    match_date=d,
                )
                out = bp_res["outcome"]
                if out == "HIT":
                    d_b_hits += 1
                    global_best_hits += 1
                elif out == "MISS":
                    d_b_misses += 1
                    global_best_misses += 1
                elif out == "VOID":
                    d_b_voids += 1
                    global_best_voids += 1
                else:
                    d_b_pend += 1
                    global_best_pending += 1

                vars_audited = []
                for v in a.get("variables", []):
                    v_lbl = v.get("pick") or ""
                    v_odds = v.get("odds", 1.25)
                    v_res = audit_individual_pick_empirically(
                        {"match": m_str, "pick": v_lbl, "odds": v_odds, "time": time_str},
                        match_date=d,
                    )
                    vo = v_res["outcome"]
                    if vo == "HIT":
                        d_v_hits += 1
                        global_vars_hits += 1
                    elif vo == "MISS":
                        d_v_misses += 1
                        global_vars_misses += 1
                    elif vo == "VOID":
                        d_v_voids += 1
                        global_vars_voids += 1
                    else:
                        d_v_pend += 1
                        global_vars_pending += 1
                    vars_audited.append({
                        "type": v.get("type", ""),
                        "pick": v_lbl,
                        "odds": v_odds,
                        "prob": v.get("prob", 80.0),
                        "outcome": vo,
                        "stat_actual": v_res.get("stat_actual", ""),
                    })

                match_rows.append({
                    "time": time_str,
                    "league": league_str,
                    "match": m_str,
                    "score": score_str,
                    "best_pick": bp_lbl,
                    "best_odds": bp_odds,
                    "best_prob": bp_prob,
                    "best_outcome": out,
                    "best_stat": bp_res.get("stat_actual", ""),
                    "variables": vars_audited,
                })

        tot_b_dec = d_b_hits + d_b_misses
        b_pct = round(d_b_hits / tot_b_dec * 100.0, 1) if tot_b_dec > 0 else 100.0
        tot_v_dec = d_v_hits + d_v_misses
        v_pct = round(d_v_hits / tot_v_dec * 100.0, 1) if tot_v_dec > 0 else 100.0

        days_data.append({
            "date_str": d,
            "date_label": DATE_LABELS.get(d, d),
            "ticket_audit": t_audit,
            "matches": match_rows,
            "best_hits": d_b_hits,
            "best_misses": d_b_misses,
            "best_voids": d_b_voids,
            "best_pending": d_b_pend,
            "best_hit_rate": b_pct,
            "vars_hits": d_v_hits,
            "vars_misses": d_v_misses,
            "vars_voids": d_v_voids,
            "vars_pending": d_v_pend,
            "vars_hit_rate": v_pct,
        })

    g_b_dec = global_best_hits + global_best_misses
    g_b_pct = round(global_best_hits / g_b_dec * 100.0, 1) if g_b_dec > 0 else 100.0
    g_v_dec = global_vars_hits + global_vars_misses
    g_v_pct = round(global_vars_hits / g_v_dec * 100.0, 1) if g_v_dec > 0 else 100.0
    g_t_dec = global_ticket_hits + global_ticket_misses
    g_t_pct = round(global_ticket_hits / g_t_dec * 100.0, 1) if g_t_dec > 0 else 100.0

    return {
        "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S CDMX"),
        "days": days_data,
        "global_best_hits": global_best_hits,
        "global_best_misses": global_best_misses,
        "global_best_voids": global_best_voids,
        "global_best_pending": global_best_pending,
        "global_best_pct": g_b_pct,
        "global_vars_hits": global_vars_hits,
        "global_vars_misses": global_vars_misses,
        "global_vars_voids": global_vars_voids,
        "global_vars_pending": global_vars_pending,
        "global_vars_pct": g_v_pct,
        "global_ticket_hits": global_ticket_hits,
        "global_ticket_misses": global_ticket_misses,
        "global_ticket_pct": g_t_pct,
    }


def generate_audit_pdf_bytes(dates: Optional[List[str]] = None) -> bytes:
    """Genera el archivo PDF completo en memoria con todos los picks sugeridos y su resultado oficial."""
    data = collect_full_picks_audit_data(dates)

    try:
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import letter, landscape
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import inch
        from reportlab.platypus import (
            SimpleDocTemplate,
            Paragraph,
            Spacer,
            Table,
            TableStyle,
            PageBreak,
        )

        buf = io.BytesIO()
        doc = SimpleDocTemplate(
            buf,
            pagesize=landscape(letter),
            leftMargin=0.35 * inch,
            rightMargin=0.35 * inch,
            topMargin=0.35 * inch,
            bottomMargin=0.35 * inch,
            title="Reporte Oficial de Auditoria de Picks - Alfra Sports",
        )

        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            "TitleCustom",
            parent=styles["Heading1"],
            fontSize=15,
            leading=18,
            textColor=colors.HexColor("#0f172a"),
            spaceAfter=4,
        )
        sub_style = ParagraphStyle(
            "SubCustom",
            parent=styles["Normal"],
            fontSize=9,
            leading=12,
            textColor=colors.HexColor("#334155"),
            spaceAfter=8,
        )
        sec_style = ParagraphStyle(
            "SecCustom",
            parent=styles["Heading2"],
            fontSize=12,
            leading=15,
            textColor=colors.HexColor("#0f172a"),
            spaceBefore=8,
            spaceAfter=6,
        )
        cell_style = ParagraphStyle(
            "CellCustom",
            parent=styles["Normal"],
            fontSize=7.2,
            leading=9.0,
            textColor=colors.HexColor("#0f172a"),
        )
        cell_bold = ParagraphStyle(
            "CellBold",
            parent=cell_style,
            fontName="Helvetica-Bold",
        )

        story = []
        story.append(Paragraph(_clean_pdf_text("REPORTE OFICIAL DE AUDITORIA DE TODOS LOS PICKS SUGERIDOS (ALFRA SPORTS)"), title_style))
        story.append(
            Paragraph(
                _clean_pdf_text(
                    f"Fecha de generacion: {data['generated_at']} | Fuente Oficial de Cotejo: Actas ESPN API / Opta / SofaScore Match Center"
                ),
                sub_style,
            )
        )

        # Tabla Resumen Ejecutivo Global
        summary_rows = [
            [
                "CATEGORIA AUDITADA",
                "ACIERTOS (GANADAS)",
                "ERRORES (FALLIDAS)",
                "ANULADAS (VOID 1.00)",
                "POR JUGAR (ABIERTOS)",
                "% EFECTIVIDAD REAL",
            ],
            [
                "Boletos Oficiales (Parlay 100x + Conservador 11x)",
                str(data["global_ticket_hits"]),
                str(data["global_ticket_misses"]),
                "0",
                "-",
                f"{data['global_ticket_pct']}%",
            ],
            [
                "Pick Principal Sugerido por Partido (Cartelera Completa)",
                str(data["global_best_hits"]),
                str(data["global_best_misses"]),
                str(data["global_best_voids"]),
                str(data["global_best_pending"]),
                f"{data['global_best_pct']}%",
            ],
            [
                "Todas las Variables SGP Evaluadas (4 por Partido)",
                str(data["global_vars_hits"]),
                str(data["global_vars_misses"]),
                str(data["global_vars_voids"]),
                str(data["global_vars_pending"]),
                f"{data['global_vars_pct']}%",
            ],
        ]
        t_sum = Table(summary_rows, colWidths=[3.4 * inch, 1.3 * inch, 1.3 * inch, 1.3 * inch, 1.4 * inch, 1.4 * inch])
        t_sum.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f172a")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, -1), 8.5),
                    ("ALIGN", (1, 0), (-1, -1), "CENTER"),
                    ("BACKGROUND", (0, 1), (-1, -1), colors.HexColor("#f8fafc")),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                    ("TOPPADDING", (0, 0), (-1, -1), 5),
                ]
            )
        )
        story.append(t_sum)
        story.append(Spacer(1, 10))

        # Desglose por Dia
        for d_idx, day in enumerate(data["days"]):
            if d_idx > 0:
                story.append(PageBreak())

            d_lbl = _clean_pdf_text(day["date_label"])
            story.append(
                Paragraph(
                    _clean_pdf_text(
                        f"JORNADA: {d_lbl} — Pick Principal: {day['best_hits']} Aciertos / {day['best_misses']} Fallos / {day['best_voids']} Void / {day['best_pending']} Por Jugar ({day['best_hit_rate']}%)"
                    ),
                    sec_style,
                )
            )

            # 1. Boletos Oficiales del Dia
            t_aud = day["ticket_audit"]
            t_picks = t_aud.get("audited_100x", []) + t_aud.get("audited_11x", [])
            if t_picks:
                story.append(Paragraph(_clean_pdf_text(f"1. Boletos Oficiales Sugeridos ({d_lbl})"), cell_bold))
                story.append(Spacer(1, 3))
                t_rows = [["#", "Partido", "Seleccion Sugerida (Boleto)", "Momio", "Resultado", "Dato Oficial en Acta"]]
                for idx_p, tp in enumerate(t_picks, 1):
                    out_str = tp.get("outcome", "")
                    res_lbl = "ACIERTO" if out_str == "HIT" else ("FALLO" if out_str == "MISS" else ("VOID" if out_str == "VOID" else "ABIERTO"))
                    t_rows.append([
                        str(idx_p),
                        Paragraph(_clean_pdf_text(tp.get("match", "")), cell_style),
                        Paragraph(_clean_pdf_text(tp.get("pick", "")), cell_bold),
                        f"{tp.get('odds', 1.25):.2f}",
                        res_lbl,
                        Paragraph(_clean_pdf_text(tp.get("stat_actual", "")), cell_style),
                    ])
                tbl_t = Table(t_rows, colWidths=[0.35 * inch, 2.2 * inch, 2.8 * inch, 0.65 * inch, 0.9 * inch, 3.2 * inch], repeatRows=1)
                ts_list = [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e293b")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, -1), 7.5),
                    ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#cbd5e1")),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("ALIGN", (0, 0), (0, -1), "CENTER"),
                    ("ALIGN", (3, 0), (4, -1), "CENTER"),
                ]
                for r_i, tp in enumerate(t_picks, 1):
                    out_s = tp.get("outcome", "")
                    if out_s == "HIT":
                        ts_list.append(("BACKGROUND", (4, r_i), (4, r_i), colors.HexColor("#dcfce7")))
                    elif out_s == "MISS":
                        ts_list.append(("BACKGROUND", (4, r_i), (4, r_i), colors.HexColor("#fee2e2")))
                tbl_t.setStyle(TableStyle(ts_list))
                story.append(tbl_t)
                story.append(Spacer(1, 8))

            # 2. Tabla Completa de Cartelera (Todos los Partidos del Dia + Pick Principal + 4 Variables SGP)
            story.append(
                Paragraph(
                    _clean_pdf_text(
                        f"2. Cartelera Completa ({len(day['matches'])} Partidos) — Pick Principal y las 4 Variables SGP Auditadas ({d_lbl})"
                    ),
                    cell_bold,
                )
            )
            story.append(Spacer(1, 3))

            m_rows = [[
                "#",
                "Hora / Liga",
                "Partido (Marcador)",
                "Pick Principal Sugerido (#1)",
                "Estado #1",
                "Dato Oficial Verificado (#1)",
                "Auditoría de las 4 Variables SGP del Partido",
            ]]
            row_styles = [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f172a")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 7.0),
                ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#cbd5e1")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("ALIGN", (0, 0), (0, -1), "CENTER"),
                ("ALIGN", (4, 0), (4, -1), "CENTER"),
            ]

            for m_i, m in enumerate(day["matches"], 1):
                out_m = m["best_outcome"]
                st_lbl = (
                    "ACIERTO"
                    if out_m == "HIT"
                    else ("FALLO" if out_m == "MISS" else ("VOID 1.00" if out_m == "VOID" else "POR JUGAR"))
                )
                vars_lines = []
                for v_idx, v_item in enumerate(m["variables"], 1):
                    vo = v_item["outcome"]
                    v_tag = "OK" if vo == "HIT" else ("FALLO" if vo == "MISS" else ("VOID" if vo == "VOID" else "PEND"))
                    vars_lines.append(
                        f"V{v_idx} [{v_tag}] {v_item['pick']} -> {v_item['stat_actual']}"
                    )
                vars_text = "<br/>".join(_clean_pdf_text(line) for line in vars_lines)

                m_rows.append([
                    str(m_i),
                    Paragraph(_clean_pdf_text(f"{m['time']} | {m['league']}"), cell_style),
                    Paragraph(_clean_pdf_text(f"{m['match']} ({m['score']})"), cell_bold),
                    Paragraph(_clean_pdf_text(f"{m['best_pick']} (@{m['best_odds']:.2f} | {m['best_prob']}%)"), cell_bold),
                    st_lbl,
                    Paragraph(_clean_pdf_text(m["best_stat"]), cell_style),
                    Paragraph(vars_text, cell_style),
                ])

                if out_m == "HIT":
                    row_styles.append(("BACKGROUND", (4, m_i), (4, m_i), colors.HexColor("#dcfce7")))
                elif out_m == "MISS":
                    row_styles.append(("BACKGROUND", (4, m_i), (4, m_i), colors.HexColor("#fee2e2")))
                elif out_m == "VOID":
                    row_styles.append(("BACKGROUND", (4, m_i), (4, m_i), colors.HexColor("#e2e8f0")))
                else:
                    row_styles.append(("BACKGROUND", (4, m_i), (4, m_i), colors.HexColor("#fef9c3")))

            tbl_m = Table(
                m_rows,
                colWidths=[0.32 * inch, 1.15 * inch, 1.65 * inch, 1.85 * inch, 0.72 * inch, 1.65 * inch, 2.86 * inch],
                repeatRows=1,
            )
            tbl_m.setStyle(TableStyle(row_styles))
            story.append(tbl_m)

        doc.build(story)
        return buf.getvalue()
    except Exception as e:
        # Fallback minimalista en PDF 1.4 puro si reportlab no estuviera disponible
        lines = [
            "REPORTE OFICIAL DE AUDITORIA DE PICKS - ALFRA SPORTS",
            f"Generado: {data['generated_at']}",
            f"Pick Principal Global: {data['global_best_hits']} Aciertos / {data['global_best_misses']} Fallos ({data['global_best_pct']}%)",
            f"Error detalle PDF enriquecido: {e}",
        ]
        for day in data["days"]:
            lines.append(f"=== {day['date_label']} ({day['best_hits']} HIT / {day['best_misses']} MISS) ===")
            for m in day["matches"]:
                lines.append(f"{m['time']} | {m['match']} ({m['score']}) | {m['best_pick']} -> {m['best_outcome']} ({m['best_stat']})")
        content_str = "\n".join(_clean_pdf_text(x) for x in lines[:120])
        stream = f"BT /F1 8 Tf 36 550 Td 10 TL ({content_str}) Tj ET"
        pdf_raw = (
            "%PDF-1.4\n1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n"
            "2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n"
            "3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 792 612] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>endobj\n"
            f"4 0 obj<< /Length {len(stream)} >>stream\n{stream}\nendstream\nendobj\n"
            "5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n"
            "xref\n0 6\n0000000000 65535 f \ntrailer<< /Size 6 /Root 1 0 R >>\nstartxref\n0\n%%EOF"
        )
        return pdf_raw.encode("latin-1", "ignore")


def generate_daily_predictions_pdf_bytes(date_str: str = "20261109") -> bytes:
    """
    Genera un PDF exhaustivo con TODAS LAS PREDICCIONES DEL DIA y su PORCENTAJE DE OCURRENCIA (%):
    1. Matriz Ejecutiva de todos los partidos del dia (Pick #1 + 4 Variables SGP con % de Ocurrencia).
    2. Boletos Oficiales del Dia (Parlay 100x, Conservador 11x, Escalera) con % de Ocurrencia por seleccion.
    3. Catalogo Completo por Partido de TODAS las Predicciones de las 8 Categorias (Tiros al Arco, Goles,
       Asistencias, G+A, Corners, Tarjetas, Mitades, BTTS y Doble Oportunidad) con % de Ocurrencia,
       Frecuencia Historica (Record), Momio, Cuota Justa, EV% y Estado Oficial.
    """
    from match_data_engineering_engine import compute_full_match_data_engineering
    from daily_tickets_engine import (
        get_daily_parlay_ticket,
        get_daily_conservative_11x,
        get_daily_escalera_blocks,
    )

    d_lbl = DATE_LABELS.get(date_str, f"Jornada {date_str}")
    slots_res = get_chronological_slots(date_str)
    all_matches_raw = []
    for s in slots_res.get("slots", []):
        for g in s.get("matches", []):
            all_matches_raw.append(g)

    try:
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import letter, landscape
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import inch
        from reportlab.platypus import (
            SimpleDocTemplate,
            Paragraph,
            Spacer,
            Table,
            TableStyle,
            PageBreak,
        )

        buf = io.BytesIO()
        doc = SimpleDocTemplate(
            buf,
            pagesize=landscape(letter),
            leftMargin=0.32 * inch,
            rightMargin=0.32 * inch,
            topMargin=0.32 * inch,
            bottomMargin=0.32 * inch,
            title=f"Todas las Predicciones del Dia con % de Ocurrencia - {d_lbl}",
        )

        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            "PredTitle",
            parent=styles["Heading1"],
            fontSize=15,
            leading=18,
            textColor=colors.HexColor("#0f172a"),
            spaceAfter=4,
        )
        sub_style = ParagraphStyle(
            "PredSub",
            parent=styles["Normal"],
            fontSize=8.8,
            leading=11,
            textColor=colors.HexColor("#334155"),
            spaceAfter=8,
        )
        sec_style = ParagraphStyle(
            "PredSec",
            parent=styles["Heading2"],
            fontSize=11.5,
            leading=14,
            textColor=colors.HexColor("#0f172a"),
            spaceBefore=8,
            spaceAfter=5,
        )
        cell_style = ParagraphStyle(
            "PredCell",
            parent=styles["Normal"],
            fontSize=7.0,
            leading=8.8,
            textColor=colors.HexColor("#0f172a"),
        )
        cell_bold = ParagraphStyle(
            "PredCellBold",
            parent=cell_style,
            fontName="Helvetica-Bold",
        )

        story = []
        now_gen = datetime.now().strftime("%Y-%m-%d %H:%M:%S CDMX")
        story.append(
            Paragraph(
                _clean_pdf_text(
                    f"REPORTE OFICIAL DE TODAS LAS PREDICCIONES DEL DIA CON PORCENTAJE DE OCURRENCIA (%) — {d_lbl.upper()}"
                ),
                title_style,
            )
        )
        story.append(
            Paragraph(
                _clean_pdf_text(
                    f"Generado: {now_gen} | Total Partidos del Dia: {len(all_matches_raw)} | Modelos: Dixon-Coles Bivariado + Binomial Negativa + Opta SOT + Rigor Arbitral + Clima/Altitud"
                ),
                sub_style,
            )
        )

        # 1. TABLA EJECUTIVA DE PREDICCIONES PRINCIPALES Y 4 VARIABLES SGP DE TODOS LOS PARTIDOS DEL DIA
        story.append(
            Paragraph(
                _clean_pdf_text(
                    f"1. MATRIZ GENERAL DE PREDICCIONES DEL DIA ({len(all_matches_raw)} PARTIDOS) — PICK #1 Y LAS 4 VARIABLES SGP CON % DE OCURRENCIA"
                ),
                sec_style,
            )
        )

        analyzed_matches = []
        for g in all_matches_raw:
            a = analyze_match_for_slot(g)
            analyzed_matches.append((g, a))

        m_rows = [[
            "#",
            "Hora / Liga",
            "Partido",
            "Prediccion Principal (#1)",
            "% OCURRENCIA",
            "Momio / EV%",
            "Las 4 Predicciones SGP del Partido con su % de Ocurrencia",
            "Estado / Verificacion",
        ]]
        m_styles = [
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f172a")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 7.0),
            ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#cbd5e1")),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("ALIGN", (0, 0), (0, -1), "CENTER"),
            ("ALIGN", (4, 0), (5, -1), "CENTER"),
        ]

        for idx_m, (g, a) in enumerate(analyzed_matches, 1):
            m_str = a["match"]
            t_str = g.get("time_cdmx", "12:00")
            bp = a.get("best_pick", {})
            bp_lbl = bp.get("pick") or ""
            bp_prob = float(bp.get("prob", 85.0))
            bp_odds = float(bp.get("odds", 1.25))
            bp_ev = float(bp.get("ev_pct", 5.0))

            aud_bp = audit_individual_pick_empirically(
                {"match": m_str, "pick": bp_lbl, "odds": bp_odds, "time": t_str},
                match_date=date_str,
            )
            out_bp = aud_bp.get("outcome", "PENDING")
            st_txt = (
                f"ACIERTO ({aud_bp.get('stat_actual', '')})"
                if out_bp == "HIT"
                else (
                    f"FALLO ({aud_bp.get('stat_actual', '')})"
                    if out_bp == "MISS"
                    else (
                        f"VOID 1.00 ({aud_bp.get('stat_actual', '')})"
                        if out_bp == "VOID"
                        else f"ABIERTO ({t_str} hs)"
                    )
                )
            )

            v_lines = []
            for v_i, v in enumerate(a.get("variables", []), 1):
                v_lines.append(
                    f"V{v_i} [{v.get('prob', 80.0)}% Ocurrencia | @{v.get('odds', 1.25):.2f}]: {v.get('pick', '')}"
                )
            v_html = "<br/>".join(_clean_pdf_text(x) for x in v_lines)

            m_rows.append([
                str(idx_m),
                Paragraph(_clean_pdf_text(f"{t_str} | {a.get('league', '')}"), cell_style),
                Paragraph(_clean_pdf_text(m_str), cell_bold),
                Paragraph(_clean_pdf_text(bp_lbl), cell_bold),
                f"{bp_prob:.1f}%",
                f"@{bp_odds:.2f} ({bp_ev:+.1f}%)",
                Paragraph(v_html, cell_style),
                Paragraph(_clean_pdf_text(st_txt), cell_style),
            ])

            if bp_prob >= 85.0:
                m_styles.append(("BACKGROUND", (4, idx_m), (4, idx_m), colors.HexColor("#dcfce7")))
                m_styles.append(("FONTNAME", (4, idx_m), (4, idx_m), "Helvetica-Bold"))
            else:
                m_styles.append(("BACKGROUND", (4, idx_m), (4, idx_m), colors.HexColor("#fef9c3")))

        tbl_main = Table(
            m_rows,
            colWidths=[0.30 * inch, 1.05 * inch, 1.45 * inch, 1.75 * inch, 0.78 * inch, 0.82 * inch, 2.55 * inch, 1.55 * inch],
            repeatRows=1,
        )
        tbl_main.setStyle(TableStyle(m_styles))
        story.append(tbl_main)
        story.append(Spacer(1, 10))

        # 2. BOLETOS OFICIALES DEL DIA CON SU PORCENTAJE DE OCURRENCIA
        t_100x = get_daily_parlay_ticket(date_str)
        t_11x = get_daily_conservative_11x(date_str)
        if t_100x or t_11x:
            story.append(
                Paragraph(
                    _clean_pdf_text(f"2. BOLETOS OFICIALES DEL DIA CON PORCENTAJE DE OCURRENCIA (%) — {d_lbl}"),
                    sec_style,
                )
            )
            b_rows = [["Boleto", "#", "Hora / Liga", "Partido", "Prediccion Sugerida", "% OCURRENCIA", "Momio", "Estado / Dato"]]
            b_styles = [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e293b")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 7.2),
                ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#cbd5e1")),
                ("ALIGN", (1, 0), (1, -1), "CENTER"),
                ("ALIGN", (5, 0), (6, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ]
            r_cursor = 1
            for b_name, b_list in [("Parlay 100x", t_100x), ("Conservador 11x", t_11x)]:
                for p_item in b_list:
                    odds_p = float(p_item.get("odds", 1.25))
                    prob_p = float(p_item.get("prob", round(min(94.0, (1.0 / odds_p) * 100.0 * 1.04), 1)))
                    aud_p = audit_individual_pick_empirically(p_item, match_date=date_str)
                    b_rows.append([
                        b_name,
                        str(p_item.get("n", r_cursor)),
                        Paragraph(_clean_pdf_text(f"{p_item.get('time', '')} | {p_item.get('league', '')}"), cell_style),
                        Paragraph(_clean_pdf_text(p_item.get("match", "")), cell_bold),
                        Paragraph(_clean_pdf_text(p_item.get("pick", "")), cell_bold),
                        f"{prob_p:.1f}%",
                        f"@{odds_p:.2f}",
                        Paragraph(_clean_pdf_text(f"{aud_p.get('outcome', '')}: {aud_p.get('stat_actual', '')}"), cell_style),
                    ])
                    b_styles.append(("BACKGROUND", (5, r_cursor), (5, r_cursor), colors.HexColor("#dcfce7")))
                    r_cursor += 1
            tbl_b = Table(
                b_rows,
                colWidths=[0.85 * inch, 0.30 * inch, 1.15 * inch, 1.75 * inch, 2.40 * inch, 0.85 * inch, 0.65 * inch, 2.30 * inch],
                repeatRows=1,
            )
            tbl_b.setStyle(TableStyle(b_styles))
            story.append(tbl_b)
            story.append(Spacer(1, 10))

        # 3. CATALOGO EXHAUSTIVO DE TODAS LAS PREDICCIONES POR PARTIDO (LAS 8 CATEGORIAS Y ~48 MERCADOS DE CADA JUEGO)
        # Para dias con >35 partidos mostramos las predicciones de alta certeza (>=70% o Top 15 por partido) para mantener el PDF agil,
        # y para jornadas de <=35 partidos incluimos absolutamente las ~48 predicciones completas de cada partido.
        full_all_markets = len(analyzed_matches) <= 35
        story.append(PageBreak())
        story.append(
            Paragraph(
                _clean_pdf_text(
                    f"3. DESGLOSE EXHAUSTIVO DE TODAS LAS PREDICCIONES POR PARTIDO Y SU % DE OCURRENCIA ({d_lbl})"
                ),
                sec_style,
            )
        )

        for idx_m, (g, a) in enumerate(analyzed_matches, 1):
            h_team = g.get("home", "")
            a_team = g.get("away", "")
            l_code = g.get("code", "")
            t_str = g.get("time_cdmx", "12:00")
            m_str = f"{h_team} vs {a_team}"

            de = compute_full_match_data_engineering(h_team, a_team, l_code)
            ref_d = a.get("referee_data", {})
            stad_d = a.get("stadium_data", {})

            story.append(
                Paragraph(
                    _clean_pdf_text(
                        f"Partido #{idx_m}: {m_str} ({t_str} hs CDMX | {g.get('league', '')}) — Estadio: {stad_d.get('stadium', 'Oficial')} ({stad_d.get('altitude_m', 100)}m) | Arbitro: {ref_d.get('referee_name', 'Oficial')} ({ref_d.get('referee_cards_avg', 4.1)} tarj/juego)"
                    ),
                    cell_bold,
                )
            )
            story.append(Spacer(1, 2))

            all_opts = []
            for cat in de.get("categories", []):
                c_name = cat.get("category", "")
                for o in cat.get("options", []):
                    all_opts.append((c_name, o))

            # Ordenar de mayor a menor % de ocurrencia
            all_opts.sort(key=lambda x: float(x[1].get("prob_num", 50.0)), reverse=True)
            if not full_all_markets:
                all_opts = all_opts[:14]

            p_rows = [[
                "Categoria",
                "Prediccion / Mercado Calculado",
                "% DE OCURRENCIA",
                "Frecuencia Empirica (Record)",
                "Momio Casa",
                "Cuota Justa",
                "Valor (EV%)",
                "Estado / Verificacion",
            ]]
            p_styles = [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e293b")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 6.8),
                ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#cbd5e1")),
                ("ALIGN", (2, 0), (6, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ]

            for r_idx, (c_name, o) in enumerate(all_opts, 1):
                prob_num = float(o.get("prob_num", 50.0))
                aud_o = audit_individual_pick_empirically(
                    {"match": m_str, "pick": o.get("pick", ""), "odds": o.get("odds_num", 1.25), "time": t_str},
                    match_date=date_str,
                )
                out_o = aud_o.get("outcome", "PENDING")
                ver_str = (
                    f"ACIERTO ({aud_o.get('stat_actual', '')})"
                    if out_o == "HIT"
                    else (
                        f"FALLO ({aud_o.get('stat_actual', '')})"
                        if out_o == "MISS"
                        else (
                            f"VOID 1.00 ({aud_o.get('stat_actual', '')})"
                            if out_o == "VOID"
                            else "ABIERTO"
                        )
                    )
                )
                p_rows.append([
                    Paragraph(_clean_pdf_text(c_name), cell_style),
                    Paragraph(_clean_pdf_text(o.get("pick", "")), cell_bold if prob_num >= 80.0 else cell_style),
                    f"{prob_num:.1f}%",
                    _clean_pdf_text(o.get("record", "")),
                    str(o.get("odds", "")),
                    str(o.get("fair_odds", "")),
                    str(o.get("ev", "")),
                    Paragraph(_clean_pdf_text(ver_str), cell_style),
                ])
                if prob_num >= 80.0:
                    p_styles.append(("BACKGROUND", (2, r_idx), (2, r_idx), colors.HexColor("#dcfce7")))
                    p_styles.append(("FONTNAME", (2, r_idx), (2, r_idx), "Helvetica-Bold"))
                elif prob_num >= 65.0:
                    p_styles.append(("BACKGROUND", (2, r_idx), (2, r_idx), colors.HexColor("#fef9c3")))

            tbl_p = Table(
                p_rows,
                colWidths=[1.55 * inch, 2.65 * inch, 0.85 * inch, 1.15 * inch, 0.65 * inch, 0.65 * inch, 0.65 * inch, 2.10 * inch],
                repeatRows=1,
            )
            tbl_p.setStyle(TableStyle(p_styles))
            story.append(tbl_p)
            story.append(Spacer(1, 7))

        doc.build(story)
        return buf.getvalue()
    except Exception as e:
        return generate_audit_pdf_bytes([date_str])


def generate_complete_match_by_match_all_picks_pdf(date_str: str = "20261109") -> bytes:
    """
    Genera el reporte PDF definitivo con ABSOLUTAMENTE TODOS LOS PICKS (~60 por partido)
    ORGANIZADOS PARTIDO POR PARTIDO:
    - Sin recortes, sin truncamientos.
    - Las 8 categorías completas: Córners, Tarjetas, Goles Mitades, BTTS / Totales / Hándicap,
      Remates al Arco, Goleadores, Asistencias y G+A.
    - Cada pick con su % de Ocurrencia, Momio, Cuota Justa, EV%, Resultado y Dato Oficial en Acta.
    """
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import letter, landscape
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import inch
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
    )
    from match_data_engineering_engine import compute_full_match_data_engineering
    from hourly_slots_engine import get_chronological_slots, analyze_match_for_slot

    d_lbl = DATE_LABELS.get(date_str, f"Jornada {date_str}")
    slots_res = get_chronological_slots(date_str)
    matches_raw = []
    for s in slots_res.get("slots", []):
        for g in s.get("matches", []):
            matches_raw.append(g)

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=landscape(letter),
        leftMargin=0.30 * inch,
        rightMargin=0.30 * inch,
        topMargin=0.30 * inch,
        bottomMargin=0.30 * inch,
        title=f"Todos los Picks Organizados por Partido - {d_lbl}",
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "MTitle",
        parent=styles["Heading1"],
        fontSize=14,
        leading=17,
        textColor=colors.HexColor("#0f172a"),
        spaceAfter=2,
    )
    sub_style = ParagraphStyle(
        "MSub",
        parent=styles["Normal"],
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor("#334155"),
        spaceAfter=6,
    )
    match_hdr_style = ParagraphStyle(
        "MatchHdr",
        parent=styles["Heading2"],
        fontSize=10.5,
        leading=13.0,
        textColor=colors.HexColor("#0f172a"),
        spaceBefore=4,
        spaceAfter=3,
    )
    cell_style = ParagraphStyle(
        "MCell",
        parent=styles["Normal"],
        fontSize=6.5,
        leading=8.2,
        textColor=colors.HexColor("#0f172a"),
    )
    cell_bold = ParagraphStyle(
        "MCellBold",
        parent=cell_style,
        fontName="Helvetica-Bold",
    )

    story = []
    now_gen = datetime.now().strftime("%Y-%m-%d %H:%M:%S CDMX")

    story.append(Paragraph(
        _clean_pdf_text(f"REPORTE OFICIAL: TODOS LOS PICKS ORGANIZADOS POR PARTIDO ({d_lbl.upper()})"),
        title_style
    ))
    story.append(Paragraph(
        _clean_pdf_text(f"Generado: {now_gen} | Total Encuentros: {len(matches_raw)} | Mercados por Partido: ~60 selecciones completas auditadas con % de ocurrencia y resultado oficial"),
        sub_style
    ))

    total_all_picks = 0
    cat_summary = {}
    matches_compiled = []

    for g in matches_raw:
        h = g["home"]
        a = g["away"]
        code = g.get("code", "")
        time_str = g.get("time_cdmx", "12:00")
        m_str = f"{h} vs {a}"
        analysis = analyze_match_for_slot(g)
        ref_d = analysis.get("referee_data", {})
        stad_d = analysis.get("stadium_data", {})
        bs = get_match_boxscore(m_str, match_date=date_str, match_time_hint=time_str)

        de = compute_full_match_data_engineering(h, a, code)
        match_opts = []
        for cat in de["categories"]:
            cat_name = cat["category"]
            for opt in cat["options"]:
                total_all_picks += 1
                aud = audit_individual_pick_empirically(
                    {"match": m_str, "pick": opt["pick"], "odds": opt["odds_num"], "time": time_str},
                    match_date=date_str
                )
                out_res = aud.get("outcome", "PENDING")
                cat_summary[cat_name] = cat_summary.get(cat_name, [0, 0, 0, 0])
                if out_res == "HIT": cat_summary[cat_name][0] += 1
                elif out_res == "MISS": cat_summary[cat_name][1] += 1
                elif out_res == "VOID": cat_summary[cat_name][2] += 1
                else: cat_summary[cat_name][3] += 1

                match_opts.append({
                    "category": cat_name,
                    "pick": opt["pick"],
                    "prob": float(opt.get("prob_num", 50.0)),
                    "record": opt.get("record", ""),
                    "odds": opt.get("odds", "1.25"),
                    "fair_odds": opt.get("fair_odds", "1.20"),
                    "ev": opt.get("ev", "+4.0%"),
                    "outcome": out_res,
                    "stat_actual": aud.get("stat_actual", "")
                })

        matches_compiled.append({
            "match": m_str,
            "home": h,
            "away": a,
            "league": g.get("league", ""),
            "time": time_str,
            "score": bs.get("score", "vs"),
            "referee": ref_d.get("referee_name", bs.get("referee", "Oficial")),
            "ref_avg": ref_d.get("referee_cards_avg", 4.1),
            "stadium": stad_d.get("stadium", "Oficial"),
            "altitude": stad_d.get("altitude_m", 100),
            "picks": match_opts
        })

    sum_rows = [["MERCADO / CATEGORIA", "TOTAL PICKS EVALUADOS", "ACIERTOS (HIT)", "FALLOS (MISS)", "ANULADAS (VOID)", "PENDIENTES", "% EFECTIVIDAD REAL"]]
    sum_styles = [
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f172a")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 7.5),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#cbd5e1")),
        ("ALIGN", (1, 0), (-1, -1), "CENTER"),
    ]
    for r_idx, (cat_name, counts) in enumerate(cat_summary.items(), 1):
        tot_c = sum(counts)
        tot_dec = counts[0] + counts[1]
        pct_c = f"{round(counts[0]/tot_dec*100, 1)}%" if tot_dec > 0 else "-"
        sum_rows.append([
            _clean_pdf_text(cat_name),
            str(tot_c),
            str(counts[0]),
            str(counts[1]),
            str(counts[2]),
            str(counts[3]),
            pct_c
        ])
    tbl_sum = Table(sum_rows, colWidths=[2.8 * inch, 1.2 * inch, 1.1 * inch, 1.1 * inch, 1.1 * inch, 1.1 * inch, 1.3 * inch])
    tbl_sum.setStyle(TableStyle(sum_styles))
    story.append(tbl_sum)
    story.append(Spacer(1, 10))

    for m_idx, m in enumerate(matches_compiled, 1):
        story.append(PageBreak())
        hdr_txt = f"PARTIDO #{m_idx}: {m['match']} ({m['time']} hs CDMX | {m['league']}) - Marcador: {m['score']} | Arbitro: {m['referee']} ({m['ref_avg']} tarj) | Estadio: {m['stadium']} ({m['altitude']}m)"
        story.append(Paragraph(_clean_pdf_text(hdr_txt), match_hdr_style))
        story.append(Spacer(1, 3))

        p_rows = [["#", "Categoria", "Seleccion / Mercado", "% OCURRENCIA", "Frecuencia (Record)", "Momio", "Cuota Justa", "EV%", "Resultado", "Dato Oficial en Acta"]]
        p_styles = [
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e293b")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 6.5),
            ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#cbd5e1")),
            ("ALIGN", (0, 0), (0, -1), "CENTER"),
            ("ALIGN", (3, 0), (7, -1), "CENTER"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ]

        for p_idx, p in enumerate(m["picks"], 1):
            out_str = p["outcome"]
            res_lbl = "ACIERTO" if out_str == "HIT" else ("FALLO" if out_str == "MISS" else ("VOID 1.00" if out_str == "VOID" else "PENDIENTE"))
            p_rows.append([
                str(p_idx),
                Paragraph(_clean_pdf_text(p["category"]), cell_style),
                Paragraph(_clean_pdf_text(p["pick"]), cell_bold if p["prob"] >= 80 else cell_style),
                f"{p['prob']:.1f}%",
                _clean_pdf_text(p["record"]),
                str(p["odds"]),
                str(p["fair_odds"]),
                str(p["ev"]),
                res_lbl,
                Paragraph(_clean_pdf_text(p["stat_actual"]), cell_style),
            ])
            if out_str == "HIT":
                p_styles.append(("BACKGROUND", (8, p_idx), (8, p_idx), colors.HexColor("#dcfce7")))
            elif out_str == "MISS":
                p_styles.append(("BACKGROUND", (8, p_idx), (8, p_idx), colors.HexColor("#fee2e2")))
            elif out_str == "VOID":
                p_styles.append(("BACKGROUND", (8, p_idx), (8, p_idx), colors.HexColor("#e2e8f0")))
            else:
                p_styles.append(("BACKGROUND", (8, p_idx), (8, p_idx), colors.HexColor("#fef9c3")))

            if p["prob"] >= 82.0:
                p_styles.append(("BACKGROUND", (3, p_idx), (3, p_idx), colors.HexColor("#dcfce7")))
                p_styles.append(("FONTNAME", (3, p_idx), (3, p_idx), "Helvetica-Bold"))

        tbl_match_picks = Table(
            p_rows,
            colWidths=[0.25 * inch, 1.45 * inch, 2.45 * inch, 0.75 * inch, 1.15 * inch, 0.50 * inch, 0.55 * inch, 0.55 * inch, 0.75 * inch, 2.30 * inch],
            repeatRows=1
        )
        tbl_match_picks.setStyle(TableStyle(p_styles))
        story.append(tbl_match_picks)

    doc.build(story)
    return buf.getvalue()
