# -*- coding: utf-8 -*-
with open('src/pages/paciente/PacienteProfile.backup.jsx', 'r', encoding='utf-8') as f:
    orig = f.read()

# 1. Alimentos
start_ali = orig.find('const ALIMENTOS_CATALOGO = [')
end_ali = orig.find('];\n\nexport default function PacienteProfile()')
alimentos = orig[start_ali:end_ali + 2]

# 2. Lealtad
start_leal = orig.find('{/* Tarjeta de Lealtad - foto llena todo el recuadro */}')
end_leal = orig.find('{/* Plan de Cuidados en Casa (Interactivo) */}')
lealtad = orig[start_leal:end_leal]

# 3. Membresia
start_mem = orig.find('{/* MEMBRESIA CON FLIP CARD */}')
end_mem = orig.find('{/* CONFIG */}')
membresia = orig[start_mem:end_mem]

print(f'Alimentos len: {len(alimentos)}, Lealtad len: {len(lealtad)}, Membresia len: {len(membresia)}')
