# -*- coding: utf-8 -*-
import os
import re

def load_logo():
    logo_path = os.path.join(os.path.dirname(__file__), '..', 'src', 'assets', 'logoAlfraBase64.js')
    with open(logo_path, 'r', encoding='utf-8') as f:
        content = f.read()
    match = re.search(r'data:image/png;base64,[^"\'\s]+', content)
    if match:
        return match.group(0)
    raise ValueError("No se encontro el logotipo en logoAlfraBase64.js")

def get_common_css():
    return """
    @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700;800&family=Playfair+Display:ital,wght@0,600;0,700;1,400&family=JetBrains+Mono:wght@400;600&display=swap');

    @page {
      size: A4 portrait;
      margin: 18mm 14mm 18mm 14mm;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Montserrat', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #1e293b;
      background: #ffffff;
      line-height: 1.55;
      font-size: 10.5pt;
      -webkit-font-smoothing: antialiased;
    }

    .page-break {
      page-break-after: always;
      break-after: page;
      clear: both;
    }

    .avoid-break {
      page-break-inside: avoid;
      break-inside: avoid;
    }

    /* PORTADA DE LUJO */
    .cover-page {
      height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 45px 35px;
      background: linear-gradient(145deg, #09131d 0%, #0f1f2e 50%, #162a3d 100%);
      color: #ffffff;
      position: relative;
      border: 2px solid #c59b27;
      border-radius: 8px;
      page-break-after: always;
      box-sizing: border-box;
    }

    .cover-page::before {
      content: "";
      position: absolute;
      top: 10px;
      left: 10px;
      right: 10px;
      bottom: 10px;
      border: 1px solid rgba(212, 175, 55, 0.35);
      border-radius: 6px;
      pointer-events: none;
    }

    .cover-header {
      text-align: center;
      padding-top: 25px;
    }

    .cover-logo-img {
      max-width: 310px;
      height: auto;
      filter: drop-shadow(0 6px 14px rgba(0,0,0,0.5));
      margin-bottom: 20px;
    }

    .cover-badge {
      display: inline-block;
      padding: 6px 16px;
      background: rgba(212, 175, 55, 0.15);
      border: 1px solid #d4af37;
      color: #f6d87e;
      border-radius: 30px;
      font-size: 8.5pt;
      font-weight: 700;
      letter-spacing: 2px;
      text-transform: uppercase;
      margin-bottom: 15px;
    }

    .cover-title {
      font-family: 'Playfair Display', serif;
      font-size: 26pt;
      font-weight: 700;
      color: #ffffff;
      line-height: 1.2;
      margin-bottom: 12px;
      letter-spacing: -0.5px;
    }

    .cover-title span {
      color: #20b2aa;
      display: block;
      font-size: 20pt;
      margin-top: 4px;
    }

    .cover-subtitle {
      font-size: 12pt;
      color: #94a3b8;
      font-weight: 400;
      max-width: 580px;
      margin: 0 auto 20px auto;
      line-height: 1.4;
    }

    .cover-role-card {
      background: rgba(255, 255, 255, 0.05);
      backdrop-filter: blur(8px);
      border: 1px solid rgba(212, 175, 55, 0.4);
      border-radius: 12px;
      padding: 16px 24px;
      margin: 10px auto;
      max-width: 520px;
      text-align: left;
    }

    .cover-role-card h4 {
      color: #d4af37;
      font-size: 11pt;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      margin-bottom: 6px;
    }

    .cover-role-card p {
      color: #cbd5e1;
      font-size: 9.5pt;
      line-height: 1.45;
    }

    .cover-footer {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      border-top: 1px solid rgba(212, 175, 55, 0.3);
      padding-top: 16px;
      font-size: 8.5pt;
      color: #94a3b8;
    }

    .cover-footer strong {
      color: #f1f5f9;
    }

    /* ENCABEZADOS Y PIE DE PÁGINAS INTERNAS */
    .doc-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #20b2aa;
      padding-bottom: 10px;
      margin-bottom: 20px;
    }

    .doc-header-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .doc-header-logo {
      height: 38px;
      width: auto;
    }

    .doc-header-titles h3 {
      font-size: 12pt;
      font-weight: 700;
      color: #0f172a;
      letter-spacing: -0.3px;
    }

    .doc-header-titles p {
      font-size: 8pt;
      color: #64748b;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .doc-header-badge {
      background: #f0fdfa;
      border: 1px solid #14b8a6;
      color: #0f766e;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 8pt;
      font-weight: 700;
    }

    .doc-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-top: 1px solid #e2e8f0;
      font-size: 8pt;
      color: #94a3b8;
      padding-top: 6px;
      margin-top: 25px;
    }

    /* TIPOGRAFÍA Y SECCIONES */
    h1.sec-title {
      font-family: 'Playfair Display', serif;
      font-size: 17pt;
      color: #0f172a;
      border-left: 4px solid #20b2aa;
      padding-left: 12px;
      margin: 20px 0 10px 0;
      line-height: 1.25;
    }

    h2.sub-title {
      font-size: 12.5pt;
      font-weight: 700;
      color: #1e293b;
      margin: 16px 0 8px 0;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    h3.subsub-title {
      font-size: 10.5pt;
      font-weight: 700;
      color: #334155;
      margin: 12px 0 6px 0;
    }

    p {
      margin-bottom: 9px;
      font-size: 9.5pt;
      color: #334155;
      line-height: 1.6;
    }

    ul, ol {
      margin: 6px 0 12px 20px;
      font-size: 9.5pt;
      color: #334155;
    }

    li {
      margin-bottom: 5px;
      line-height: 1.5;
    }

    /* CALLOUTS */
    .callout {
      border-radius: 8px;
      padding: 10px 14px;
      margin: 12px 0;
      font-size: 9pt;
      line-height: 1.5;
      page-break-inside: avoid;
    }

    .callout-info {
      background: #f0fdfa;
      border-left: 4px solid #14b8a6;
      color: #134e4a;
    }

    .callout-gold {
      background: #fefce8;
      border-left: 4px solid #d4af37;
      color: #713f12;
    }

    .callout-warning {
      background: #fff7ed;
      border-left: 4px solid #f97316;
      color: #7c2d12;
    }

    .callout-danger {
      background: #fef2f2;
      border-left: 4px solid #ef4444;
      color: #7f1d1d;
    }

    .callout-title {
      font-weight: 700;
      margin-bottom: 4px;
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 9.5pt;
    }

    /* STEP CARDS */
    .step-card {
      display: flex;
      gap: 12px;
      margin: 10px 0;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 12px;
      page-break-inside: avoid;
    }

    .step-number {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: #20b2aa;
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 10pt;
      flex-shrink: 0;
      box-shadow: 0 2px 4px rgba(32, 178, 170, 0.3);
    }

    .step-body {
      flex: 1;
    }

    .step-body h4 {
      font-size: 10pt;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 3px;
    }

    .step-body p {
      font-size: 9pt;
      margin-bottom: 3px;
      color: #475569;
    }

    /* MOCKUPS VISUALES */
    .mockup-container {
      background: #0f172a;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 6px 16px rgba(0,0,0,0.12);
      border: 1px solid #334155;
      margin: 12px 0 16px 0;
      page-break-inside: avoid;
    }

    .mockup-header {
      background: #1e293b;
      padding: 5px 10px;
      display: flex;
      align-items: center;
      gap: 6px;
      border-bottom: 1px solid #334155;
    }

    .mockup-dot {
      width: 9px;
      height: 9px;
      border-radius: 50%;
      display: inline-block;
    }
    .dot-red { background: #ef4444; }
    .dot-yellow { background: #eab308; }
    .dot-green { background: #22c55e; }

    .mockup-title {
      color: #94a3b8;
      font-size: 7.5pt;
      margin-left: 6px;
      font-family: 'JetBrains Mono', monospace;
    }

    .mockup-content {
      background: #ffffff;
      padding: 14px;
      color: #1e293b;
    }

    /* BADGES */
    .badge {
      display: inline-block;
      padding: 2px 7px;
      border-radius: 4px;
      font-size: 7.5pt;
      font-weight: 700;
    }
    .badge-teal { background: #ccfbf1; color: #0f766e; }
    .badge-gold { background: #fef08a; color: #854d0e; }
    .badge-blue { background: #dbeafe; color: #1e40af; }
    .badge-rose { background: #ffe4e6; color: #9f1239; }
    .badge-slate { background: #e2e8f0; color: #334155; }
    .badge-red { background: #fee2e2; color: #991b1b; }
    .badge-green { background: #dcfce7; color: #166534; }

    /* TABLAS */
    table.data-table {
      width: 100%;
      border-collapse: collapse;
      margin: 10px 0;
      font-size: 8.5pt;
      page-break-inside: avoid;
    }

    table.data-table th {
      background: #f1f5f9;
      color: #0f172a;
      font-weight: 700;
      text-align: left;
      padding: 7px 8px;
      border-bottom: 2px solid #cbd5e1;
      font-size: 8pt;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    table.data-table td {
      padding: 7px 8px;
      border-bottom: 1px solid #e2e8f0;
      color: #334155;
    }

    table.data-table tr:nth-child(even) td {
      background: #f8fafc;
    }

    /* GRID DE MÓDULOS */
    .module-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin: 12px 0;
      page-break-inside: avoid;
    }

    .module-card {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px;
      background: #ffffff;
      box-shadow: 0 1px 3px rgba(0,0,0,0.03);
    }

    .module-card h4 {
      font-size: 9.5pt;
      font-weight: 700;
      color: #0f172a;
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 3px;
    }

    .module-card p {
      font-size: 8pt;
      color: #64748b;
      margin-bottom: 0;
    }

    /* BOTONES MOCKUP */
    .btn-mockup {
      display: inline-block;
      padding: 5px 12px;
      border-radius: 5px;
      font-size: 8pt;
      font-weight: 600;
      text-align: center;
    }
    .btn-mockup-primary { background: #20b2aa; color: #fff; border: none; }
    .btn-mockup-gold { background: #d4af37; color: #fff; border: none; }
    .btn-mockup-whatsapp { background: #25d366; color: #fff; border: none; }
    .btn-mockup-outline { background: #fff; color: #475569; border: 1px solid #cbd5e1; }
    """

