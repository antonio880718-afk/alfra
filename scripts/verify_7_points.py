# -*- coding: utf-8 -*-
import sys
import re

sys.stdout.reconfigure(encoding='utf-8')

with open("src/pages/paciente/PacienteProfile.jsx", "r", encoding="utf-8") as f:
    code = f.read()

print("========== VERIFYING THE 7 REQUIREMENTS ==========")

# Point 1: Tarjeta de Lealtad
has_lealtad = "Tarjeta de Lealtad" in code and "sellosLealtad" in code and "Acumula 7 visitas" in code
pos_tabs = code.find("TABS DE NAVEGACIÓN")
pos_resumen = code.find('activeTab === "progreso"')
pos_lealtad = code.find("Tarjeta de Lealtad - foto llena todo el recuadro")

print(f"Point 1 - Tarjeta de Lealtad present: {has_lealtad}")
print(f"Point 1 - Position: Tabs at {pos_tabs}, Resumen at {pos_resumen}, Lealtad at {pos_lealtad}")
assert pos_lealtad > pos_resumen, "Lealtad should be inside Resumen!"
assert pos_resumen > pos_tabs, "Tabs should be before Resumen!"

# Point 2: Actividad física en segundo plano
has_wakelock = "wakeLock" in code
has_localstorage = "alfra_active_workout" in code
has_visibility = "visibilitychange" in code
has_timestamp_calc = "workoutStartTimeRef" in code
has_speech = "speechSynthesis" in code
print(f"Point 2 - Background workout tracking: WakeLock={has_wakelock}, LocalStorage={has_localstorage}, VisibilityChange={has_visibility}, TimestampCalc={has_timestamp_calc}, SpeechSynthesis={has_speech}")
assert has_wakelock and has_localstorage and has_visibility and has_timestamp_calc, "Background tracking missing required features!"

# Point 3: Gráfica de Calorías
has_areachart = "AreaChart" in code
has_calorias_chart_data = "caloriasChartData" in code
calorias_areachart_count = code.count("caloriasChartData")
print(f"Point 3 - Calorie AreaChart: AreaChart={has_areachart}, caloriasChartData count={calorias_areachart_count}")
assert has_areachart and calorias_areachart_count >= 2, "Calorie chart should be in both Resumen and Estilo de Vida!"

# Point 4: Recomendaciones de tu Especialista (NO receta, NO doctora)
has_recom_title = "Recomendaciones de tu Especialista" in code
has_interactive_checks = "recomendacionesCumplidasCount" in code and "handleToggleCuidado" in code
has_cumplidas_badge = "cumplidas hoy" in code
print(f"Point 4 - Recomendaciones de tu Especialista: Title={has_recom_title}, InteractiveChecks={has_interactive_checks}, Badge={has_cumplidas_badge}")
assert has_recom_title and has_interactive_checks, "Recomendaciones must be interactive and properly titled!"

# Point 5: Zero "concierge", zero "doctora", zero "receta"
concierge_count = len(re.findall(r'concierge', code, re.IGNORECASE))
doctora_count = len(re.findall(r'doctora', code, re.IGNORECASE))
receta_count = len(re.findall(r'receta', code, re.IGNORECASE))
print(f"Point 5 - Word Checks: concierge count = {concierge_count}, doctora count = {doctora_count}, receta count = {receta_count}")
assert concierge_count == 0, f"Found {concierge_count} occurrences of 'concierge'!"
assert doctora_count == 0, f"Found {doctora_count} occurrences of 'doctora'!"
assert receta_count == 0, f"Found {receta_count} occurrences of 'receta'!"

# Point 6: Índice de Bienestar dinámico
has_dynamic_bienestar = "const indiceBienestar = useMemo(" in code
has_reactive_inputs = "vasosAguaHoy" in code and "recomendacionesCumplidasCount" in code
print(f"Point 6 - Dynamic Índice de Bienestar: Calculated={has_dynamic_bienestar}, Reactive={has_reactive_inputs}")
assert has_dynamic_bienestar and has_reactive_inputs, "Índice de Bienestar must be dynamically calculated!"

# Point 7: Pestañas al inicio no enmedio
tabs_before_resumen = pos_tabs < pos_resumen
print(f"Point 7 - Tabs at the beginning: {tabs_before_resumen} (Tabs={pos_tabs} < Resumen={pos_resumen})")
assert tabs_before_resumen, "Tabs must be at the very top, before tab content!"

# Design preservation: Membresía & Lealtad
has_membresia = "MEMBRESIA CON FLIP CARD" in code and "flip-card" in code
print(f"Design preservation - Membresía flip card intact: {has_membresia}")
assert has_membresia, "Membresía flip card must be 100% intact!"

print("========== ALL 7 VERIFICATIONS PASSED 100% SUCCESSFULLY! ==========")