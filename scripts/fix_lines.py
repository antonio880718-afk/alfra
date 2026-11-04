with open("src/pages/paciente/PacienteProfile.jsx", "r", encoding="utf-8") as f:
    code = f.read()

code = code.replace(
    "return hrs > 0 ? ${hrs}:: : ${m}:;",
    "return hrs > 0 ? (hrs + ':' + m + ':' + s) : (m + ':' + s);"
)
code = code.replace(
    "const label = ${diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1)} ;",
    "const label = (diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1)) + ' ' + diaNum;"
)

with open("src/pages/paciente/PacienteProfile.jsx", "w", encoding="utf-8") as f:
    f.write(code)

with open("scripts/part_comp_body.txt", "r", encoding="utf-8") as f:
    b = f.read()

b = b.replace(
    "return hrs > 0 ? ${hrs}:: : ${m}:;",
    "return hrs > 0 ? (hrs + ':' + m + ':' + s) : (m + ':' + s);"
)
b = b.replace(
    "const label = ${diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1)} ;",
    "const label = (diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1)) + ' ' + diaNum;"
)

with open("scripts/part_comp_body.txt", "w", encoding="utf-8") as f:
    f.write(b)

print("Fixed lines 1350 and 1432!")