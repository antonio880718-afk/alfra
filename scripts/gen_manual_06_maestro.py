# -*- coding: utf-8 -*-
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pdf_engine import render_html_to_pdf
from manual_data_common import load_logo, get_common_css, render_cover, render_header, render_footer

def build_manual_maestro():
    logo = load_logo()
    doc_title = "Manual Maestro Institucional"
    
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

  <!-- PORTADA DE LUJO MAESTRA -->
  {render_cover(
    logo,
    "MANUAL MAESTRO INSTITUCIONAL",
    "Compendio General de Procedimientos, Arquitectura del Sistema, Roles y Permisos, Seguridad NOM-004 y Flujos Operativos",
    "Este compendio institucional integra la totalidad de las guías de operación para todos los perfiles que conforman Clínica ALFRA: Dirección General, Recepción y Cajas, Médicos Especialistas, Intendencia y Pacientes VIP. Documento normativo oficial versión 1.5.0.",
    "Todo el Personal Clínico, Administrativo y Operativo de Clínica ALFRA"
  )}

  <!-- PÁGINA 2: ÍNDICE Y ARQUITECTURA -->
  {render_header(logo, doc_title, "Capítulo 1 • Arquitectura del Sistema y Matriz de Roles")}

  <h1 class="sec-title">1. Arquitectura de la Plataforma Digital ALFRA</h1>
  <p>
    El ecosistema digital de <strong>Clínica ALFRA</strong> (versión 1.5.0, Compilación 103) está desarrollado sobre una arquitectura en la nube de alta disponibilidad, integrando microservicios de Firebase (Firestore, Authentication, Cloud Storage y Hosting) sincronizados en tiempo real con la aplicación nativa Android (AAB) y la Web App progresiva.
  </p>

  <h2 class="sub-title">1.1 Matriz de Roles, Permisos y Accesos</h2>
  <table class="data-table">
    <thead>
      <tr>
        <th>Perfil / Rol</th>
        <th>Dispositivo Principal</th>
        <th>Módulos Clave Habilitados</th>
        <th>Nivel de Acceso</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Administrador</strong></td>
        <td>Web Desktop / Tablet</td>
        <td>Dashboard KPIs, Finanzas, Nómina, Reseteo Alfra2026!, Auditoría</td>
        <td><span class="badge badge-rose">Total / Nivel 1</span></td>
      </tr>
      <tr>
        <td><strong>Recepción y Caja</strong></td>
        <td>Web Desktop / TPV</td>
        <td>Check-In, Caja Diaria, Cobros Mixtos, Recibos, Cumpleaños VIP</td>
        <td><span class="badge badge-teal">Operativo / Nivel 2</span></td>
      </tr>
      <tr>
        <td><strong>Médico / Especialista</strong></td>
        <td>Tablet en Cabina</td>
        <td>Agenda Médica, Expediente NOM-004, Mapeo Facial, Firma Táctil</td>
        <td><span class="badge badge-blue">Clínico / Nivel 2</span></td>
      </tr>
      <tr>
        <td><strong>Limpieza / Intendencia</strong></td>
        <td>Smartphone Móvil</td>
        <td>Semáforo de Cabinas, Checklist Sanitización, Checador Horario</td>
        <td><span class="badge badge-slate">Servicios / Nivel 3</span></td>
      </tr>
      <tr>
        <td><strong>Paciente VIP</strong></td>
        <td>App Android / Móvil</td>
        <td>Citas en Línea, Mi Rutina en Casa, Monedero, Tarjeta Bday</td>
        <td><span class="badge badge-gold">Usuario Final</span></td>
      </tr>
    </tbody>
  </table>

  <h2 class="sub-title">1.2 Protocolo de Seguridad y Restablecimiento de Credenciales</h2>
  <p>
    Ante el olvido o renovación de credenciales de cualquier colaborador, la Dirección cuenta con la función centralizada de <strong>Restablecimiento de Contraseña</strong>:
  </p>
  <ul>
    <li>El Administrador asigna en un clic la contraseña genérica de transición: <strong style="font-family: monospace; color: #b45309; background: #fef3c7; padding: 2px 6px; border-radius: 4px;">Alfra2026!</strong>.</li>
    <li>El sistema marca la cuenta con <code style="color: #0f766e;">requiereCambioContrasena = true</code>.</li>
    <li>Al iniciar sesión por primera vez con dicha clave, la aplicación <strong>bloquea el acceso</strong> y despliega obligatoriamente la pantalla para capturar su clave definitiva.</li>
  </ul>

  {render_footer(doc_title, "Página 2 de 7")}

  <div class="page-break"></div>

  <!-- PÁGINA 3: FLUJO INTEGRAL DEL PACIENTE -->
  {render_header(logo, doc_title, "Capítulo 2 • Flujo Integral del Paciente en Clínica")}

  <h1 class="sec-title">2. Diagrama de Flujo Integral del Paciente</h1>
  <p>
    La plataforma ALFRA coordina a todos los departamentos para que la experiencia del paciente sea sincrónica y libre de fricciones desde que ingresa a la clínica hasta su seguimiento post-consulta:
  </p>

  <div class="step-card">
    <div class="step-number">1</div>
    <div class="step-body">
      <h4>Paso 1: Arribo y Check-In en Recepción</h4>
      <p>Recepción recibe al paciente, confirma su cita en el sistema y verifica que la cabina médica esté en verde (sanitizada).</p>
    </div>
  </div>

  <div class="step-card">
    <div class="step-number">2</div>
    <div class="step-body">
      <h4>Paso 2: Notificación al Médico y Entrada a Cabina</h4>
      <p>El médico recibe la notificación en su tablet y pulsa \"Iniciar Atención\". La cabina cambia a amarillo (en atención).</p>
    </div>
  </div>

  <div class="step-card">
    <div class="step-number">3</div>
    <div class="step-body">
      <h4>Paso 3: Consentimiento Digital con Firma Táctil</h4>
      <p>El paciente revisa el consentimiento informado y estampa su firma manuscrita en la pantalla táctil conforme a la NOM-004.</p>
    </div>
  </div>

  <div class="step-card">
    <div class="step-number">4</div>
    <div class="step-body">
      <h4>Paso 4: Realización del Tratamiento y Registro Clínico</h4>
      <p>La doctora inyecta o realiza el procedimiento, anotando lotes, dosis y prescripción de cuidados en casa.</p>
    </div>
  </div>

  <div class="step-card">
    <div class="step-number">5</div>
    <div class="step-body">
      <h4>Paso 5: Alerta de Sanitización a Intendencia</h4>
      <p>Al salir el paciente, la cabina pasa a rojo. Intendencia desinfecta y pulsa \"Cabina Lista\" para retornarla a verde.</p>
    </div>
  </div>

  <div class="step-card">
    <div class="step-number">6</div>
    <div class="step-body">
      <h4>Paso 6: Liquidación en Caja y Recibo Digital</h4>
      <p>Recepción efectúa el cobro multimétodo, emite el recibo oficial con QR y envía la tarjeta de cumpleaños si aplica.</p>
    </div>
  </div>

  <div class="step-card">
    <div class="step-number">7</div>
    <div class="step-body">
      <h4>Paso 7: Alertas Post-Consulta 24h / 48h / 7d</h4>
      <p>El sistema programa recordatorios automáticos para que Recepción llame o escriba a la paciente evaluando su satisfacción.</p>
    </div>
  </div>

  {render_footer(doc_title, "Página 3 de 7")}

  <div class="page-break"></div>

  <!-- PÁGINA 4: COMPILADO ADMINISTRACIÓN Y FINANZAS -->
  {render_header(logo, doc_title, "Capítulo 3 • Supervisión Administrativa y Financiera")}

  <h1 class="sec-title">3. Panel Administrativo y Conciliación Global</h1>
  <p>
    La Dirección General audita en tiempo real las operaciones de sucursales, finanzas y comisiones de la plantilla médica:
  </p>

  <div class="module-grid">
    <div class="module-card">
      <h4>📊 Consolidado de Ingresos</h4>
      <p>Monitoreo diario de ventas brutas, descuentos aplicados, comisiones deducidas e ingreso neto por periodo.</p>
    </div>
    <div class="module-card">
      <h4>🏥 Auditoría de Expedientes</h4>
      <p>Verificación muestral de notas médicas, firmas de consentimientos informados y fotos clínicas de evolución.</p>
    </div>
    <div class="module-card">
      <h4>👥 Plantilla y Nómina</h4>
      <p>Gestión de altas, bajas, comisiones por procedimiento y restablecimiento de claves con guard <strong>Alfra2026!</strong>.</p>
    </div>
    <div class="module-card">
      <h4>🎁 Concierge y Tarjetas VIP</h4>
      <p>Diseño de tarjetas de cumpleaños personalizadas con descarga de imagen PNG y botón de WhatsApp integrado.</p>
    </div>
  </div>

  <!-- MOCKUP TARJETA CUMPLEAÑOS -->
  <div class="mockup-container">
    <div class="mockup-header">
      <span class="mockup-dot dot-red"></span>
      <span class="mockup-dot dot-yellow"></span>
      <span class="mockup-dot dot-green"></span>
      <span class="mockup-title">ALFRA Loyalty System • Diseñador Oficial de Tarjetas VIP de Cumpleaños</span>
    </div>
    <div class="mockup-content" style="text-align: center; background: #fdfbf7; padding: 14px;">
      <div style="display: inline-block; border: 2px solid #d4af37; border-radius: 10px; padding: 12px 20px; background: #fff; max-width: 320px;">
        <img src="{logo}" style="height: 38px; margin-bottom: 4px;" alt="ALFRA" /><br>
        <strong style="color: #d4af37; font-size: 7.5pt; text-transform: uppercase; letter-spacing: 1.5px;">Membresía Exclusiva ALFRA</strong>
        <div style="font-family: 'Playfair Display', serif; font-size: 13pt; color: #0f172a; margin: 3px 0;">¡Feliz Cumpleaños!</div>
        <div style="font-size: 10.5pt; font-weight: 700; color: #c59b27;">Valeria Montemayor</div>
        <div style="background: #f0fdfa; border: 1px dashed #14b8a6; border-radius: 6px; padding: 6px; margin: 6px 0; font-size: 8.5pt; color: #0f766e; font-weight: 700;">
          Facial Hidratante Profundo de Cortesía
        </div>
        <div style="font-size: 6.5pt; color: #94a3b8;">Descarga en PNG / Envío Directo por WhatsApp</div>
      </div>
    </div>
  </div>

  {render_footer(doc_title, "Página 4 de 7")}

  <div class="page-break"></div>

  <!-- PÁGINA 5: COMPILADO RECEPCIÓN Y MÉDICO -->
  {render_header(logo, doc_title, "Capítulo 4 • Front Desk y Procedimientos Médicos")}

  <h1 class="sec-title">4. Estándares para Recepción y Personal Médico</h1>
  
  <h2 class="sub-title">4.1 Recepción y Caja</h2>
  <ul>
    <li><strong>Apertura de Caja:</strong> Conteo del fondo inicial de cambio ($1,500 MXN o según política de sucursal).</li>
    <li><strong>Cobro Multimétodo:</strong> Registro exacto en caso de pago mixto (parte en efectivo y parte con terminal TPV o SPEI).</li>
    <li><strong>Emisión de Recibo:</strong> Entrega física o digital del comprobante oficial con sello de autenticidad.</li>
    <li><strong>Próximos Cumpleaños:</strong> Revisión diaria de cumpleañeros con fecha exacta calculada sin desfases horarios.</li>
  </ul>

  <h2 class="sub-title">4.2 Médicos Especialistas</h2>
  <ul>
    <li><strong>Historia Médica Completa:</strong> Verificación rigurosa de alergias a anestésicos (Lidocaína) y contraindicaciones absolutas.</li>
    <li><strong>Consentimiento Táctil Obligatorio:</strong> Todo procedimiento requiere la rúbrica táctil del paciente antes de la infiltración.</li>
    <li><strong>Trazabilidad de Inyectables:</strong> Anotación del número de lote y fecha de expiración del producto aplicado.</li>
    <li><strong>Cuidados Posteriores:</strong> Carga de la rutina de cuidado en casa para consulta del paciente en su app.</li>
  </ul>

  <!-- MOCKUP CANVAS FIRMA -->
  <div class="mockup-container">
    <div class="mockup-header">
      <span class="mockup-dot dot-red"></span>
      <span class="mockup-dot dot-yellow"></span>
      <span class="mockup-dot dot-green"></span>
      <span class="mockup-title">ALFRA Clinical • Consentimiento Informado Digital con Firma Táctil</span>
    </div>
    <div class="mockup-content" style="padding: 10px; text-align: center;">
      <div style="border: 2px dashed #0d9488; background: #fffdf9; border-radius: 8px; width: 320px; height: 80px; margin: 0 auto; display: flex; align-items: center; justify-content: center;">
        <span style="font-family: cursive; font-size: 18pt; color: #0f172a;">Valeria Montemayor L.</span>
      </div>
      <div style="font-size: 7.5pt; color: #64748b; margin-top: 4px;">Rúbrica Biométrica Digital Registrada • Validez Legal NOM-004-SSA3-2012</div>
    </div>
  </div>

  {render_footer(doc_title, "Página 5 de 7")}

  <div class="page-break"></div>

  <!-- PÁGINA 6: LIMPIEZA Y PACIENTE -->
  {render_header(logo, doc_title, "Capítulo 5 • Intendencia y Portal del Paciente")}

  <h1 class="sec-title">5. Intendencia y Portal del Paciente</h1>

  <h2 class="sub-title">5.1 Semáforo de Cabinas en Intendencia</h2>
  <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 10px 0;">
    <div style="background: #f0fdf4; border: 1px solid #22c55e; border-radius: 6px; padding: 10px; text-align: center;">
      <strong style="color: #166534; font-size: 9.5pt;">🟢 VERDE</strong>
      <div style="font-size: 8pt; color: #15803d; font-weight: 700;">Cabina Lista</div>
      <p style="font-size: 7.5pt; color: #4b5563; margin-top: 4px;">Sanitizada, con kit nuevo y disponible para recibir al paciente.</p>
    </div>
    <div style="background: #fefce8; border: 1px solid #eab308; border-radius: 6px; padding: 10px; text-align: center;">
      <strong style="color: #854d0e; font-size: 9.5pt;">🟡 AMARILLO</strong>
      <div style="font-size: 8pt; color: #a16207; font-weight: 700;">En Tratamiento</div>
      <p style="font-size: 7.5pt; color: #4b5563; margin-top: 4px;">Médico en procedimiento con paciente. No interrumpir.</p>
    </div>
    <div style="background: #fef2f2; border: 1px solid #ef4444; border-radius: 6px; padding: 10px; text-align: center;">
      <strong style="color: #991b1b; font-size: 9.5pt;">🔴 ROJO</strong>
      <div style="font-size: 8pt; color: #b91c1c; font-weight: 700;">Requiere Higiene</div>
      <p style="font-size: 7.5pt; color: #4b5563; margin-top: 4px;">Paciente concluyó. Personal de limpieza procede de inmediato.</p>
    </div>
  </div>

  <h2 class="sub-title">5.2 Portal del Paciente y Fidelización</h2>
  <p>
    Los pacientes disfrutan de acceso autónomo a la plataforma mediante su smartphone:
  </p>
  <ul>
    <li><strong>Agendado 24/7:</strong> Reserva de citas en segundos con su especialista de preferencia.</li>
    <li><strong>Mi Rutina en Casa:</strong> Consulta de indicaciones dermatológicas AM y PM.</li>
    <li><strong>Monedero y Recompensas:</strong> Acumulación de puntos ALFRA y recepción de su Tarjeta VIP de Cumpleaños.</li>
    <li><strong>Recibos Digitales:</strong> Comprobantes de pago con sello fiscal siempre disponibles.</li>
  </ul>

  {render_footer(doc_title, "Página 6 de 7")}

  <div class="page-break"></div>

  <!-- PÁGINA 7: CONTINGENCIAS Y SOPORTE -->
  {render_header(logo, doc_title, "Capítulo 6 • Políticas de Seguridad y Soporte Institucional")}

  <h1 class="sec-title">6. Protocolos de Contingencia y Soporte Técnico</h1>

  <h2 class="sub-title">6.1 Contingencia por Falla de Energía o Conectividad</h2>
  <table class="data-table">
    <thead>
      <tr>
        <th>Incidencia Técnica</th>
        <th>Protocolo de Acción</th>
        <th>Responsable Inmediato</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Corte temporal de internet</strong></td>
        <td>Activar punto de acceso móvil institucional (Hotspot 5G) en la caja y cabinas principales.</td>
        <td>Recepción y Sistemas</td>
      </tr>
      <tr>
        <td><strong>Falla en terminal bancaria TPV</strong></td>
        <td>Ofrecer al paciente cobro vía transferencia SPEI o enlace de pago digital seguro.</td>
        <td>Cajera en turno</td>
      </tr>
      <tr>
        <td><strong>Colaborador bloqueado por clave</strong></td>
        <td>El Administrador restablece la contraseña asignando Alfra2026! con cambio forzado en primer login.</td>
        <td>Administrador General</td>
      </tr>
    </tbody>
  </table>

  <h2 class="sub-title">6.2 Directorio de Asistencia y Soporte ALFRA</h2>
  <div class="module-grid">
    <div class="module-card">
      <h4>Directorio de Soporte Técnico</h4>
      <p>
        <strong>Mesa de Ayuda TI:</strong> soporte@clinica-alfra.mx<br>
        <strong>WhatsApp de Emergencia / Citas:</strong> 753 538 6018<br><strong>Dirección:</strong> Calle Río Fuerte #26, Col. Lomas de Bellavista, Lázaro Cárdenas, Michoacán<br>
        <strong>Horario:</strong> Lunes a Sábado de 08:00 a 20:00 hrs.
      </p>
    </div>
    <div class="module-card">
      <h4>Dirección Médica y Calidad</h4>
      <p>
        <strong>Supervisión Sanitaria:</strong> direccion.medica@clinica-alfra.mx<br>
        <strong>Cumplimiento Normativo:</strong> NOM-004-SSA3-2012<br>
        <strong>Protección de Datos:</strong> LFPDPPP / INAI
      </p>
    </div>
  </div>

  <div style="text-align: center; margin-top: 25px; padding: 18px; background: #0f172a; color: #fff; border-radius: 8px;">
    <img src="{logo}" style="height: 48px; margin-bottom: 6px;" alt="ALFRA" /><br>
    <strong style="color: #d4af37; font-size: 12pt;">CLÍNICA ALFRA • MEDICINA ESTÉTICA & SPA INTEGRAL</strong><br>
    <span style="color: #94a3b8; font-size: 8.5pt;">Manual Maestro Institucional v1.5.0 • Documento Oficial Reservado</span>
  </div>

  {render_footer(doc_title, "Página 7 de 7")}

</body>
</html>
"""
    return html

if __name__ == "__main__":
    html_content = build_manual_maestro()
    out_pdf = os.path.join(os.path.dirname(__file__), "..", "manuales", "Manual_Maestro_Clinica_ALFRA.pdf")
    print("Compilando Manual Maestro Institucional...")
    render_html_to_pdf(html_content, out_pdf)