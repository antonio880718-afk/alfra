# -*- coding: utf-8 -*-
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pdf_engine import render_html_to_pdf
from manual_data_common import load_logo, get_common_css, render_cover, render_header, render_footer

def build_manual_01():
    logo = load_logo()
    doc_title = "Manual de Administración y Gestión General"
    
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
    "ADMINISTRADOR GENERAL",
    "Supervisión Gerencial, Finanzas, Nómina, Restablecimiento de Credenciales Alfra2026!, Agenda Global y Fidelización VIP",
    "Este manual define los procedimientos oficiales para la administración de la plataforma digital de Clínica ALFRA. Incluye la gestión ejecutiva de colaboradores, reseteo seguro de credenciales con guard obligatorio, conciliación de caja multimetodo y emisión de tarjetas VIP de cumpleaños.",
    "Administrador General, Dirección Médica, Gerencia de Operaciones"
  )}

  <!-- PÁGINA 2: ACCESO Y DASHBOARD -->
  {render_header(logo, doc_title, "Capítulo 1 • Acceso y Consola Ejecutiva")}

  <h1 class="sec-title">1. Acceso a la Plataforma y Panel de Control</h1>
  <p>
    La plataforma <strong>Clínica ALFRA</strong> opera tanto en entorno web seguro (<a href="https://clinica-alfra.web.app" style="color:#0d9488; text-decoration:none; font-weight:600;">clinica-alfra.web.app</a>) como en aplicación nativa Android (AAB v1.5.0). El rol de <strong>Administrador General</strong> posee el nivel jerárquico máximo de supervisión, con facultades para auditar historiales clínicos, conciliar finanzas y administrar los accesos de todo el personal.
  </p>

  <div class="callout callout-info">
    <div class="callout-title">Seguridad de Acceso Institucional</div>
    El sistema cuenta con autenticación cifrada en Firebase Authentication y persistencia segura de sesión. Las credenciales de administrador nunca deben compartirse ni utilizarse en terminales públicas.
  </div>

  <h2 class="sub-title">1.1 Pantalla de Autenticación</h2>
  <p>El ingreso se realiza mediante correo institucional y clave personal:</p>

  <!-- MOCKUP LOGIN -->
  <div class="mockup-container">
    <div class="mockup-header">
      <span class="mockup-dot dot-red"></span>
      <span class="mockup-dot dot-yellow"></span>
      <span class="mockup-dot dot-green"></span>
      <span class="mockup-title">ALFRA Cloud • Consola de Autenticación Centralizada</span>
    </div>
    <div class="mockup-content" style="background: #0f172a; color: #fff; padding: 20px; text-align: center;">
      <img src="{logo}" style="height: 48px; margin-bottom: 10px;" alt="ALFRA" />
      <h3 style="color: #ffffff; font-size: 13pt; margin-bottom: 2px;">Clínica ALFRA</h3>
      <p style="color: #94a3b8; font-size: 8pt; margin-bottom: 14px;">Medicina Estética & Spa Integral • Acceso Autorizado</p>

      <div style="max-width: 310px; margin: 0 auto; text-align: left; background: #1e293b; padding: 14px; border-radius: 8px; border: 1px solid #334155;">
        <label style="font-size: 7.5pt; color: #cbd5e1; display: block; margin-bottom: 3px;">Correo Electrónico Institucional</label>
        <div style="background: #0f172a; border: 1px solid #475569; border-radius: 5px; padding: 6px 10px; color: #fff; font-size: 8.5pt; margin-bottom: 10px;">
          admin@clinica-alfra.mx
        </div>

        <label style="font-size: 7.5pt; color: #cbd5e1; display: block; margin-bottom: 3px;">Contraseña de Seguridad</label>
        <div style="background: #0f172a; border: 1px solid #475569; border-radius: 5px; padding: 6px 10px; color: #94a3b8; font-size: 8.5pt; margin-bottom: 14px; letter-spacing: 2px;">
          ••••••••••••
        </div>

        <div style="background: #20b2aa; color: #fff; text-align: center; padding: 8px; border-radius: 6px; font-weight: 700; font-size: 9pt; cursor: pointer;">
          Iniciar Sesión como Administrador
        </div>
      </div>
    </div>
  </div>

  <h2 class="sub-title">1.2 Dashboard Gerencial y KPIs en Tiempo Real</h2>
  <p>Al iniciar sesión, el Administrador accede a la consola de mando con métricas operativas actualizadas automáticamente:</p>

  <div class="module-grid">
    <div class="module-card" style="border-left: 4px solid #14b8a6;">
      <h4>Ingresos del Día</h4>
      <p style="font-size: 15pt; font-weight: 800; color: #0f172a; margin: 2px 0;">$38,450 MXN</p>
      <span class="badge badge-teal">+18.5% vs promedio diario</span>
    </div>
    <div class="module-card" style="border-left: 4px solid #d4af37;">
      <h4>Ocupación de Cabinas</h4>
      <p style="font-size: 15pt; font-weight: 800; color: #0f172a; margin: 2px 0;">87.5%</p>
      <span class="badge badge-gold">7 de 8 cabinas en servicio</span>
    </div>
    <div class="module-card" style="border-left: 4px solid #3b82f6;">
      <h4>Citas Concluidas</h4>
      <p style="font-size: 15pt; font-weight: 800; color: #0f172a; margin: 2px 0;">24 Pacientes</p>
      <span class="badge badge-blue">8 en proceso • 0 retrasos</span>
    </div>
    <div class="module-card" style="border-left: 4px solid #ec4899;">
      <h4>Ticket Promedio</h4>
      <p style="font-size: 15pt; font-weight: 800; color: #0f172a; margin: 2px 0;">$1,602 MXN</p>
      <span class="badge badge-rose">Tratamientos Médicos & Spa</span>
    </div>
  </div>

  {render_footer(doc_title, "Página 2 de 5")}

  <div class="page-break"></div>

  <!-- PÁGINA 3: RESTABLECIMIENTO DE CONTRASEÑA -->
  {render_header(logo, doc_title, "Capítulo 2 • Control de Personal y Restablecimiento de Credenciales")}

  <h1 class="sec-title">2. Gestión de Personal y Restablecimiento Seguro de Contraseñas</h1>
  <p>
    El módulo de <strong>Personal y Colaboradores</strong> permite supervisar a médicos, especialistas, recepcionistas y personal de intendencia. Una de las funciones más críticas incorporadas en la versión <strong>1.5.0</strong> es el <strong>Restablecimiento Centralizado de Contraseñas</strong> con forzado de cambio en el primer inicio de sesión.
  </p>

  <h2 class="sub-title">2.1 Flujo Operativo: Clave Genérica Alfra2026!</h2>
  <p>Cuando un colaborador solicita el restablecimiento de su acceso, siga el procedimiento oficial:</p>

  <div class="step-card">
    <div class="step-number">1</div>
    <div class="step-body">
      <h4>Localización del Colaborador</h4>
      <p>Navegue a <strong>Personal / Colaboradores</strong> y filtre por nombre o puesto para encontrar la fila del empleado.</p>
    </div>
  </div>

  <div class="step-card">
    <div class="step-number">2</div>
    <div class="step-body">
      <h4>Pulsar \"Restablecer Contraseña\"</h4>
      <p>Haga clic en el botón dorado <strong>🔑 Restablecer Contraseña</strong>. El sistema desplegará un modal de confirmación con la advertencia de seguridad.</p>
    </div>
  </div>

  <div class="step-card">
    <div class="step-number">3</div>
    <div class="step-body">
      <h4>Asignación Automática de Clave Genérica</h4>
      <p>
        El sistema actualiza la credencial del colaborador en Firebase Authentication a la clave oficial: 
        <strong style="font-family: monospace; color: #b45309; background: #fef3c7; padding: 2px 6px; border-radius: 4px;">Alfra2026!</strong> y establece el atributo <code style="color: #0f766e;">requiereCambioContrasena: true</code> en su expediente.
      </p>
    </div>
  </div>

  <div class="step-card">
    <div class="step-number">4</div>
    <div class="step-body">
      <h4>Guard Obligatorio de Primer Login</h4>
      <p>
        Cuando el colaborador introduce <strong>Alfra2026!</strong> en la pantalla de acceso, el sistema bloquea cualquier otra vista y despliega inmediatamente el formulario de <strong>\"Cambio Obligatorio de Contraseña\"</strong>. El colaborador no podrá utilizar la aplicación hasta definir su propia contraseña segura y confidencial.
      </p>
    </div>
  </div>

  <!-- MOCKUP TABLA DE PERSONAL Y ACCIÓN DE RESETEO -->
  <div class="mockup-container">
    <div class="mockup-header">
      <span class="mockup-dot dot-red"></span>
      <span class="mockup-dot dot-yellow"></span>
      <span class="mockup-dot dot-green"></span>
      <span class="mockup-title">ALFRA Management • Directorio de Personal y Control de Credenciales</span>
    </div>
    <div class="mockup-content">
      <table class="data-table">
        <thead>
          <tr>
            <th>Colaborador</th>
            <th>Puesto</th>
            <th>Email</th>
            <th>Estatus</th>
            <th>Acción de Seguridad</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Dra. Claudia Méndez</strong></td>
            <td><span class="badge badge-blue">Médico Especialista</span></td>
            <td>dra.claudia@clinica-alfra.mx</td>
            <td><span class="badge badge-green">Activo</span></td>
            <td>
              <button class="btn-mockup btn-mockup-gold">🔑 Restablecer Contraseña</button>
            </td>
          </tr>
          <tr>
            <td><strong>Lic. Mariana Gómez</strong></td>
            <td><span class="badge badge-teal">Recepción y Caja</span></td>
            <td>mariana.caja@clinica-alfra.mx</td>
            <td><span class="badge badge-green">Activo</span></td>
            <td>
              <button class="btn-mockup btn-mockup-gold">🔑 Restablecer Contraseña</button>
            </td>
          </tr>
          <tr>
            <td><strong>Carlos Domínguez</strong></td>
            <td><span class="badge badge-slate">Intendencia</span></td>
            <td>carlos.limpieza@clinica-alfra.mx</td>
            <td><span class="badge badge-rose">Clave Reasignada</span></td>
            <td>
              <span class="badge badge-gold" style="font-family: monospace;">Alfra2026! (Pendiente cambio)</span>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- MOCKUP FORMULARIO FORZOSO DE CAMBIO -->
      <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px; margin-top: 10px; display: flex; align-items: center; justify-content: space-between;">
        <div>
          <div style="font-size: 9pt; font-weight: 700; color: #0f172a;">🔒 Pantalla vista por el colaborador al ingresar con Alfra2026!</div>
          <div style="font-size: 8pt; color: #64748b;">Modal bloqueante: Debe ingresar Nueva Contraseña y Confirmar para desbloquear su perfil.</div>
        </div>
        <div style="display: flex; gap: 6px;">
          <input type="text" value="Nueva contraseña..." disabled style="font-size: 7.5pt; padding: 4px 8px; border: 1px solid #cbd5e1; border-radius: 4px; background: #fff; width: 130px;" />
          <button class="btn-mockup btn-mockup-primary" style="font-size: 7.5pt;">Guardar y Activar</button>
        </div>
      </div>
    </div>
  </div>

  <div class="callout callout-gold">
    <div class="callout-title">Garantía de Confidencialidad</div>
    Gracias a este flujo, ni el Administrador ni la recepcionista conocen jamás la clave privada del colaborador, cumpliendo estrictamente con la Ley Federal de Protección de Datos Personales (LFPDPPP).
  </div>

  {render_footer(doc_title, "Página 3 de 5")}

  <div class="page-break"></div>

  <!-- PÁGINA 4: PRÓXIMOS CUMPLEAÑOS Y TARJETA VIP -->
  {render_header(logo, doc_title, "Capítulo 3 • Fidelización VIP y Tarjeta de Cumpleaños")}

  <h1 class="sec-title">3. Próximos Cumpleaños y Tarjeta de Regalo VIP</h1>
  <p>
    La fidelización y la experiencia de lujo son sellos distintivos de <strong>Clínica ALFRA</strong>. La plataforma integra un módulo automatizado que detecta los cumpleaños del mes con cálculo exacto de fecha (libre de desfases UTC) y permite generar y descargar una tarjeta digital de alta resolución para enviar vía WhatsApp.
  </p>

  <h2 class="sub-title">3.1 Diseñador de Tarjeta Digital de Cumpleaños</h2>
  <p>
    Al hacer clic en el botón <strong>\"Diseñar Tarjeta\"</strong> sobre cualquier cumpleañero del día o del mes, se despliega el generador digital:
  </p>
  <ul>
    <li><strong>Estilo Recibo de Lujo:</strong> Fondo claro marfil aperlado, guardas doradas `#d4af37`, bordes biselados y logotipo oficial ALFRA en alta definición.</li>
    <li><strong>Regalo Personalizable Manual:</strong> El Administrador o recepcionista puede redactar el obsequio o cortesía específica acordada con la dirección médica (ej: <em>\"Facial Hidratante Profundo de Cortesía\"</em>, <em>\"20% de Descuento en Toxina Botulínica\"</em> o <em>\"Kit Cosmeceútico Regenerador\"</em>).</li>
    <li><strong>Exportación Directa a PNG/JPEG:</strong> Descarga instantánea con nitidez Retina y botón directo de envío a WhatsApp con texto de cortesía prellenado.</li>
  </ul>

  <!-- MOCKUP TARJETA DIGITAL -->
  <div class="mockup-container">
    <div class="mockup-header">
      <span class="mockup-dot dot-red"></span>
      <span class="mockup-dot dot-yellow"></span>
      <span class="mockup-dot dot-green"></span>
      <span class="mockup-title">ALFRA Concierge • Emisión de Tarjeta Digital de Cumpleaños</span>
    </div>
    <div class="mockup-content" style="background: #f8fafc; padding: 14px; display: flex; gap: 16px; align-items: center; justify-content: center;">
      
      <!-- TARJETA VIP PREVIEW -->
      <div style="background: #ffffff; border: 2px solid #d4af37; border-radius: 10px; padding: 14px; text-align: center; width: 310px; box-shadow: 0 4px 12px rgba(212,175,55,0.18);">
        <img src="{logo}" style="height: 42px; margin-bottom: 6px;" alt="ALFRA" />
        <div style="font-size: 7.5pt; letter-spacing: 2px; color: #d4af37; font-weight: 700; text-transform: uppercase;">Membresía VIP Exclusiva</div>
        <h3 style="font-family: 'Playfair Display', serif; font-size: 14pt; color: #0f172a; margin: 3px 0;">¡Feliz Cumpleaños!</h3>
        <div style="font-size: 11pt; font-weight: 700; color: #c59b27; margin-bottom: 6px;">Sra. Valeria Montemayor</div>
        <p style="font-size: 8pt; color: #64748b; margin-bottom: 8px;">
          En este día tan especial celebramos tu belleza, bienestar y confianza en Clínica ALFRA.
        </p>

        <div style="background: #f0fdfa; border: 1px dashed #14b8a6; border-radius: 6px; padding: 8px; margin-bottom: 8px;">
          <div style="font-size: 7pt; text-transform: uppercase; letter-spacing: 1px; color: #0d9488; font-weight: 700;">OBSEQUIO ESPECIAL DE ANIVERSARIO</div>
          <div style="font-size: 9.5pt; font-weight: 700; color: #0f766e;">Facial Hidratante Profundo de Cortesía</div>
          <div style="font-size: 7pt; color: #64748b; margin-top: 2px;">Válido durante todo tu mes de cumpleaños</div>
        </div>

        <div style="font-size: 6.5pt; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 5px;">
          Clínica ALFRA • Concierge & Reservas: 753 538 6018
        </div>
      </div>

      <!-- PANEL LATERAL DE EDICIÓN -->
      <div style="flex: 1; max-width: 250px; background: #ffffff; padding: 12px; border-radius: 6px; border: 1px solid #cbd5e1;">
        <h4 style="font-size: 9.5pt; color: #0f172a; margin-bottom: 6px;">Personalizar Regalo</h4>
        <label style="font-size: 7.5pt; color: #475569; display: block; margin-bottom: 3px;">Cortesía / Tratamiento</label>
        <div style="border: 1px solid #20b2aa; border-radius: 4px; padding: 5px; font-size: 8pt; color: #0f766e; background: #f0fdfa; margin-bottom: 10px;">
          Facial Hidratante Profundo de Cortesía
        </div>

        <div style="display: flex; flex-direction: column; gap: 6px;">
          <button class="btn-mockup btn-mockup-primary" style="width: 100%;">💾 Descargar Imagen PNG</button>
          <button class="btn-mockup btn-mockup-whatsapp" style="width: 100%;">📲 Enviar por WhatsApp</button>
        </div>
      </div>

    </div>
  </div>

  {render_footer(doc_title, "Página 4 de 5")}

  <div class="page-break"></div>

  <!-- PÁGINA 5: ARQUEO DE CAJA Y AUDITORÍA -->
  {render_header(logo, doc_title, "Capítulo 4 • Finanzas, Cortes de Caja y Auditoría Clínica")}

  <h1 class="sec-title">4. Finanzas, Cortes de Caja y Auditoría Clínica</h1>
  <p>
    El Administrador supervisa diariamente la conciliación financiera de la caja y valida que los expedientes médicos cumplan con las directrices de la <strong>NOM-004-SSA3-2012</strong> (Expediente Clínico).
  </p>

  <h2 class="sub-title">4.1 Conciliación Multimétodo de Caja</h2>
  <table class="data-table">
    <thead>
      <tr>
        <th>Método de Pago</th>
        <th>Cobros</th>
        <th>Monto Total</th>
        <th>Participación</th>
        <th>Verificación Requerida</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Efectivo</strong></td>
        <td>14 citas</td>
        <td>$12,400.00 MXN</td>
        <td>32.2%</td>
        <td>Cotejo en bóveda de seguridad</td>
      </tr>
      <tr>
        <td><strong>Terminal Bancaria (TPV)</strong></td>
        <td>18 citas</td>
        <td>$19,850.00 MXN</td>
        <td>51.6%</td>
        <td>Vouchers y liquidación bancaria</td>
      </tr>
      <tr>
        <td><strong>Transferencia SPEI</strong></td>
        <td>4 citas</td>
        <td>$4,200.00 MXN</td>
        <td>10.9%</td>
        <td>Clave de rastreo en banca en línea</td>
      </tr>
      <tr>
        <td><strong>Pago Mixto</strong></td>
        <td>2 citas</td>
        <td>$2,000.00 MXN</td>
        <td>5.3%</td>
        <td>Doble desglose en ticket</td>
      </tr>
    </tbody>
    <tfoot>
      <tr style="background: #f1f5f9; font-weight: 700;">
        <td>TOTAL CONCILIADO</td>
        <td>38 transacciones</td>
        <td>$38,450.00 MXN</td>
        <td>100%</td>
        <td>Corte Cuadrado Sin Diferencias</td>
      </tr>
    </tfoot>
  </table>

  <h2 class="sub-title">4.2 Auditoría de Expedientes y Consentimientos Informados</h2>
  <p>
    La plataforma audita que cada procedimiento médico cuente con su consentimiento informado debidamente firmado mediante rúbrica digital táctil por el paciente antes de ingresar a la cabina médica.
  </p>

  <div class="callout callout-danger">
    <div class="callout-title">Regla Inquebrantable de Bioseguridad</div>
    Ningún procedimiento invasivo (infiltración de toxina botulínica, ácido hialurónico, bioestimuladores o aparatología láser) puede iniciarse sin el consentimiento táctil registrado en el expediente digital.
  </div>

  <h1 class="sec-title" style="margin-top: 22px;">5. Soporte y Preguntas Frecuentes</h1>
  
  <div style="margin-top: 10px;">
    <h3 class="subsub-title">¿Qué ocurre si el empleado olvida su nueva contraseña después de cambiar Alfra2026!?</h3>
    <p>El Administrador simplemente presiona nuevamente \"Restablecer Contraseña\". Esto reinicia el ciclo asignando otra vez <strong>Alfra2026!</strong> y exigiendo el cambio forzoso en su siguiente acceso.</p>

    <h3 class="subsub-title">¿Cómo exportar el reporte quincenal de comisiones médicas?</h3>
    <p>Desde la pestaña <strong>Nómina y Comisiones</strong>, seleccione el rango de fechas y presione \"Exportar Reporte\". Se descargará un archivo tabulado con el desglose exacto de cada médico.</p>
  </div>

  {render_footer(doc_title, "Página 5 de 5")}

</body>
</html>
"""
    return html

if __name__ == "__main__":
    html_content = build_manual_01()
    out_pdf = os.path.join(os.path.dirname(__file__), "..", "manuales", "Manual_01_Administrador.pdf")
    print("Compilando Manual 01 - Administrador...")
    render_html_to_pdf(html_content, out_pdf)