# -*- coding: utf-8 -*-
import sys

with open('src/pages/paciente/PacienteProfile.backup.jsx', 'r', encoding='utf-8') as f:
    orig = f.read()

start_ali = orig.find('const ALIMENTOS_CATALOGO = [')
end_ali = orig.find('];\n\nexport default function PacienteProfile()')
alimentos_block = orig[start_ali:end_ali + 2]

start_leal = orig.find('{/* Tarjeta de Lealtad - foto llena todo el recuadro */}')
end_leal = orig.find('{/* Plan de Cuidados en Casa (Interactivo) */}')
lealtad_block = orig[start_leal:end_leal]

start_mem = orig.find('{/* MEMBRESIA CON FLIP CARD */}')
end_mem = orig.find('{/* CONFIG */}')
membresia_block = orig[start_mem:end_mem]

print('Blocks ready')
