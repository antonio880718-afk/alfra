# -*- coding: utf-8 -*-
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pdf_engine import render_html_to_pdf
from manual_data_common import load_logo, get_common_css, render_cover, render_header, render_footer

def build_manual_03():
    logo = load_logo()
    doc_title = "Manual de Especialistas y Médicos Clínicos"
    
    html = f"""<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>{doc_title} - Clínica ALFRA</title>
  <style>
    {get_common_css()}
  </style>
</head>
<body>

  <!-- PORTADA DE LUJO -->
  {render_cover(
    logo,
    "MÉDICOS Y ESPECIALISTAS",
    "Agenda Médica, Expediente Clínico Digital NOM-004, Mapeo Estético, Consentimiento con Firma Táctil y Comisiones",
    "Manual de operación médica para Médicos Especialistas en Medicina Estética, Cirujanos Plásticos, Dermatólogos y Cosmiatras de Clínica ALFRA. Incluye la guía para el registro de historiales clínicos, dosificación de inyectables, firma digital táctil y prescripción domiciliaria.",
    "Médicos Estéticos, Dermatólogos, Cosmiatras, Nutriólogos y Enfermeras Especialistas"
  )}

  <!-- PÁGINA 2: AGENDA Y EXPEDIENTE -->
  {render_header(logo, doc_title, "Capítulo 1 • Agenda Diaria y Expediente Clínico NOM-004")}

  <h1 class="sec-title">1. Agenda Médica Diaria y Control de Cabina</h1>
  <p>
    El personal médico de <strong>Clínica ALFRA</strong> accede desde su tablet o smartphone asignado a su consola clínica. La agenda presenta los pacientes del día, procedimientos programados y el estado de preparación de su cabina.
  </p>

  <h2 class="sub-title">1.1 Iniciar Atención en Cabina</h2>
  <div class="step-card">
    <div class="step-number">1</div>
    <div class="step-body">
      <h4>Recepción de la Notificación de Llegada</h4>
      <p>Cuando recepción realiza el check-in, la pantalla del médico muestra el aviso sonoro y visual: <em>\"Paciente en sala / Cabina lista\"</em>.</p>
    </div>
  </div>

  <div class="step-card">
    <div class="step-number">2</div>
    <div class="step-body">
      <h4>Pulsar \"Iniciar Atención\"</h4>
      <p>Al recibir al paciente en cabina, presione el botón verde. La cabina cambiará de color en el monitor general a <strong>AMARILLO (En Tratamiento)</strong>.</p>
    </div>
  </div>

  <h1 class="sec-title" style="margin-top: 18px;">2. Expediente Clínico Digital Integral</h1>
  <p>
    En estricto apego a la <strong>NOM-004-SSA3-2012</strong>, el expediente electrónico resguarda la historia médica completa del paciente:
  </p>

  <!-- MOCKUP EXPEDIENTE CLÍNICO -->
  <div class="mockup-container">
    <div class="mockup-header">
      <span class="mockup-dot dot-red"></span>
      <span class="mockup-dot dot-yellow"></span>
      <span class="mockup-dot dot-green"></span>
      <span class="mockup-title">ALFRA MedSuite • Expediente Clínico Digital #EXP-2026-0182</span>
    </div>
    <div class="mockup-content">
      <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 10px;">
        <div>
          <strong style="font-size: 11pt; color: #0f172a;">Valeria Montemayor Lozano</strong>
          <div style="font-size: 8pt; color: #64748b;">34 años • Femenino • Tel: (81) 1982-3456 • Ocupación: Arquitecta</div>
        </div>
        <div style="text-align: right;">
          <span class="badge badge-red" style="font-size: 8pt;">ALERGIAS: LIDOCAÍNA</span>
          <div style="font-size: 7.5pt; color: #64748b; margin-top: 2px;">Fototipo Fitzpatrick III • Piel Mixta</div>
        </div>
      </div>

      <div class="module-grid">
        <div style="background: #f8fafc; padding: 8px; border-radius: 6px; border: 1px solid #e2e8f0;">
          <strong style="font-size: 8pt; color: #0f766e;">Antecedentes Relevantes:</strong>
          <p style="font-size: 7.5pt; color: #475569; margin: 2px 0;">No padece hipertensión ni diabetes. Sin implantes metálicos. No gestante ni en lactancia. Sin coagulopatías activas.</p>
        </div>
        <div style="background: #f8fafc; padding: 8px; border-radius: 6px; border: 1px solid #e2e8f0;">
          <strong style="font-size: 8pt; color: #b45309;">Tratamientos Previos:</strong>
          <p style="font-size: 7.5pt; color: #475569; margin: 2px 0;">Toxina Botulínica hace 6 meses (tercio superior). Peeling salicílico hace 3 meses sin complicaciones.</p>
        </div>
      </div>
    </div>
  </div>

  <div class="callout callout-danger">
    <div class="callout-title">Alerta de Bioseguridad por Alergias</div>
    El sistema resalta en rojo parpadeante cualquier alergia reportada (anestésicos locales, látex, mariscos o metales) para evitar reacciones anafilácticas o adversas en cabina.
  </div>

  {render_footer(doc_title, "Página 2 de 5")}

  <div class="page-break"></div>

  <!-- PÁGINA 3: MAPEO Y DOSIFICACIÓN -->
  {render_header(logo, doc_title, "Capítulo 2 • Mapeo Facial, Sesiones y Dosificación")}

  <h1 class="sec-title">3. Mapeo Facial y Registro Clínico de Sesión</h1>
  <p>
    Para garantizar resultados estéticos armoniosos y trazabilidad farmacológica, cada procedimiento invasivo o aparatología requiere el registro preciso de zonas anatómicas y unidades dosificadas.
  </p>

  <h2 class="sub-title">3.1 Ficha de Infiltración y Trazabilidad COFEPRIS</h2>

  <!-- MOCKUP DOSIFICACIÓN -->
  <div class="mockup-container">
    <div class="mockup-header">
      <span class="mockup-dot dot-red"></span>
      <span class="mockup-dot dot-yellow"></span>
      <span class="mockup-dot dot-green"></span>
      <span class="mockup-title">ALFRA MedSuite • Hoja de Evolución y Aplicación Clínica</span>
    </div>
    <div class="mockup-content">
      <table class="data-table">
        <thead>
          <tr>
            <th>Zona Anatómica</th>
            <th>Fármaco / Tecnología</th>
            <th>Lote / Caducidad</th>
            <th>Dosis Aplicada</th>
            <th>Técnica</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Músculo Frontal</strong></td>
            <td>Botox® (OnabotulinumtoxinA 100U)</td>
            <td>Lote: C5820B1 (Cad: 11/2027)</td>
            <td><span class="badge badge-teal">12 Unidades</span></td>
            <td>Inyección intramuscular 30G</td>
          </tr>
          <tr>
            <td><strong>Glabela / Entrecejo</strong></td>
            <td>Botox® (Corrugador y Prócer)</td>
            <td>Lote: C5820B1 (Cad: 11/2027)</td>
            <td><span class="badge badge-teal">16 Unidades</span></td>
            <td>5 puntos de aplicación</td>
          </tr>
          <tr>
            <td><strong>Patas de Gallo</strong></td>
            <td>Botox® (Orbicular de los ojos)</td>
            <td>Lote: C5820B1 (Cad: 11/2027)</td>
            <td><span class="badge badge-teal">12 Unidades (6 c/lado)</span></td>
            <td>Pápula subdérmica</td>
          </tr>
          <tr>
            <td><strong>Surcos Nasogenianos</strong></td>
            <td>Juvéderm Volift® (Ácido Hialurónico)</td>
            <td>Lote: VB1940 (Cad: 08/2027)</td>
            <td><span class="badge badge-gold">1.0 ml con cánula 25G</span></td>
            <td>Retrotrazado lineal profundo</td>
          </tr>
        </tbody>
      </table>

      <div style="background: #f0fdfa; border: 1px solid #14b8a6; border-radius: 6px; padding: 10px; margin-top: 10px; font-size: 8pt; color: #0f766e;">
        <strong>Nota de Evolución Médica:</strong> Paciente tolera adecuadamente el procedimiento sin dolor ni sangrado. Se aplicó hielo local previo y posterior. Se descartan hematomas inmediatos. Plan: Cita de revisión y retoque en 15 días.
      </div>
    </div>
  </div>

  <h2 class="sub-title">3.2 Fotodocumentación Clínica Antes y Después</h2>
  <p>
    La aplicación permite capturar fotografías estandarizadas directamente desde la cámara del dispositivo móvil, archivándolas con sello de fecha y hora inmutables en la galería comparativa del paciente.
  </p>

  {render_footer(doc_title, "Página 3 de 5")}

  <div class="page-break"></div>

  <!-- PÁGINA 4: CONSENTIMIENTO CON FIRMA TÁCTIL -->
  {render_header(logo, doc_title, "Capítulo 3 • Consentimiento Informado con Firma Táctil")}

  <h1 class="sec-title">4. Consentimiento Informado Digital con Firma Táctil</h1>
  <p>
    El consentimiento informado es el requisito legal y ético indispensable antes de realizar cualquier intervención. En <strong>Clínica ALFRA</strong>, este proceso es 100% digital, eliminando el papel y garantizando validez jurídica mediante firma táctil manuscrita.
  </p>

  <h2 class="sub-title">4.1 Secuencia de Captura de Firma</h2>
  <div class="step-card">
    <div class="step-number">1</div>
    <div class="step-body">
      <h4>Selección del Formato de Consentimiento</h4>
      <p>El médico elige el procedimiento a realizar (ej: <em>\"Consentimiento de Aplicación de Toxina Botulínica\"</em> o <em>\"Consentimiento de Rellenos con Ácido Hialurónico\"</em>).</p>
    </div>
  </div>
  <div class="step-card">
    <div class="step-number">2</div>
    <div class="step-body">
      <h4>Lectura y Explicación al Paciente</h4>
      <p>Se le entrega la tablet al paciente para que lea los riesgos inherentes, cuidados posteriores esperados y resuelva cualquier duda con la doctora.</p>
    </div>
  </div>
  <div class="step-card">
    <div class="step-number">3</div>
    <div class="step-body">
      <h4>Firma Digital en Pantalla</h4>
      <p>El paciente estampa su firma manuscrita con el dedo o stylus táctil en el lienzo interactivo. El sistema registra fecha, hora y coordenadas IP.</p>
    </div>
  </div>

  <!-- MOCKUP CANVAS DE FIRMA DIGITAL -->
  <div class="mockup-container">
    <div class="mockup-header">
      <span class="mockup-dot dot-red"></span>
      <span class="mockup-dot dot-yellow"></span>
      <span class="mockup-dot dot-green"></span>
      <span class="mockup-title">ALFRA Signatures • Módulo de Consentimiento Digital y Rúbrica Táctil</span>
    </div>
    <div class="mockup-content" style="background: #ffffff; padding: 14px;">
      <div style="font-size: 8pt; color: #475569; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 10px;">
        <strong>Declaración del Paciente:</strong> Manifiesto que he sido informada con claridad sobre el procedimiento, sus posibles efectos temporales (enrojecimiento leve o pequeños hematomas) y las precauciones requeridas (no recostarse en 4 horas, no ejercicio intenso). Otorgo libremente mi consentimiento a Clínica ALFRA.
      </div>

      <div style="display: flex; gap: 16px; align-items: center; justify-content: center;">
        
        <!-- CANVAS MOCKUP -->
        <div style="border: 2px dashed #0d9488; background: #fdfbf7; border-radius: 8px; width: 340px; height: 110px; display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative;">
          <svg width="220" height="70" viewBox="0 0 220 70">
            <path d="M 20 45 Q 50 10, 80 40 T 130 30 T 170 48 T 200 25" fill="none" stroke="#0f172a" stroke-width="2.5" stroke-linecap="round" />
            <path d="M 60 55 L 150 55" fill="none" stroke="#0f172a" stroke-width="1.5" />
          </svg>
          <div style="position: absolute; bottom: 6px; font-size: 7pt; color: #94a3b8;">
            Firma Táctil de Valeria Montemayor • Sellado: 03/11/2026 11:12:45 UTC-6
          </div>
        </div>

        <div>
          <button class="btn-mockup btn-mockup-outline" style="display: block; margin-bottom: 6px; width: 120px;">Borrar / Repetir</button>
          <button class="btn-mockup btn-mockup-primary" style="display: block; width: 120px;">✓ Validar Firma</button>
        </div>

      </div>
    </div>
  </div>

  {render_footer(doc_title, "Página 4 de 5")}

  <div class="page-break"></div>

  <!-- PÁGINA 5: PRESCRIPCIÓN Y RENDIMIENTO -->
  {render_header(logo, doc_title, "Capítulo 4 • Prescripción de Cuidados y Reporte de Rendimiento")}

  <h1 class="sec-title">5. Prescripción de Rutina y Cuidados en Casa</h1>
  <p>
    El éxito de los tratamientos médico-estéticos depende en gran medida de los cuidados domiciliarios posteriores. Desde su perfil, el médico puede estructurar la rutina que el paciente consultará inmediatamente en su app móvil:
  </p>

  <div class="module-grid">
    <div class="module-card">
      <h4>☀️ Rutina Matutina (AM)</h4>
      <p>1. Limpiador facial suave con pH 5.5.<br>2. Serum antioxidante de Vitamina C al 15%.<br>3. Protector solar dermatológico FPS 50+ cada 4 horas.</p>
    </div>
    <div class="module-card">
      <h4>🌙 Rutina Nocturna (PM)</h4>
      <p>1. Doble limpieza con agua micelar.<br>2. Crema reparadora con Ácido Hialurónico y Ceramidas.<br>3. Evitar retinoides o exfoliantes por 72 horas.</p>
    </div>
  </div>

  <h1 class="sec-title" style="margin-top: 18px;">6. Consulta de Honorarios y Comisiones Médicas</h1>
  <p>
    Cada médico o especialista tiene acceso privado y en tiempo real al resumen de sus procedimientos realizados y comisiones acumuladas durante la quincena en curso:
  </p>

  <table class="data-table">
    <thead>
      <tr>
        <th>Fecha</th>
        <th>Paciente</th>
        <th>Tratamiento Realizado</th>
        <th>Monto del Servicio</th>
        <th>Comisión Devengada</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>03/11/2026</td>
        <td>Valeria Montemayor</td>
        <td>Bótox Tercio Superior (40U)</td>
        <td>$3,200.00 MXN</td>
        <td><strong style="color: #0f766e;">$800.00 MXN (25%)</strong></td>
      </tr>
      <tr>
        <td>03/11/2026</td>
        <td>Carla Villarreal</td>
        <td>Relleno de Labios Juvederm</td>
        <td>$4,500.00 MXN</td>
        <td><strong style="color: #0f766e;">$1,125.00 MXN (25%)</strong></td>
      </tr>
      <tr>
        <td>02/11/2026</td>
        <td>Mauricio Sada</td>
        <td>HIFU 7D Cuello y Papada</td>
        <td>$2,800.00 MXN</td>
        <td><strong style="color: #0f766e;">$700.00 MXN (25%)</strong></td>
      </tr>
    </tbody>
    <tfoot>
      <tr style="background: #f1f5f9; font-weight: 700;">
        <td colspan="4">TOTAL HONORARIOS Y COMISIONES ACUMULADAS</td>
        <td style="color: #0f766e; font-size: 9.5pt;">$2,625.00 MXN</td>
      </tr>
    </tfoot>
  </table>

  {render_footer(doc_title, "Página 5 de 5")}

</body>
</html>
"""
    return html

if __name__ == "__main__":
    html_content = build_manual_03()
    out_pdf = os.path.join(os.path.dirname(__file__), "..", "manuales", "Manual_03_Especialista_y_Doctor.pdf")
    print("Compilando Manual 03 - Especialista y Doctor...")
    render_html_to_pdf(html_content, out_pdf)