import {
    collection, addDoc, updateDoc, setDoc, doc, getDocs, getDoc,
    query, orderBy, where, onSnapshot, deleteField, deleteDoc
} from 'firebase/firestore';
import { db } from '../lib/firebase';

const FINANZAS_COL = collection(db, 'finanzas');
const CAJAS_DIARIAS_COL = collection(db, 'cajas_diarias');

/**
 * Catálogo maestro unificado de Categorías de Gasto y sus Motivos Frecuentes.
 * Usado por Recepción (CajaView), Corte de Caja (CorteCajaGlobal), Contabilidad (ContabilidadView) y Reportes.
 * Regla: Todo gasto (Egreso) SIEMPRE sin excepción pertenece a una categoría de este catálogo.
 */
export const CATALOGO_CATEGORIAS_GASTO = [
    {
        id: 'Insumos / Producto (Tratamientos)',
        nombre: 'Insumos / Producto (Tratamientos)',
        grupo: 'Bolsa Producto Tratamientos',
        disponibleRecepcion: true,
        color: 'teal',
        motivos: [
            'Gel conductor / Ultrasonido',
            'Guantes, cubrebocas, gorros y desechables',
            'Gasas, algodón, hisopos y toallas desechables',
            'Jeringas, agujas, cánulas y punzones',
            'Antisépticos, alcohol, benzal y microdacyn',
            'Anestesia tópica / infiltrada',
            'Ampolletas, enzimas, activos y peelings faciales',
            'Ácido hialurónico / Toxina / Bioestimuladores',
            'Cremas, mascarillas y aceites de cabina',
            'Sábanas desechables y papel camilla',
            'Hojas de bisturí y material de curación',
        ],
    },
    {
        id: 'Limpieza, Higiene y Papelería',
        nombre: 'Limpieza, Higiene y Papelería',
        grupo: 'Operación Diaria / Recepción',
        disponibleRecepcion: true,
        color: 'sky',
        motivos: [
            'Garrafones de agua para pacientes y personal',
            'Café, té, azúcar, vasos y amenidades recepción',
            'Cloro, desinfectante, pino y jabón líquido',
            'Papel higiénico, sanitas e insumos de baño',
            'Bolsas de basura y bolsas RPBI',
            'Lavandería y tintorería (batas, toallas, sábanas)',
            'Aromatizantes y ambientales para clínica',
            'Hojas blancas, carpetas, plumas y papelería',
            'Impresión de formatos, expedientes y recibos',
            'Pilas, focos y consumibles menores de recepción',
        ],
    },
    {
        id: 'Inversión en Producto (Venta)',
        nombre: 'Inversión en Producto (Venta)',
        grupo: 'Inventario de Venta',
        disponibleRecepcion: true,
        color: 'emerald',
        motivos: [
            'Compra de productos dermatológicos / skincare para venta',
            'Fajas, tablas, espumas y accesorios post-operatorios',
            'Suplementos / colágeno / vitaminas para venta',
            'Kits de cuidado en casa para pacientes',
            'Bolsas de regalo, empaques y etiquetas de producto',
            'Flete / Envío / Paquetería de proveedor de productos',
        ],
    },
    {
        id: 'Comidas y Viáticos Operativos',
        nombre: 'Comidas y Viáticos Operativos',
        grupo: 'Operación Diaria / Recepción',
        disponibleRecepcion: true,
        color: 'amber',
        motivos: [
            'Alimentos / Comida del personal en jornada continua',
            'Agua / Bebidas / Refrigerios operativos',
            'Envío local / Uber Flash / Mandado de urgencia clínica',
            'Transporte / Taxi / Gasolina para diligencia de clínica',
            'Estacionamiento o casetas en comisión de trabajo',
        ],
    },
    {
        id: 'Mantenimiento e Instalaciones',
        nombre: 'Mantenimiento e Instalaciones',
        grupo: 'Operación e Instalaciones',
        disponibleRecepcion: true,
        color: 'orange',
        motivos: [
            'Mantenimiento de aire acondicionado / minisplit',
            'Reparación de plomería, baños o lavabos',
            'Reparación eléctrica, lámparas o contactos',
            'Cerrajería, llaves o chapas',
            'Fumigación y control de plagas',
            'Recolección de residuos peligrosos (RPBI)',
            'Pintura, resane o decoración de consultorios',
        ],
    },
    {
        id: 'Renta',
        nombre: 'Renta',
        grupo: 'Gasto Fijo Mensual',
        disponibleRecepcion: true,
        color: 'indigo',
        motivos: [
            'Pago de renta mensual del local',
            'Cuota de mantenimiento de plaza / edificio',
            'Abono o complemento de renta',
        ],
    },
    {
        id: 'Luz / CFE',
        nombre: 'Luz / CFE',
        grupo: 'Gasto Fijo Mensual',
        disponibleRecepcion: true,
        color: 'yellow',
        motivos: [
            'Pago de recibo de luz CFE',
            'Reconexión o revisión de medidor CFE',
        ],
    },
    {
        id: 'Internet y Teléfono',
        nombre: 'Internet y Teléfono',
        grupo: 'Gasto Fijo Mensual',
        disponibleRecepcion: true,
        color: 'blue',
        motivos: [
            'Pago mensual de Internet y telefonía fija',
            'Recarga o plan de celular de Recepción / WhatsApp',
            'Servicio de software / nube / dominio web',
        ],
    },
    {
        id: 'Agua',
        nombre: 'Agua',
        grupo: 'Gasto Fijo Mensual',
        disponibleRecepcion: true,
        color: 'cyan',
        motivos: [
            'Recibo mensual de agua potable',
            'Servicio de pipa de agua / limpieza de cisterna',
        ],
    },
    {
        id: 'Compra / Renovación de Equipo',
        nombre: 'Compra / Renovación de Equipo',
        grupo: 'Bolsa de Equipo',
        disponibleRecepcion: true,
        color: 'purple',
        motivos: [
            'Compra de equipo o aparatología estética',
            'Abono a financiamiento de equipo médico/estético',
            'Mantenimiento preventivo / calibración de aparatología',
            'Compra de manerales, cabezales, transductores o refacciones',
            'Compra de mobiliario (camilla, carrito, silla, lámpara)',
            'Equipo de cómputo, tablet, impresora o terminal bancaria',
        ],
    },
    {
        id: 'Nómina',
        nombre: 'Nómina',
        grupo: 'Personal y Comisiones',
        disponibleRecepcion: true,
        color: 'rose',
        motivos: [
            'Pago de sueldo base semanal / quincenal',
            'Liquidación de comisiones a especialista',
            'Adelanto de nómina autorizado',
            'Bono de productividad / meta alcanzada',
            'Pago de guardia, suplencia o apoyo por día',
        ],
    },
    {
        id: 'Marketing',
        nombre: 'Marketing',
        grupo: 'Crecimiento Comercial',
        disponibleRecepcion: true,
        color: 'pink',
        motivos: [
            'Publicidad pagada en Facebook / Instagram / TikTok Ads',
            'Impresión de flyers, lonas, tarjetas o cupones',
            'Producción de foto, video o diseño de contenido',
            'Colaboración con creadores / evento promocional',
            'Regalos o cortesías promocionales para pacientes',
        ],
    },
    {
        id: 'Impuestos, Contabilidad y Legales',
        nombre: 'Impuestos, Contabilidad y Legales',
        grupo: 'Administración y Cumplimiento',
        disponibleRecepcion: false,
        color: 'slate',
        motivos: [
            'Honorarios mensuales de contador',
            'Pago de impuestos SAT / declaraciones',
            'Cuotas IMSS / INFONAVIT / Impuesto sobre nómina',
            'Trámites y licencias COFEPRIS / Protección Civil / Ayuntamiento',
            'Comisiones bancarias / anualidad / renta de terminal',
        ],
    },
    {
        id: 'Otros Fijos',
        nombre: 'Otros Fijos',
        grupo: 'Gasto Fijo Mensual',
        disponibleRecepcion: true,
        color: 'gray',
        motivos: [
            'Seguro del local o responsabilidad civil',
            'Servicio de alarma, cámaras o seguridad',
            'Devolución o reembolso autorizado a paciente',
            'Gasto operativo extraordinario autorizado',
        ],
    },
];

