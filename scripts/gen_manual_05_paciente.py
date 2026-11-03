# -*- coding: utf-8 -*-
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pdf_engine import render_html_to_pdf
from manual_data_common import load_logo, get_common_css, render_cover, render_header, render_footer

def build_manual_05():
    logo = load_logo()
    doc_title = "Manual del Paciente • Portal y App Móvil"
    
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
    "PORTAL DEL PACIENTE",
    "App Móvil Oficial, Agendado de Citas en Línea, Monedero de Lealtad, Rutina en Casa y Tarjeta de Cumpleaños",
    "Guía ilustrada para pacientes de Clínica ALFRA. Explica cómo instalar la aplicación, agendar tratamientos de belleza y medicina estética, consultar la rutina de skincare domiciliaria indicada por su médico y disfrutar de beneficios VIP exclusivos.",
    "Pacientes, Clientes VIP y Nuevos Usuarios de Clínica ALFRA"
  )}

  <!-- PÁGINA 2: ACCESO Y APP MÓVIL -->
  {render_header(logo, doc_title, "Capítulo 1 • Descarga de la App y Primer Acceso")}

  <h1 class="sec-title">1. Bienvenido a la Experiencia Digital ALFRA</h1>
  <p>
    En <strong>Clínica ALFRA</strong>, diseñamos una experiencia digital exclusiva para que gestione sus citas de medicina estética, consulte las indicaciones de su doctora y disfrute de recompensas exclusivas directamente desde su smartphone.
  </p>

  <h2 class="sub-title">1.1 Acceso Multiplataforma</h2>
  <div class="module-grid">
    <div class="module-card" style="border-left: 4px solid #14b8a6;">
      <h4>📱 Aplicación Móvil Android</h4>
      <p>Disponible en formato de aplicación oficial (APK / AAB v1.5.0) con notificaciones push y acceso biométrico.</p>
    </div>
    <div class="module-card" style="border-left: 4px solid #d4af37;">
      <h4>🌐 Portal Web Seguro</h4>
      <p>Acceda desde cualquier navegador en su computadora o iPhone ingresando a <a href="https://clinica-alfra.web.app" style="color: #0d9488; text-decoration: none; font-weight: 700;">clinica-alfra.web.app</a>.</p>
    </div>
  </div>

  <h2 class="sub-title">1.2 Registro e Inicio de Sesión</h2>
  <div class="step-card">
    <div class="step-number">1</div>
    <div class="step-body">
      <h4>Crear Cuenta o Iniciar Sesión</h4>
      <p>Ingrese con su número de teléfono o correo electrónico personal y contraseña.</p>
    </div>
  </div>
  <div class="step-card">
    <div class="step-number">2</div>
    <div class="step-body">
      <h4>Completar Perfil y Fecha de Cumpleaños</h4>
      <p>Asegúrese de registrar su fecha de nacimiento exacta para recibir anualmente su <strong>Tarjeta de Regalo VIP de Aniversario</strong>.</p>
    </div>
  </div>

  <!-- MOCKUP HOME PACIENTE -->
  <div class="mockup-container">
    <div class="mockup-header">
      <span class="mockup-dot dot-red"></span>
      <span class="mockup-dot dot-yellow"></span>
      <span class="mockup-dot dot-green"></span>
      <span class="mockup-title">ALFRA Mobile • Experiencia Personalizada del Paciente</span>
    </div>
    <div class="mockup-content" style="background: #f8fafc; padding: 16px; display: flex; gap: 16px; align-items: center; justify-content: center;">
      
      <!-- PHONE MOCKUP -->
      <div style="background: #ffffff; border: 2px solid #0f172a; border-radius: 18px; width: 260px; padding: 12px; box-shadow: 0 8px 16px rgba(0,0,0,0.1);">
        <div style="text-align: center; margin-bottom: 8px;">
          <img src="{logo}" style="height: 28px;" alt="ALFRA" />
        </div>
        <div style="background: linear-gradient(135deg, #09131d 0%, #162a3d 100%); color: #fff; border-radius: 10px; padding: 10px; margin-bottom: 10px;">
          <div style="font-size: 7.5pt; color: #94a3b8;">Hola de nuevo,</div>
          <div style="font-size: 11pt; font-weight: 700; color: #d4af37;">Valeria Montemayor</div>
          <div style="font-size: 7pt; color: #20b2aa; margin-top: 4px;">Membresía: ALFRA Black VIP</div>
          <div style="font-size: 8pt; font-weight: 700; margin-top: 4px;">Monedero: $850 Puntos ALFRA</div>
        </div>

        <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px; margin-bottom: 8px; font-size: 7.5pt;">
          <strong style="color: #0f172a;">Próxima Cita Programada:</strong><br>
          <span style="color: #0f766e; font-weight: 600;">Jueves 15 de Noviembre • 16:00 hrs</span><br>
          <span style="color: #64748b;">Tratamiento: Retoque Bótox Facial</span>
        </div>

        <div style="display: flex; gap: 6px;">
          <button class="btn-mockup btn-mockup-primary" style="flex: 1; font-size: 7pt; padding: 6px;">Agendar Cita</button>
          <button class="btn-mockup btn-mockup-gold" style="flex: 1; font-size: 7pt; padding: 6px;">Mi Rutina</button>
        </div>
      </div>

      <!-- DESCRIPCIÓN -->
      <div style="flex: 1; max-width: 270px;">
        <h4 style="font-size: 10pt; color: #0f172a; margin-bottom: 6px;">Control Total en su Mano</h4>
        <p style="font-size: 8pt; color: #475569; margin-bottom: 8px;">
          Visualice en cualquier momento el saldo de su monedero, sus citas activas y su expediente de recomendaciones médicas post-consulta.
        </p>
        <span class="badge badge-teal">Sincronización Inmediata en la Nube</span>
      </div>

    </div>
  </div>

  {render_footer(doc_title, "Página 2 de 5")}

  <div class="page-break"></div>

  <!-- PÁGINA 3: AGENDADO DE CITAS -->
  {render_header(logo, doc_title, "Capítulo 2 • Agendado de Citas en Línea")}

  <h1 class="sec-title">2. Cómo Agendar una Cita desde su Celular</h1>
  <p>
    Agendar en <strong>Clínica ALFRA</strong> toma menos de 60 segundos. Siga estos sencillos pasos:
  </p>

  <div class="step-card">
    <div class="step-number">1</div>
    <div class="step-body">
      <h4>Selección del Tratamiento</h4>
      <p>Navegue por las categorías de servicios: Medicina Estética Inyectable, Cosmiatría Facial Avanzada, Moldeado Corporal o Depilación Láser.</p>
    </div>
  </div>

  <div class="step-card">
    <div class="step-number">2</div>
    <div class="step-body">
      <h4>Elección del Especialista Favorito</h4>
      <p>Elija a su médico o especialista de confianza, o seleccione <em>\"Cualquier especialista disponible\"</em> para mayor flexibilidad.</p>
    </div>
  </div>

  <div class="step-card">
    <div class="step-number">3</div>
    <div class="step-body">
      <h4>Selección de Fecha y Horario</h4>
      <p>El calendario muestra los espacios disponibles en tiempo real. Elija el día y la hora que mejor se adapte a su agenda.</p>
    </div>
  </div>

  <div class="step-card">
    <div class="step-number">4</div>
    <div class="step-body">
      <h4>Confirmación y Recordatorio Automático</h4>
      <p>Su cita queda confirmada inmediatamente y recibirá un recordatorio por WhatsApp 24 horas antes con las indicaciones de llegada.</p>
    </div>
  </div>

  <h2 class="sub-title">2.1 Catálogo de Tratamientos Destacados</h2>
  <table class="data-table">
    <thead>
      <tr>
        <th>Tratamiento</th>
        <th>Área</th>
        <th>Duración</th>
        <th>Beneficio Principal</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Bótox Tercio Superior</strong></td>
        <td>Frente, entrecejo y ojos</td>
        <td>30 min</td>
        <td>Atenúa líneas de expresión con expresión natural</td>
      </tr>
      <tr>
        <td><strong>Relleno de Labios Juvederm</strong></td>
        <td>Labios / Perfilado</td>
        <td>45 min</td>
        <td>Hidratación, definición de arco y volumen sutil</td>
      </tr>
      <tr>
        <td><strong>Facial Hidratante Profundo</strong></td>
        <td>Rostro y cuello</td>
        <td>60 min</td>
        <td>Limpieza médica, exfoliación y luminosidad instantánea</td>
      </tr>
      <tr>
        <td><strong>HIFU 7D Reafirmante</strong></td>
        <td>Rostro / Papada / Cuerpo</td>
        <td>50 min</td>
        <td>Lifting no quirúrgico por estimulación de colágeno</td>
      </tr>
    </tbody>
  </table>

  {render_footer(doc_title, "Página 3 de 5")}

  <div class="page-break"></div>

  <!-- PÁGINA 4: RUTINA EN CASA Y TARJETA CUMPLEAÑOS -->
  {render_header(logo, doc_title, "Capítulo 3 • Cuidados en Casa y Regalo de Cumpleaños VIP")}

  <h1 class="sec-title">3. Mi Expediente y Rutina de Skincare en Casa</h1>
  <p>
    Al salir de su consulta, la doctora carga su rutina médica domiciliaria. Puede consultarla cuando lo desee en la pestaña <strong>\"Mi Rutina en Casa\"</strong>:
  </p>

  <div class="module-grid">
    <div class="module-card">
      <h4>☀️ Cuidados Matutinos</h4>
      <p>
        • Lavar con limpiador suave.<br>
        • Aplicar 4 gotas de Vitamina C.<br>
        • Aplicar crema hidratante con ácido hialurónico.<br>
        • Reaplicar protector solar FPS 50+ cada 3 a 4 horas.
      </p>
    </div>
    <div class="module-card">
      <h4>🌙 Cuidados Nocturnos</h4>
      <p>
        • Desmaquillar con agua micelar.<br>
        • Limpiar profundamente.<br>
        • Aplicar suero reparador con péptidos.<br>
        • No masajear la zona inyectada por 48 horas.
      </p>
    </div>
  </div>

  <h1 class="sec-title" style="margin-top: 18px;">4. Su Tarjeta VIP de Cumpleaños</h1>
  <p>
    Durante el mes de su cumpleaños, Clínica ALFRA le envía una <strong>Tarjeta Digital de Aniversario</strong> con un regalo exclusivo acordado por la dirección médica:
  </p>

  <!-- MOCKUP TARJETA RECIBIDA POR EL PACIENTE -->
  <div class="mockup-container">
    <div class="mockup-header">
      <span class="mockup-dot dot-red"></span>
      <span class="mockup-dot dot-yellow"></span>
      <span class="mockup-dot dot-green"></span>
      <span class="mockup-title">ALFRA Rewards • Tarjeta Digital de Cumpleaños Recibida</span>
    </div>
    <div class="mockup-content" style="background: #ffffff; padding: 14px; text-align: center;">
      <div style="border: 2px solid #d4af37; border-radius: 10px; padding: 14px; max-width: 320px; margin: 0 auto; background: #fffdf9;">
        <img src="{logo}" style="height: 38px; margin-bottom: 4px;" alt="ALFRA" />
        <div style="font-size: 7pt; letter-spacing: 2px; color: #d4af37; font-weight: 700; text-transform: uppercase;">Membresía Exclusiva ALFRA</div>
        <h3 style="font-family: 'Playfair Display', serif; font-size: 13pt; margin: 3px 0; color: #0f172a;">¡Feliz Cumpleaños, Valeria!</h3>
        <p style="font-size: 7.5pt; color: #64748b; margin-bottom: 6px;">
          Queremos consentirte en tu mes especial con una cortesía clínica:
        </p>

        <div style="background: #f0fdfa; border: 1px dashed #14b8a6; border-radius: 6px; padding: 8px; margin-bottom: 6px;">
          <div style="font-size: 6.5pt; color: #0d9488; font-weight: 700; text-transform: uppercase;">OBSEQUIO DE ANIVERSARIO</div>
          <div style="font-size: 9.5pt; font-weight: 700; color: #0f766e;">Facial Hidratante Profundo de Cortesía</div>
          <div style="font-size: 6.5pt; color: #64748b; margin-top: 2px;">Presenta esta tarjeta en recepción al acudir a tu cita</div>
        </div>

        <div style="font-size: 6.5pt; color: #94a3b8;">Código de Canje: BDAY-2026-VAL</div>
      </div>
    </div>
  </div>

  {render_footer(doc_title, "Página 4 de 5")}

  <div class="page-break"></div>

  <!-- PÁGINA 5: MONEDERO Y RECIBOS -->
  {render_header(logo, doc_title, "Capítulo 4 • Monedero de Lealtad y Recibos Digitales")}

  <h1 class="sec-title">5. Monedero de Lealtad y Cashback ALFRA</h1>
  <p>
    Por cada visita y compra de productos en la clínica, acumula automáticamente un porcentaje de su cuenta en <strong>Puntos ALFRA</strong>:
  </p>
  <ul>
    <li><strong>Equivalencia Directa:</strong> 1 Punto ALFRA = $1.00 MXN utilizable en cualquiera de nuestras sucursales.</li>
    <li><strong>Sin Caducidad Anticipada:</strong> Sus puntos se mantienen vigentes mientras continúe visitándonos regularmente.</li>
    <li><strong>Canje Flexible:</strong> Puede cubrir el costo total o parcial de faciales, sesiones de aparatología o cremas cosmeceúticas.</li>
  </ul>

  <h1 class="sec-title" style="margin-top: 18px;">6. Historial de Recibos y Comprobantes</h1>
  <p>
    Todos sus pagos se archivan con transparencia. Puede consultar y descargar en formato PDF sus recibos oficiales con desglose de conceptos y sello digital.
  </p>

  <div class="callout callout-info">
    <div class="callout-title">Atención Personalizada y Concierge</div>
    ¿Tiene alguna duda sobre su recuperación o requiere reprogramar su cita? Comuníquese directamente a través del botón verde de WhatsApp integrado en la app para ser atendida por nuestro equipo de concierge.
  </div>

  <div style="text-align: center; margin-top: 30px; padding: 16px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
    <img src="{logo}" style="height: 44px; margin-bottom: 6px;" alt="ALFRA" /><br>
    <strong style="color: #0f172a; font-size: 11pt;">Clínica ALFRA • Medicina Estética & Spa Integral</strong><br>
    <span style="color: #64748b; font-size: 8.5pt;">Calle Río Fuerte #26, Col. Lomas de Bellavista, Lázaro Cárdenas, Michoacán • Citas & WhatsApp: 753 538 6018</span>
  </div>

  {render_footer(doc_title, "Página 5 de 5")}

</body>
</html>
"""
    return html

if __name__ == "__main__":
    html_content = build_manual_05()
    out_pdf = os.path.join(os.path.dirname(__file__), "..", "manuales", "Manual_05_Portal_Paciente.pdf")
    print("Compilando Manual 05 - Portal del Paciente...")
    render_html_to_pdf(html_content, out_pdf)