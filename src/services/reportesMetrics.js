/**
 * Motor de métricas de negocio para el módulo de Reportes (Administrador).
 * Incluye desglose de Gastos Fijos (Renta, Luz, Internet, Agua, Otros),
 * Promedio Automático de Nóminas, Bolsas de Provisión (Producto Tratamientos y Equipo)
 * y Plan de Ingresos Mensuales con Meta Diaria de Servicios (No Paquete).
 */
import {
    startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
    startOfYear, endOfYear, subDays, subWeeks, subMonths, subYears,
    addDays, addWeeks, addMonths, addYears,
    differenceInCalendarDays, format, parseISO, eachDayOfInterval, eachMonthOfInterval
} from 'date-fns';
import { es } from 'date-fns/locale';

// ─────────────────────────── Configuración ───────────────────────────

export const DEFAULT_CONFIG = {
    // Gastos fijos mensuales desglosados
    gastoRenta: 0,
    gastoLuz: 0,
    gastoInternet: 0,
    gastoAgua: 0,
    gastoOtrosFijos: 0,
    // Nómina mensual (0 = promedio automático de las nóminas registradas)
    nominaMensualEstimada: 0,
    // Bolsas de provisión mensuales
    provisionProductoMensual: 0,   // 0 = usa promedio automático de compras de insumos
    provisionEquipoMensual: 0,     // ahorro mensual para comprar/renovar equipo
    nombreEquipoMeta: '',          // ej. "Láser Diodo / Hydrafacial"
    costoEquipoMeta: 0,            // meta total del equipo a comprar
    // Utilidad libre deseada y meta mensual
    utilidadDeseadaMensual: 0,
    metaMensual: 0,
    // Compatibilidad previa
    gastosFijosMensuales: 0,
    // Umbrales operativos
    diasRiesgo: 45,
    diasAtrasoPlan: 30,
    horario: {
        0: null,
        1: [9, 19],
        2: [9, 19],
        3: [9, 19],
        4: [9, 19],
        5: [9, 19],
        6: [9, 14],
    },
};

export const ORIGENES_PACIENTE = [
    'Facebook',
    'Instagram',
    'TikTok',
    'Google / Maps',
    'Recomendación de un paciente',
    'Volante / Publicidad impresa',
    'Pasaba por aquí',
    'WhatsApp',
    'Otro',
];

export const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
export const DIAS_SEMANA_LARGO = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export const FUENTES = {
    SERVICIOS: 'Servicios',
    PLANES: 'Planes de tratamiento',
    PRODUCTOS: 'Productos',
    MEMBRESIAS: 'Membresías',
};

// ─────────────────────────── Utilidades ───────────────────────────

export const toDate = (v) => {
    if (!v) return null;
    if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
    if (typeof v.toDate === 'function') return v.toDate();
    if (typeof v === 'object' && typeof v.seconds === 'number') return new Date(v.seconds * 1000);
    if (typeof v === 'string') {
        const d = parseISO(v);
        return isNaN(d.getTime()) ? null : d;
    }
    if (typeof v === 'number') return new Date(v);
    return null;
};

const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};