export const CATEGORIAS_GASTO_NOMBRES = CATALOGO_CATEGORIAS_GASTO.map((c) => c.nombre);

export const ORIGENES_PAGO_GASTO = [
    { id: 'Efectivo en Caja', label: 'Efectivo (Caja del Día — Recepción)', afectaCajaDia: true },
    { id: 'Efectivo (Cortes Anteriores)', label: 'Efectivo (Resguardo / Cortes Anteriores)', afectaCajaDia: false },
    { id: 'Transferencia Bancaria', label: 'Transferencia Bancaria', afectaCajaDia: false },
    { id: 'Tarjeta de Crédito/Débito', label: 'Tarjeta de Crédito / Débito', afectaCajaDia: false },
];

export const DENOMINACIONES_ARQUEO = [
    { valor: 1000, label: 'Billetes $1,000', tipo: 'billete' },
    { valor: 500, label: 'Billetes $500', tipo: 'billete' },
    { valor: 200, label: 'Billetes $200', tipo: 'billete' },
    { valor: 100, label: 'Billetes $100', tipo: 'billete' },
    { valor: 50, label: 'Billetes $50', tipo: 'billete' },
    { valor: 20, label: 'Billetes $20', tipo: 'billete' },
    { valor: 10, label: 'Monedas $10', tipo: 'moneda' },
    { valor: 5, label: 'Monedas $5', tipo: 'moneda' },
    { valor: 2, label: 'Monedas $2', tipo: 'moneda' },
    { valor: 1, label: 'Monedas $1', tipo: 'moneda' },
    { valor: 0.5, label: 'Monedas $0.50', tipo: 'moneda' },
];

