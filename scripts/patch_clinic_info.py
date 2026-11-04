# -*- coding: utf-8 -*-
import os
import re

CORRECT_PHONE = '7535386018'
CORRECT_PHONE_FMT = '753 538 6018'
CORRECT_ADDRESS = 'Calle Rio Fuerte #26 colonia Lomas de Bellavista, Lázaro Cárdenas Michoacán'
CORRECT_ADDRESS_ACCENT = 'Calle Río Fuerte #26, Col. Lomas de Bellavista, Lázaro Cárdenas, Michoacán'

print("Starting clinic info patch...")

# 1. src/services/limpiezaPdfService.js
p1 = 'src/services/limpiezaPdfService.js'
if os.path.exists(p1):
    with open(p1, 'r', encoding='utf-8') as f:
        c = f.read()
    c = re.sub(r"domicilio:\s*'Av\.\s*Principal[^']*'", f"domicilio: '{CORRECT_ADDRESS_ACCENT}'", c)
    c = re.sub(r"telefono:\s*'\([0-9]+\)\s*[0-9\-]+'", f"telefono: '{CORRECT_PHONE}'", c)
    with open(p1, 'w', encoding='utf-8') as f:
        f.write(c)
    print('Updated:', p1)

# 2. src/components/ui/ReciboDigital.jsx
p2 = 'src/components/ui/ReciboDigital.jsx'
if os.path.exists(p2):
    with open(p2, 'r', encoding='utf-8') as f:
        c = f.read()
    if 'Calle Río Fuerte' not in c and 'Calle Rio Fuerte' not in c:
        marker = '<div className="bg-gray-50 rounded-xl p-4 text-center mt-6 border border-gray-100 shadow-sm relative z-10">'
        footer_block = f'''<div className="border-t border-dashed border-gray-200 pt-3 mt-4 text-center">
                        <p className="text-[9px] font-bold text-gray-700">Clínica ALFRA · Cirugía & Medicina Estética</p>
                        <p className="text-[8px] text-gray-500 mt-0.5">{CORRECT_ADDRESS_ACCENT}</p>
                        <p className="text-[8px] text-turquesa font-bold mt-0.5">Citas & WhatsApp: {CORRECT_PHONE_FMT}</p>
                    </div>
                    '''
        c = c.replace(marker, footer_block + marker)
        with open(p2, 'w', encoding='utf-8') as f:
            f.write(c)
        print('Updated:', p2)
    else:
        print('Already updated:', p2)

# 3. src/components/ui/ReciboNomina.jsx
p3 = 'src/components/ui/ReciboNomina.jsx'
if os.path.exists(p3):
    with open(p3, 'r', encoding='utf-8') as f:
        c = f.read()
    new_footer = f'Clínica ALFRA · {CORRECT_ADDRESS_ACCENT} · Tel: {CORRECT_PHONE_FMT} · Documento generado electrónicamente · {{new Date().getFullYear()}}'
    c = re.sub(r'Cl[ií]nica ALFRA.*?Documento generado electr[oó]nicamente.*?\{new Date\(\)\.getFullYear\(\)\}', new_footer, c)
    with open(p3, 'w', encoding='utf-8') as f:
        f.write(c)
    print('Updated:', p3)

# 4. src/pages/admin/CorteCajaGlobal.jsx
p4 = 'src/pages/admin/CorteCajaGlobal.jsx'
if os.path.exists(p4):
    with open(p4, 'r', encoding='utf-8') as f:
        c = f.read()
    if '753 538 6018' not in c:
        old_pdf_foot = "pdf.text('Documento generado automaticamente por el sistema ALFRA • Uso interno y confidencial', margin, 287);"
        new_pdf_foot = f"pdf.text('Clínica ALFRA • {CORRECT_ADDRESS_ACCENT} • Tel: {CORRECT_PHONE_FMT}', margin, 287);\n            pdf.text('Documento generado automaticamente por el sistema ALFRA • Uso interno y confidencial', margin, 291);"
        if old_pdf_foot in c:
            c = c.replace(old_pdf_foot, new_pdf_foot)
            with open(p4, 'w', encoding='utf-8') as f:
                f.write(c)
            print('Updated:', p4)

