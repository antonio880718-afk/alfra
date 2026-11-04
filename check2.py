# -*- coding: utf-8 -*-
with open('src/pages/admin/AdminDashboard.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

if "detalleModal === 'ingreso_semanal_real' ? 'bg-turquesa'" in content:
    print("YES! Target 1 was replaced")
else:
    print("NO! Target 1 was NOT replaced")

if "onClick={() => setDetalleModal('agenda_'" in content:
    print("YES! Agenda onClick is there")
else:
    print("NO! Agenda onClick is NOT there")