const CUSTOM_CATALOG_KEY = 'alfra_catalogo_gastos_custom_v1';

/**
 * Normaliza cualquier movimiento de egreso para garantizar que SIEMPRE tenga una categoría oficial.
 */
export const normalizarCategoriaGasto = (m = {}) => {
    if (m.staffId || m.folioNomina) return 'Nómina';
    const rawCat = String(m.categoria || '').trim();
    const matchExacto = CATALOGO_CATEGORIAS_GASTO.find(
        (c) => c.nombre.toLowerCase() === rawCat.toLowerCase()
    );
    if (matchExacto) return matchExacto.nombre;

    const texto = `${rawCat} ${m.motivo || ''} ${m.concepto || ''} ${m.descripcion || ''}`.toLowerCase();
    if (/nomina|nómina|sueldo|comision|comisión|pago a /.test(texto)) return 'Nómina';
    if (/renta|alquiler/.test(texto)) return 'Renta';
    if (/luz|cfe/.test(texto)) return 'Luz / CFE';
    if (/internet|telmex|izzi|totalplay|telefono|teléfono|celular/.test(texto)) return 'Internet y Teléfono';
    if (/recibo de agua|agua potable|pipa|cisterna/.test(texto)) return 'Agua';
    if (/garrafon|garrafón|limpieza|cloro|jabon|jabón|papel|lavanderia|lavandería|toalla|café|cafe|papeleria|papelería/.test(texto)) {
        return 'Limpieza, Higiene y Papelería';
    }
    if (/inversion en producto \(venta\)|producto.*venta|faja|skincare/.test(texto)) return 'Inversión en Producto (Venta)';
    if (/insumo|tratamiento|gel|guante|jeringa|acido|ácido|toxina|ampolleta|cabina|material medico|material médico/.test(texto)) {
        return 'Insumos / Producto (Tratamientos)';
    }
    if (/equipo|aparatolog|maquina|máquina|maneral|cabezal|camilla|mobiliario/.test(texto)) return 'Compra / Renovación de Equipo';
    if (/marketing|publicidad|facebook|instagram|tiktok|flyer|lona/.test(texto)) return 'Marketing';
    if (/mantenimiento|plomeria|plomería|clima|minisplit|aire acondicionado|fumigac|rpbi|electric/.test(texto)) return 'Mantenimiento e Instalaciones';
    if (/impuesto|contador|contabilidad|sat|imss|cofepris|legal/.test(texto)) return 'Impuestos, Contabilidad y Legales';
    if (/comida|alimento|viatico|viático|uber|envio|envío|gasolina|taxi/.test(texto)) return 'Comidas y Viáticos Operativos';
    return 'Otros Fijos';
};

