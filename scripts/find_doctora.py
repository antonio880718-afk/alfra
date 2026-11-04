with open("src/pages/paciente/PacienteProfile.jsx", "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, l in enumerate(lines):
    if "doctora" in l.lower() or "receta" in l.lower():
        print(f"Line {i+1}: {l.strip()}")