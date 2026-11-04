# -*- coding: utf-8 -*-
import sys
import os

sys.stdout.reconfigure(encoding='utf-8')

print('Reading input components...')
with open('scripts/part_header.txt', 'r', encoding='utf-8') as f:
    header = f.read().strip()

with open('src/pages/paciente/PacienteProfile.backup.jsx', 'r', encoding='utf-8') as f:
    orig = f.read()

s_ali = orig.find('const ALIMENTOS_CATALOGO = [')
e_ali = orig.find('];\n\nexport default function PacienteProfile()')
alimentos_block = orig[s_ali:e_ali + 2]

s_leal = orig.find('{/* Tarjeta de Lealtad - foto llena todo el recuadro */}')
e_leal = orig.find('{/* Plan de Cuidados en Casa (Interactivo) */}')
lealtad_block = orig[s_leal:e_leal].strip()

s_mem = orig.find('{/* MEMBRESIA CON FLIP CARD */}')
e_mem = orig.find('{/* CONFIG */}')
membresia_block = orig[s_mem:e_mem].strip()

with open('scripts/part_comp_body.txt', 'r', encoding='utf-8') as f:
    body = f.read().strip()

print('Header, Alimentos, Body, Lealtad, Membresia ready.')