export const esGastoDeCajaDelDia = (m = {}) => {
    if (m.tipo !== 'Egreso' || m.estado === 'Cancelado') return false;
    const met = String(m.metodoPago || '').toLowerCase();
    if (met.includes('cortes anterior') || met.includes('resguardo')) return false;
    if (met.includes('transfer') || met.includes('tarjeta') || met.includes('banco')) return false;
    return met.includes('efectivo') || met.includes('caja') || met === '';
};

/**
 * Obtiene el catálogo completo combinando el catálogo base con motivos personalizados guardados.
 */
export const obtenerCatalogoGastosCompleto = async () => {
    let customMap = {};
    try {
        const local = localStorage.getItem(CUSTOM_CATALOG_KEY);
        if (local) customMap = JSON.parse(local);
    } catch {}

    try {
        const snap = await getDoc(doc(db, 'configuracion', 'catalogo_gastos'));
        if (snap.exists() && snap.data().motivosPorCategoria) {
            customMap = { ...customMap, ...snap.data().motivosPorCategoria };
            try { localStorage.setItem(CUSTOM_CATALOG_KEY, JSON.stringify(customMap)); } catch {}
        }
    } catch {}

    return CATALOGO_CATEGORIAS_GASTO.map((cat) => {
        const extras = Array.isArray(customMap[cat.nombre]) ? customMap[cat.nombre] : [];
        const unidos = Array.from(new Set([...cat.motivos, ...extras]));
        return { ...cat, motivos: unidos };
    });
};

export const agregarMotivoPersonalizadoGasto = async (categoriaNombre, nuevoMotivo) => {
    const limpio = String(nuevoMotivo || '').trim();
    if (!categoriaNombre || !limpio) return;
    let customMap = {};
    try {
        const local = localStorage.getItem(CUSTOM_CATALOG_KEY);
        if (local) customMap = JSON.parse(local);
    } catch {}

    const prev = Array.isArray(customMap[categoriaNombre]) ? customMap[categoriaNombre] : [];
    if (!prev.includes(limpio)) {
        customMap[categoriaNombre] = [...prev, limpio];
    }
    try { localStorage.setItem(CUSTOM_CATALOG_KEY, JSON.stringify(customMap)); } catch {}
    try {
        await setDoc(
            doc(db, 'configuracion', 'catalogo_gastos'),
            { motivosPorCategoria: customMap, updatedAt: new Date().toISOString() },
            { merge: true }
        );
    } catch (err) {
        console.error('Error guardando motivo personalizado en Firestore:', err);
    }
};

/**
 * Genera un ISO string usando la hora LOCAL del dispositivo.
 */
export const toLocalISOString = (date = new Date()) => {
    const offset = date.getTimezoneOffset();
    const localDate = new Date(date.getTime() - offset * 60000);
    return localDate.toISOString().replace('Z', '');
};

/**
 * Registrar un movimiento financiero (Ingreso o Egreso).
 * Garantiza que todo Egreso lleve SIEMPRE sin excepción una categoría oficial alineada.
 */
