# -*- coding: utf-8 -*-
import sys

sys.stdout.reconfigure(encoding='utf-8')

with open("src/pages/paciente/PacienteProfile.jsx", "r", encoding="utf-8") as f:
    code = f.read()

# 1. Target the old META_CALORIAS block
target_old_meta = """  const META_CALORIAS = useMemo(() => {
    let meta = parseInt(perfilPaciente?.metaCalorica);
    if (tratamientoActivo && sesionesPorTrat[tratamientoActivo.id]) {
      const sesiones = sesionesPorTrat[tratamientoActivo.id];
      if (sesiones.length > 0) {
        const ultimaSesion = sesiones[sesiones.length - 1];
        if (ultimaSesion.metasPaciente?.metaCalorica) {
            meta = parseInt(ultimaSesion.metasPaciente.metaCalorica);
        }
      }
    }
    return meta || 1500;
  }, [perfilPaciente, tratamientoActivo, sesionesPorTrat]);"""

new_metabolic_engine = """  // ==================== ALGORITMO METABÓLICO CLÍNICO CIENTÍFICO (MIFFLIN-ST JEOR + ALFRA) ====================
  const diagnosticoMetabolico = useMemo(() => {
    // 1. Obtener peso actual (última sesión clínica o perfil)
    let peso = 65;
    if (tratamientoActivo && sesionesPorTrat[tratamientoActivo.id]?.length > 0) {
      const sesiones = sesionesPorTrat[tratamientoActivo.id];
      const sUltima = sesiones[sesiones.length - 1];
      if (sUltima?.medidas?.peso) peso = parseFloat(sUltima.medidas.peso) || 65;
    } else if (perfilPaciente?.peso) {
      peso = parseFloat(perfilPaciente.peso) || 65;
    } else if (progresoData?.length > 0 && progresoData[0]?.peso) {
      peso = parseFloat(progresoData[0].peso) || 65;
    }

    // 2. Obtener estatura
    let estatura = 162;
    if (tratamientoActivo && sesionesPorTrat[tratamientoActivo.id]?.length > 0) {
      const sesiones = sesionesPorTrat[tratamientoActivo.id];
      const sUltima = sesiones[sesiones.length - 1];
      if (sUltima?.medidas?.estatura) estatura = parseFloat(sUltima.medidas.estatura) || 162;
    } else if (perfilPaciente?.estatura) {
      estatura = parseFloat(perfilPaciente.estatura) || 162;
    }

    // 3. Obtener edad
    let edad = 32;
    if (perfilPaciente?.fechaNacimiento) {
      const dNac = new Date(perfilPaciente.fechaNacimiento);
      if (!isNaN(dNac.getTime())) {
        const diffMs = Date.now() - dNac.getTime();
        edad = Math.max(18, Math.min(80, Math.floor(diffMs / (365.25 * 24 * 3600 * 1000))));
      }
    } else if (perfilPaciente?.edad) {
      edad = parseInt(perfilPaciente.edad) || 32;
    }

    // 4. Género
    const genero = (perfilPaciente?.genero || perfilPaciente?.sexo || 'Femenino').toLowerCase();
    const esMasculino = genero.startsWith('m') || genero.startsWith('h');

    // 5. Tasa Metabólica Basal (Ecuación Mifflin-St Jeor)
    let tmb = (10 * peso) + (6.25 * estatura) - (5 * edad);
    tmb = esMasculino ? (tmb + 5) : (tmb - 161);
    tmb = Math.round(tmb);

    // 6. Factor de Actividad Física (PAL)
    let factorActividad = 1.375;
    let nivelActividadTexto = "Actividad Ligera (1-3 días)";
    const sesionesEjercicioSemanales = (historialEjercicio || []).filter(e => {
      const d = new Date(e.fecha);
      return (Date.now() - d.getTime()) <= (7 * 24 * 3600 * 1000);
    }).length;

    if (isTracking || sesionesEjercicioSemanales >= 4) {
      factorActividad = 1.55;
      nivelActividadTexto = "Moderada (3-5 días activos)";
    } else if (sesionesEjercicioSemanales === 0 && !isTracking) {
      factorActividad = 1.2;
      nivelActividadTexto = "Sedentaria / Oficina";
    }

    const tdee = Math.round(tmb * factorActividad);

    // 7. Ajuste según objetivo estético del tratamiento activo
    const tipoTrat = (perfilPaciente?.tipoTratamiento || tratamientoActivo?.tipo || tratamientoActivo?.nombre || 'Mixto').toLowerCase();
    let deficitKcal = -350;
    let objetivoClinico = "Reducción Grasa & Lipólisis";
    let razonClinica = "Déficit moderado controlado (18-20%) para metabolizar la grasa liberada por aparatología sin comprometer la masa magra ni inducir flacidez.";

    if (tipoTrat.includes('reafirm') || tipoTrat.includes('tensado') || tipoTrat.includes('radiofrecuencia')) {
      deficitKcal = 0;
      objetivoClinico = "Reafirmación & Neocolagénesis";
      razonClinica = "Dieta normocalórica (100% de tu gasto) enfocada en síntesis de colágeno, elastina y tonificación del tejido conectivo.";
    } else if (tipoTrat.includes('celulitis') || tipoTrat.includes('anticelul') || tipoTrat.includes('drenaje')) {
      deficitKcal = -200;
      objetivoClinico = "Drenaje Linfático & Celulitis";
      razonClinica = "Déficit suave con balance mineral enfocado en desinflamación intersticial, desintoxicación celular y eliminación de edema.";
    } else if (tipoTrat.includes('facial')) {
      deficitKcal = 0;
      objetivoClinico = "Nutrición & Regeneración Dérmica";
      razonClinica = "Aporte isocalórico antioxidante para nutrir la dermis profunda y maximizar la hidratación del estrato córneo.";
    }

    // Piso biológico de seguridad
    const pisoSeguridad = esMasculino ? 1500 : 1200;
    const metaAlgoritmo = Math.max(pisoSeguridad, Math.min(3200, tdee + deficitKcal));

    // 8. Chequeo de Override de Especialista
    let metaFinal = metaAlgoritmo;
    let esPrescripcionManual = false;

    if (tratamientoActivo && sesionesPorTrat[tratamientoActivo.id]?.length > 0) {
      const sesiones = sesionesPorTrat[tratamientoActivo.id];
      const sUltima = sesiones[sesiones.length - 1];
      if (sUltima?.metasPaciente?.metaCalorica) {
        metaFinal = parseInt(sUltima.metasPaciente.metaCalorica) || metaAlgoritmo;
        esPrescripcionManual = true;
      }
    } else if (perfilPaciente?.metaCalorica) {
      metaFinal = parseInt(perfilPaciente.metaCalorica) || metaAlgoritmo;
      esPrescripcionManual = true;
    }

    // 9. Macronutrientes Científicos:
    // Proteína 1.6 g/kg (estándar clínico antiflacidez)
    const gramosProteina = Math.round(peso * 1.6);
    const kcalProteina = gramosProteina * 4;

    // Grasas saludables: 25% del total
    const kcalGrasas = Math.round(metaFinal * 0.25);
    const gramosGrasas = Math.round(kcalGrasas / 9);

    // Carbohidratos complejos: El restante
    const kcalCarbs = Math.max(0, metaFinal - (kcalProteina + kcalGrasas));
    const gramosCarbs = Math.round(kcalCarbs / 4);

    return {
      peso,
      estatura,
      edad,
      genero: esMasculino ? 'Masculino' : 'Femenino',
      tmb,
      tdee,
      factorActividad,
      nivelActividadTexto,
      deficitKcal,
      objetivoClinico,
      razonClinica,
      metaFinal,
      esPrescripcionManual,
      macros: {
        proteina: { gramos: gramosProteina, kcal: kcalProteina, pct: Math.round((kcalProteina / metaFinal) * 100) },
        grasas: { gramos: gramosGrasas, kcal: kcalGrasas, pct: Math.round((kcalGrasas / metaFinal) * 100) },
        carbs: { gramos: gramosCarbs, kcal: kcalCarbs, pct: Math.round((kcalCarbs / metaFinal) * 100) }
      }
    };
  }, [perfilPaciente, tratamientoActivo, sesionesPorTrat, progresoData, historialEjercicio, isTracking]);

  const META_CALORIAS = diagnosticoMetabolico.metaFinal;

  // Macros consumidos estimados hoy
  const macrosHoy = useMemo(() => {
    const totalCal = alimentosHoy.reduce((s, a) => s + (a.calorias || 0), 0);
    // Estimación equilibrada a partir del diario
    const protG = Math.round((totalCal * 0.25) / 4);
    const grasasG = Math.round((totalCal * 0.25) / 9);
    const carbsG = Math.round((totalCal * 0.50) / 4);
    return { proteina: protG, grasas: grasasG, carbs: carbsG };
  }, [alimentosHoy]);"""

if target_old_meta in code:
    code = code.replace(target_old_meta, new_metabolic_engine)
    print("Replaced META_CALORIAS with full scientific metabolic engine!")
else:
    print("WARNING: target_old_meta not found exactly!")

with open("src/pages/paciente/PacienteProfile.jsx", "w", encoding="utf-8") as f:
    f.write(code)

print("Saved PacienteProfile.jsx with metabolic engine logic.")