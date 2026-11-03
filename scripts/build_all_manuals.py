# -*- coding: utf-8 -*-
import subprocess
import os

scripts = [
    "gen_manual_01_admin.py",
    "gen_manual_02_recepcion.py",
    "gen_manual_03_medico.py",
    "gen_manual_04_limpieza.py",
    "gen_manual_05_paciente.py",
    "gen_manual_06_maestro.py"
]

base_dir = os.path.dirname(os.path.abspath(__file__))
print("=== COMPILACIÓN MAESTRA DE TODOS LOS MANUALES ALFRA ===")
for s in scripts:
    script_path = os.path.join(base_dir, s)
    print(f"Ejecutando {s}...")
    subprocess.run(["python", script_path], check=True)
print("=== TODOS LOS MANUALES COMPILADOS EXITOSAMENTE ===")