export const registrarMovimiento = async (data) => {
    try {
        const payload = {
            ...data,
            monto: Number(data.monto) || 0,
            createdAt: data.fecha || toLocalISOString(),
        };

        if (payload.tipo === 'Egreso') {
            payload.categoria = normalizarCategoriaGasto(payload);
            if (!payload.metodoPago) {
                payload.metodoPago = 'Efectivo en Caja';
            }
            if (!payload.estado) {
                payload.estado = 'Pagado';
            }
        } else if (payload.tipo === 'Ingreso') {
            if (!payload.categoria) {
                payload.categoria = payload.subTipo === 'abono_tratamiento'
                    ? 'Planes de Tratamiento'
                    : payload.productoId
                        ? 'Venta de Productos'
                        : 'Servicios y Consultas';
            }
            if (!payload.estado) {
                payload.estado = 'Completado';
            }
        }

        const docRef = await addDoc(FINANZAS_COL, payload);
        return docRef.id;
    } catch (error) {
        console.error('Error registering movimiento:', error);
        throw error;
    }
};

// Obtener flujo de caja para Dashboard Admin (KPIs)
export const getFlujoCaja = async () => {
    try {
        const q = query(FINANZAS_COL, orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        const movimientos = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

        const ingresos = movimientos
            .filter((m) => m.tipo === 'Ingreso' && m.estado !== 'Cancelado')
            .reduce((acc, sum) => acc + Number(sum.monto), 0);
        const egresos = movimientos
            .filter((m) => m.tipo === 'Egreso' && m.estado !== 'Cancelado')
            .reduce((acc, sum) => acc + Number(sum.monto), 0);

        return {
            ingresos,
            egresos,
            gananciaNeta: ingresos - egresos,
            historial: movimientos,
        };
    } catch (error) {
        console.error('Error calculating cash flow:', error);
        return { ingresos: 0, egresos: 0, gananciaNeta: 0, historial: [] };
    }
};

export const registrarAbonoAhorro = async (pacienteId, monto, motivo) => {
    try {
        await registrarMovimiento({
            tipo: 'Ingreso',
            monto,
            motivo: `Abono Cirugía: ${motivo}`,
            fecha: toLocalISOString(),
            pacienteAsociado: pacienteId,
        });
        return true;
    } catch (error) {
        console.error('Error en flujo de pagos de ahorro:', error);
        throw error;
    }
};

// Escuchar movimientos financieros en tiempo real
export const onMovimientosChange = (callback) => {
    const q = query(FINANZAS_COL, orderBy('createdAt', 'desc'));
    return onSnapshot(
        q,
        (snapshot) => {
            const movimientos = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
            callback(movimientos);
        },
        (error) => {
            console.error('Error in movimientos listener:', error);
            callback([]);
        }
    );
};

// Escuchar cajas diarias (Fondo inicial, Arqueos de recepción, Retiros y Cierres) en tiempo real
export const onCajasDiariasChange = (callback) => {
    return onSnapshot(
        CAJAS_DIARIAS_COL,
        (snapshot) => {
            const map = {};
            snapshot.docs.forEach((d) => {
                map[d.id] = { id: d.id, ...d.data() };
            });
            callback(map);
        },
        (error) => {
            console.error('Error in cajas_diarias listener:', error);
            callback({});
        }
    );
};

export const guardarCajaDiaria = async (fechaStr, data) => {
    if (!fechaStr) return;
    const ref = doc(db, 'cajas_diarias', fechaStr);
    await setDoc(
        ref,
        {
            fecha: fechaStr,
            ...data,
            updatedAt: new Date().toISOString(),
        },
        { merge: true }
    );
};

// Obtener movimientos de la semana actual
export const getMovimientosSemana = async () => {
    try {
        const startOfWeekDate = new Date();
        startOfWeekDate.setDate(startOfWeekDate.getDate() - startOfWeekDate.getDay());
        startOfWeekDate.setHours(0, 0, 0, 0);
        const q = query(FINANZAS_COL, where('createdAt', '>=', startOfWeekDate.toISOString()), orderBy('createdAt', 'asc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (error) {
        console.error('Error getting semana movimientos:', error);
        return [];
    }
};

/**
 * Construye los cortes por día combinando todos los movimientos financieros (Ingresos y Egresos)
 * con la información de la caja diaria (fondo inicial, arqueo de recepción, retiros).
 * Sin límite artificial de 30 días.
 */
export const construirCortesPorDia = (movimientos = [], cajasMap = {}, aprobadosMap = {}) => {
    const cortesMap = {};

    const ensureDay = (fecha) => {
        if (!cortesMap[fecha]) {
            const cajaDoc = cajasMap[fecha] || {};
            cortesMap[fecha] = {
                fecha,
                ingresosTotales: 0,
                ingresosEfectivo: 0,
                ingresosTarjeta: 0,
                ingresosTransferencia: 0,
                egresosTotales: 0,
                egresosEfectivoCaja: 0,
                egresosOtrosMedios: 0,
                egresosPorCategoria: {},
                // Compatibilidad y saldos netos por canal
                efectivo: 0,
                tarjeta: 0,
                transferencia: 0,
                fondoInicial: Number(cajaDoc.fondoInicial) || 0,
                retirosEfectivo: Array.isArray(cajaDoc.retirosEfectivo) ? cajaDoc.retirosEfectivo : [],
                totalRetiros: (Array.isArray(cajaDoc.retirosEfectivo) ? cajaDoc.retirosEfectivo : []).reduce(
                    (acc, r) => acc + (Number(r.monto) || 0),
                    0
                ),
                arqueo: cajaDoc.arqueo || null,
                entregadoRecepcion: Boolean(cajaDoc.entregadoRecepcion),
                entregadoPor: cajaDoc.entregadoPor || '',
                entregadoEn: cajaDoc.entregadoEn || null,
                notasRecepcion: cajaDoc.notasRecepcion || '',
                cierreAdmin: cajaDoc.cierreAdmin || null,
                estado: aprobadosMap[fecha] || cajaDoc.estado === 'Aprobado' ? 'Aprobado' : 'Pendiente Revisión',
                movimientos: [],
            };
        }
        return cortesMap[fecha];
    };

    // Asegurar días que tengan caja abierta aunque aún no tengan movimientos
    Object.keys(cajasMap || {}).forEach((f) => {
        if (/^\d{4}-\d{2}-\d{2}$/.test(f)) ensureDay(f);
    });

    movimientos.forEach((m) => {
        const rawFecha = m.fecha || m.createdAt || '';
        const fecha = rawFecha ? String(rawFecha).substring(0, 10) : 'Sin fecha';
        if (fecha === 'Sin fecha') return;
        const c = ensureDay(fecha);
        const monto = Number(m.monto) || 0;

        const mNorm = m.tipo === 'Egreso'
            ? { ...m, categoria: normalizarCategoriaGasto(m) }
            : m;

        if (mNorm.tipo === 'Ingreso' && mNorm.estado !== 'Cancelado') {
            c.ingresosTotales += monto;
            // Soporte para cobros con desglose mixto (efectivo + tarjeta + transferencia)
            if (mNorm.desglosePago && typeof mNorm.desglosePago === 'object') {
                const ef = Number(mNorm.desglosePago.efectivo) || 0;
                const tj = Number(mNorm.desglosePago.tarjeta) || 0;
                const tr = Number(mNorm.desglosePago.transferencia) || 0;
                c.ingresosEfectivo += ef;
                c.ingresosTarjeta += tj;
                c.ingresosTransferencia += tr;
                c.efectivo += ef;
                c.tarjeta += tj;
                c.transferencia += tr;
            } else {
                const metodo = String(mNorm.metodoPago || '').toLowerCase();
                if (metodo.includes('tarjeta') || metodo.includes('debito') || metodo.includes('credito')) {
                    c.ingresosTarjeta += monto;
                    c.tarjeta += monto;
                } else if (metodo.includes('transfer')) {
                    c.ingresosTransferencia += monto;
                    c.transferencia += monto;
                } else if (metodo.includes('cortesia') || metodo.includes('puntos')) {
                    // Cortesía $0
                } else {
                    c.ingresosEfectivo += monto;
                    c.efectivo += monto;
                }
            }
        } else if (mNorm.tipo === 'Egreso' && mNorm.estado !== 'Cancelado') {
            c.egresosTotales += monto;
            const cat = mNorm.categoria;
            c.egresosPorCategoria[cat] = (c.egresosPorCategoria[cat] || 0) + monto;

            const metodo = String(mNorm.metodoPago || '').toLowerCase();
            if (esGastoDeCajaDelDia(mNorm)) {
                c.egresosEfectivoCaja += monto;
                c.efectivo -= monto;
            } else {
                c.egresosOtrosMedios += monto;
                if (metodo.includes('tarjeta')) c.tarjeta -= monto;
                else if (metodo.includes('transfer')) c.transferencia -= monto;
            }
        }

        c.movimientos.push(mNorm);
    });

    return Object.values(cortesMap)
        .map((c) => {
            const efectivoEsperadoEnCajon = c.fondoInicial + c.ingresosEfectivo - c.egresosEfectivoCaja - c.totalRetiros;
            const contadoFisico = c.arqueo && c.arqueo.totalContado !== undefined && c.arqueo.totalContado !== null
                ? Number(c.arqueo.totalContado)
                : null;
            const diferenciaArqueo = contadoFisico !== null ? contadoFisico - efectivoEsperadoEnCajon : null;
            return {
                ...c,
                efectivoEsperadoEnCajon,
                contadoFisico,
                diferenciaArqueo,
                utilidadNetaDia: c.ingresosTotales - c.egresosTotales,
            };
        })
        .sort((a, b) => b.fecha.localeCompare(a.fecha));
};

// Obtener corte de caja por fecha (función asíncrona compatible con llamadas existentes)
export const getCortesPorDia = async () => {
    try {
        const [movSnap, cajasSnap, apList] = await Promise.all([
            getDocs(query(FINANZAS_COL, orderBy('createdAt', 'desc'))),
            getDocs(CAJAS_DIARIAS_COL),
            getCortesAprobados(),
        ]);
        const movimientos = movSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const cajasMap = {};
        cajasSnap.docs.forEach((d) => { cajasMap[d.id] = { id: d.id, ...d.data() }; });
        const aprobadosMap = {};
        apList.forEach((f) => { aprobadosMap[f] = true; });
        return construirCortesPorDia(movimientos, cajasMap, aprobadosMap);
    } catch (error) {
        console.error('Error getting cortes:', error);
        return [];
    }
};

// Solicitar cancelación de un movimiento (Recepcionista)
export const solicitarCancelacionMovimiento = async (id, motivo) => {
    try {
        const docRef = doc(FINANZAS_COL, id);
        await updateDoc(docRef, {
            estado: 'Pendiente Cancelación',
            motivoCancelacion: motivo,
            fechaSolicitudCancelacion: new Date().toISOString(),
        });
        return true;
    } catch (error) {
        console.error('Error solicitando cancelación:', error);
        throw error;
    }
};

// Procesar solicitud de cancelación (Administrador)
export const procesarCancelacionMovimiento = async (id, aprobado) => {
    try {
        const docRef = doc(FINANZAS_COL, id);
        if (aprobado) {
            const snap = await getDoc(docRef);
            const movData = snap.exists() ? snap.data() : null;

            await updateDoc(docRef, {
                estado: 'Cancelado',
                fechaCancelacion: new Date().toISOString(),
            });

            // 1. Revertir stock de inventario si fue venta de producto
            if (movData?.productoId && movData?.cantidadVendida) {
                try {
                    const invRef = doc(db, 'inventario', movData.productoId);
                    const invSnap = await getDoc(invRef);
                    if (invSnap.exists()) {
                        const stockActual = Number(invSnap.data().stock) || 0;
                        await updateDoc(invRef, {
                            stock: stockActual + Number(movData.cantidadVendida),
                            updatedAt: new Date().toISOString(),
                        });
                    }
                } catch (invErr) {
                    console.error('Error revirtiendo stock:', invErr);
                }
            }

            // 2. Revertir comisiones del empleado si fue pago de nómina
            if (movData?.staffId && movData?.folioNomina) {
                try {
                    const staffRef = doc(db, 'staff', movData.staffId);
                    const staffSnap = await getDoc(staffRef);
                    if (staffSnap.exists()) {
                        const staffData = staffSnap.data();
                        const historialPagos = staffData.historialPagos || [];
                        const pagoIndex = historialPagos.findIndex((p) => p.folio === movData.folioNomina);

                        if (pagoIndex !== -1) {
                            const pagoRevertido = historialPagos[pagoIndex];
                            const saldoActual = Number(staffData.saldoComisiones) || 0;
                            const comisionesRestauradas = pagoRevertido.historialComisiones || [];
                            const nuevoHistorialPagos = historialPagos.filter((_, i) => i !== pagoIndex);

                            await updateDoc(staffRef, {
                                saldoComisiones: saldoActual + Number(pagoRevertido.totalComisiones || 0),
                                historialComisiones: comisionesRestauradas,
                                historialPagos: nuevoHistorialPagos,
                                updatedAt: new Date().toISOString(),
                            });
                        }
                    }
                } catch (staffErr) {
                    console.error('Error revirtiendo comisiones de nómina:', staffErr);
                }
            }

            // 3. Revertir saldo de paquete de tratamiento y borrar recibo
            if (movData?.subTipo === 'abono_tratamiento' && movData?.pacienteNombre) {
                try {
                    const motivo = movData.motivo || '';
                    const match = motivo.match(/\(([^)]+)\)$/);
                    const objetivo = match ? match[1] : '';

                    if (objetivo) {
                        const planesCol = collection(db, 'planes');
                        const q = query(planesCol, where('paciente', '==', movData.pacienteNombre), where('objetivo', '==', objetivo));
                        const snapPlanes = await getDocs(q);
                        if (!snapPlanes.empty) {
                            const planDoc = snapPlanes.docs[0];
                            const planData = planDoc.data();
                            const nuevoAcumulado = Math.max(0, (parseFloat(planData.acumulado) || 0) - parseFloat(movData.monto));
                            await updateDoc(planDoc.ref, {
                                acumulado: nuevoAcumulado,
                                morosidad: nuevoAcumulado < parseFloat(planData.meta) * 0.1,
                                updatedAt: new Date().toISOString(),
                            });
                        }
                    }

                    if (movData.reciboId) {
                        await deleteDoc(doc(db, 'recibos', movData.reciboId));
                    }
                } catch (planErr) {
                    console.error('Error revirtiendo saldo de paquete:', planErr);
                }
            }
        } else {
            await updateDoc(docRef, {
                estado: 'Completado',
                motivoCancelacion: deleteField(),
                fechaSolicitudCancelacion: deleteField(),
            });
        }
        return true;
    } catch (error) {
        console.error('Error procesando cancelación:', error);
        throw error;
    }
};

// Actualizar un movimiento existente (Editar - Administrador)
export const actualizarMovimiento = async (id, nuevaData) => {
    try {
        const docRef = doc(FINANZAS_COL, id);
        const payload = {
            ...nuevaData,
            updatedAt: new Date().toISOString(),
        };
        if (payload.tipo === 'Egreso') {
            payload.categoria = normalizarCategoriaGasto(payload);
        }
        await updateDoc(docRef, payload);
        return true;
    } catch (error) {
        console.error('Error actualizando movimiento:', error);
        throw error;
    }
};

// Aprobar Corte de Caja Diario Permanentemente (con detalles opcionales de cierre)
export const aprobarCorteDefinitivo = async (fecha, detallesCierre = {}) => {
    try {
        await addDoc(collection(db, 'cortes_aprobados'), {
            fecha,
            ...detallesCierre,
            aprobadoEn: new Date().toISOString(),
        });
        await guardarCajaDiaria(fecha, {
            estado: 'Aprobado',
            cierreAdmin: {
                ...detallesCierre,
                aprobadoEn: new Date().toISOString(),
            },
        });
        return true;
    } catch (error) {
        console.error('Error aprobando corte:', error);
        throw error;
    }
};

// Obtener lista de fechas con corte ya aprobado
export const getCortesAprobados = async () => {
    try {
        const snapshot = await getDocs(collection(db, 'cortes_aprobados'));
        return snapshot.docs.map((d) => d.data().fecha);
    } catch (error) {
        console.error('Error getting cortes aprobados:', error);
        return [];
    }
};
