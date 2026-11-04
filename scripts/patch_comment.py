with open("src/pages/paciente/PacienteProfile.jsx", "r", encoding="utf-8") as f:
    c = f.read()

c = c.replace('ZERO "receta", ZERO "doctora"', '100% PERSONALIZADAS')
with open("src/pages/paciente/PacienteProfile.jsx", "w", encoding="utf-8") as f:
    f.write(c)

with open("scripts/jsx_resumen.txt", "r", encoding="utf-8") as f:
    r = f.read()

r = r.replace('ZERO "receta", ZERO "doctora"', '100% PERSONALIZADAS')
with open("scripts/jsx_resumen.txt", "w", encoding="utf-8") as f:
    f.write(r)
print("Patched comment!")