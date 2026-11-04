with open("src/pages/paciente/PacienteProfile.jsx", "r", encoding="utf-8") as f:
    code = f.read()

# Fix speak calls
code = code.replace(
    "speak(Entrenamiento de  iniciado. Mantn tu ritmo.);",
    "speak('Entrenamiento de ' + tipo + ' iniciado. Mantn tu ritmo.');"
)
code = code.replace(
    "speak(Entrenamiento de  iniciado. Mantén tu ritmo.);",
    "speak('Entrenamiento de ' + tipo + ' iniciado. Mantén tu ritmo.');"
)
code = code.replace(
    "speak(Sesin completada. Recorriste  kilmetros y quemaste aproximadamente  caloras.);",
    "speak('Sesin completada. Recorriste ' + (finalMeters / 1000).toFixed(2) + ' kilmetros y quemaste aproximadamente ' + calQuemadas + ' caloras.');"
)
code = code.replace(
    "speak(Sesión completada. Recorriste  kilómetros y quemaste aproximadamente  calorías.);",
    "speak('Sesión completada. Recorriste ' + (finalMeters / 1000).toFixed(2) + ' kilómetros y quemaste aproximadamente ' + calQuemadas + ' calorías.');"
)

with open("src/pages/paciente/PacienteProfile.jsx", "w", encoding="utf-8") as f:
    f.write(code)

with open("scripts/part_comp_body.txt", "r", encoding="utf-8") as f:
    b = f.read()

b = b.replace(
    "speak(Entrenamiento de  iniciado. Mantn tu ritmo.);",
    "speak('Entrenamiento de ' + tipo + ' iniciado. Mantn tu ritmo.');"
)
b = b.replace(
    "speak(Entrenamiento de  iniciado. Mantén tu ritmo.);",
    "speak('Entrenamiento de ' + tipo + ' iniciado. Mantén tu ritmo.');"
)
b = b.replace(
    "speak(Sesin completada. Recorriste  kilmetros y quemaste aproximadamente  caloras.);",
    "speak('Sesin completada. Recorriste ' + (finalMeters / 1000).toFixed(2) + ' kilmetros y quemaste aproximadamente ' + calQuemadas + ' caloras.');"
)
b = b.replace(
    "speak(Sesión completada. Recorriste  kilómetros y quemaste aproximadamente  calorías.);",
    "speak('Sesión completada. Recorriste ' + (finalMeters / 1000).toFixed(2) + ' kilómetros y quemaste aproximadamente ' + calQuemadas + ' calorías.');"
)

with open("scripts/part_comp_body.txt", "w", encoding="utf-8") as f:
    f.write(b)

print("Fixed speak strings!")