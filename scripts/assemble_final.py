# -*- coding: utf-8 -*-
import sys

print("Reading backup and parts...")
with open("src/pages/paciente/PacienteProfile.backup.jsx", "r", encoding="utf-8") as f:
    orig = f.read()

start_ali = orig.find("const ALIMENTOS_CATALOGO = [")
end_ali = orig.find("];\n\nexport default function PacienteProfile()")
alimentos_block = orig[start_ali:end_ali + 2]

start_leal = orig.find("{/* Tarjeta de Lealtad - foto llena todo el recuadro */}")
end_leal = orig.find("{/* Plan de Cuidados en Casa (Interactivo) */}")
lealtad_block = orig[start_leal:end_leal]

start_mem = orig.find("{/* MEMBRESIA CON FLIP CARD */}")
end_mem = orig.find("{/* CONFIG */}")
membresia_block = orig[start_mem:end_mem]

with open("scripts/part_header.txt", "r", encoding="utf-8") as f:
    part_header = f.read()

with open("scripts/part_comp_body.txt", "r", encoding="utf-8") as f:
    part_body = f.read()

with open("scripts/part_jsx.txt", "r", encoding="utf-8") as f:
    part_jsx = f.read()

# Replace placeholders
part_jsx = part_jsx.replace("{/* PLACEHOLDER_LEALTAD_BLOCK */}", lealtad_block)
part_jsx = part_jsx.replace("{/* PLACEHOLDER_MEMBRESIA_BLOCK */}", membresia_block)

full_content = part_header + "\n" + alimentos_block + "\n\n" + part_body + "\n\n" + part_jsx

with open("src/pages/paciente/PacienteProfile.jsx", "w", encoding="utf-8") as f:
    f.write(full_content)

print(f"Successfully assembled PacienteProfile.jsx! Total characters: {len(full_content)}")
