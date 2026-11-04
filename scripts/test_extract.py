# -*- coding: utf-8 -*-
import sys

print("Reading backup file...")
with open("src/pages/paciente/PacienteProfile.backup.jsx", "r", encoding="utf-8") as f:
    orig = f.read()

# 1. Alimentos
start_ali = orig.find("const ALIMENTOS_CATALOGO = [")
end_ali = orig.find("];\n\nexport default function PacienteProfile()")
if start_ali == -1 or end_ali == -1:
    print("Error: ALIMENTOS_CATALOGO not found")
    sys.exit(1)
alimentos_block = orig[start_ali:end_ali + 2]

# 2. Lealtad
start_leal = orig.find("{/* Tarjeta de Lealtad - foto llena todo el recuadro */}")
end_leal = orig.find("{/* Plan de Cuidados en Casa (Interactivo) */}")
if start_leal == -1 or end_leal == -1:
    print("Error: Lealtad not found")
    sys.exit(1)
lealtad_block = orig[start_leal:end_leal]

# 3. Membresia
start_mem = orig.find("{/* MEMBRESIA CON FLIP CARD */}")
end_mem = orig.find("{/* CONFIG */}")
if start_mem == -1 or end_mem == -1:
    print("Error: Membresia not found")
    sys.exit(1)
membresia_block = orig[start_mem:end_mem]

print("Extracted all 3 key blocks successfully!")