export const normTxt = (s) => String(s || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');

const pct = (a, b) => (b > 0 ? (a / b) * 100 : 0);
const sumBy = (arr, fn) => arr.reduce((acc, x) => acc + fn(x), 0);
const inRange = (d, s, e) => !!d && d >= s && d <= e;
const round2 = (n) => Math.round(n * 100) / 100;

export const variacion = (actual, anterior) => {
    if (!anterior) return actual ? null : 0;
    return ((actual - anterior) / Math.abs(anterior)) * 100;
};

const titleCase = (s) => String(s || '')
    .trim()
    .toLowerCase()
    .replace(/(^|\s)\S/g, (c) => c.toUpperCase());

const agrupar = (arr, keyFn, valFn = () => 1) => {
    const map = {};
    arr.forEach((x) => {
        const k = keyFn(x);
        if (k === null || k === undefined) return;
        map[k] = (map[k] || 0) + valFn(x);
    });
    return map;
};

const mapToList = (map, total) => Object.entries(map)
    .map(([name, value]) => ({ name, value: round2(value), pct: pct(value, total) }))
    .sort((a, b) => b.value - a.value);

// ─────────────────────────── Clasificadores ───────────────────────────

export const normalizarMetodo = (v) => {
    const t = normTxt(v);
    if (!t) return 'Sin especificar';
    if (t.includes('tarjeta') || t.includes('debito') || t.includes('credito')) return 'Tarjeta';
    if (t.includes('transfer')) return 'Transferencia';
    if (t.includes('efectivo')) return 'Efectivo';
    if (t.includes('historic')) return 'Abono histórico';
    return titleCase(v);
};

export const clasificarIngreso = (m) => {
    const t = normTxt(m.motivo || m.concepto);
    if (m.subTipo === 'abono_tratamiento' || /abono|plan de tratamiento|anticipo|liquidacion/.test(t)) return FUENTES.PLANES;
    if (m.productoId || m.productoNombre) return FUENTES.PRODUCTOS;
    if (/membres/.test(t)) return FUENTES.MEMBRESIAS;
    return FUENTES.SERVICIOS;
};

export const categoriaEgreso = (m) => {
    if (m.staffId || m.folioNomina) return 'Nómina';
    const cat = normTxt(m.categoria);
    const t = normTxt(m.motivo || m.concepto);
    if (cat.includes('nomina') || /nomina|sueldo|pago a /.test(t)) return 'Nómina';
    if (cat.includes('renta') || /renta|alquiler/.test(t)) return 'Renta';
    if (/luz|cfe/.test(t) || cat.includes('luz')) return 'Luz / CFE';
    if (/internet|telmex|izzi|totalplay|telefono/.test(t) || cat.includes('internet')) return 'Internet y Teléfono';
    if (cat === 'agua' || /recibo.*agua|agua potable|pipa/.test(t)) return 'Agua';
    if (cat.includes('limpieza') || /garrafon|limpieza|cloro|papeleria|lavanderia/.test(t)) return 'Limpieza, Higiene y Papelería';
    if (cat.includes('venta') && cat.includes('producto')) return 'Inversión en Producto (Venta)';
    if (cat.includes('insumo') || cat.includes('tratamiento') || /insumo|material|tratamiento|gel|guante|jeringa|ampolleta/.test(t)) return 'Insumos / Producto Tratamientos';
    if (cat.includes('equipo') || /equipo|aparatologia|maquina|mobiliario/.test(t)) return 'Compra de Equipo';
    if (cat.includes('mantenimiento') || /mantenimiento|plomeria|clima|fumigac|rpbi/.test(t)) return 'Mantenimiento e Instalaciones';
    if (cat.includes('marketing') || /marketing|publicidad|flyer/.test(t)) return 'Marketing';
    if (cat.includes('impuesto') || cat.includes('contabilidad') || cat.includes('legal')) return 'Impuestos y Contabilidad';
    if (cat.includes('comida') || /comida|despensa|viatico/.test(t)) return 'Comidas y Viáticos';
    if (m.categoria && String(m.categoria).trim()) return titleCase(m.categoria);
    return 'Otros Fijos';
};

const nombreServicio = (txt) => {
    const limpio = String(txt || '')
        .replace(/\s*[-—–(]?\s*sesi[oó]n\s*#?\d+.*$/i, '')
        .replace(/\s+/g, ' ')
        .trim();
    return limpio || 'Varios';
};

export const esServicioPaquete = (s) => {
    if (!s) return false;
    if (typeof s.esPaquete === 'boolean') return s.esPaquete;
    if (s.tipo === 'Paquete / Plan Tratamiento') return true;
    const n = String(s.nombre || '').toLowerCase();
    return /\(\s*paq|\bpaquete\b|efecto lipo sin bisturi/i.test(n);
};

export const esServicioEnPlanDiario = (s) => {
    if (!s) return false;
    if (esServicioPaquete(s)) return false;
    if (s.tipo === 'Producto Físico (Venta)') return false;
    if (typeof s.incluirEnPlanDiario === 'boolean') return s.incluirEnPlanDiario;
    const p = num(s.precioVenta ?? s.precio);
    return p >= 50 && p <= 15000;
};

// ─────────────────────────── Periodos ───────────────────────────

export const TIPO_LABEL = { dia: 'Diario', semana: 'Semanal', mes: 'Mensual', anio: 'Anual' };

const etiquetaRango = (tipo, s, e) => {
    if (tipo === 'dia') return format(s, "EEEE d 'de' MMMM yyyy", { locale: es });
    if (tipo === 'semana') return `${format(s, "d 'de' MMM", { locale: es })} al ${format(e, "d 'de' MMM yyyy", { locale: es })}`;
    if (tipo === 'mes') return format(s, 'MMMM yyyy', { locale: es });
    return format(s, 'yyyy');
};

export const getRango = (periodo, now = new Date()) => {
    let tipo;
    let start;
    let end;
    if (periodo === 'Hoy') { tipo = 'dia'; start = startOfDay(now); end = endOfDay(now); }
    else if (periodo === 'Semana') { tipo = 'semana'; start = startOfWeek(now, { weekStartsOn: 1 }); end = endOfWeek(now, { weekStartsOn: 1 }); }
    else if (periodo === 'Año') { tipo = 'anio'; start = startOfYear(now); end = endOfYear(now); }
    else if (typeof periodo === 'string' && periodo.startsWith('D:')) {
        const d = parseISO(periodo.slice(2));
        tipo = 'dia'; start = startOfDay(d); end = endOfDay(d);
    } else if (typeof periodo === 'string' && periodo.startsWith('S:')) {
        const d = parseISO(periodo.slice(2));
        tipo = 'semana'; start = startOfWeek(d, { weekStartsOn: 1 }); end = endOfWeek(d, { weekStartsOn: 1 });
    } else if (typeof periodo === 'string' && periodo.startsWith('M:')) {
        const [y, m] = periodo.slice(2).split('-').map(Number);
        tipo = 'mes'; start = startOfMonth(new Date(y, m - 1, 1)); end = endOfMonth(start);
    } else if (typeof periodo === 'string' && periodo.startsWith('A:')) {
        tipo = 'anio'; start = startOfYear(new Date(Number(periodo.slice(2)), 0, 1)); end = endOfYear(start);
    } else if (typeof periodo === 'string' && /^\d{4}-\d{2}$/.test(periodo)) {
        const [y, m] = periodo.split('-').map(Number);
        tipo = 'mes'; start = startOfMonth(new Date(y, m - 1, 1)); end = endOfMonth(start);
    } else { tipo = 'mes'; start = startOfMonth(now); end = endOfMonth(now); }

    const enCurso = now >= start && now <= end;
    const corte = enCurso ? now : end;

    let prevStart;
    if (tipo === 'dia') prevStart = subDays(start, 1);
    else if (tipo === 'semana') prevStart = subWeeks(start, 1);
    else if (tipo === 'mes') prevStart = subMonths(start, 1);
    else prevStart = subYears(start, 1);
    const prevEnd = new Date(start.getTime() - 1);

    let prevCorte = prevEnd;
    if (enCurso) {
        const offset = corte.getTime() - start.getTime();
        const candidato = new Date(prevStart.getTime() + offset);
        prevCorte = candidato > prevEnd ? prevEnd : candidato;
    }

    return {
        periodo,
        tipo,
        tipoLabel: TIPO_LABEL[tipo],
        start,
        end,
        enCurso,
        corte,
        prevStart,
        prevEnd,
        prevCorte,
        label: etiquetaRango(tipo, start, end),
        prevLabel: etiquetaRango(tipo, prevStart, prevEnd),
        diasPeriodo: differenceInCalendarDays(end, start) + 1,
    };
};

export const navegarPeriodo = (periodo, dir = -1, now = new Date()) => {
    const R = getRango(periodo, now);
    if (R.tipo === 'dia') {
        const d = dir < 0 ? subDays(R.start, 1) : addDays(R.start, 1);
        return `D:${format(d, 'yyyy-MM-dd')}`;
    }
    if (R.tipo === 'semana') {
        const d = dir < 0 ? subWeeks(R.start, 1) : addWeeks(R.start, 1);
        return `S:${format(d, 'yyyy-MM-dd')}`;
    }
    if (R.tipo === 'anio') {
        const d = dir < 0 ? subYears(R.start, 1) : addYears(R.start, 1);
        return `A:${format(d, 'yyyy')}`;
    }
    const d = dir < 0 ? subMonths(R.start, 1) : addMonths(R.start, 1);
    return `M:${format(d, 'yyyy-MM')}`;
};

// ─────────────────────────── Preparación de datos ───────────────────────────

export const prepararDatos = ({
    movimientos = [], citas = [], pacientes = [], planes = [], staff = [], inventario = [], servicios = []
}) => {
    const pacs = (Array.isArray(pacientes) ? pacientes : []).filter((p) => !p.eliminado);
    const pacById = {};
    const idByName = {};
    pacs.forEach((p) => {
        pacById[p.id] = p;
        const n = normTxt(p.nombre);
        if (n && !idByName[n]) idByName[n] = p.id;
    });

    const pacienteKey = (id, nombre) => {
        if (id && id !== 'null') return id;
        const n = normTxt(nombre);
        if (!n) return null;
        return idByName[n] || `n:${n}`;
    };

    const movs = movimientos
        .filter((m) => m.estado !== 'Cancelado')
        .map((m) => {
            const _d = toDate(m.fecha || m.createdAt);
            const esIngreso = m.tipo === 'Ingreso';
            return {
                ...m,
                _d,
                _monto: num(m.monto),
                _fuente: esIngreso ? clasificarIngreso(m) : null,
                _metodo: normalizarMetodo(m.metodoPago),
                _cat: m.tipo === 'Egreso' ? categoriaEgreso(m) : null,
                _pkey: esIngreso ? pacienteKey(m.pacienteId, m.pacienteNombre) : null,
            };
        })
        .filter((m) => m._d && (m.tipo === 'Ingreso' || m.tipo === 'Egreso'));

    const cits = citas
        .map((c) => ({
            ...c,
            _d: toDate(c.fechaHora || c.fecha || c.createdAt),
            _precio: num(c.precio),
            _dur: num(c.duracionMin) || 60,
            _pkey: pacienteKey(c.pacienteId, c.pacienteNombre || c.paciente),
        }))
        .filter((c) => c._d);

    const pacsPrep = pacs.map((p) => ({ ...p, _created: toDate(p.createdAt) }));

    return {
        movs,
        cits,
        pacs: pacsPrep,
        pacById,
        pacienteKey,
        planes: (planes || []).filter((p) => !p.eliminado),
        staff: staff || [],
        inventario: (inventario || []).filter((i) => !i.eliminado),
        servicios: (servicios || []).filter((s) => !s.eliminado && s.activo !== false),
    };
};

// ─────────────────────────── Resumen por ventana ───────────────────────────

const ES_PENDIENTE = (s) => s === 'Pendiente' || s === 'Confirmada';

const resumenVentana = (datos, s, e) => {
    const mv = datos.movs.filter((m) => inRange(m._d, s, e));
    const ing = mv.filter((m) => m.tipo === 'Ingreso');
    const egr = mv.filter((m) => m.tipo === 'Egreso');
    const ingresos = sumBy(ing, (m) => m._monto);
    const egresos = sumBy(egr, (m) => m._monto);
    const utilidad = ingresos - egresos;

    const visitas = new Set();
    let sinPaciente = 0;
    ing.forEach((m) => {
        if (m._pkey) visitas.add(`${m._pkey}|${format(m._d, 'yyyy-MM-dd')}`);
        else sinPaciente += 1;
    });
    const numVisitas = visitas.size + sinPaciente;

    const ct = datos.cits.filter((c) => inRange(c._d, s, e));
    const completadas = ct.filter((c) => c.status === 'Completada').length;
    const noAsistio = ct.filter((c) => c.status === 'No Asistió').length;
    const canceladas = ct.filter((c) => c.status === 'Cancelada').length;
    const pendientes = ct.filter((c) => ES_PENDIENTE(c.status)).length;

    const nuevos = datos.pacs.filter((p) => inRange(p._created, s, e)).length;
    const abonosPlanes = sumBy(ing.filter((m) => m._fuente === FUENTES.PLANES), (m) => m._monto);

    return {
        mv, ing, egr, ct,
        ingresos, egresos, utilidad,
        margen: pct(utilidad, ingresos),
        ticket: numVisitas ? ingresos / numVisitas : 0,
        numVisitas,
        transacciones: ing.length,
        completadas, noAsistio, canceladas, pendientes,
        totalCitas: ct.length,
        tasaInasistencia: pct(noAsistio, completadas + noAsistio),
        nuevos,
        abonosPlanes,
        pctPlanes: pct(abonosPlanes, ingresos),
    };
};

// ─────────────────────────── Desglose temporal ───────────────────────────

const construirBuckets = (R) => {
    if (R.tipo === 'dia') {
        const horas = [];
        for (let h = 8; h <= 20; h += 1) horas.push(h);
        return horas.map((h) => ({
            key: String(h).padStart(2, '0'),
            label: `${String(h).padStart(2, '0')}:00 hrs`,
            labelCorto: `${h}h`,
            s: new Date(R.start.getFullYear(), R.start.getMonth(), R.start.getDate(), h === 8 ? 0 : h, 0, 0),
            e: new Date(R.start.getFullYear(), R.start.getMonth(), R.start.getDate(), h === 20 ? 23 : h, 59, 59, 999),
        }));
    }
    if (R.tipo === 'anio') {
        return eachMonthOfInterval({ start: R.start, end: R.end }).map((m) => ({
            key: format(m, 'yyyy-MM'),
            label: titleCase(format(m, 'MMMM yyyy', { locale: es })),
            labelCorto: titleCase(format(m, 'MMM', { locale: es })).replace('.', ''),
            s: startOfMonth(m),
            e: endOfMonth(m),
        }));
    }
    return eachDayOfInterval({ start: R.start, end: R.end }).map((d) => ({
        key: format(d, 'yyyy-MM-dd'),
        label: titleCase(format(d, R.tipo === 'semana' ? "EEEE d 'de' MMM" : "EEE d 'de' MMM", { locale: es })),
        labelCorto: R.tipo === 'semana' ? titleCase(format(d, 'EEE d', { locale: es })) : format(d, 'd'),
        s: startOfDay(d),
        e: endOfDay(d),
    }));
};

const calcularDesglose = (datos, R) => {
    const buckets = construirBuckets(R);
    return buckets.map((b) => {
        const mv = datos.movs.filter((m) => inRange(m._d, b.s, b.e));
        const ing = mv.filter((m) => m.tipo === 'Ingreso');
        const ingresos = sumBy(ing, (m) => m._monto);
        const egresos = sumBy(mv.filter((m) => m.tipo === 'Egreso'), (m) => m._monto);
        const ct = datos.cits.filter((c) => inRange(c._d, b.s, b.e));
        const visitas = new Set();
        let sinPac = 0;
        ing.forEach((m) => {
            if (m._pkey) visitas.add(`${m._pkey}|${format(m._d, 'yyyy-MM-dd')}`);
            else sinPac += 1;
        });
        const nVis = visitas.size + sinPac;
        return {
            key: b.key,
            label: b.label,
            labelCorto: b.labelCorto,
            ingresos: round2(ingresos),
            egresos: round2(egresos),
            utilidad: round2(ingresos - egresos),
            margen: pct(ingresos - egresos, ingresos),
            ticket: nVis ? round2(ingresos / nVis) : 0,
            completadas: ct.filter((c) => c.status === 'Completada').length,
            noAsistio: ct.filter((c) => c.status === 'No Asistió').length,
            canceladas: ct.filter((c) => c.status === 'Cancelada').length,
            nuevos: datos.pacs.filter((p) => inRange(p._created, b.s, b.e)).length,
        };
    });
};

// ─────────────────────────── Horario / ocupación / días laborales ───────────────────────────

export const minutosDisponibles = (s, e, horario) => {
    if (e < s) return 0;
    return eachDayOfInterval({ start: s, end: e }).reduce((acc, d) => {
        const h = horario?.[d.getDay()] ?? horario?.[String(d.getDay())];
        if (!h || h.length < 2) return acc;
        return acc + Math.max(0, (num(h[1]) - num(h[0])) * 60);
    }, 0);
};

export const contarDiasLaborales = (s, e, horario) => {
    if (e < s) return 1;
    let count = 0;
    eachDayOfInterval({ start: s, end: e }).forEach((d) => {
        const h = horario?.[d.getDay()] ?? horario?.[String(d.getDay())];
        if (h && h.length === 2 && num(h[1]) > num(h[0])) count += 1;
    });
    return Math.max(1, count);
};

// ─────────────────────────── Cálculo principal ───────────────────────────

export const calcularReporte = (datos, periodo, configIn = {}, now = new Date()) => {
    const config = { ...DEFAULT_CONFIG, ...configIn, horario: { ...DEFAULT_CONFIG.horario, ...(configIn.horario || {}) } };
    const R = getRango(periodo, now);

    const actual = resumenVentana(datos, R.start, R.end);
    const actualCorte = R.enCurso ? resumenVentana(datos, R.start, R.corte) : actual;
    const anterior = resumenVentana(datos, R.prevStart, R.prevCorte);
    const anteriorCompleto = resumenVentana(datos, R.prevStart, R.prevEnd);

    // ── KPIs con comparativo ──
    const kpis = {
        ingresos: { valor: actual.ingresos, anterior: anterior.ingresos, delta: variacion(actualCorte.ingresos, anterior.ingresos), tipo: 'moneda' },
        egresos: { valor: actual.egresos, anterior: anterior.egresos, delta: variacion(actualCorte.egresos, anterior.egresos), tipo: 'moneda', inverso: true },
        utilidad: { valor: actual.utilidad, anterior: anterior.utilidad, delta: variacion(actualCorte.utilidad, anterior.utilidad), tipo: 'moneda' },
        margen: { valor: actual.margen, anterior: anterior.margen, delta: actualCorte.margen - anterior.margen, tipo: 'porcentaje', deltaEnPuntos: true },
        ticket: { valor: actual.ticket, anterior: anterior.ticket, delta: variacion(actualCorte.ticket, anterior.ticket), tipo: 'moneda' },
        completadas: { valor: actual.completadas, anterior: anterior.completadas, delta: variacion(actualCorte.completadas, anterior.completadas), tipo: 'numero' },
        tasaInasistencia: { valor: actual.tasaInasistencia, anterior: anterior.tasaInasistencia, delta: actualCorte.tasaInasistencia - anterior.tasaInasistencia, tipo: 'porcentaje', deltaEnPuntos: true, inverso: true },
        nuevos: { valor: actual.nuevos, anterior: anterior.nuevos, delta: variacion(actualCorte.nuevos, anterior.nuevos), tipo: 'numero' },
        visitas: { valor: actual.numVisitas, anterior: anterior.numVisitas, delta: variacion(actualCorte.numVisitas, anterior.numVisitas), tipo: 'numero' },
    };

    // ── Finanzas ──
    const porFuente = mapToList(agrupar(actual.ing, (m) => m._fuente, (m) => m._monto), actual.ingresos);
    const porMetodo = mapToList(agrupar(actual.ing, (m) => m._metodo, (m) => m._monto), actual.ingresos);
    const egresosCat = mapToList(agrupar(actual.egr, (m) => m._cat, (m) => m._monto), actual.egresos);

    const servMap = {};
    actual.ing.filter((m) => m._fuente === FUENTES.SERVICIOS || m._fuente === FUENTES.PLANES).forEach((m) => {
        const nombre = nombreServicio(m.motivo || m.concepto);
        const k = normTxt(nombre);
        if (!servMap[k]) servMap[k] = { name: nombre, value: 0, count: 0 };
        servMap[k].value += m._monto;
        servMap[k].count += 1;
    });
    const topServicios = Object.values(servMap)
        .map((s) => ({ ...s, value: round2(s.value), pct: pct(s.value, actual.ingresos), promedio: s.count ? s.value / s.count : 0 }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10);

    // ── Promedios Históricos Automáticos (Nóminas, Insumos, Egresos) ──
    const refMes = startOfMonth(R.enCurso ? now : R.start);
    const mesesHist = [1, 2, 3, 4, 5, 6].map((i) => {
        const s = startOfMonth(subMonths(refMes, i));
        const e = endOfMonth(s);
        const egrMes = datos.movs.filter((m) => m.tipo === 'Egreso' && inRange(m._d, s, e));
        return {
            mes: format(s, 'MMM yyyy', { locale: es }),
            total: sumBy(egrMes, (m) => m._monto),
            nomina: sumBy(egrMes.filter((m) => m._cat === 'Nómina'), (m) => m._monto),
            insumos: sumBy(egrMes.filter((m) => m._cat === 'Insumos / Producto Tratamientos'), (m) => m._monto),
        };
    });

    const ult3ConDatos = mesesHist.slice(0, 3).filter((m) => m.total > 0);
    const gastoMensualAuto = ult3ConDatos.length ? sumBy(ult3ConDatos, (m) => m.total) / ult3ConDatos.length : 0;

    // Promedio de nóminas: últimos meses con nómina registrada
    const mesesConNomina = mesesHist.filter((m) => m.nomina > 0).slice(0, 4);
    const nominaPromedioAuto = mesesConNomina.length
        ? round2(sumBy(mesesConNomina, (m) => m.nomina) / mesesConNomina.length)
        : round2(sumBy(datos.staff.filter((s) => s.estatus !== 'Eliminado'), (s) => num(s.sueldoBase) * 4));
    const nominaSemanalAuto = round2(nominaPromedioAuto / 4.33);

    // Desglose de nóminas históricas por integrante del staff
    const nominaStaffMap = {};
    datos.movs.filter((m) => m.tipo === 'Egreso' && m._cat === 'Nómina').forEach((m) => {
        const nombre = String(m.staffNombre || (m.motivo || '').replace(/^n[oó]mina\s+/i, '').split('—')[0] || 'Staff').trim();
        if (!nominaStaffMap[nombre]) nominaStaffMap[nombre] = { nombre, totalPagado: 0, pagos: 0 };
        nominaStaffMap[nombre].totalPagado += m._monto;
        nominaStaffMap[nombre].pagos += 1;
    });
    const divisorMesesNom = Math.max(1, mesesConNomina.length);
    const nominasPorStaff = Object.values(nominaStaffMap)
        .map((n) => {
            const promPago = n.pagos ? round2(n.totalPagado / n.pagos) : 0;
            return {
                ...n,
                promedioMensual: round2(n.totalPagado / divisorMesesNom),
                promedioPorPago: promPago,
                promedioPago: promPago,
            };
        })
        .sort((a, b) => b.totalPagado - a.totalPagado);

    // Promedio automático de compras de producto para tratamientos (insumos)
    const mesesConInsumos = mesesHist.filter((m) => m.insumos > 0).slice(0, 4);
    const insumosPromedioAuto = mesesConInsumos.length
        ? round2(sumBy(mesesConInsumos, (m) => m.insumos) / mesesConInsumos.length)
        : 3500;

    // ── Estructura Mensual Desglosada: Gastos Fijos + Nómina + Bolsas de Provisión ──
    const fijosDesglose = {
        renta: num(config.gastoRenta),
        luz: num(config.gastoLuz),
        internet: num(config.gastoInternet),
        agua: num(config.gastoAgua),
        otros: num(config.gastoOtrosFijos),
    };
    const sumaFijosServicios = fijosDesglose.renta + fijosDesglose.luz + fijosDesglose.internet + fijosDesglose.agua + fijosDesglose.otros;

    const nominaMensual = num(config.nominaMensualEstimada) > 0 ? num(config.nominaMensualEstimada) : nominaPromedioAuto;
    const bolsaProductoMensual = num(config.provisionProductoMensual) > 0 ? num(config.provisionProductoMensual) : insumosPromedioAuto;
    const bolsaEquipoMensual = num(config.provisionEquipoMensual);
    const utilidadDeseada = num(config.utilidadDeseadaMensual);

    const usaEstructuraModular = sumaFijosServicios > 0 || num(config.nominaMensualEstimada) > 0 || num(config.provisionProductoMensual) > 0 || bolsaEquipoMensual > 0 || num(config.gastosFijosMensuales) === 0;
    const compromisoMensualTotal = usaEstructuraModular
        ? round2(sumaFijosServicios + nominaMensual + bolsaProductoMensual + bolsaEquipoMensual)
        : round2(num(config.gastosFijosMensuales));

    const factor = R.tipo === 'mes' ? 1 : R.tipo === 'anio' ? 12 : R.diasPeriodo / 30.4375;
    const metaEquilibrio = round2(compromisoMensualTotal * factor);

    // Gasto real de insumos y equipo en el periodo actual
    const gastadoInsumosPeriodo = sumBy(actual.egr.filter((m) => m._cat === 'Insumos / Producto Tratamientos'), (m) => m._monto);
    const gastadoEquipoPeriodo = sumBy(actual.egr.filter((m) => m._cat === 'Compra de Equipo'), (m) => m._monto);
    const gastadoNominaPeriodo = sumBy(actual.egr.filter((m) => m._cat === 'Nómina'), (m) => m._monto);

    let fechaEquilibrio = null;
    let equilibrioEstimado = false;
    if (metaEquilibrio > 0 && R.tipo !== 'dia') {
        let acumulado = 0;
        const finReal = R.enCurso ? now : R.end;
        const dias = eachDayOfInterval({ start: R.start, end: finReal });
        for (const d of dias) {
            acumulado += sumBy(datos.movs.filter((m) => m.tipo === 'Ingreso' && inRange(m._d, startOfDay(d), endOfDay(d))), (m) => m._monto);
            if (acumulado >= metaEquilibrio) { fechaEquilibrio = d; break; }
        }
        if (!fechaEquilibrio && R.enCurso) {
            const diasTransc = Math.max(1, differenceInCalendarDays(now, R.start) + 1);
            const ritmo = actualCorte.ingresos / diasTransc;
            if (ritmo > 0) {
                const estimada = addDays(R.start, Math.ceil(metaEquilibrio / ritmo) - 1);
                if (estimada <= R.end) { fechaEquilibrio = estimada; equilibrioEstimado = true; }
            }
        }
    }

    const costoEquipoMeta = num(config.costoEquipoMeta);
    const mesesParaEquipo = bolsaEquipoMensual > 0 && costoEquipoMeta > 0
        ? Math.ceil(costoEquipoMeta / bolsaEquipoMensual)
        : null;

    const bolsaProductoPeriodo = round2(bolsaProductoMensual * factor);
    const bolsaEquipoPeriodo = round2(bolsaEquipoMensual * factor);

    const equilibrio = {
        fijosDesglose,
        sumaFijosServicios,
        nominaMensual,
        nominaPromedioAuto,
        nominaSemanalAuto,
        usaNominaAuto: !(num(config.nominaMensualEstimada) > 0),
        nominasPorStaff,
        bolsaProductoMensual,
        bolsaProductoPeriodo,
        insumosPromedioAuto,
        usaInsumosAuto: !(num(config.provisionProductoMensual) > 0),
        gastadoInsumosPeriodo,
        disponibleBolsaProducto: round2(bolsaProductoPeriodo - gastadoInsumosPeriodo),
        bolsaEquipoMensual,
        bolsaEquipoPeriodo,
        nombreEquipoMeta: config.nombreEquipoMeta || 'Nuevo Equipo / Aparatología',
        costoEquipoMeta,
        mesesParaEquipo,
        gastadoEquipoPeriodo,
        gastadoNominaPeriodo,
        utilidadDeseada,
        gastoMensual: compromisoMensualTotal,
        gastoMensualAuto,
        esAutomatico: sumaFijosServicios === 0 && !(num(config.gastosFijosMensuales) > 0),
        metaEquilibrio,
        cubierto: pct(actual.ingresos, metaEquilibrio),
        faltante: Math.max(0, metaEquilibrio - actual.ingresos),
        alcanzado: actual.ingresos >= metaEquilibrio && metaEquilibrio > 0,
        fechaEquilibrio,
        equilibrioEstimado,
        aplica: R.tipo !== 'dia',
    };

    // ── PLAN DE INGRESOS MENSUALES Y SIMULADOR DE VENTAS DIARIAS (SERVICIOS NO PAQUETE) ──
    const mesRefStart = R.tipo === 'mes' ? R.start : startOfMonth(now);
    const mesRefEnd = R.tipo === 'mes' ? R.end : endOfMonth(now);
    const diasLaboralesMes = contarDiasLaborales(mesRefStart, mesRefEnd, config.horario);
    const diasLaboralesPeriodo = contarDiasLaborales(R.start, R.end, config.horario);
    const minCabinaDia = Math.max(60, Math.round(minutosDisponibles(mesRefStart, mesRefEnd, config.horario) / diasLaboralesMes));

    const metaPlanMensual = Math.max(num(config.metaMensual), round2(compromisoMensualTotal + utilidadDeseada));
    const metaDiariaPesos = round2(metaPlanMensual / diasLaboralesMes);
    const equilibrioDiarioPesos = round2(compromisoMensualTotal / diasLaboralesMes);

    const cuotaDiaria = {
        fijos: round2(sumaFijosServicios / diasLaboralesMes),
        nomina: round2(nominaMensual / diasLaboralesMes),
        bolsaProducto: round2(bolsaProductoMensual / diasLaboralesMes),
        bolsaEquipo: round2(bolsaEquipoMensual / diasLaboralesMes),
        utilidad: round2(utilidadDeseada / diasLaboralesMes),
        equilibrioTotal: equilibrioDiarioPesos,
        metaTotal: metaDiariaPesos,
    };

    // Conteo histórico de citas/ventas por nombre de servicio para ponderar demanda real
    const demandaHistorica = {};
    const vendidosPeriodoMap = {};
    datos.cits.filter((c) => c.status === 'Completada').forEach((c) => {
        const k = normTxt(nombreServicio(c.servicio));
        if (!k) return;
        demandaHistorica[k] = (demandaHistorica[k] || 0) + 1;
        if (inRange(c._d, R.start, R.end)) {
            vendidosPeriodoMap[k] = (vendidosPeriodoMap[k] || 0) + 1;
        }
    });
    actual.ing.filter((m) => m._fuente === FUENTES.SERVICIOS).forEach((m) => {
        const k = normTxt(nombreServicio(m.motivo || m.concepto));
        if (!k) return;
        if (!vendidosPeriodoMap[k]) vendidosPeriodoMap[k] = 1;
    });

    // Filtrar servicios del catálogo que NO sean paquete y estén incluidos en el plan diario
    const serviciosSueltosRaw = datos.servicios.filter((s) => esServicioEnPlanDiario(s) && num(s.precioVenta ?? s.precio) > 0);

    const pesoPrioridad = (p) => (p === 'alta' ? 3 : p === 'baja' ? 1 : 2);

    const serviciosPlan = serviciosSueltosRaw.map((s) => {
        const precio = num(s.precioVenta ?? s.precio);
        const insumo = num(s.costoInsumos);
        const comPct = num(s.comisionPct ?? 0);
        const comMonto = round2(precio * (comPct / 100));
        const margenLibre = round2(Math.max(1, precio - insumo - comMonto));
        const duracionMin = Math.max(10, num(s.duracionMin) || 60);
        const k = normTxt(s.nombre);
        const hist = demandaHistorica[k] || 0;
        const vendidosPeriodo = vendidosPeriodoMap[k] || 0;
        const prio = s.prioridadPlan || 'media';
        const peso = pesoPrioridad(prio) * (1 + Math.min(2, hist / 25));

        const soloEsteParaEquilibrioDia = round2(equilibrioDiarioPesos / precio);
        const soloEsteParaMetaDia = round2(metaDiariaPesos / precio);
        const soloEsteMargenDia = round2(metaDiariaPesos / margenLibre);

        return {
            id: s.id,
            nombre: s.nombre || 'Servicio',
            categoria: s.categoria || 'Cabina / Corporal',
            precio,
            precioVenta: precio,
            insumo,
            costoInsumos: insumo,
            comPct,
            comisionPct: comPct,
            comMonto,
            comisionMonto: comMonto,
            margenLibre,
            margenNetoUnitario: margenLibre,
            margenPct: pct(margenLibre, precio),
            duracionMin,
            prioridad: prio,
            prioridadPlan: prio,
            incluirEnPlanDiario: true,
            esPaquete: false,
            metaManual: num(s.metaDiariaManual) > 0 ? num(s.metaDiariaManual) : null,
            metaDiariaManual: num(s.metaDiariaManual) || 0,
            peso,
            demandaHist: hist,
            vendidosPeriodo,
            soloEsteParaEquilibrioDia,
            soloEsteParaEquilibrioDiaRedondeado: Math.max(1, Math.ceil(soloEsteParaEquilibrioDia)),
            soloEsteParaMetaDia,
            soloEsteParaMetaDiaRedondeado: Math.max(1, Math.ceil(soloEsteParaMetaDia)),
            soloEsteParaMetaMes: Math.ceil(metaPlanMensual / precio),
            soloEsteMargenDia,
            soloEsteMargenDiaRedondeado: Math.max(1, Math.ceil(soloEsteMargenDia)),
        };
    }).sort((a, b) => b.peso - a.peso || b.demandaHist - a.demandaHist || a.precio - b.precio);

    // Construir Mix Diario Sugerido (combinación realista de servicios sueltos para llegar a metaDiariaPesos)
    const topMixBase = serviciosPlan.slice(0, 8);
    const sumaPesosMix = sumBy(topMixBase, (s) => s.peso) || 1;
    let ingresoMixAcum = 0;
    let margenMixAcum = 0;
    let minutosMixAcum = 0;
    let sesionesMixAcum = 0;

    const mixDiarioSugerido = topMixBase.map((s) => {
        const cuotaIngreso = metaDiariaPesos * (s.peso / sumaPesosMix);
        const sesiones = s.metaManual !== null ? s.metaManual : Math.max(1, Math.round(cuotaIngreso / s.precio));
        const ingresoDia = round2(sesiones * s.precio);
        const margenDia = round2(sesiones * s.margenLibre);
        const minutosDia = sesiones * s.duracionMin;
        ingresoMixAcum += ingresoDia;
        margenMixAcum += margenDia;
        minutosMixAcum += minutosDia;
        sesionesMixAcum += sesiones;
        return {
            ...s,
            sesionesDiaMix: sesiones,
            unidadesMixDia: sesiones,
            sesionesMesMix: sesiones * diasLaboralesMes,
            unidadesMixMes: sesiones * diasLaboralesMes,
            ingresoDiaMix: ingresoDia,
            ingresoMixDia: ingresoDia,
            ingresoMesMix: round2(ingresoDia * diasLaboralesMes),
            ingresoMixMes: round2(ingresoDia * diasLaboralesMes),
            margenDiaMix: margenDia,
            margenMixDia: margenDia,
            minutosDiaMix: minutosDia,
            minutosMixDia: minutosDia,
        };
    });

    const precioPromedioSuelto = serviciosPlan.length
        ? round2(sumBy(serviciosPlan, (s) => s.precio) / serviciosPlan.length)
        : round2(actual.ticket || 500);
    const serviciosDiariosPromedioRequeridos = precioPromedioSuelto > 0
        ? round2(metaDiariaPesos / precioPromedioSuelto)
        : 0;
    const serviciosEquilibrioDiarios = precioPromedioSuelto > 0
        ? round2(equilibrioDiarioPesos / precioPromedioSuelto)
        : 0;

    const ingSinPaquetePeriodo = sumBy(actual.ing.filter((m) => m._fuente === FUENTES.SERVICIOS), (m) => m._monto);
    const diasLabTranscurridos = R.enCurso ? contarDiasLaborales(R.start, now, config.horario) : diasLaboralesPeriodo;
    const diasLabRestantes = R.enCurso ? Math.max(1, diasLaboralesPeriodo - diasLabTranscurridos) : 0;
    const faltanteMetaPlan = Math.max(0, metaPlanMensual * factor - actual.ingresos);
    const ventaDiariaNecesariaRestante = R.enCurso ? round2(faltanteMetaPlan / diasLabRestantes) : 0;

    const horasCabinaMix = round2(minutosMixAcum / 60);

    const planIngresos = {
        diasLaboralesMes,
        diasLaboralesPeriodo,
        diasLabTranscurridos,
        diasLabRestantes,
        compromisoMensualTotal,
        metaPlanMensual,
        metaDiariaPesos,
        equilibrioDiarioPesos,
        cuotaDiaria,
        precioPromedioSuelto,
        serviciosDiariosPromedioRequeridos,
        serviciosEquilibrioDiarios,
        serviciosPlan,
        mixDiarioSugerido,
        resumenMix: {
            sesionesDia: sesionesMixAcum,
            unidadesTotalesMixDia: sesionesMixAcum,
            sesionesMes: sesionesMixAcum * diasLaboralesMes,
            unidadesTotalesMixMes: sesionesMixAcum * diasLaboralesMes,
            ingresoDia: round2(ingresoMixAcum),
            ingresoMixDia: round2(ingresoMixAcum),
            ingresoMes: round2(ingresoMixAcum * diasLaboralesMes),
            ingresoMixMes: round2(ingresoMixAcum * diasLaboralesMes),
            margenDia: round2(margenMixAcum),
            margenMixDia: round2(margenMixAcum),
            horasCabinaDia: horasCabinaMix,
            horasCabinaMixDia: horasCabinaMix,
            horasDisponiblesDia: round2(minCabinaDia / 60),
        },
        ingSinPaquetePeriodo,
        faltanteMetaPlan,
        ventaDiariaNecesariaRestante,
        serviciosRestantesPorDia: precioPromedioSuelto > 0 ? round2(ventaDiariaNecesariaRestante / precioPromedioSuelto) : 0,
    };

    // ── Proyección de cierre ──
    let proyeccion = null;
    if (R.enCurso && R.tipo !== 'dia') {
        const frac = Math.min(1, Math.max(0.01, (now.getTime() - R.start.getTime()) / (R.end.getTime() - R.start.getTime())));
        const proyIngresos = actualCorte.ingresos / frac;
        const proyEgresos = actualCorte.egresos / frac;
        const meta = metaPlanMensual * factor;
        proyeccion = {
            avance: frac * 100,
            ingresos: proyIngresos,
            egresos: proyEgresos,
            utilidad: proyIngresos - proyEgresos,
            vsAnterior: variacion(proyIngresos, anteriorCompleto.ingresos),
            anteriorCompleto: anteriorCompleto.ingresos,
            meta,
            pctMeta: pct(proyIngresos, meta),
            avanceMeta: pct(actual.ingresos, meta),
        };
    }

    // ── Planes de tratamiento ──
    const abonosPorPac = {};
    datos.movs
        .filter((m) => m.tipo === 'Ingreso' && m._fuente === FUENTES.PLANES && m._pkey && m._d <= now)
        .forEach((m) => { (abonosPorPac[m._pkey] = abonosPorPac[m._pkey] || []).push(m); });

    const planesN = datos.planes.map((p) => {
        const meta = num(p.meta);
        const acumulado = num(p.acumulado);
        const created = toDate(p.createdAt);
        const key = datos.pacienteKey(p.pacienteId, p.paciente);
        const pagos = (abonosPorPac[key] || []).filter((m) => !created || m._d >= subDays(created, 1));
        const ultimoPago = pagos.reduce((mx, m) => (!mx || m._d > mx ? m._d : mx), null);
        const ref = ultimoPago || created;
        const pac = datos.pacById[p.pacienteId] || {};
        return {
            id: p.id,
            paciente: String(p.paciente || pac.nombre || 'Sin nombre').trim(),
            telefono: p.telefono || pac.telefono || '',
            objetivo: String(p.objetivo || 'Plan de tratamiento').trim(),
            meta,
            acumulado,
            saldo: Math.max(0, meta - acumulado),
            created,
            ultimoPago,
            diasSinPago: ref ? differenceInCalendarDays(now, ref) : null,
            liquidado: meta > 0 && acumulado >= meta,
            activo: p.activo !== false,
            morosidad: !!p.morosidad,
        };
    }).filter((p) => p.meta > 0);

    const vigentes = planesN.filter((p) => p.activo && !p.liquidado);
    const atrasados = vigentes
        .filter((p) => p.diasSinPago !== null && p.diasSinPago > num(config.diasAtrasoPlan))
        .sort((a, b) => b.saldo - a.saldo);
    const vendidos = planesN.filter((p) => inRange(p.created, R.start, R.end));
    const liquidadosPeriodo = planesN.filter((p) => p.liquidado && p.ultimoPago && inRange(p.ultimoPago, R.start, R.end));

    const planes = {
        cartera: sumBy(vigentes, (p) => p.saldo),
        vigentes: vigentes.length,
        cobradoVigentes: sumBy(vigentes, (p) => p.acumulado),
        valorVigentes: sumBy(vigentes, (p) => p.meta),
        atrasados,
        montoAtrasado: sumBy(atrasados, (p) => p.saldo),
        vendidos: vendidos.length,
        valorVendido: sumBy(vendidos, (p) => p.meta),
        liquidados: liquidadosPeriodo.length,
        abonosCobrados: actual.abonosPlanes,
        abonosCobradosAnterior: anterior.abonosPlanes,
        pctIngresos: actual.pctPlanes,
        avancePromedio: vigentes.length ? sumBy(vigentes, (p) => pct(p.acumulado, p.meta)) / vigentes.length : 0,
    };

    // ── Pacientes ──
    const infoPac = (key, fallback = {}) => {
        const p = datos.pacById[key];
        return {
            nombre: String(p?.nombre || fallback.nombre || 'Sin nombre').trim(),
            telefono: p?.telefono || fallback.telefono || '',
        };
    };

    const visitasPorPac = {};
    const ultimoServicio = {};
    const fallbackPac = {};
    datos.cits
        .filter((c) => c.status === 'Completada' && c._pkey && c._d <= now)
        .sort((a, b) => a._d - b._d)
        .forEach((c) => {
            (visitasPorPac[c._pkey] = visitasPorPac[c._pkey] || []).push(c._d);
            ultimoServicio[c._pkey] = c.servicio || '';
            fallbackPac[c._pkey] = { nombre: c.pacienteNombre || c.paciente, telefono: c.telefono };
        });

    const futuras = new Set(datos.cits.filter((c) => ES_PENDIENTE(c.status) && c._d > now && c._pkey).map((c) => c._pkey));

    const ltvMap = {};
    datos.movs
        .filter((m) => m.tipo === 'Ingreso' && m._pkey && m._d <= now)
        .forEach((m) => { ltvMap[m._pkey] = (ltvMap[m._pkey] || 0) + m._monto; });
    const ltvValores = Object.values(ltvMap).filter((v) => v > 0);
    const ltvPromedio = ltvValores.length ? sumBy(ltvValores, (v) => v) / ltvValores.length : 0;

    const diasUnicos = (arr) => {
        const set = new Set(arr.map((d) => format(d, 'yyyy-MM-dd')));
        return set.size;
    };
    const visitasProm = Object.keys(visitasPorPac).length
        ? sumBy(Object.values(visitasPorPac), diasUnicos) / Object.keys(visitasPorPac).length
        : 0;

    const haceUnAnio = subYears(now, 1);
    const retencion = [30, 60, 90].map((N) => {
        let elegibles = 0;
        let regresaron = 0;
        Object.values(visitasPorPac).forEach((visitas) => {
            const F = visitas[0];
            if (F < haceUnAnio) return;
            if (differenceInCalendarDays(now, F) < N) return;
            elegibles += 1;
            if (visitas.some((d) => {
                const dd = differenceInCalendarDays(d, F);
                return dd >= 1 && dd <= N;
            })) regresaron += 1;
        });
        return { dias: N, tasa: pct(regresaron, elegibles), elegibles, regresaron };
    });

    const atendidosEn = (s, e) => new Set(
        datos.cits.filter((c) => c.status === 'Completada' && c._pkey && inRange(c._d, s, e)).map((c) => c._pkey)
    );
    const atendidos = atendidosEn(R.start, R.end);
    let nuevosAtendidos = 0;
    atendidos.forEach((k) => {
        const F = visitasPorPac[k]?.[0];
        if (F && inRange(F, R.start, R.end)) nuevosAtendidos += 1;
    });
    const atendidosPrev = atendidosEn(R.prevStart, R.prevEnd);
    const atendidosHastaCorte = atendidosEn(R.start, R.corte);
    let regresaronPrev = 0;
    atendidosPrev.forEach((k) => { if (atendidosHastaCorte.has(k)) regresaronPrev += 1; });

    const topMap = {};
    actual.ing.forEach((m) => {
        if (!m._pkey) return;
        if (!topMap[m._pkey]) topMap[m._pkey] = { key: m._pkey, total: 0, pagos: 0, fallback: { nombre: m.pacienteNombre } };
        topMap[m._pkey].total += m._monto;
        topMap[m._pkey].pagos += 1;
    });
    const topPacientes = Object.values(topMap)
        .sort((a, b) => b.total - a.total)
        .slice(0, 10)
        .map((t) => ({
            ...infoPac(t.key, t.fallback),
            total: t.total,
            pagos: t.pagos,
            ltv: ltvMap[t.key] || 0,
            visitas: visitasPorPac[t.key] ? diasUnicos(visitasPorPac[t.key]) : 0,
        }));

    const riesgo = [];
    let perdidos = 0;
    Object.entries(visitasPorPac).forEach(([k, visitas]) => {
        const ultima = visitas[visitas.length - 1];
        const dias = differenceInCalendarDays(now, ultima);
        if (futuras.has(k)) return;
        if (dias > 180) { perdidos += 1; return; }
        if (dias >= num(config.diasRiesgo)) {
            riesgo.push({
                ...infoPac(k, fallbackPac[k]),
                key: k,
                ultimaVisita: ultima,
                dias,
                ultimoServicio: ultimoServicio[k] || '',
                visitas: diasUnicos(visitas),
                ltv: ltvMap[k] || 0,
            });
        }
    });
    riesgo.sort((a, b) => b.ltv - a.ltv || a.dias - b.dias);

    const nuevosPeriodo = datos.pacs.filter((p) => inRange(p._created, R.start, R.end));
    const origenMap = agrupar(nuevosPeriodo, (p) => (p.comoNosConocio && String(p.comoNosConocio).trim()) || 'Sin registrar');
    const canales = mapToList(origenMap, nuevosPeriodo.length);

    const pacientesM = {
        totalActivos: datos.pacs.length,
        nuevos: actual.nuevos,
        atendidos: atendidos.size,
        nuevosAtendidos,
        recurrentes: atendidos.size - nuevosAtendidos,
        pctRecurrentes: pct(atendidos.size - nuevosAtendidos, atendidos.size),
        retencion,
        regresoPrev: { base: atendidosPrev.size, regresaron: regresaronPrev, tasa: pct(regresaronPrev, atendidosPrev.size) },
        ltvPromedio,
        visitasProm,
        pacientesConPagos: ltvValores.length,
        topPacientes,
        riesgo,
        valorRiesgo: sumBy(riesgo, (r) => r.ltv),
        perdidos,
        canales,
        canalesSinRegistrar: origenMap['Sin registrar'] || 0,
    };

    // ── Operación / agenda ──
    const preciosValidos = datos.cits.filter((c) => c._precio > 0).map((c) => c._precio);
    const precioPromCita = preciosValidos.length ? sumBy(preciosValidos, (v) => v) / preciosValidos.length : actual.ticket;
    const citasNoAsistio = actual.ct.filter((c) => c.status === 'No Asistió');
    const costoInasistencias = sumBy(citasNoAsistio, (c) => (c._precio > 0 ? c._precio : precioPromCita));

    const minDisp = minutosDisponibles(R.start, R.end, config.horario);
    const staffById = {};
    datos.staff.forEach((s) => { staffById[s.id] = s; });

    const pagosPorPacDia = {};
    actual.ing.forEach((m) => {
        if (!m._pkey) return;
        const dk = `${m._pkey}|${format(m._d, 'yyyy-MM-dd')}`;
        pagosPorPacDia[dk] = (pagosPorPacDia[dk] || 0) + m._monto;
    });
    const citasSinPrecioPorPacDia = {};
    actual.ct.filter((c) => c.status === 'Completada' && c._precio <= 0 && c._pkey).forEach((c) => {
        const dk = `${c._pkey}|${format(c._d, 'yyyy-MM-dd')}`;
        citasSinPrecioPorPacDia[dk] = (citasSinPrecioPorPacDia[dk] || 0) + 1;
    });

    const espMap = {};
    actual.ct.forEach((c) => {
        const k = c.especialistaId || `n:${normTxt(c.especialistaNombre)}`;
        if (!espMap[k]) {
            espMap[k] = {
                id: c.especialistaId,
                nombre: String(staffById[c.especialistaId]?.nombre || c.especialistaNombre || 'Sin asignar').trim(),
                agendadas: 0, completadas: 0, noAsistio: 0, canceladas: 0, pendientes: 0,
                ingresos: 0, minutos: 0, conPrecio: 0,
            };
        }
        const e = espMap[k];
        if (c.status === 'Cancelada') { e.canceladas += 1; return; }
        e.agendadas += 1;
        e.minutos += c._dur;
        if (c.status === 'Completada') {
            e.completadas += 1;
            if (c._precio > 0) {
                e.ingresos += c._precio;
                e.conPrecio += 1;
            } else if (c._pkey) {
                const dk = `${c._pkey}|${format(c._d, 'yyyy-MM-dd')}`;
                const nCitas = citasSinPrecioPorPacDia[dk] || 1;
                if (pagosPorPacDia[dk]) {
                    e.ingresos += pagosPorPacDia[dk] / nCitas;
                    e.conPrecio += 1;
                }
            }
        } else if (c.status === 'No Asistió') e.noAsistio += 1;
        else if (ES_PENDIENTE(c.status)) e.pendientes += 1;
    });

    const especialistas = Object.values(espMap).map((e) => {
        const st = staffById[e.id];
        const comisiones = sumBy(
            (st?.historialComisiones || []).filter((h) => inRange(toDate(h.fecha), R.start, R.end)),
            (h) => num(h.comisionGanada)
        );
        const nomina = sumBy(actual.egr.filter((m) => m.staffId && m.staffId === e.id), (m) => m._monto);
        const utilidadNeta = e.ingresos - (nomina > 0 ? nomina : comisiones);
        return {
            ...e,
            ingresos: round2(e.ingresos),
            comisiones: round2(comisiones),
            nomina: round2(nomina),
            utilidadNeta: round2(utilidadNeta),
            ticket: e.completadas ? e.ingresos / e.completadas : 0,
            tasaInasistencia: pct(e.noAsistio, e.completadas + e.noAsistio),
            ocupacion: pct(e.minutos, minDisp),
            horasAgendadas: e.minutos / 60,
        };
    }).sort((a, b) => b.ingresos - a.ingresos || b.completadas - a.completadas);

    // Mapa de calor (día de semana x hora)
    const horasSet = new Set();
    Object.values(config.horario).forEach((h) => { if (h) for (let x = num(h[0]); x < num(h[1]); x += 1) horasSet.add(x); });
    const activas = actual.ct.filter((c) => c.status !== 'Cancelada');
    activas.forEach((c) => horasSet.add(c._d.getHours()));
    const horas = [...horasSet].sort((a, b) => a - b);
    const matriz = DIAS_SEMANA.map(() => horas.map(() => 0));
    activas.forEach((c) => {
        const di = (c._d.getDay() + 6) % 7;
        const hi = horas.indexOf(c._d.getHours());
        if (hi >= 0) matriz[di][hi] += 1;
    });
    let maxCalor = 0;
    let picoDia = null;
    let picoHora = null;
    matriz.forEach((fila, di) => fila.forEach((v, hi) => {
        if (v > maxCalor) { maxCalor = v; picoDia = di; picoHora = horas[hi]; }
    }));
    const totalPorDia = matriz.map((f) => sumBy(f, (v) => v));

    const operacion = {
        especialistas,
        minutosDisponibles: minDisp,
        ocupacionGlobal: especialistas.length ? sumBy(especialistas, (e) => e.ocupacion) / especialistas.length : 0,
        costoInasistencias,
        precioPromCita,
        estatus: [
            { name: 'Completadas', value: actual.completadas, color: '#10b981' },
            { name: 'No asistió', value: actual.noAsistio, color: '#f59e0b' },
            { name: 'Canceladas', value: actual.canceladas, color: '#f43f5e' },
            { name: 'Por atender', value: actual.pendientes, color: '#3b82f6' },
        ],
        heatmap: { dias: DIAS_SEMANA, horas, matriz, max: maxCalor, picoDia, picoHora, totalPorDia },
    };

    // ── Inventario ──
    const ventasMap = {};
    actual.ing.filter((m) => m._fuente === FUENTES.PRODUCTOS).forEach((m) => {
        const k = m.productoId || `n:${normTxt(m.productoNombre || m.motivo)}`;
        if (!ventasMap[k]) ventasMap[k] = { unidades: 0, ingreso: 0, nombre: m.productoNombre || m.motivo };
        ventasMap[k].unidades += num(m.cantidadVendida) || 1;
        ventasMap[k].ingreso += m._monto;
    });

    const items = datos.inventario;
    const bajoStock = items
        .filter((i) => num(i.stockMinimo) > 0 && num(i.stock) <= num(i.stockMinimo))
        .map((i) => ({ nombre: i.nombre, tipo: i.tipo, stock: num(i.stock), stockMinimo: num(i.stockMinimo), unidad: i.unidad || '', proveedor: i.proveedor || '', agotado: num(i.stock) <= 0 }))
        .sort((a, b) => (a.stock / a.stockMinimo) - (b.stock / b.stockMinimo));

    const itemsById = {};
    items.forEach((i) => { itemsById[i.id] = i; });
    const productos = items
        .filter((i) => i.tipo === 'producto' && num(i.precio) > 0)
        .map((i) => {
            const v = ventasMap[i.id] || { unidades: 0, ingreso: 0 };
            const precio = num(i.precio);
            const costo = num(i.costo);
            return {
                nombre: i.nombre,
                precio,
                costo,
                margen: precio - costo,
                margenPct: pct(precio - costo, precio),
                stock: num(i.stock),
                unidadesVendidas: v.unidades,
                ingresoVentas: v.ingreso,
                utilidadVentas: v.ingreso - costo * v.unidades,
                sinCosto: costo <= 0,
            };
        })
        .sort((a, b) => b.ingresoVentas - a.ingresoVentas || b.margenPct - a.margenPct);

    const ventasSinCatalogo = Object.entries(ventasMap).filter(([k]) => !itemsById[k]).reduce((acc, [, v]) => acc + v.ingreso, 0);

    const inventarioM = {
        totalItems: items.length,
        bajoStock,
        agotados: bajoStock.filter((b) => b.agotado).length,
        valorCosto: sumBy(items, (i) => Math.max(0, num(i.stock)) * num(i.costo)),
        valorVenta: sumBy(items.filter((i) => i.tipo === 'producto'), (i) => Math.max(0, num(i.stock)) * num(i.precio)),
        productos,
        ingresoProductos: sumBy(actual.ing.filter((m) => m._fuente === FUENTES.PRODUCTOS), (m) => m._monto),
        utilidadProductos: sumBy(productos, (p) => p.utilidadVentas),
        unidadesVendidas: sumBy(Object.values(ventasMap), (v) => v.unidades),
        ventasSinCatalogo,
        margenPromedio: productos.length ? sumBy(productos.filter((p) => !p.sinCosto), (p) => p.margenPct) / Math.max(1, productos.filter((p) => !p.sinCosto).length) : 0,
    };

    // ── Desglose temporal ──
    const desglose = calcularDesglose(datos, R);

    // ── Hallazgos automáticos ──
    const money = (n) => `$${Math.round(n).toLocaleString('es-MX')}`;
    const hallazgos = [];
    hallazgos.push({
        tipo: 'info',
        texto: `Meta diaria requerida: ${money(planIngresos.metaDiariaPesos)}/día (~${Math.ceil(planIngresos.serviciosDiariosPromedioRequeridos)} servicios sueltos diarios a precio promedio de ${money(planIngresos.precioPromedioSuelto)}).`,
    });
    const dIng = kpis.ingresos.delta;
    if (dIng !== null && Math.abs(dIng) >= 5 && anterior.ingresos > 0) {
        hallazgos.push(dIng > 0
            ? { tipo: 'positivo', texto: `Los ingresos crecieron ${dIng.toFixed(1)}% frente al periodo anterior (${R.prevLabel}).` }
            : { tipo: 'alerta', texto: `Los ingresos bajaron ${Math.abs(dIng).toFixed(1)}% frente al periodo anterior (${R.prevLabel}).` });
    }
    if (equilibrio.aplica && equilibrio.metaEquilibrio > 0) {
        if (equilibrio.alcanzado && fechaEquilibrio) {
            hallazgos.push({ tipo: 'positivo', texto: `Compromiso de gastos y provisiones cubierto el ${format(fechaEquilibrio, "d 'de' MMMM", { locale: es })}: todo ingreso adicional es ganancia libre.` });
        } else if (R.enCurso && fechaEquilibrio && equilibrioEstimado) {
            hallazgos.push({ tipo: 'info', texto: `Al ritmo actual cubrirás gastos fijos, nómina y bolsas alrededor del ${format(fechaEquilibrio, "d 'de' MMMM", { locale: es })}. Faltan ${money(equilibrio.faltante)}.` });
        } else {
            hallazgos.push({ tipo: 'alerta', texto: `Faltan ${money(equilibrio.faltante)} para cubrir el compromiso de gastos fijos, nómina y bolsas del periodo (${money(equilibrio.metaEquilibrio)}).` });
        }
    }
    if (actual.noAsistio > 0) {
        hallazgos.push({ tipo: 'alerta', texto: `${actual.noAsistio} inasistencias (${actual.tasaInasistencia.toFixed(1)}%) representan ~${money(costoInasistencias)} en ingresos no realizados.` });
    }
    if (atrasados.length) {
        hallazgos.push({ tipo: 'alerta', texto: `${atrasados.length} planes llevan más de ${config.diasAtrasoPlan} días sin abono, con ${money(planes.montoAtrasado)} por cobrar.` });
    }
    if (riesgo.length) {
        hallazgos.push({ tipo: 'info', texto: `${riesgo.length} pacientes no vienen desde hace más de ${config.diasRiesgo} días y no tienen cita agendada (han invertido ${money(pacientesM.valorRiesgo)} en total).` });
    }
    if (bajoStock.length) {
        hallazgos.push({ tipo: 'alerta', texto: `${bajoStock.length} productos/insumos están en o por debajo del stock mínimo${inventarioM.agotados ? ` (${inventarioM.agotados} agotados)` : ''}.` });
    }

    return {
        R,
        config,
        actual,
        anterior,
        kpis,
        finanzas: { porFuente, porMetodo, egresosCat, topServicios },
        equilibrio,
        planIngresos,
        proyeccion,
        planes,
        pacientes: pacientesM,
        operacion,
        inventario: inventarioM,
        desglose,
        hallazgos,
        generado: now,
    };
};