def render_cover(logo_b64, profile_title, manual_subtitle, summary_text, target_roles):
    return f"""
    <div class="cover-page">
      <div class="cover-header">
        <img src="{logo_b64}" class="cover-logo-img" alt="Clinica ALFRA" />
        <br>
        <span class="cover-badge">Manual Operativo Oficial • Sistema Digital ALFRA</span>
        <h1 class="cover-title">
          {profile_title}
          <span>Guía de Procedimientos y Operación</span>
        </h1>
        <p class="cover-subtitle">{manual_subtitle}</p>
      </div>

      <div class="cover-role-card">
        <h4>Objetivo y Alcance Institucional</h4>
        <p>{summary_text}</p>
        <div style="margin-top: 10px; padding-top: 8px; border-top: 1px dashed rgba(212,175,55,0.4); font-size: 8.5pt; color: #f6d87e;">
          <strong>Perfiles Autorizados:</strong> {target_roles}
        </div>
      </div>

      <div class="cover-footer">
        <div>
          <div><strong>Clínica ALFRA</strong> • Medicina Estética & Spa</div>
          <div>Plataforma Integrada v1.5.0 (AAB Compilación 103)</div>
        </div>
        <div style="text-align: right;">
          <div><strong>Fecha de Emisión:</strong> Noviembre 2026</div>
          <div><strong>Clasificación:</strong> Confidencial • Uso Institucional</div>
        </div>
      </div>
    </div>
    """

def render_header(logo_b64, doc_title, chapter_name):
    return f"""
    <div class="doc-header">
      <div class="doc-header-left">
        <img src="{logo_b64}" class="doc-header-logo" alt="ALFRA" />
        <div class="doc-header-titles">
          <h3>Clínica ALFRA — {doc_title}</h3>
          <p>{chapter_name}</p>
        </div>
      </div>
      <div class="doc-header-badge">v1.5.0 Producción</div>
    </div>
    """

def render_footer(manual_name, page_info):
    return f"""
    <div class="doc-footer">
      <div>Clínica ALFRA © 2026 • Documento Oficial Confidencial</div>
      <div>{manual_name} • {page_info}</div>
    </div>
    """