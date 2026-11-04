# -*- coding: utf-8 -*-
import re

# 1. Fix citasService.js duplicate
with open('src/services/citasService.js', 'r', encoding='utf-8') as f:
    c = f.read()

dup = """// Descartar alertas pendientes vinculadas a una cita que ya fue atendida o completada
export const descartarAlertasPorCita = async (citaId) => {
    if (!citaId) return;
    try {
        const alertsCol = collection(db, 'alertas_pacientes');
        const q = query(alertsCol, where('citaId', '==', citaId), where('estado', '==', 'pendiente'));
        const snap = await getDocs(q);
        const updates = snap.docs.map(d => updateDoc(d.ref, { estado: 'completado', completadoAt: serverTimestamp() }));
        await Promise.all(updates);
    } catch (e) {
        console.warn('Error al descartar alertas por cita:', e);
    }
};

"""
if c.count(dup) > 1:
    c = c.replace(dup, '', 1)
    with open('src/services/citasService.js', 'w', encoding='utf-8') as f:
        f.write(c)
    print('Fixed citasService duplicate')

# 2. Fix ContabilidadView.jsx UTF-8
p = 'src/pages/admin/ContabilidadView.jsx'
with open(p, 'r', encoding='utf-8') as f:
    c = f.read()
c = re.sub(r'docPdf\.text\(.*?Tel: 753 538 6018.*?\);', "docPdf.text('Clínica ALFRA • Calle Río Fuerte #26, Col. Lomas de Bellavista, Lázaro Cárdenas, Michoacán • Tel: 753 538 6018', 14, 21);", c)
with open(p, 'w', encoding='utf-8') as f:
    f.write(c)
print('Fixed ContabilidadView UTF-8')

# 3. Fix CorteCajaGlobal.jsx UTF-8
p = 'src/pages/admin/CorteCajaGlobal.jsx'
with open(p, 'r', encoding='utf-8') as f:
    c = f.read()
c = re.sub(r'pdf\.text\(.*?Tel: 753 538 6018.*?\);', "pdf.text('Clínica ALFRA • Calle Río Fuerte #26, Col. Lomas de Bellavista, Lázaro Cárdenas, Michoacán • Tel: 753 538 6018', margin, pageH - 10);", c)
with open(p, 'w', encoding='utf-8') as f:
    f.write(c)
print('Fixed CorteCajaGlobal UTF-8')
