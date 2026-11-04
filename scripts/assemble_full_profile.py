# -*- coding: utf-8 -*-
import sys
import os

sys.stdout.reconfigure(encoding='utf-8')

print("1. Loading base components...")
with open("scripts/part_header.txt", "r", encoding="utf-8") as f:
    header = f.read().strip()

with open("src/pages/paciente/PacienteProfile.backup.jsx", "r", encoding="utf-8") as f:
    orig = f.read()

s_ali = orig.find("const ALIMENTOS_CATALOGO = [")
e_ali = orig.find("];\n\nexport default function PacienteProfile()")
alimentos_block = orig[s_ali:e_ali + 2]

s_leal = orig.find("{/* Tarjeta de Lealtad - foto llena todo el recuadro */}")
e_leal = orig.find("{/* Plan de Cuidados en Casa (Interactivo) */}")
lealtad_block = orig[s_leal:e_leal].strip()

s_mem = orig.find("{/* MEMBRESIA CON FLIP CARD */}")
e_mem = orig.find("{/* CONFIG */}")
membresia_block = orig[s_mem:e_mem].strip()

with open("scripts/part_comp_body.txt", "r", encoding="utf-8") as f:
    body = f.read().strip()

with open("scripts/part_jsx.txt", "r", encoding="utf-8") as f:
    orig_lines = f.readlines()

print("2. Loading new JSX chunks...")
with open("scripts/jsx_hero_tabs.txt", "r", encoding="utf-8") as f:
    jsx_hero_tabs = f.read().strip()

with open("scripts/jsx_resumen.txt", "r", encoding="utf-8") as f:
    jsx_resumen = f.read().strip()

with open("scripts/jsx_expediente_chart.txt", "r", encoding="utf-8") as f:
    jsx_expediente_chart = f.read().strip()

print("3. Rearranging tabs & Roadmap...")
roadmap_block = "".join(orig_lines[100:175]).strip()

miprogreso_lines = orig_lines[461:643]
title_end_idx = 6
miprogreso_full = "".join(miprogreso_lines[:title_end_idx]) + "\n" + roadmap_block + "\n" + "".join(miprogreso_lines[title_end_idx:])

citas_block = "".join(orig_lines[643:689])

expediente_lines = orig_lines[689:825]
expediente_str = "".join(expediente_lines)
search_pos = expediente_str.find('<div className="relative mb-')
if search_pos != -1:
    expediente_str = expediente_str[:search_pos] + "\n" + jsx_expediente_chart + "\n" + expediente_str[search_pos:]
    print("Inserted Calorie chart into Estilo de Vida.")

pagos_block = "".join(orig_lines[825:875])

config_and_modales = "".join(orig_lines[876:])

full_jsx = (
    jsx_hero_tabs + "\n\n" +
    jsx_resumen + "\n\n" +
    miprogreso_full + "\n\n" +
    citas_block + "\n\n" +
    expediente_str + "\n\n" +
    pagos_block + "\n\n" +
    "{/* PLACEHOLDER_MEMBRESIA_BLOCK */}\n\n" +
    config_and_modales
)

print("4. Replacing placeholders for Loyalty and Membership cards...")
full_jsx = full_jsx.replace("{/* PLACEHOLDER_LEALTAD_BLOCK */}", lealtad_block)
full_jsx = full_jsx.replace("{/* PLACEHOLDER_MEMBRESIA_BLOCK */}", membresia_block)

full_content = header + "\n\n" + alimentos_block + "\n\n" + body + "\n\n" + full_jsx

out_path = "src/pages/paciente/PacienteProfile.jsx"
with open(out_path, "w", encoding="utf-8") as f:
    f.write(full_content)

print(f"5. Successfully written {out_path}! Total length: {len(full_content)} chars.")