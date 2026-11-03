# -*- coding: utf-8 -*-
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pdf_engine import render_html_to_pdf
from manual_data_common import load_logo, get_common_css, render_cover, render_header, render_footer

def build_manual_02():
    logo = load_logo()
    doc_title = "Manual de Recepción, Front Desk y Caja"
    
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
    "RECEPCIÓN Y CAJA",
    "Gestión de Front Desk, Check-In en Cabinas, Caja Diaria, Cobros Multimétodo, Recibos Digitales y Fidelización",
    "Guía operativa estándar para el personal de Recepción y Cajas de Clínica ALFRA. Incluye los protocolos de bienvenida al paciente, asignación ágil de cabinas, flujo de cobro con pagos combinados, emisión de recibos oficiales y seguimiento post-consulta.",
    "Recepcionistas, Cajeras, Hostess y Asistentes de Front Desk"
  )}

  <!-- PÁGINA 2: FRONT DESK Y CHECK-IN -->
  {render_header(logo, doc_title, "Capítulo 1 • Bienvenida al Paciente y Check-In")}

  <h1 class="sec-title">1. Recepción del Paciente y Check-In en Cabina</h1>
  <p>
    El personal de recepción representa la primera impresión de excelencia y calidez en <strong>Clínica ALFRA</strong>. Al llegar el paciente a la sucursal, el proceso de check-in debe realizarse de forma fluida y protocolizada.
  </p>

  <h2 class="sub-title">1.1 Secuencia de Check-In Digital</h2>

  <div class="step-card">
    <div class="step-number">1</div>
    <div class="step-body">
      <h4>Identificación y Saludo VIP</h4>
      <p>Salude al paciente con amabilidad y calidez: <em>\"Bienvenida a Clínica ALFRA, ¿cuál es su nombre?\"</em>. Ubique su cita en el calendario diario.</p>
    </div>
  </div>

  <div class="step-card">
    <div class="step-number">2</div>
    <div class="step-body">
      <h4>Validación de Estatus de Cabina</h4>
      <p>Verifique que la cabina asignada se encuentre en color <strong style="color: #166534;">VERDE (Sanitizada y Lista)</strong> en el semáforo de intendencia.</p>
    </div>
  </div>

  <div class="step-card">
    <div class="step-number">3</div>
    <div class="step-body">
      <h4>Pulsar \"Llegó el Paciente / Pasar a Cabina\"</h4>
      <p>El sistema notifica automáticamente a la tablet de la doctora o especialista que el paciente ha arribado y está listo en su cabina.</p>
    </div>
  </div>

  <!-- MOCKUP AGENDA Y CHECK-IN -->
  <div class="mockup-container">
    <div class="mockup-header">
      <span class="mockup-dot dot-red"></span>
      <span class="mockup-dot dot-yellow"></span>
      <span class="mockup-dot dot-green"></span>
      <span class="mockup-title">ALFRA FrontDesk • Agenda Diaria y Estado de Pacientes</span>
    </div>
    <div class="mockup-content">
      <table class="data-table">
        <thead>
          <tr>
            <th>Hora</th>
            <th>Paciente</th>
            <th>Tratamiento</th>
            <th>Especialista</th>
            <th>Cabina</th>
            <th>Acción Front Desk</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>10:00</strong></td>
            <td>Valeria Montemayor</td>
            <td>Bótox Tercio Superior</td>
            <td>Dra. Claudia Méndez</td>
            <td><span class="badge badge-teal">Cabina 1 (Lista)</span></td>
            <td><button class="btn-mockup btn-mockup-primary">✓ Check-In Cabina</button></td>
          </tr>
          <tr>
            <td><strong>10:30</strong></td>
            <td>Rodrigo Garza</td>
            <td>Limpieza Facial Profunda</td>
            <td>Lic. Mariana Gómez</td>
            <td><span class="badge badge-teal">Cabina 2 (Lista)</span></td>
            <td><span class="badge badge-green">En Atención</span></td>
          </tr>
          <tr>
            <td><strong>11:00</strong></td>
            <td>Daniela Cantú</td>
            <td>HIFU 7D Reafirmante</td>
            <td>Lic. Sofía Rivas</td>
            <td><span class="badge badge-gold">Cabina 3 (Ocupada)</span></td>
            <td><button class="btn-mockup btn-mockup-outline">En Espera</button></td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <div class="callout callout-info">
    <div class="callout-title">Protocolo de Cortesía</div>
    Ofrezca siempre a la paciente agua alcalina, café gourmet o infusión de frutas mientras la especialista sale a recibirla a la sala de espera.
  </div>

  {render_footer(doc_title, "Página 2 de 5")}

  <div class="page-break"></div>

  <!-- PÁGINA 3: CAJA DIARIA Y RECIBOS -->
  {render_header(logo, doc_title, "Capítulo 2 • Flujo de Cobro y Recibo Digital Oficial")}

  <h1 class="sec-title">2. Módulo de Caja Diaria y Cobro de Servicios</h1>
  <p>
    Al concluir el tratamiento, el especialista acompaña al paciente a recepción para efectuar el pago correspondiente de honorarios médicos, aparatología y cosmecéuticos recomendados.
  </p>

  <h2 class="sub-title">2.1 Opciones y Métodos de Cobro Soportados</h2>
  <div class="module-grid">
    <div class="module-card">
      <h4>💵 Efectivo</h4>
      <p>Calculadora automática de cambio con registro exacto de denominaciones para evitar faltantes en arqueo.</p>
    </div>
    <div class="module-card">
      <h4>💳 Tarjeta Bancaria (TPV)</h4>
      <p>Crédito o débito (Visa, Mastercard, AMEX). Registro del número de autorización y voucher bancario.</p>
    </div>
    <div class="module-card">
      <h4>📱 Transferencia SPEI</h4>
      <p>Captura de la clave de rastreo bancaria tras confirmar el abono en la cuenta fiscal de la clínica.</p>
    </div>
    <div class="module-card">
      <h4>🔄 Pago Mixto / Combinado</h4>
      <p>Permite liquidar una parte en efectivo y el restante con tarjeta o transferencia bancaria.</p>
    </div>
  </div>

  <h2 class="sub-title">2.2 Emisión del Recibo Digital Oficial ALFRA</h2>
  <p>
    Una vez confirmado el cobro, el sistema genera automáticamente el <strong>Recibo Digital Oficial</strong> con diseño de alta elegancia, sellado con código de verificación QR:
  </p>

  <!-- MOCKUP RECIBO DIGITAL -->
  <div class="mockup-container">
    <div class="mockup-header">
      <span class="mockup-dot dot-red"></span>
      <span class="mockup-dot dot-yellow"></span>
      <span class="mockup-dot dot-green"></span>
      <span class="mockup-title">ALFRA CashRegister • Recibo Digital de Pago</span>
    </div>
    <div class="mockup-content" style="display: flex; gap: 20px; align-items: center; justify-content: center; background: #f8fafc;">
      
      <!-- RECIBO PREVIEW -->
      <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 14px; width: 280px; box-shadow: 0 4px 8px rgba(0,0,0,0.06); font-family: monospace; font-size: 7.5pt; color: #334155;">
        <div style="text-align: center; border-bottom: 1px dashed #cbd5e1; padding-bottom: 8px; margin-bottom: 8px;">
          <img src="{logo}" style="height: 32px; margin-bottom: 4px;" alt="ALFRA" /><br>
          <strong style="font-size: 8.5pt; color: #0f172a;">CLÍNICA ALFRA</strong><br>
          Medicina Estética & Spa Integral<br>
          RECIBO OFICIAL: #REC-2026-0492
        </div>
        <div>
          <strong>Fecha:</strong> 03/11/2026 11:45 hrs<br>
          <strong>Paciente:</strong> Valeria Montemayor<br>
          <strong>Médico:</strong> Dra. Claudia Méndez<br>
          <hr style="border: 0; border-top: 1px dashed #cbd5e1; margin: 6px 0;">
          <strong>Concepto:</strong> Bótox Tercio Superior ($3,200.00)<br>
          <strong>Cosmecéutico:</strong> Bloqueador Solar SPF50 ($650.00)<br>
          <hr style="border: 0; border-top: 1px dashed #cbd5e1; margin: 6px 0;">
          <div style="font-size: 9pt; font-weight: 700; color: #0f172a; text-align: right;">
            TOTAL: $3,850.00 MXN
          </div>
          <strong>Método:</strong> Pago Mixto (Efectivo: $1,850 / TPV: $2,000)<br>
          <hr style="border: 0; border-top: 1px dashed #cbd5e1; margin: 6px 0;">
          <div style="text-align: center; font-size: 6.5pt; color: #64748b; margin-top: 4px;">
            ¡Gracias por consentirte con nosotros!<br>
            Sello Digital: 9F2A-881C-B430
          </div>
        </div>
      </div>

      <!-- BOTONES DE ENVÍO -->
      <div style="flex: 1; max-width: 230px;">
        <h4 style="font-size: 9.5pt; color: #0f172a; margin-bottom: 6px;">Entrega de Comprobante</h4>
        <p style="font-size: 8pt; color: #64748b; margin-bottom: 10px;">
          El recibo puede imprimirse en ticket térmico o enviarse directamente por WhatsApp con un solo clic.
        </p>
        <div style="display: flex; flex-direction: column; gap: 6px;">
          <button class="btn-mockup btn-mockup-whatsapp">📲 Enviar por WhatsApp</button>
          <button class="btn-mockup btn-mockup-primary">🖨️ Imprimir Ticket</button>
          <button class="btn-mockup btn-mockup-outline">✉️ Enviar por Correo</button>
        </div>
      </div>

    </div>
  </div>

  {render_footer(doc_title, "Página 3 de 5")}

  <div class="page-break"></div>

  <!-- PÁGINA 4: PRÓXIMOS CUMPLEAÑOS -->
  {render_header(logo, doc_title, "Capítulo 3 • Próximos Cumpleaños y Tarjeta VIP en Front Desk")}

  <h1 class="sec-title">3. Próximos Cumpleaños y Tarjeta Digital VIP</h1>
  <p>
    En la versión <strong>1.5.0</strong>, el módulo de <strong>Próximos Cumpleaños</strong> se encuentra habilitado para Recepción en la pestaña superior de Caja. Esto permite felicitar a los pacientes que cumplen años hoy o durante la semana y obsequiarles su tarjeta digital personalizada.
  </p>

  <h2 class="sub-title">3.1 Consulta de Fecha Exacta</h2>
  <p>
    El sistema calcula matemáticamente la fecha de aniversario sin desfases horarios, indicando con precisión: <strong>\"Cumpleaños Hoy\"</strong>, <strong>\"Mañana\"</strong> o <strong>\"El día 14 de Noviembre\"</strong>.
  </p>

  <!-- MOCKUP LISTA DE CUMPLEAÑOS EN RECEPCIÓN -->
  <div class="mockup-container">
    <div class="mockup-header">
      <span class="mockup-dot dot-red"></span>
      <span class="mockup-dot dot-yellow"></span>
      <span class="mockup-dot dot-green"></span>
      <span class="mockup-title">ALFRA FrontDesk • Pestaña Próximos Cumpleaños</span>
    </div>
    <div class="mockup-content">
      <table class="data-table">
        <thead>
          <tr>
            <th>Paciente</th>
            <th>Fecha Exacta</th>
            <th>Teléfono WhatsApp</th>
            <th>Estatus de Felicitación</th>
            <th>Acción VIP</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Valeria Montemayor</strong></td>
            <td><span class="badge badge-gold">🎉 ¡HOY 3 DE NOVIEMBRE!</span></td>
            <td>(81) 1982-3456</td>
            <td><span class="badge badge-teal">Pendiente de Envío</span></td>
            <td><button class="btn-mockup btn-mockup-primary">✨ Diseñar Tarjeta</button></td>
          </tr>
          <tr>
            <td><strong>Lorena Treviño</strong></td>
            <td><span class="badge badge-slate">5 de Noviembre (En 2 días)</span></td>
            <td>(81) 2345-6789</td>
            <td><span class="badge badge-slate">Programado</span></td>
            <td><button class="btn-mockup btn-mockup-outline">Ver Perfil</button></td>
          </tr>
          <tr>
            <td><strong>Sofía Hernández</strong></td>
            <td><span class="badge badge-slate">12 de Noviembre</span></td>
            <td>(81) 8765-4321</td>
            <td><span class="badge badge-green">Enviada en 2025</span></td>
            <td><button class="btn-mockup btn-mockup-outline">Historial</button></td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <h2 class="sub-title">3.2 Paso a Paso: Personalización y Envío de la Tarjeta</h2>
  <div class="step-card">
    <div class="step-number">1</div>
    <div class="step-body">
      <h4>Pulsar \"Diseñar Tarjeta\"</h4>
      <p>Haga clic en el botón turquesa al lado del paciente para abrir el modal de personalización.</p>
    </div>
  </div>
  <div class="step-card">
    <div class="step-number">2</div>
    <div class="step-body">
      <h4>Asignar Regalo o Cortesía</h4>
      <p>Revise el campo de cortesía. Por defecto sugiere un <em>\"Facial Hidratante Profundo de Cortesía\"</em>, pero puede cambiarse por cualquier promoción acordada.</p>
    </div>
  </div>
  <div class="step-card">
    <div class="step-number">3</div>
    <div class="step-body">
      <h4>Descargar y Enviar por WhatsApp</h4>
      <p>Presione <strong>\"Descargar PNG\"</strong> o <strong>\"Enviar por WhatsApp\"</strong>. Se abrirá la conversación con la imagen adjunta y un texto de celebración exclusivo.</p>
    </div>
  </div>

  {render_footer(doc_title, "Página 4 de 5")}

  <div class="page-break"></div>

  <!-- PÁGINA 5: SEGUIMIENTO POST-CONSULTA Y CIERRE -->
  {render_header(logo, doc_title, "Capítulo 4 • Seguimiento Post-Consulta y Cierre de Turno")}

  <h1 class="sec-title">4. Alertas Post-Consulta (24h / 48h / 7 días)</h1>
  <p>
    La experiencia ALFRA continúa después de que el paciente se retira. El módulo de <strong>Alertas Post-Consulta</strong> programa automáticamente recordatorios para contactar al paciente y monitorear su evolución:
  </p>

  <div class="module-grid">
    <div class="module-card" style="border-left: 4px solid #ef4444;">
      <h4>Alertas a las 24 Horas</h4>
      <p>Verificación de tratamientos inyectables (bótox, labios, rinomodelación). Descartar inflamación o hematomas.</p>
    </div>
    <div class="module-card" style="border-left: 4px solid #f97316;">
      <h4>Alertas a las 48 Horas</h4>
      <p>Seguimiento de peelings médicos, láser CO2 y aparatología de calor profundo. Indagar sobre uso de protector solar.</p>
    </div>
    <div class="module-card" style="border-left: 4px solid #14b8a6;">
      <h4>Alertas a los 7 Días</h4>
      <p>Evaluación de satisfacción general y motivación para agendar sesión de seguimiento o retoque estético.</p>
    </div>
    <div class="module-card" style="border-left: 4px solid #3b82f6;">
      <h4>Registro en Bitácora</h4>
      <p>Cada llamada o mensaje se anota en el expediente con las opciones: Conforme, Duda Médica o Inconformidad.</p>
    </div>
  </div>

  <h1 class="sec-title" style="margin-top: 18px;">5. Protocolo de Cierre Diario de Caja</h1>
  <p>
    Al término de la jornada laboral, la recepcionista responsable debe realizar el <strong>Corte de Caja Diario</strong>:
  </p>
  <ol>
    <li>Contar físicamente el dinero en efectivo en el cajón de cobro y registrar el desglose por denominación.</li>
    <li>Sumar los vouchers de las terminales TPV y verificar que coincidan al centavo con el reporte del sistema.</li>
    <li>Comprobar los recibos emitidos en transferencia SPEI contra el estado de cuenta bancario.</li>
    <li>Pulsar <strong>\"Generar Corte de Turno\"</strong>. El sistema bloquea nuevos cobros y envía el resumen financiero por correo a la Dirección Administrativa.</li>
  </ol>

  <div class="callout callout-gold">
    <div class="callout-title">Respaldo Físico y Digital</div>
    El ticket impreso del corte de caja debe engraparse junto con los vouchers bancarios del día y resguardarse en el sobre de seguridad en la bóveda de la clínica.
  </div>

  {render_footer(doc_title, "Página 5 de 5")}

</body>
</html>
"""
    return html

if __name__ == "__main__":
    html_content = build_manual_02()
    out_pdf = os.path.join(os.path.dirname(__file__), "..", "manuales", "Manual_02_Recepcion_y_Caja.pdf")
    print("Compilando Manual 02 - Recepción y Caja...")
    render_html_to_pdf(html_content, out_pdf)