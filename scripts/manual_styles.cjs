const fs = require('fs');
const path = require('path');

// Cargar Logo ALFRA en Base64
let logoBase64 = "";
try {
  const logoFile = fs.readFileSync(path.join(__dirname, '../src/assets/logoAlfraBase64.js'), 'utf8');
  const match = logoFile.match(/export const LOGO_ALFRA_BASE64 = "([^"]+)";/);
  if (match) {
    logoBase64 = match[1];
  } else {
    const fallbackMatch = logoFile.match(/data:image\/png;base64,[^"'\s]+/);
    if (fallbackMatch) logoBase64 = fallbackMatch[0];
  }
} catch (e) {
  console.error("No se pudo cargar el logo:", e.message);
}

function getCommonStyles() {
  return `
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
      font-size: 11pt;
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
      padding: 40px 30px;
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
      max-width: 320px;
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
      font-size: 28pt;
      font-weight: 700;
      color: #ffffff;
      line-height: 1.2;
      margin-bottom: 12px;
      letter-spacing: -0.5px;
    }

    .cover-title span {
      color: #20b2aa;
      display: block;
      font-size: 22pt;
      margin-top: 4px;
    }

    .cover-subtitle {
      font-size: 13pt;
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
      margin-bottom: 22px;
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
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      height: 12mm;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-top: 1px solid #e2e8f0;
      font-size: 8pt;
      color: #94a3b8;
      padding-top: 4px;
    }

    /* TIPOGRAFÍA Y SECCIONES */
    h1.sec-title {
      font-family: 'Playfair Display', serif;
      font-size: 18pt;
      color: #0f172a;
      border-left: 4px solid #20b2aa;
      padding-left: 12px;
      margin: 22px 0 12px 0;
      line-height: 1.25;
    }

    h2.sub-title {
      font-size: 13pt;
      font-weight: 700;
      color: #1e293b;
      margin: 18px 0 10px 0;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    h3.subsub-title {
      font-size: 11pt;
      font-weight: 700;
      color: #334155;
      margin: 14px 0 8px 0;
    }

    p {
      margin-bottom: 10px;
      font-size: 10pt;
      color: #334155;
      line-height: 1.6;
    }

    ul, ol {
      margin: 6px 0 14px 22px;
      font-size: 10pt;
      color: #334155;
    }

    li {
      margin-bottom: 6px;
      line-height: 1.5;
    }

    /* CALLOUTS */
    .callout {
      border-radius: 8px;
      padding: 12px 16px;
      margin: 14px 0;
      font-size: 9.5pt;
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
      font-size: 10pt;
    }

    /* STEP CARDS */
    .step-card {
      display: flex;
      gap: 14px;
      margin: 12px 0;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px 14px;
      page-break-inside: avoid;
    }

    .step-number {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: #20b2aa;
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 11pt;
      flex-shrink: 0;
      box-shadow: 0 2px 4px rgba(32, 178, 170, 0.3);
    }

    .step-body {
      flex: 1;
    }

    .step-body h4 {
      font-size: 10.5pt;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 4px;
    }

    .step-body p {
      font-size: 9.5pt;
      margin-bottom: 4px;
      color: #475569;
    }

    /* MOCKUPS VISUALES */
    .mockup-container {
      background: #0f172a;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 8px 20px rgba(0,0,0,0.15);
      border: 1px solid #334155;
      margin: 14px 0 20px 0;
      page-break-inside: avoid;
    }

    .mockup-header {
      background: #1e293b;
      padding: 6px 12px;
      display: flex;
      align-items: center;
      gap: 6px;
      border-bottom: 1px solid #334155;
    }

    .mockup-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      display: inline-block;
    }
    .dot-red { background: #ef4444; }
    .dot-yellow { background: #eab308; }
    .dot-green { background: #22c55e; }

    .mockup-title {
      color: #94a3b8;
      font-size: 8pt;
      margin-left: 8px;
      font-family: 'JetBrains Mono', monospace;
    }

    .mockup-content {
      background: #ffffff;
      padding: 16px;
      color: #1e293b;
    }

    /* BADGES & CHIPS */
    .badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 8pt;
      font-weight: 700;
    }
    .badge-teal { background: #ccfbf1; color: #0f766e; }
    .badge-gold { background: #fef08a; color: #854d0e; }
    .badge-blue { background: #dbeafe; color: #1e40af; }
    .badge-rose { background: #ffe4e6; color: #9f1239; }
    .badge-slate { background: #e2e8f0; color: #334155; }
    .badge-red { background: #fee2e2; color: #991b1b; }
    .badge-green { background: #dcfce7; color: #166534; }

    /* TABLAS ELEGANTES */
    table.data-table {
      width: 100%;
      border-collapse: collapse;
      margin: 14px 0;
      font-size: 9pt;
      page-break-inside: avoid;
    }

    table.data-table th {
      background: #f1f5f9;
      color: #0f172a;
      font-weight: 700;
      text-align: left;
      padding: 8px 10px;
      border-bottom: 2px solid #cbd5e1;
      font-size: 8.5pt;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    table.data-table td {
      padding: 8px 10px;
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
      gap: 12px;
      margin: 14px 0;
      page-break-inside: avoid;
    }

    .module-card {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px;
      background: #ffffff;
      box-shadow: 0 2px 4px rgba(0,0,0,0.03);
    }

    .module-card h4 {
      font-size: 10pt;
      font-weight: 700;
      color: #0f172a;
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 4px;
    }

    .module-card p {
      font-size: 8.5pt;
      color: #64748b;
      margin-bottom: 0;
    }

    /* MOCKUP ESPECÍFICO TARJETA CUMPLEAÑOS */
    .bday-card-preview {
      background: linear-gradient(135deg, #fdfbf7 0%, #ffffff 100%);
      border: 2px solid #d4af37;
      border-radius: 12px;
      padding: 16px;
      text-align: center;
      max-width: 380px;
      margin: 10px auto;
      box-shadow: 0 4px 12px rgba(212, 175, 55, 0.2);
    }

    .bday-card-preview .bday-logo {
      height: 48px;
      margin-bottom: 8px;
    }

    .bday-card-preview h3 {
      font-family: 'Playfair Display', serif;
      font-size: 16pt;
      color: #0f172a;
      margin-bottom: 4px;
    }

    .bday-card-preview .bday-recipient {
      font-size: 13pt;
      font-weight: 700;
      color: #c59b27;
      margin-bottom: 8px;
    }

    .bday-card-preview .bday-gift-box {
      background: #f0fdfa;
      border: 1px dashed #14b8a6;
      border-radius: 8px;
      padding: 10px;
      margin: 10px 0;
      font-size: 10pt;
      color: #0f766e;
      font-weight: 600;
    }

    .btn-mockup {
      display: inline-block;
      padding: 6px 14px;
      border-radius: 6px;
      font-size: 8.5pt;
      font-weight: 600;
      text-align: center;
      cursor: pointer;
    }
    .btn-mockup-primary { background: #20b2aa; color: #fff; border: none; }
    .btn-mockup-gold { background: #d4af37; color: #fff; border: none; }
    .btn-mockup-whatsapp { background: #25d366; color: #fff; border: none; }
    .btn-mockup-outline { background: #fff; color: #475569; border: 1px solid #cbd5e1; }
  `;
}

function renderCover(profileName, manualSubtitle, summaryText, targetRoles) {
  return `
    <div class="cover-page">
      <div class="cover-header">
        <img src="${logoBase64}" class="cover-logo-img" alt="Clínica ALFRA" />
        <br>
        <span class="cover-badge">Manual Operativo Oficial • Sistema Digital ALFRA</span>
        <h1 class="cover-title">
          ${profileName}
          <span>Guía de Procedimientos y Operación</span>
        </h1>
        <p class="cover-subtitle">${manualSubtitle}</p>
      </div>

      <div class="cover-role-card">
        <h4>Objetivo y Alcance</h4>
        <p>${summaryText}</p>
        <div style="margin-top: 10px; padding-top: 8px; border-top: 1px dashed rgba(212,175,55,0.4); font-size: 8.5pt; color: #f6d87e;">
          <strong>Perfiles Autorizados:</strong> ${targetRoles}
        </div>
      </div>

      <div class="cover-footer">
        <div>
          <div><strong>Clínica ALFRA</strong> | Medicina Estética & Spa</div>
          <div>Plataforma Integrada v1.5.0 (AAB Comp. 103)</div>
        </div>
        <div style="text-align: right;">
          <div><strong>Fecha de Publicación:</strong> Noviembre 2026</div>
          <div><strong>Clasificación:</strong> Confidencial • Uso Interno</div>
        </div>
      </div>
    </div>
  `;
}

function renderHeader(manualTitle, chapterName) {
  return `
    <div class="doc-header">
      <div class="doc-header-left">
        <img src="${logoBase64}" class="doc-header-logo" alt="ALFRA" />
        <div class="doc-header-titles">
          <h3>Clínica ALFRA — ${manualTitle}</h3>
          <p>${chapterName}</p>
        </div>
      </div>
      <div class="doc-header-badge">v1.5.0 Prod</div>
    </div>
  `;
}

module.exports = {
  logoBase64,
  getCommonStyles,
  renderCover,
  renderHeader
};
