with open("src/pages/paciente/PacienteProfile.jsx", "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, l in enumerate(lines):
    if "speak(" in l:
        print(f"Line {i+1}: {repr(l.strip())}")