# 5. src/services/reportesPdfGenerator.js
p5 = 'src/services/reportesPdfGenerator.js'
if os.path.exists(p5):
    with open(p5, 'r', encoding='utf-8') as f:
        c = f.read()
    if '753 538 6018' not in c:
        old_rep_head = "doc.text('CLÍNICA ALFRA • DIRECCIÓN Y ADMINISTRACIÓN', leftTextX, y + 9.5);"
        new_rep_head = f"doc.text('CLÍNICA ALFRA • DIRECCIÓN Y ADMINISTRACIÓN', leftTextX, y + 9.5);\n    doc.setFontSize(7);\n    doc.text('{CORRECT_ADDRESS_ACCENT} | Tel: {CORRECT_PHONE_FMT}', leftTextX, y + 13.5);"
        if old_rep_head in c:
            c = c.replace(old_rep_head, new_rep_head)
            with open(p5, 'w', encoding='utf-8') as f:
                f.write(c)
            print('Updated:', p5)

# 6. scripts/manual_data_common.py
p6 = 'scripts/manual_data_common.py'
if os.path.exists(p6):
    with open(p6, 'r', encoding='utf-8') as f:
        c = f.read()
    old_cover_foot = 'Plataforma Integrada v1.5.0 (AAB Compilación 103)'
    new_cover_foot = f'{CORRECT_ADDRESS_ACCENT}<br>Citas & WhatsApp: <strong>{CORRECT_PHONE_FMT}</strong> • Plataforma Digital ALFRA v1.5.2 (Build 105)'
    if old_cover_foot in c:
        c = c.replace(old_cover_foot, new_cover_foot)
    
    old_doc_foot = 'Clínica ALFRA © 2026 • Documento Oficial Confidencial'
    new_doc_foot = f'Clínica ALFRA • {CORRECT_ADDRESS_ACCENT} • Tel: {CORRECT_PHONE_FMT}'
    if old_doc_foot in c:
        c = c.replace(old_doc_foot, new_doc_foot)
        
    with open(p6, 'w', encoding='utf-8') as f:
        f.write(c)
    print('Updated:', p6)

# 7. scripts/gen_manual_01_admin.py
p7 = 'scripts/gen_manual_01_admin.py'
if os.path.exists(p7):
    with open(p7, 'r', encoding='utf-8') as f:
        c = f.read()
    c = c.replace('(81) 1234-5678', CORRECT_PHONE_FMT)
    with open(p7, 'w', encoding='utf-8') as f:
        f.write(c)
    print('Updated:', p7)

# 8. scripts/gen_manual_05_paciente.py
p8 = 'scripts/gen_manual_05_paciente.py'
if os.path.exists(p8):
    with open(p8, 'r', encoding='utf-8') as f:
        c = f.read()
    c = c.replace('(81) 1234-5678', CORRECT_PHONE_FMT)
    c = c.replace('Citas & Concierge: 753 538 6018 • clinica-alfra.web.app', f'{CORRECT_ADDRESS_ACCENT} • Citas & WhatsApp: {CORRECT_PHONE_FMT}')
    with open(p8, 'w', encoding='utf-8') as f:
        f.write(c)
    print('Updated:', p8)

# 9. scripts/gen_manual_06_maestro.py
p9 = 'scripts/gen_manual_06_maestro.py'
if os.path.exists(p9):
    with open(p9, 'r', encoding='utf-8') as f:
        c = f.read()
    c = c.replace('(81) 1234-5678', CORRECT_PHONE_FMT)
    c = c.replace('<strong>WhatsApp de Emergencia:</strong> 753 538 6018<br>', f'<strong>WhatsApp de Emergencia / Citas:</strong> {CORRECT_PHONE_FMT}<br><strong>Dirección:</strong> {CORRECT_ADDRESS_ACCENT}<br>')
    with open(p9, 'w', encoding='utf-8') as f:
        f.write(c)
    print('Updated:', p9)

# 10. Normalizar en CalendarioCitas, SupervisionAgenda, whatsappService
for p in ['src/pages/recepcion/CalendarioCitas.jsx', 'src/pages/admin/SupervisionAgenda.jsx', 'src/services/whatsappService.js']:
    if os.path.exists(p):
        with open(p, 'r', encoding='utf-8') as f:
            c = f.read()
        c = c.replace('Lomas de Bella Vista', 'Lomas de Bellavista')
        with open(p, 'w', encoding='utf-8') as f:
            f.write(c)
        print('Updated:', p)

print("Patching completed successfully.")
