const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const DIAS_SEMANA = [
  'Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'
];

/**
 * Parsea una fecha de cumpleaños en formato YYYY-MM-DD, DD/MM/YYYY o ISO
 */
export function parsearFechaNacimiento(fechaStr) {
  if (!fechaStr) return null;
  const s = String(fechaStr).trim();

  // YYYY-MM-DD o YYYY/MM/DD
  const mYMD = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
  if (mYMD) {
    return { anio: parseInt(mYMD[1], 10), mes: parseInt(mYMD[2], 10) - 1, dia: parseInt(mYMD[3], 10) };
  }

  // DD-MM-YYYY o DD/MM/YYYY
  const mDMY = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
  if (mDMY) {
    return { dia: parseInt(mDMY[1], 10), mes: parseInt(mDMY[2], 10) - 1, anio: parseInt(mDMY[3], 10) };
  }

  try {
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      return { anio: d.getFullYear(), mes: d.getMonth(), dia: d.getDate() };
    }
  } catch (_) {}

  return null;
}

/**
 * Calcula los detalles del próximo cumpleaños del paciente con respecto a hoy
 */
export function calcularDetalleCumpleanos(fechaStr, refDate = new Date()) {
  const parsed = parsearFechaNacimiento(fechaStr);
  if (!parsed || parsed.mes === null || parsed.dia === null) return null;

  const refMidnight = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate());
  const anioRef = refMidnight.getFullYear();

  let proximo = new Date(anioRef, parsed.mes, parsed.dia);
  let diffDias = Math.round((proximo - refMidnight) / (1000 * 60 * 60 * 24));

  // Si ya pasó hace más de 0 días este año, calcular para el próximo año
  if (diffDias < 0) {
    proximo = new Date(anioRef + 1, parsed.mes, parsed.dia);
    diffDias = Math.round((proximo - refMidnight) / (1000 * 60 * 60 * 24));
  }

  const diaSemana = DIAS_SEMANA[proximo.getDay()];
  const nombreMes = MESES[parsed.mes];

  let textoProximidad = '';
  let esHoy = false;
  let esManana = false;

  if (diffDias === 0) {
    textoProximidad = '¡Hoy! 🎉';
    esHoy = true;
  } else if (diffDias === 1) {
    textoProximidad = 'Mañana';
    esManana = true;
  } else if (diffDias === 2) {
    textoProximidad = 'Pasado mañana';
  } else {
    textoProximidad = `En ${diffDias} días`;
  }

  const textoFechaExacta = `${diaSemana} ${parsed.dia} de ${nombreMes}`;
  const edadCumple = parsed.anio ? (proximo.getFullYear() - parsed.anio) : null;

  return {
    dia: parsed.dia,
    mes: parsed.mes,
    anio: parsed.anio,
    diasFaltantes: diffDias,
    esHoy,
    esManana,
    textoProximidad,
    textoFechaExacta,
    edadCumple,
    proximaFecha: proximo
  };
}

/**
 * Filtra y ordena los pacientes que cumplen años en los próximos X días (default 30)
 */
export function obtenerProximosCumpleanos(pacientes = [], ventanaDias = 30, refDate = new Date()) {
  if (!Array.isArray(pacientes)) return [];

  const resultado = [];

  for (const p of pacientes) {
    const fecha = p.fechaNacimiento || p.cumpleanos || p.fechaNac || '';
    if (!fecha) continue;

    const detalle = calcularDetalleCumpleanos(fecha, refDate);
    if (!detalle) continue;

    if (detalle.diasFaltantes <= ventanaDias) {
      resultado.push({
        ...p,
        detalleCumple: detalle
      });
    }
  }

  resultado.sort((a, b) => a.detalleCumple.diasFaltantes - b.detalleCumple.diasFaltantes);

  return resultado;
}