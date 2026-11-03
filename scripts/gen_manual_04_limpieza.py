# -*- coding: utf-8 -*-
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pdf_engine import render_html_to_pdf
from manual_data_common import load_logo, get_common_css, render_cover, render_header, render_footer

def build_manual_04():
    logo = load_logo()
    doc_title = "Manual de Limpieza, Bioseguridad e Intendencia"
    
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
    "LIMPIEZA E INTENDENCIA",
    "Protocolos de Bioseguridad, Semáforo de Cabinas en Tiempo Real, Sanitización de Grado Hospitalario y Checador",
    "Guía técnica y operativa para el personal de Limpieza, Bioseguridad e Intendencia de Clínica ALFRA. Describe el flujo del semáforo digital de cabinas, la esterilización entre citas, la reposición de consumibles clínicos y el control de asistencia.",
    "Personal de Intendencia, Auxiliares de Sanitización y Coordinación de Servicios Generales"
  )}

  <!-- PÁGINA 2: BIOSEGURIDAD Y ACCESO -->
  {render_header(logo, doc_title, "Capítulo 1 • Bioseguridad y Acceso al Módulo Móvil")}

  <h1 class="sec-title">1. La Bioseguridad en Clínica ALFRA</h1>
  <p>
    En una institución de medicina estética y spa de alta gama como <strong>Clínica ALFRA</strong>, la bioseguridad, la asepsia y la pulcritud absoluta son pilares fundamentales para proteger la salud de nuestros pacientes y salvaguardar la reputación clínica.
  </p>

  <div class="callout callout-info">
    <div class="callout-title">Estándar de Calidad Sanitaria</div>
    Cada cabina debe considerarse un área estéril controlada. La desinfección adecuada entre cada cita previene infecciones cruzadas y garantiza una atmósfera impecable de lujo y confort.
  </div>

  <h2 class="sub-title">1.1 Acceso al Módulo Móvil de Intendencia</h2>
  <p>
    El personal de limpieza cuenta con un teléfono institucional o tablet móvil con acceso directo a la aplicación ALFRA. La interfaz está diseñada con botones de gran tamaño y contrastes de color intuitivos para facilitar su operación rápida:
  </p>

  <!-- MOCKUP MÓVIL LIMPIEZA -->
  <div class="mockup-container">
    <div class="mockup-header">
      <span class="mockup-dot dot-red"></span>
      <span class="mockup-dot dot-yellow"></span>
      <span class="mockup-dot dot-green"></span>
      <span class="mockup-title">ALFRA CleanTrack • Vista Rápida de Cabinas</span>
    </div>
    <div class="mockup-content" style="background: #0f172a; color: #fff; padding: 16px;">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #334155; padding-bottom: 8px; margin-bottom: 12px;">
        <div style="font-weight: 700; font-size: 10pt; color: #f1f5f9;">Panel de Cabinas • Turno Matutino</div>
        <span class="badge badge-teal">Turno Activo: Carlos D.</span>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
        
        <!-- CABINA EN ROJO -->
        <div style="background: #1e293b; border: 2px solid #ef4444; border-radius: 8px; padding: 10px; text-align: center;">
          <div style="width: 14px; height: 14px; border-radius: 50%; background: #ef4444; margin: 0 auto 4px auto; box-shadow: 0 0 8px #ef4444;"></div>
          <strong style="color: #fca5a5; font-size: 9.5pt;">Cabina 3 • Facial</strong>
          <p style="font-size: 7.5pt; color: #cbd5e1; margin: 2px 0;">Paciente concluyó sesión</p>
          <span class="badge badge-red" style="margin: 4px 0;">🔴 REQUIERE LIMPIEZA</span><br>
          <button class="btn-mockup btn-mockup-primary" style="margin-top: 6px; width: 100%; font-size: 8pt;">✓ Iniciar Sanitización</button>
        </div>

        <!-- CABINA EN VERDE -->
        <div style="background: #1e293b; border: 1px solid #14b8a6; border-radius: 8px; padding: 10px; text-align: center;">
          <div style="width: 14px; height: 14px; border-radius: 50%; background: #22c55e; margin: 0 auto 4px auto; box-shadow: 0 0 8px #22c55e;"></div>
          <strong style="color: #99f6e4; font-size: 9.5pt;">Cabina 1 • VIP Médica</strong>
          <p style="font-size: 7.5pt; color: #cbd5e1; margin: 2px 0;">Sanitizada a las 11:15</p>
          <span class="badge badge-green" style="margin: 4px 0;">🟢 LISTA Y DISPONIBLE</span><br>
          <button class="btn-mockup btn-mockup-outline" style="margin-top: 6px; width: 100%; font-size: 8pt; color: #94a3b8; border-color: #475569;" disabled>Cabina Desocupada</button>
        </div>

      </div>
    </div>
  </div>

  {render_footer(doc_title, "Página 2 de 4")}

  <div class="page-break"></div>

  <!-- PÁGINA 3: PROTOCOLO DE DESINFECCIÓN -->
  {render_header(logo, doc_title, "Capítulo 2 • Protocolo de Desinfección y Sanitización")}

  <h1 class="sec-title">2. Protocolo Oficial de Desinfección Paso a Paso</h1>
  <p>
    Tan pronto como el médico y el paciente abandonan la cabina, el personal de intendencia debe seguir la lista de verificación (checklist) estandarizada:
  </p>

  <div class="step-card">
    <div class="step-number">1</div>
    <div class="step-body">
      <h4>Retiro de Insumos Desechables y RPBI</h4>
      <p>Retire la sábana descartable de la camilla, guantes, campos quirúrgicos y apósitos. Deposítelos en el contenedor de basura adecuado (bolsa roja si contiene sangre conforme a la NOM-087-SEMARNAT-SSA1-2002).</p>
    </div>
  </div>

  <div class="step-card">
    <div class="step-number">2</div>
    <div class="step-body">
      <h4>Desinfección de Superficies de Contacto</h4>
      <p>Rocíe y frote la camilla, banco del médico, charola de instrumentos y superficies con solución desinfectante de sales cuaternarias de amonio de 5ª generación. Deje actuar durante 2 minutos.</p>
    </div>
  </div>

  <div class="step-card">
    <div class="step-number">3</div>
    <div class="step-body">
      <h4>Aparatología Médica y Cabezales</h4>
      <p>Limpie con paño de microfibra humedecido en alcohol isopropílico al 70% los manípulos de ultrasonido, radiofrecuencia o láser, asegurando no mojar puertos eléctricos.</p>
    </div>
  </div>

  <div class="step-card">
    <div class="step-number">4</div>
    <div class="step-body">
      <h4>Colocación del Nuevo Kit de Lujo ALFRA</h4>
      <p>Tienda una sábana descartable nueva y sin arrugas, coloque una toalla limpia bordada ALFRA en la cabecera y verifique la existencia de cofias y gasas limpias.</p>
    </div>
  </div>

  <div class="step-card">
    <div class="step-number">5</div>
    <div class="step-body">
      <h4>Aromatización y Clima</h4>
      <p>Rocíe la esencia de spa institucional (toque de lavanda y té blanco) y verifique que la temperatura ambiental se encuentre en 21°C a 23°C.</p>
    </div>
  </div>

  <div class="callout callout-warning">
    <div class="callout-title">Precaución con Aparatología Láser</div>
    Nunca rocíe líquidos directamente sobre las pantallas táctiles o sensores ópticos de los equipos láser. Siempre humedezca el paño antes de limpiar.
  </div>

  {render_footer(doc_title, "Página 3 de 4")}

  <div class="page-break"></div>

  <!-- PÁGINA 4: LIBERACIÓN DE CABINA Y CHECADOR -->
  {render_header(logo, doc_title, "Capítulo 3 • Liberación de Cabina y Checador de Asistencia")}

  <h1 class="sec-title">3. Liberación de Cabina con 1 Clic</h1>
  <p>
    Una vez concluida la sanitización y colocado el kit nuevo, el colaborador debe pulsar en su pantalla el botón: <strong>\"Liberar Cabina / Cabina Lista\"</strong>.
  </p>

  <div class="callout callout-info">
    <div class="callout-title">Sincronización Instantánea con Recepción y Doctores</div>
    Al pulsar el botón, el semáforo cambia a <strong>VERDE</strong> de forma inmediata en las pantallas de Recepción y de la Dirección Médica. Con esto, recepción sabe que ya puede ingresar al siguiente paciente sin demoras.
  </div>

  <h1 class="sec-title" style="margin-top: 22px;">4. Checador de Asistencia y Turnos Laborales</h1>
  <p>
    La aplicación incluye el registro digital de jornada laboral para el personal operativo de Clínica ALFRA:
  </p>

  <div class="mockup-container">
    <div class="mockup-header">
      <span class="mockup-dot dot-red"></span>
      <span class="mockup-dot dot-yellow"></span>
      <span class="mockup-dot dot-green"></span>
      <span class="mockup-title">ALFRA Attendance • Checador Digital de Turno</span>
    </div>
    <div class="mockup-content" style="text-align: center; padding: 18px;">
      <div style="font-size: 9pt; color: #64748b; margin-bottom: 4px;">Martes 3 de Noviembre de 2026</div>
      <div style="font-size: 20pt; font-weight: 800; color: #0f172a; font-family: monospace; margin-bottom: 10px;">08:58:32 AM</div>

      <div style="max-width: 280px; margin: 0 auto; display: flex; gap: 10px; justify-content: center;">
        <button class="btn-mockup btn-mockup-primary" style="padding: 10px 18px; font-size: 9pt;">⏰ Entrada Registrada (08:58)</button>
        <button class="btn-mockup btn-mockup-outline" style="padding: 10px 18px; font-size: 9pt;">Salida de Turno</button>
      </div>

      <div style="font-size: 7.5pt; color: #94a3b8; margin-top: 8px;">
        Ubicación: Sucursal Principal ALFRA • GPS Verificado
      </div>
    </div>
  </div>

  <h2 class="sub-title">4.1 Registro de Incidencias</h2>
  <p>
    Si una cabina requiere mantenimiento mayor (fuga de aire acondicionado, falla de luz o necesidad de pintura), el colaborador puede activar el botón <strong>\"Reportar Falla Técnica\"</strong> para que Mantenimiento atienda el reporte de inmediato.
  </p>

  {render_footer(doc_title, "Página 4 de 4")}

</body>
</html>
"""
    return html

if __name__ == "__main__":
    html_content = build_manual_04()
    out_pdf = os.path.join(os.path.dirname(__file__), "..", "manuales", "Manual_04_Limpieza_e_Intendencia.pdf")
    print("Compilando Manual 04 - Limpieza e Intendencia...")
    render_html_to_pdf(html_content, out_pdf)