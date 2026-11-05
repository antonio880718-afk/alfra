import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import {
    PlusCircle, Edit, Trash2, Tag, DollarSign, Package, Percent, Upload, X,
    Search, Clock, Target, Sparkles, CheckCircle2, Download, FileSpreadsheet,
    AlertTriangle, ArrowRight, CheckSquare, Square, Megaphone, Calendar, RefreshCw
} from 'lucide-react';
import {
    getFlyers, uploadFlyer, uploadFlyersBatch, deleteFlyer, deleteFlyersBatch,
    onControlFlyersMensualChange, marcarFlyersMesCompletado
} from '../../services/flyersService';
import {
    onServiciosChange, createServicio, updateServicio, deleteServicio,
    onCuponesChange, createCupon, updateCupon, deleteCupon,
    parseVigenciaCupon, isCuponVigente
} from '../../services/comercialService';
import { useAuth } from '../../contexts/AuthContext';

export const CATEGORIAS_SERVICIO = [
    'Facial',
    'Corporal',
    'Depilación Láser',
    'Despigmentación',
    'Masajes y Spa',
    'Capilar',
    'Post-Operatorio',
    'Médico / Especializado',
    'Otro',
];

export const PRIORIDADES_PLAN = [
    { id: 'alta', label: 'Alta (Servicio Estrella — Mayor volumen diario)', peso: 3 },
    { id: 'media', label: 'Media (Demanda Regular)', peso: 2 },
    { id: 'baja', label: 'Baja (Complementario / Ocasional)', peso: 1 },
];

/** Determina si un item del catálogo es un paquete/plan o no debe tratarse como sesión suelta */
export const detectEsPaquete = (item) => {
    if (!item) return false;
    if (typeof item.esPaquete === 'boolean') return item.esPaquete;
    if (item.tipo === 'Paquete / Plan Tratamiento' || item.tipo === 'Paquete') return true;
    const n = String(item.nombre || '').toLowerCase();
    return /\(\s*paq|\bpaquete\b|efecto lipo sin bisturi/i.test(n);
};

export const detectIncluirEnPlan = (item) => {
    if (!item) return false;
    if (typeof item.incluirEnPlanDiario === 'boolean') return item.incluirEnPlanDiario;
    if (detectEsPaquete(item)) return false;
    if (item.tipo === 'Producto Físico (Venta)') return false;
    const precio = Number(item.precioVenta) || 0;
    return precio >= 50 && precio <= 15000;
};

const inferCategoria = (nombre = '') => {
    const n = String(nombre).toLowerCase();
    if (/despigment|aclarad|mancha/i.test(n)) return 'Despigmentación';
    if (/l[aá]ser|depilaci/i.test(n)) return 'Depilación Láser';
    if (/facial|dermapen|acn[eé]|melasma|peel|glow|microdermo/i.test(n)) return 'Facial';
    if (/post\s*operatorio|pre\s*operatorio|lipoescultura/i.test(n)) return 'Post-Operatorio';
    if (/masaje|relajante|piedras|spa|chakras/i.test(n)) return 'Masajes y Spa';
    if (/capilar|cabello/i.test(n)) return 'Capilar';
    if (/reductivo|anticelulitis|papada|lipoenzimas|gl[uú]teo|abdomen|brazos|body/i.test(n)) return 'Corporal';
    if (/cx|rinoplastia|escleroterapia|botox|valoraci/i.test(n)) return 'Médico / Especializado';
    return 'Facial';
};

const normalizarNombre = (str = '') =>
    String(str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

const emptyForm = {
    nombre: '',
    categoria: 'Facial',
    tipo: 'Servicio Individual',
    esPaquete: false,
    duracionMin: 60,
    numeroSesiones: 1,
    costoInsumos: '',
    comisionPct: 15,
    precioVenta: '',
    incluirEnPlanDiario: true,
    prioridadPlan: 'media',
    metaDiariaManual: '',
    itemsIncluidos: [],
    cuponId: '',
};

const CSV_HEADERS = [
    'Nombre',
    'Tipo',
    'Categoria',
    'Precio_Venta',
    'Numero_Sesiones',
    'Duracion_Min',
    'Costo_Insumos',
    'Comision_Pct',
    'Incluir_Plan_Diario',
    'Prioridad_Plan',
    'Servicios_Incluidos',
    'Cupon_Codigo',
    'Cupon_Descuento',
    'Cupon_Tipo',
    'Cupon_Vigencia',
    'Anticipo_20_Sesion_1',
    'Pago_Sesion_2_a_Fin'
];

// Parser CSV/TSV robusto con soporte para comillas y pegado desde Excel
const parseCsvOrTsvText = (rawText = '') => {
    const lines = String(rawText || '')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .split('\n')
        .filter(l => l.trim().length > 0 && !l.trim().startsWith('#'));

    if (lines.length === 0) return [];

    // Detectar delimitador predominante en la primera línea (tabulador, coma o punto y coma)
    const firstLine = lines[0];
    let delimiter = ',';
    if (firstLine.split('\t').length >= 4) delimiter = '\t';
    else if (firstLine.split(';').length > firstLine.split(',').length) delimiter = ';';

    const splitRow = (line) => {
        if (delimiter === '\t') return line.split('\t').map(c => c.trim().replace(/^"|"$/g, ''));
        const res = [];
        let cur = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    cur += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (ch === delimiter && !inQuotes) {
                res.push(cur.trim());
                cur = '';
            } else {
                cur += ch;
            }
        }
        res.push(cur.trim());
        return res;
    };

    const rows = lines.map(splitRow);
    // Verificar si la primera fila es cabecera
    const h0 = normalizarNombre(rows[0][0] || '');
    const startIdx = (h0 === 'nombre' || h0.includes('servicio')) ? 1 : 0;

    const parsedItems = [];
    for (let i = startIdx; i < rows.length; i++) {
        const r = rows[i];
        const nombre = String(r[0] || '').trim();
        if (!nombre) continue;

        const tipoRaw = String(r[1] || 'Servicio Individual').trim();
        const esPaq = /paquete|plan/i.test(tipoRaw) || detectEsPaquete({ nombre, tipo: tipoRaw });
        const tipoFinal = esPaq ? 'Paquete / Plan Tratamiento' : 'Servicio Individual';
        const categoria = r[2] ? String(r[2]).trim() : inferCategoria(nombre);
        const precioClean = String(r[3] ?? '0').replace(/[^0-9.-]/g, '');
        const precioVenta = Math.max(0, Number(precioClean) || 0);
        const numSesRaw = parseInt(String(r[4] ?? '').replace(/[^0-9]/g, ''), 10);
        const numeroSesiones = esPaq ? (numSesRaw > 0 ? numSesRaw : 10) : (numSesRaw > 0 ? numSesRaw : 1);
        const durRaw = parseInt(String(r[5] ?? '').replace(/[^0-9]/g, ''), 10);
        const duracionMin = durRaw >= 5 ? durRaw : 60;
        const costoInsumos = Math.max(0, Number(String(r[6] ?? '0').replace(/[^0-9.-]/g, '')) || 0);
        const comisionPct = Math.max(0, Math.min(100, Number(String(r[7] ?? '15').replace(/[^0-9.-]/g, '')) || 15));
        const incRaw = normalizarNombre(r[8] || (esPaq ? 'no' : 'si'));
        const incluirEnPlanDiario = esPaq ? false : (incRaw === 'si' || incRaw === 'true' || incRaw === '1' || incRaw === 'activo');
        const prioRaw = normalizarNombre(r[9] || 'media');
        const prioridadPlan = ['alta', 'media', 'baja'].includes(prioRaw) ? prioRaw : 'media';
        const incluidosRaw = String(r[10] || '').trim();
        const itemsIncluidos = incluidosRaw
            ? incluidosRaw.split(/\+|\|/).map(s => s.trim()).filter(Boolean)
            : [];

        // Datos de cupón opcionales en la fila
        const cuponCodigo = String(r[11] || '').trim().toUpperCase();
        const cuponDescRaw = String(r[12] || '').trim();
        const cuponTipoRaw = String(r[13] || '').trim();
        const cuponVigenciaRaw = String(r[14] || '').trim();

        let cuponTipo = 'Porcentaje';
        if (cuponDescRaw.includes('$') || /fijo|monto|\$/i.test(cuponTipoRaw)) {
            cuponTipo = 'Monto Fijo';
        }
        const cuponDescuento = Math.max(0, Number(cuponDescRaw.replace(/[^0-9.-]/g, '')) || 0);

        parsedItems.push({
            nombre,
            tipo: tipoFinal,
            esPaquete: esPaq,
            categoria,
            precioVenta,
            numeroSesiones,
            duracionMin,
            costoInsumos,
            comisionPct,
            incluirEnPlanDiario,
            prioridadPlan,
            itemsIncluidos,
            cuponCodigo: cuponCodigo && cuponDescuento > 0 ? cuponCodigo : '',
            cuponDescuento: cuponCodigo && cuponDescuento > 0 ? cuponDescuento : 0,
            cuponTipo,
            cuponVigenciaRaw
        });
    }
    return parsedItems;
};

export default function GestionComercial() {
    const { currentUser } = useAuth();
    const [activeView, setActiveView] = useState('catalogo'); // 'catalogo' o 'flyers'
    const [filtroCatalogo, setFiltroCatalogo] = useState('todos'); // 'todos' | 'sueltos' | 'paquetes' | 'plan'
    const [servicios, setServicios] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [cupones, setCupones] = useState([]);

    const [isItemModalOpen, setIsItemModalOpen] = useState(false);
    const [isCouponModalOpen, setIsCouponModalOpen] = useState(false);

    // Coupon form refs
    const couponCodeRef = useRef(null);
    const couponValueRef = useRef(null);
    const couponTypeRef = useRef(null);
    const couponVigenciaRef = useRef(null);

    // Control mensual de flyers
    const [controlFlyersMes, setControlFlyersMes] = useState({
        mesActual: '',
        nombreMesActual: '',
        completadoEsteMes: true
    });
    const [marcandoFlyersMes, setMarcandoFlyersMes] = useState(false);

    // Estado para Plantilla / Carga Masiva y Auditoría de Variaciones (Solo Web)
    const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
    const [bulkPasteText, setBulkPasteText] = useState('');
    const [bulkAnalysis, setBulkAnalysis] = useState(null); // { nuevos: [], variaciones: [], sinCambios: [], cuponesDetectados: [] }
    const [acceptedNewIds, setAcceptedNewIds] = useState({});
    const [acceptedVarIds, setAcceptedVarIds] = useState({});
    const [acceptedCuponIds, setAcceptedCuponIds] = useState({});
    const [applyingBulk, setApplyingBulk] = useState(false);
    const bulkFileInputRef = useRef(null);

    // Estado de Flyers (Subida Masiva y Eliminación Masiva)
    const [flyers, setFlyers] = useState([]);
    const [isFlyerModalOpen, setIsFlyerModalOpen] = useState(false);
    const [batchFlyersQueue, setBatchFlyersQueue] = useState([]); // [{ id, file, title, preview }]
    const [selectedFlyerIds, setSelectedFlyerIds] = useState({});
    const [loadingFlyers, setLoadingFlyers] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadStep, setUploadStep] = useState('');
    const [deletingBatch, setDeletingBatch] = useState(false);

    useEffect(() => {
        const unsubServicios = onServiciosChange(setServicios);
        const unsubCupones = onCuponesChange(setCupones);
        const unsubControlFlyers = onControlFlyersMensualChange(setControlFlyersMes);
        return () => {
            unsubServicios();
            unsubCupones();
            if (unsubControlFlyers) unsubControlFlyers();
        };
    }, []);

    const loadFlyers = async () => {
        setLoadingFlyers(true);
        try {
            const data = await getFlyers();
            setFlyers(data);
            setSelectedFlyerIds({});
        } catch (error) {
            console.error(error);
        } finally {
            setLoadingFlyers(false);
        }
    };

    useEffect(() => {
        if (activeView === 'flyers') {
            loadFlyers();
        }
    }, [activeView]);

    const [editingItem, setEditingItem] = useState(null);
    const [formData, setFormData] = useState(emptyForm);

    const formatCurrency = (amount) => `$${Number(amount || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    // Mapa rápido de cupones por ID y por Código
    const cuponById = useMemo(() => {
        const map = {};
        cupones.forEach(c => { map[c.id] = c; });
        return map;
    }, [cupones]);

    const cuponByCode = useMemo(() => {
        const map = {};
        cupones.forEach(c => {
            if (c.codigo) map[String(c.codigo).toUpperCase().trim()] = c;
        });
        return map;
    }, [cupones]);

    // ─── EXPORTAR CATÁLOGO ACTUAL A PLANTILLA CSV (UTF-8 CON BOM PARA EXCEL) ──────
    const handleDescargarPlantillaActual = () => {
        const escapeCell = (val) => {
            const s = String(val ?? '').replace(/"/g, '""');
            return /[",;\n]/.test(s) ? `"${s}"` : s;
        };

        const rows = [CSV_HEADERS.join(',')];

        // Ordenar primero servicios sueltos y luego paquetes por nombre
        const sorted = [...servicios].sort((a, b) => {
            const paqA = detectEsPaquete(a) ? 1 : 0;
            const paqB = detectEsPaquete(b) ? 1 : 0;
            if (paqA !== paqB) return paqA - paqB;
            return String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es');
        });

        sorted.forEach(item => {
            const esPaq = detectEsPaquete(item);
            const cat = item.categoria || inferCategoria(item.nombre);
            const numSes = Number(item.numeroSesiones) || (esPaq ? 10 : 1);
            const dur = Number(item.duracionMin) || 60;
            const insumo = Number(item.costoInsumos) || 0;
            const comPct = Number(item.comisionPct ?? 15);
            const precio = Number(item.precioVenta) || 0;
            const enPlan = !esPaq && detectIncluirEnPlan(item) ? 'SI' : 'NO';
            const prio = item.prioridadPlan || 'media';
            const incluidos = Array.isArray(item.itemsIncluidos) ? item.itemsIncluidos.join(' + ') : '';

            const cup = item.cuponId ? cuponById[item.cuponId] : (item.cuponCodigo ? cuponByCode[String(item.cuponCodigo).toUpperCase()] : null);
            const cupCodigo = cup ? cup.codigo : (item.cuponCodigo || '');
            const cupDescuento = cup ? cup.descuento : '';
            const cupTipo = cup ? (cup.tipo || 'Porcentaje') : '';
            const cupVigencia = cup ? (cup.fechaFin || cup.vigenciaTexto || '') : '';

            const anticipo20 = esPaq ? Math.round((precio * 0.20) * 100) / 100 : '';
            const pagoRestante = esPaq ? Math.round(((precio * 0.80) / Math.max(1, numSes - 1)) * 100) / 100 : '';

            rows.push([
                escapeCell(item.nombre || ''),
                escapeCell(esPaq ? 'Paquete' : 'Servicio Individual'),
                escapeCell(cat),
                escapeCell(precio),
                escapeCell(numSes),
                escapeCell(dur),
                escapeCell(insumo),
                escapeCell(comPct),
                escapeCell(enPlan),
                escapeCell(prio),
                escapeCell(incluidos),
                escapeCell(cupCodigo),
                escapeCell(cupDescuento),
                escapeCell(cupTipo),
                escapeCell(cupVigencia),
                escapeCell(anticipo20),
                escapeCell(pagoRestante)
            ].join(','));
        });

        // Si el catálogo estuviera vacío, incluir 4 filas de ejemplo
        if (sorted.length === 0) {
            rows.push('Hidrafacial + Dermapen,Servicio Individual,Facial,950,1,60,130,15,SI,alta,,GLOW20,20,Porcentaje,15 dias');
            rows.push('Paquete Reductivo Body Fit,Paquete,Corporal,4800,12,60,650,15,NO,media,Cavitación + Radiofrecuencia + Drenaje,BODY500,500,Monto Fijo,2026-11-30');
            rows.push('Depilación Láser Cuerpo Completo,Paquete,Depilación Láser,6500,10,60,500,15,NO,alta,10 sesiones láser diodo,,,,');
            rows.push('Protocolo Despigmentante Axilas,Paquete,Despigmentación,3200,8,45,350,15,NO,media,Peeling despigmentante + LED,,,,');
        }

        const csvString = '\uFEFF' + rows.join('\r\n');
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const fechaHoy = new Date().toISOString().split('T')[0];
        link.href = url;
        link.setAttribute('download', `Plantilla_Servicios_Paquetes_Cupones_ALFRA_${fechaHoy}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    // ─── ANALIZAR PLANTILLA Y DETECTAR VARIACIONES Y CUPONES ─────────────────────
    const analizarFilasImportadas = (parsedRows = []) => {
        const mapExistentes = {};
        servicios.forEach(s => {
            mapExistentes[normalizarNombre(s.nombre)] = s;
        });

        const nuevos = [];
        const variaciones = [];
        const sinCambios = [];
        const cuponesMap = {};

        parsedRows.forEach((row, idx) => {
            const key = normalizarNombre(row.nombre);
            const existente = mapExistentes[key];

            // Si la fila trae un cupón, registrarlo en cuponesMap para creación/actualización automática
            if (row.cuponCodigo && row.cuponDescuento > 0) {
                const parsedVig = parseVigenciaCupon(row.cuponVigenciaRaw);
                const existingCup = cuponByCode[row.cuponCodigo];
                const cupChanged = !existingCup ||
                    Number(existingCup.descuento) !== Number(row.cuponDescuento) ||
                    (existingCup.tipo || 'Porcentaje') !== row.cuponTipo ||
                    (parsedVig.fechaFin && existingCup.fechaFin !== parsedVig.fechaFin);

                cuponesMap[row.cuponCodigo] = {
                    codigo: row.cuponCodigo,
                    descuento: row.cuponDescuento,
                    tipo: row.cuponTipo,
                    fechaInicio: parsedVig.fechaInicio,
                    fechaFin: parsedVig.fechaFin,
                    vigenciaTexto: parsedVig.vigenciaTexto,
                    esNuevo: !existingCup,
                    tieneCambio: cupChanged,
                    existingId: existingCup?.id || null,
                    existingData: existingCup || null
                };
            }

            if (!existente) {
                nuevos.push({ tempId: `new_${idx}`, ...row });
            } else {
                // Comparar campo por campo para detectar variaciones
                const diffs = [];
                const oldPrecio = Number(existente.precioVenta) || 0;
                if (Math.abs(oldPrecio - row.precioVenta) >= 0.01) {
                    const delta = row.precioVenta - oldPrecio;
                    const pct = oldPrecio > 0 ? ((delta / oldPrecio) * 100).toFixed(1) : '100';
                    diffs.push({
                        campo: 'Precio de Venta',
                        antes: formatCurrency(oldPrecio),
                        ahora: formatCurrency(row.precioVenta),
                        deltaTexto: `${delta >= 0 ? '+' : ''}${formatCurrency(delta)} (${delta >= 0 ? '+' : ''}${pct}%)`
                    });
                }

                const oldInsumo = Number(existente.costoInsumos) || 0;
                if (Math.abs(oldInsumo - row.costoInsumos) >= 0.01) {
                    diffs.push({
                        campo: 'Costo Insumos',
                        antes: formatCurrency(oldInsumo),
                        ahora: formatCurrency(row.costoInsumos)
                    });
                }

                const oldCom = Number(existente.comisionPct ?? 15);
                if (Math.abs(oldCom - row.comisionPct) >= 0.1) {
                    diffs.push({
                        campo: '% Comisión Esp.',
                        antes: `${oldCom}%`,
                        ahora: `${row.comisionPct}%`
                    });
                }

                const oldDur = Number(existente.duracionMin) || 60;
                if (oldDur !== row.duracionMin) {
                    diffs.push({
                        campo: 'Duración',
                        antes: `${oldDur} min`,
                        ahora: `${row.duracionMin} min`
                    });
                }

                const oldPaq = detectEsPaquete(existente);
                if (oldPaq !== row.esPaquete) {
                    diffs.push({
                        campo: 'Modalidad',
                        antes: oldPaq ? 'Paquete' : 'Servicio Individual',
                        ahora: row.esPaquete ? 'Paquete' : 'Servicio Individual'
                    });
                }

                const oldSes = Number(existente.numeroSesiones) || (oldPaq ? 10 : 1);
                if (oldSes !== row.numeroSesiones) {
                    diffs.push({
                        campo: 'Núm. Sesiones',
                        antes: `${oldSes} ses.`,
                        ahora: `${row.numeroSesiones} ses.`
                    });
                }

                const oldCat = existente.categoria || inferCategoria(existente.nombre);
                if (normalizarNombre(oldCat) !== normalizarNombre(row.categoria)) {
                    diffs.push({
                        campo: 'Categoría',
                        antes: oldCat,
                        ahora: row.categoria
                    });
                }

                const oldCup = existente.cuponId ? cuponById[existente.cuponId]?.codigo : (existente.cuponCodigo || '');
                if ((oldCup || '') !== (row.cuponCodigo || '')) {
                    diffs.push({
                        campo: 'Cupón Vinculado',
                        antes: oldCup || 'Ninguno',
                        ahora: row.cuponCodigo ? `${row.cuponCodigo} (${row.cuponDescuento}${row.cuponTipo === 'Porcentaje' ? '%' : ' MXN'})` : 'Ninguno'
                    });
                }

                if (diffs.length > 0) {
                    variaciones.push({
                        tempId: `var_${existente.id}`,
                        existingId: existente.id,
                        existingItem: existente,
                        newData: row,
                        diffs
                    });
                } else {
                    sinCambios.push(row);
                }
            }
        });

        const cuponesDetectados = Object.values(cuponesMap);

        // Pre-seleccionar todos por defecto para que el administrador solo desmarque lo que no quiera
        const initNew = {};
        nuevos.forEach(n => { initNew[n.tempId] = true; });
        const initVar = {};
        variaciones.forEach(v => { initVar[v.tempId] = true; });
        const initCup = {};
        cuponesDetectados.forEach(c => { initCup[c.codigo] = true; });

        setAcceptedNewIds(initNew);
        setAcceptedVarIds(initVar);
        setAcceptedCuponIds(initCup);
        setBulkAnalysis({
            totalLeidos: parsedRows.length,
            nuevos,
            variaciones,
            sinCambios,
            cuponesDetectados
        });
    };

    const handleSubirArchivoPlantilla = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const text = String(ev.target?.result || '');
            setBulkPasteText(text);
            const rows = parseCsvOrTsvText(text);
            analizarFilasImportadas(rows);
        };
        reader.readAsText(file, 'UTF-8');
        e.target.value = '';
    };

    const handleAnalizarTextoPegado = () => {
        const rows = parseCsvOrTsvText(bulkPasteText);
        if (rows.length === 0) {
            alert('No se detectaron filas válidas. Verifica que hayas subido el archivo CSV o pegado las columnas desde Excel.');
            return;
        }
        analizarFilasImportadas(rows);
    };

    const handleAplicarCambiosAprobados = async () => {
        if (!bulkAnalysis) return;
        setApplyingBulk(true);
        try {
            // 1. Crear o actualizar cupones aprobados y guardar mapa codigo -> cuponId
            const resolvedCuponIds = {};
            cupones.forEach(c => {
                if (c.codigo) resolvedCuponIds[String(c.codigo).toUpperCase()] = c.id;
            });

            let cuponesProcesados = 0;
            for (const cup of bulkAnalysis.cuponesDetectados) {
                if (!acceptedCuponIds[cup.codigo]) continue;
                const payloadCup = {
                    codigo: cup.codigo,
                    descuento: Number(cup.descuento) || 0,
                    tipo: cup.tipo || 'Porcentaje',
                    fechaInicio: cup.fechaInicio || new Date().toISOString().split('T')[0],
                    fechaFin: cup.fechaFin || '',
                    vigenciaTexto: cup.vigenciaTexto || 'Indefinida',
                    activo: true
                };
                if (cup.existingId) {
                    await updateCupon(cup.existingId, payloadCup);
                    resolvedCuponIds[cup.codigo] = cup.existingId;
                } else {
                    const newCupId = await createCupon(payloadCup);
                    resolvedCuponIds[cup.codigo] = newCupId;
                }
                cuponesProcesados++;
            }

            // 2. Actualizar servicios con variaciones aprobadas
            let actualizadosCount = 0;
            for (const v of bulkAnalysis.variaciones) {
                if (!acceptedVarIds[v.tempId]) continue;
                const d = v.newData;
                const cId = d.cuponCodigo ? (resolvedCuponIds[d.cuponCodigo] || '') : '';
                await updateServicio(v.existingId, {
                    nombre: d.nombre,
                    categoria: d.categoria,
                    tipo: d.tipo,
                    esPaquete: d.esPaquete,
                    precioVenta: d.precioVenta,
                    numeroSesiones: d.numeroSesiones,
                    duracionMin: d.duracionMin,
                    costoInsumos: d.costoInsumos,
                    comisionPct: d.comisionPct,
                    incluirEnPlanDiario: d.incluirEnPlanDiario,
                    prioridadPlan: d.prioridadPlan,
                    itemsIncluidos: d.itemsIncluidos,
                    cuponId: cId,
                    cuponCodigo: d.cuponCodigo || ''
                });
                actualizadosCount++;
            }

            // 3. Crear servicios nuevos aprobados
            let nuevosCount = 0;
            for (const n of bulkAnalysis.nuevos) {
                if (!acceptedNewIds[n.tempId]) continue;
                const cId = n.cuponCodigo ? (resolvedCuponIds[n.cuponCodigo] || '') : '';
                await createServicio({
                    nombre: n.nombre,
                    categoria: n.categoria,
                    tipo: n.tipo,
                    esPaquete: n.esPaquete,
                    precioVenta: n.precioVenta,
                    numeroSesiones: n.numeroSesiones,
                    duracionMin: n.duracionMin,
                    costoInsumos: n.costoInsumos,
                    comisionPct: n.comisionPct,
                    incluirEnPlanDiario: n.incluirEnPlanDiario,
                    prioridadPlan: n.prioridadPlan,
                    itemsIncluidos: n.itemsIncluidos,
                    cuponId: cId,
                    cuponCodigo: n.cuponCodigo || ''
                });
                nuevosCount++;
            }

            alert(`✅ ¡Catálogo Sincronizado con Éxito!\n\n• Variaciones aplicadas: ${actualizadosCount}\n• Nuevos servicios/paquetes creados: ${nuevosCount}\n• Cupones automáticos generados/actualizados: ${cuponesProcesados}`);
            setIsBulkModalOpen(false);
            setBulkAnalysis(null);
            setBulkPasteText('');
        } catch (err) {
            console.error('Error en sincronización masiva:', err);
            alert('Error al aplicar cambios: ' + (err.message || 'Error desconocido'));
        } finally {
            setApplyingBulk(false);
        }
    };

    const handleOpenItemModal = (item = null) => {
        if (item) {
            const esPaq = detectEsPaquete(item);
            setEditingItem(item.id);
            setFormData({
                nombre: item.nombre || '',
                categoria: item.categoria || inferCategoria(item.nombre),
                tipo: item.tipo || (esPaq ? 'Paquete / Plan Tratamiento' : 'Servicio Individual'),
                esPaquete: esPaq,
                duracionMin: Number(item.duracionMin) || 60,
                numeroSesiones: Number(item.numeroSesiones) || (esPaq ? 10 : 1),
                costoInsumos: item.costoInsumos ?? 0,
                comisionPct: item.comisionPct ?? 15,
                precioVenta: item.precioVenta ?? 0,
                incluirEnPlanDiario: detectIncluirEnPlan(item),
                prioridadPlan: item.prioridadPlan || 'media',
                metaDiariaManual: item.metaDiariaManual ?? '',
                itemsIncluidos: item.itemsIncluidos || [],
                cuponId: item.cuponId || '',
            });
        } else {
            setEditingItem(null);
            setFormData(emptyForm);
        }
        setIsItemModalOpen(true);
    };

    const handleSaveItem = async () => {
        if (!formData.nombre.trim() || formData.precioVenta === '') {
            alert('Ingresa el nombre y el precio de venta del servicio.');
            return;
        }

        const esPaq = formData.tipo === 'Paquete / Plan Tratamiento' || Boolean(formData.esPaquete);
        const cupObj = formData.cuponId ? cuponById[formData.cuponId] : null;
        const payload = {
            nombre: formData.nombre.trim(),
            categoria: formData.categoria || 'Facial',
            tipo: formData.tipo,
            esPaquete: esPaq,
            duracionMin: Math.max(5, Number(formData.duracionMin) || 60),
            numeroSesiones: esPaq ? Math.max(1, Number(formData.numeroSesiones) || 1) : 1,
            costoInsumos: Number(formData.costoInsumos) || 0,
            comisionPct: Math.max(0, Math.min(100, Number(formData.comisionPct) || 0)),
            precioVenta: Number(formData.precioVenta) || 0,
            incluirEnPlanDiario: esPaq ? false : Boolean(formData.incluirEnPlanDiario),
            prioridadPlan: formData.prioridadPlan || 'media',
            metaDiariaManual: formData.metaDiariaManual !== '' ? Number(formData.metaDiariaManual) : null,
            itemsIncluidos: formData.itemsIncluidos || [],
            cuponId: formData.cuponId || '',
            cuponCodigo: cupObj?.codigo || '',
        };

        try {
            if (editingItem) {
                await updateServicio(editingItem, payload);
            } else {
                await createServicio(payload);
            }
            setIsItemModalOpen(false);
        } catch (err) {
            console.error(err);
            alert('Error al guardar servicio.');
        }
    };

    const handleQuickTogglePlan = async (item) => {
        const actual = detectIncluirEnPlan(item);
        try {
            await updateServicio(item.id, {
                incluirEnPlanDiario: !actual,
                esPaquete: detectEsPaquete(item),
            });
        } catch (err) {
            console.error(err);
        }
    };

    const handleDeleteItem = async (id) => {
        if (window.confirm('¿Estás seguro de eliminar este item del catálogo?')) {
            try {
                await deleteServicio(id);
            } catch (err) {
                console.error(err);
                alert('Error al eliminar servicio.');
            }
        }
    };

    const handleCrearCupon = async () => {
        const codigo = couponCodeRef.current?.value?.trim().toUpperCase();
        const descuento = Number(couponValueRef.current?.value);
        const tipo = couponTypeRef.current?.value === '%' ? 'Porcentaje' : 'Monto Fijo';
        const vigenciaInput = couponVigenciaRef.current?.value?.trim() || '';

        if (!codigo || !descuento) { alert('Ingresa el código y el valor del cupón.'); return; }

        const parsedVig = parseVigenciaCupon(vigenciaInput);

        try {
            await createCupon({
                codigo,
                descuento,
                tipo,
                fechaInicio: parsedVig.fechaInicio,
                fechaFin: parsedVig.fechaFin,
                vigenciaTexto: parsedVig.vigenciaTexto
            });
            couponCodeRef.current.value = '';
            couponValueRef.current.value = '';
            if (couponVigenciaRef.current) couponVigenciaRef.current.value = '';
        } catch (err) {
            console.error(err);
            alert('Error al crear cupón.');
        }
    };

    const handleToggleCupon = async (cupon) => {
        try {
            await updateCupon(cupon.id, { activo: !cupon.activo });
        } catch (err) {
            console.error(err);
        }
    };

    const handleDeleteCupon = async (id) => {
        if (!window.confirm('¿Eliminar este cupón?')) return;
        try {
            await deleteCupon(id);
        } catch (err) {
            console.error(err);
            alert('Error al eliminar cupón.');
        }
    };

    // ─── GESTIÓN MASIVA DE FLYERS Y CONTROL MENSUAL ──────────────────────────────
    const handleSelectBatchFlyerFiles = (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        files.forEach((file, index) => {
            const reader = new FileReader();
            const cleanTitle = file.name
                .replace(/\.[^/.]+$/, '')
                .replace(/[_-]+/g, ' ')
                .trim() || `Promoción ${controlFlyersMes.nombreMesActual || 'ALFRA'} #${index + 1}`;

            reader.onloadend = () => {
                setBatchFlyersQueue(prev => [
                    ...prev,
                    {
                        id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                        file,
                        title: cleanTitle,
                        preview: reader.result
                    }
                ]);
            };
            reader.readAsDataURL(file);
        });
        e.target.value = '';
    };

    const handleSubirBatchFlyers = async (marcarMes = true) => {
        if (batchFlyersQueue.length === 0) return;
        setUploading(true);
        setUploadStep('Iniciando subida masiva...');
        try {
            await uploadFlyersBatch(batchFlyersQueue, (info) => {
                setUploadStep(info.step);
            });
            if (marcarMes) {
                await marcarFlyersMesCompletado(true, currentUser?.email || 'Administración', batchFlyersQueue.length);
            }
            setIsFlyerModalOpen(false);
            setBatchFlyersQueue([]);
            await loadFlyers();
        } catch (e) {
            alert('Error al subir flyers: ' + e.message);
        } finally {
            setUploading(false);
            setUploadStep('');
        }
    };

    const selectedFlyersList = useMemo(() => {
        return flyers.filter(f => selectedFlyerIds[f.id]);
    }, [flyers, selectedFlyerIds]);

    const handleToggleSelectAllFlyers = () => {
        if (selectedFlyersList.length === flyers.length && flyers.length > 0) {
            setSelectedFlyerIds({});
        } else {
            const next = {};
            flyers.forEach(f => { next[f.id] = true; });
            setSelectedFlyerIds(next);
        }
    };

    const handleEliminarFlyersSeleccionados = async () => {
        if (selectedFlyersList.length === 0) return;
        if (!window.confirm(`¿Eliminar permanentemente los ${selectedFlyersList.length} flyers seleccionados de la App de Pacientes?`)) return;

        setDeletingBatch(true);
        try {
            await deleteFlyersBatch(selectedFlyersList);
            await loadFlyers();
        } catch (err) {
            alert('Error eliminando flyers: ' + err.message);
        } finally {
            setDeletingBatch(false);
        }
    };

    const handleToggleMarcarMesFlyers = async (completado) => {
        setMarcandoFlyersMes(true);
        try {
            await marcarFlyersMesCompletado(completado, currentUser?.email || 'Administración', flyers.length);
        } catch (err) {
            alert('Error al actualizar recordatorio mensual: ' + err.message);
        } finally {
            setMarcandoFlyersMes(false);
        }
    };

    const stats = useMemo(() => {
        const sueltos = servicios.filter((s) => !detectEsPaquete(s));
        const paquetes = servicios.filter((s) => detectEsPaquete(s));
        const enPlan = servicios.filter((s) => !detectEsPaquete(s) && detectIncluirEnPlan(s));
        const conPrecio = sueltos.filter((s) => Number(s.precioVenta) > 0);
        const precioPromSuelto = conPrecio.length
            ? conPrecio.reduce((a, b) => a + Number(b.precioVenta || 0), 0) / conPrecio.length
            : 0;
        const avgMargin = conPrecio.length
            ? (conPrecio.reduce((acc, curr) => {
                const p = Number(curr.precioVenta) || 0;
                const c = Number(curr.costoInsumos) || 0;
                const com = p * ((Number(curr.comisionPct ?? 15)) / 100);
                return acc + ((p - c - com) / p);
            }, 0) / conPrecio.length * 100).toFixed(1)
            : 0;
        return { sueltos: sueltos.length, paquetes: paquetes.length, enPlan: enPlan.length, precioPromSuelto, avgMargin };
    }, [servicios]);

    const serviciosFiltrados = useMemo(() => {
        return servicios.filter((item) => {
            const matchTxt = (item.nombre || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (item.tipo || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (item.categoria || inferCategoria(item.nombre)).toLowerCase().includes(searchTerm.toLowerCase());
            if (!matchTxt) return false;
            const esPaq = detectEsPaquete(item);
            if (filtroCatalogo === 'sueltos') return !esPaq;
            if (filtroCatalogo === 'paquetes') return esPaq;
            if (filtroCatalogo === 'plan') return !esPaq && detectIncluirEnPlan(item);
            return true;
        });
    }, [servicios, searchTerm, filtroCatalogo]);

    const modalCalc = useMemo(() => {
        const precio = Number(formData.precioVenta) || 0;
        const insumo = Number(formData.costoInsumos) || 0;
        const comPct = Number(formData.comisionPct) || 0;
        const comMonto = precio * (comPct / 100);
        const utilidadNeta = precio - insumo - comMonto;
        const margenPct = precio > 0 ? (utilidadNeta / precio) * 100 : 0;
        return { precio, insumo, comPct, comMonto, utilidadNeta, margenPct };
    }, [formData.precioVenta, formData.costoInsumos, formData.comisionPct]);

    return (
        <div className="space-y-6">
            {/* ALERTA MENSUAL AUTOMÁTICA: RENOVACIÓN DE FLYERS DEL MES */}
            {!controlFlyersMes.completadoEsteMes && (
                <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 border-2 border-amber-300 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-in fade-in">
                    <div className="flex items-start gap-3.5">
                        <div className="p-2.5 rounded-xl bg-amber-500 text-white shrink-0 shadow-xs">
                            <Megaphone size={20} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-amber-200/80 text-amber-900">
                                    Recordatorio Mensual • {controlFlyersMes.nombreMesActual}
                                </span>
                            </div>
                            <h3 className="text-sm sm:text-base font-black text-amber-950 mt-1">
                                📢 Cambiar Flyers Promocionales del Mes ({controlFlyersMes.nombreMesActual})
                            </h3>
                            <p className="text-xs text-amber-800 mt-0.5">
                                Aún no se ha registrado como completada la renovación de flyers de este mes para la App de Pacientes. Puedes subirlos o eliminarlos masivamente.
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0 w-full md:w-auto justify-end">
                        <button
                            type="button"
                            onClick={() => {
                                setActiveView('flyers');
                                setIsFlyerModalOpen(true);
                            }}
                            className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                        >
                            <Upload size={14} /> Subir Flyers del Mes
                        </button>
                        <button
                            type="button"
                            disabled={marcandoFlyersMes}
                            onClick={() => handleToggleMarcarMesFlyers(true)}
                            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-50"
                        >
                            <CheckCircle2 size={14} /> {marcandoFlyersMes ? 'Guardando...' : 'Marcar como Completado'}
                        </button>
                    </div>
                </div>
            )}

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-acero">Catálogo de Servicios, Costos y Promociones</h2>
                    <p className="text-gray-500 text-sm">
                        Configura precios, paquetes, costos de insumo, comisiones, cupones con vigencia y flyers promocionales
                    </p>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                    <div className="bg-gray-100 p-1 rounded-xl flex gap-1 mr-1">
                        <button
                            onClick={() => setActiveView('catalogo')}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeView === 'catalogo' ? 'bg-white text-acero shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Catálogo ({servicios.length})
                        </button>
                        <button
                            onClick={() => setActiveView('flyers')}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${activeView === 'flyers' ? 'bg-white text-acero shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <span>Flyers App ({flyers.length})</span>
                            {!controlFlyersMes.completadoEsteMes && (
                                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                            )}
                        </button>
                    </div>
                    {activeView === 'catalogo' && (
                        <>
                            <div className="relative flex-1 sm:w-56">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                <input
                                    type="text"
                                    placeholder="Buscar servicio o categoría..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-turquesa outline-none"
                                />
                            </div>
                            {/* Botones exclusivos para Web (md:inline-flex) de Plantilla / Carga Masiva */}
                            <div className="hidden md:flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    icon={Download}
                                    onClick={handleDescargarPlantillaActual}
                                    title="Descarga un archivo Excel/CSV con TODOS los servicios, paquetes y cupones que tienes actualmente"
                                    className="border-teal-600/30 text-teal-800 bg-teal-50/60 hover:bg-teal-100/70"
                                >
                                    Exportar Plantilla Actual
                                </Button>
                                <Button
                                    variant="outline"
                                    icon={FileSpreadsheet}
                                    onClick={() => {
                                        setBulkAnalysis(null);
                                        setIsBulkModalOpen(true);
                                    }}
                                    className="border-indigo-500/30 text-indigo-800 bg-indigo-50/60 hover:bg-indigo-100/70"
                                >
                                    Subir Plantilla / Auditar Cambios
                                </Button>
                            </div>
                            <Button variant="outline" icon={Tag} onClick={() => setIsCouponModalOpen(true)}>Cupones ({cupones.filter(c => c.activo).length})</Button>
                            <Button variant="primary" icon={PlusCircle} onClick={() => handleOpenItemModal()}>Nuevo Servicio</Button>
                        </>
                    )}
                </div>
            </div>

            {activeView === 'catalogo' ? (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <Card className="bg-turquesa/5 border-turquesa/20">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-turquesa/10 rounded-xl text-turquesa"><Package size={22} /></div>
                                <div>
                                    <p className="text-xs font-bold text-gray-500 uppercase">Servicios Sueltos vs Paquetes</p>
                                    <h3 className="text-xl font-black text-gray-900">{stats.sueltos} Sueltos • {stats.paquetes} Paq.</h3>
                                </div>
                            </div>
                        </Card>
                        <Card className="bg-emerald-500/5 border-emerald-500/20">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-600"><Target size={22} /></div>
                                <div>
                                    <p className="text-xs font-bold text-gray-500 uppercase">Activos en Plan Diario</p>
                                    <h3 className="text-xl font-black text-emerald-700">{stats.enPlan} servicios sueltos</h3>
                                </div>
                            </div>
                        </Card>
                        <Card className="bg-acero/5 border-acero/20">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-acero/10 rounded-xl text-acero"><DollarSign size={22} /></div>
                                <div>
                                    <p className="text-xs font-bold text-gray-500 uppercase">Margen Libre Promedio</p>
                                    <h3 className="text-xl font-black text-gray-900">{stats.avgMargin}% libre</h3>
                                </div>
                            </div>
                        </Card>
                        <Card className="bg-orange-500/5 border-orange-500/20">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-orange-500/10 rounded-xl text-orange-500"><Percent size={22} /></div>
                                <div>
                                    <p className="text-xs font-bold text-gray-500 uppercase">Cupones Vigentes</p>
                                    <h3 className="text-xl font-black text-gray-900">{cupones.filter((c) => c.activo).length} Promociones</h3>
                                </div>
                            </div>
                        </Card>
                    </div>

                    {/* Filtros rápidos de catálogo */}
                    <div className="flex flex-wrap gap-2">
                        {[
                            { id: 'todos', label: `Todos (${servicios.length})` },
                            { id: 'sueltos', label: `Servicios Sueltos — No Paquete (${stats.sueltos})` },
                            { id: 'plan', label: `Incluidos en Plan de Meta Diaria (${stats.enPlan})` },
                            { id: 'paquetes', label: `Paquetes / Planes (${stats.paquetes})` },
                        ].map((f) => (
                            <button
                                key={f.id}
                                onClick={() => setFiltroCatalogo(f.id)}
                                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                                    filtroCatalogo === f.id
                                        ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                }`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>

                    <Card>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                    <tr className="border-b border-gray-100 text-[11px] uppercase text-gray-500 bg-gray-50/70">
                                        <th className="py-3 px-4 font-bold">Servicio / Categoría</th>
                                        <th className="py-3 px-3 font-bold text-center">Modalidad</th>
                                        <th className="py-3 px-3 font-bold text-center">Duración</th>
                                        <th className="py-3 px-3 font-bold text-right">Costo Insumo</th>
                                        <th className="py-3 px-3 font-bold text-right">Comisión Esp.</th>
                                        <th className="py-3 px-3 font-bold text-right">Precio Venta</th>
                                        <th className="py-3 px-3 font-bold text-right">Utilidad Libre</th>
                                        <th className="py-3 px-3 font-bold text-center">Plan Diario</th>
                                        <th className="py-3 px-4 font-bold text-center">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {serviciosFiltrados.map((item) => {
                                        const esPaq = detectEsPaquete(item);
                                        const enPlan = !esPaq && detectIncluirEnPlan(item);
                                        const precio = Number(item.precioVenta) || 0;
                                        const insumo = Number(item.costoInsumos) || 0;
                                        const comPct = Number(item.comisionPct ?? 15);
                                        const comMonto = precio * (comPct / 100);
                                        const utilidadLibre = precio - insumo - comMonto;
                                        const margenPct = precio > 0 ? Math.round((utilidadLibre / precio) * 100) : 0;
                                        const cat = item.categoria || inferCategoria(item.nombre);
                                        const dur = Number(item.duracionMin) || 60;
                                        const prio = item.prioridadPlan || 'media';
                                        const cup = item.cuponId ? cuponById[item.cuponId] : (item.cuponCodigo ? cuponByCode[String(item.cuponCodigo).toUpperCase()] : null);

                                        return (
                                            <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                                                <td className="py-3 px-4 font-medium text-gray-900">
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-slate-800 text-sm">{item.nombre}</span>
                                                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-bold">
                                                                {cat}
                                                            </span>
                                                            {esPaq && (
                                                                <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-[10px] font-bold">
                                                                    {Number(item.numeroSesiones) || 10} sesiones
                                                                </span>
                                                            )}
                                                            {cup && (
                                                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-black flex items-center gap-1 ${
                                                                    cup.activo ? 'bg-orange-100 text-orange-800 border border-orange-200' : 'bg-gray-100 text-gray-400 line-through'
                                                                }`}>
                                                                    🎟️ {cup.codigo} (-{cup.descuento}{cup.tipo === 'Porcentaje' ? '%' : ' MXN'})
                                                                    {cup.fechaFin ? ` • vence ${cup.fechaFin}` : ''}
                                                                </span>
                                                            )}
                                                            {!esPaq && enPlan && (
                                                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                                                    prio === 'alta'
                                                                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                                                        : prio === 'baja'
                                                                            ? 'bg-slate-50 text-slate-500'
                                                                            : 'bg-teal-50 text-teal-700'
                                                                }`}>
                                                                    Prioridad {prio}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-3 px-3 text-center">
                                                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${
                                                        esPaq ? 'bg-indigo-50 text-indigo-700' : 'bg-emerald-50 text-emerald-700'
                                                    }`}>
                                                        {esPaq ? 'Paquete / Plan' : 'Sesión Suelta'}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-3 text-center text-slate-600 font-semibold">
                                                    <span className="inline-flex items-center gap-1"><Clock size={12} /> {dur} min</span>
                                                </td>
                                                <td className="py-3 px-3 text-right text-rose-600 font-semibold">
                                                    {formatCurrency(insumo)}
                                                </td>
                                                <td className="py-3 px-3 text-right text-amber-700 font-semibold">
                                                    {formatCurrency(comMonto)} <span className="text-[10px] text-slate-400">({comPct}%)</span>
                                                </td>
                                                <td className="py-3 px-3 text-right">
                                                    <div className="text-slate-900 font-black text-sm">{formatCurrency(precio)}</div>
                                                    {esPaq && precio > 0 && (
                                                        <div className="mt-1 text-[10px] space-y-0.5 text-right">
                                                            <div className="text-emerald-700 font-bold">
                                                                ✨ 1ª Ses (20%): {formatCurrency(precio * 0.20)}
                                                            </div>
                                                            <div className="text-indigo-700 font-semibold">
                                                                💳 Ses 2 a {Number(item.numeroSesiones) || 10}: {formatCurrency((precio * 0.80) / Math.max(1, (Number(item.numeroSesiones) || 10) - 1))} c/u
                                                            </div>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="py-3 px-3 text-right">
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-emerald-600 font-black">{formatCurrency(utilidadLibre)}</span>
                                                        <span className="text-[10px] text-slate-400">{margenPct}% libre</span>
                                                    </div>
                                                </td>
                                                <td className="py-3 px-3 text-center">
                                                    {esPaq ? (
                                                        <span className="text-[10px] text-slate-400 italic">No aplica (Paq.)</span>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleQuickTogglePlan(item)}
                                                            title="Haz clic para incluir o excluir este servicio del cálculo de ventas diarias en Reportes"
                                                            className={`px-2.5 py-1 rounded-xl text-[10px] font-black transition-all ${
                                                                enPlan
                                                                    ? 'bg-emerald-500 text-white shadow-sm'
                                                                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                                            }`}
                                                        >
                                                            {enPlan ? '✓ En Plan Diario' : 'Excluido'}
                                                        </button>
                                                    )}
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <Button variant="ghost" size="sm" icon={Edit} onClick={() => handleOpenItemModal(item)} />
                                                        <Button variant="ghost" size="sm" className="text-red-500 hover:bg-red-50 hover:text-red-600" icon={Trash2} onClick={() => handleDeleteItem(item.id)} />
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {serviciosFiltrados.length === 0 && (
                                        <tr>
                                            <td colSpan="9" className="py-8 text-center text-gray-400">
                                                No se encontraron servicios con ese filtro.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </>
            ) : (
                <div className="space-y-6 animate-in fade-in">
                    {/* BARRA DE GESTIÓN DE FLYERS Y CONTROL MENSUAL */}
                    <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2.5 flex-wrap">
                                <h3 className="text-lg font-black text-acero">Flyers Publicitarios de la App</h3>
                                <span className={`text-[11px] font-black px-3 py-0.5 rounded-full border ${
                                    controlFlyersMes.completadoEsteMes
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                        : 'bg-amber-100 text-amber-800 border-amber-300'
                                }`}>
                                    {controlFlyersMes.completadoEsteMes
                                        ? `✓ Flyers de ${controlFlyersMes.nombreMesActual} Completados`
                                        : `⏳ Pendiente actualizar Flyers de ${controlFlyersMes.nombreMesActual}`}
                                </span>
                            </div>
                            <p className="text-xs text-gray-500">
                                Selecciona múltiples imágenes para subirlas o eliminarlas en lote. Los pacientes las verán de inmediato en su App.
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            {flyers.length > 0 && (
                                <>
                                    <button
                                        type="button"
                                        onClick={handleToggleSelectAllFlyers}
                                        className="px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 text-xs font-bold text-gray-700 flex items-center gap-1.5 cursor-pointer"
                                    >
                                        {selectedFlyersList.length === flyers.length ? <CheckSquare size={15} className="text-turquesa" /> : <Square size={15} />}
                                        <span>{selectedFlyersList.length === flyers.length ? 'Deseleccionar Todos' : `Seleccionar Todos (${flyers.length})`}</span>
                                    </button>

                                    {selectedFlyersList.length > 0 && (
                                        <button
                                            type="button"
                                            disabled={deletingBatch}
                                            onClick={handleEliminarFlyersSeleccionados}
                                            className="px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-black flex items-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50"
                                        >
                                            <Trash2 size={15} />
                                            <span>{deletingBatch ? 'Eliminando...' : `Eliminar Seleccionados (${selectedFlyersList.length})`}</span>
                                        </button>
                                    )}
                                </>
                            )}

                            <button
                                type="button"
                                disabled={marcandoFlyersMes}
                                onClick={() => handleToggleMarcarMesFlyers(!controlFlyersMes.completadoEsteMes)}
                                className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 border transition-all cursor-pointer ${
                                    controlFlyersMes.completadoEsteMes
                                        ? 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                        : 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700 shadow-sm'
                                }`}
                            >
                                <CheckCircle2 size={15} />
                                <span>{controlFlyersMes.completadoEsteMes ? 'Reabrir Alerta del Mes' : `Marcar ${controlFlyersMes.nombreMesActual} Completado`}</span>
                            </button>

                            <Button
                                variant="primary"
                                icon={Upload}
                                onClick={() => {
                                    setBatchFlyersQueue([]);
                                    setIsFlyerModalOpen(true);
                                }}
                            >
                                Subir Flyers (Individual o Masivo)
                            </Button>
                        </div>
                    </div>

                    {loadingFlyers ? (
                        <div className="py-20 text-center text-gray-400">Cargando flyers...</div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
                            {flyers.map((flyer) => {
                                const isSelected = Boolean(selectedFlyerIds[flyer.id]);
                                return (
                                    <div
                                        key={flyer.id}
                                        onClick={() => setSelectedFlyerIds(prev => ({ ...prev, [flyer.id]: !prev[flyer.id] }))}
                                        className={`relative group rounded-2xl overflow-hidden shadow-lg border-2 transition-all cursor-pointer bg-white ${
                                            isSelected ? 'border-turquesa ring-4 ring-turquesa/20 scale-[0.99]' : 'border-gray-100 hover:border-gray-300'
                                        }`}
                                    >
                                        {/* Checkbox de selección masiva */}
                                        <div className="absolute top-3 left-3 z-20">
                                            <div className={`w-7 h-7 rounded-xl flex items-center justify-center shadow-md border transition-all ${
                                                isSelected ? 'bg-turquesa text-white border-turquesa' : 'bg-white/90 text-gray-500 border-gray-300'
                                            }`}>
                                                {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                                            </div>
                                        </div>

                                        <div className="bg-slate-950/5 flex items-center justify-center"><img src={flyer.imageUrl} alt={flyer.title} className="w-full h-auto max-h-96 object-contain mx-auto block" /></div>
                                        <div className="p-3 bg-white border-t border-gray-100 flex items-center justify-between gap-2">
                                            <div className="min-w-0">
                                                <p className="text-slate-800 font-bold text-xs truncate">{flyer.title}</p>
                                                {flyer.mesClave && (
                                                    <span className="text-[10px] text-gray-400 font-semibold">Mes: {flyer.mesClave}</span>
                                                )}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={async (e) => {
                                                    e.stopPropagation();
                                                    if (window.confirm('¿Eliminar este flyer?')) {
                                                        await deleteFlyer(flyer.id, flyer.storagePath);
                                                        loadFlyers();
                                                    }
                                                }}
                                                className="p-2 rounded-xl bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition-colors shrink-0"
                                                title="Eliminar flyer"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                            {flyers.length === 0 && (
                                <div className="col-span-full py-20 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 text-center">
                                    <Upload size={48} className="mx-auto text-gray-300 mb-3" />
                                    <p className="text-gray-500 font-medium">No hay flyers activos</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Modal: Editar/Crear Servicio con todos los elementos financieros y operativos */}
            <Modal
                isOpen={isItemModalOpen}
                onClose={() => setIsItemModalOpen(false)}
                title={editingItem ? 'Editar Servicio / Paquete' : 'Nuevo Servicio en Catálogo'}
                maxWidth="max-w-xl"
                footer={
                    <div className="flex justify-end gap-3">
                        <Button variant="ghost" onClick={() => setIsItemModalOpen(false)}>Cancelar</Button>
                        <Button variant="primary" onClick={handleSaveItem}>Guardar en Catálogo</Button>
                    </div>
                }
            >
                <div className="space-y-4 text-xs">
                    <div>
                        <label className="font-bold text-gray-700 block mb-1">Nombre del Servicio o Paquete *</label>
                        <input
                            type="text"
                            className="w-full px-3.5 py-2.5 border rounded-xl focus:ring-2 focus:ring-turquesa outline-none bg-gray-50 font-semibold text-sm"
                            placeholder="Ej. Limpieza Facial Profunda + Dermapen"
                            value={formData.nombre}
                            onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="font-bold text-gray-700 block mb-1">Categoría Clínica</label>
                            <select
                                className="w-full px-3 py-2.5 border rounded-xl focus:ring-2 focus:ring-turquesa outline-none bg-gray-50 font-semibold"
                                value={formData.categoria}
                                onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                            >
                                {CATEGORIAS_SERVICIO.map((cat) => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="font-bold text-gray-700 block mb-1">Tipo / Modalidad</label>
                            <select
                                className="w-full px-3 py-2.5 border rounded-xl focus:ring-2 focus:ring-turquesa outline-none bg-gray-50 font-semibold"
                                value={formData.tipo}
                                onChange={(e) => {
                                    const nuevoTipo = e.target.value;
                                    const esPaq = nuevoTipo === 'Paquete / Plan Tratamiento';
                                    setFormData({
                                        ...formData,
                                        tipo: nuevoTipo,
                                        esPaquete: esPaq,
                                        incluirEnPlanDiario: esPaq ? false : formData.incluirEnPlanDiario,
                                    });
                                }}
                            >
                                <option value="Servicio Individual">Servicio Individual (Sesión suelta)</option>
                                <option value="Procedimiento">Procedimiento Especializado</option>
                                <option value="Paquete / Plan Tratamiento">Paquete / Plan de Tratamiento (Varias sesiones)</option>
                                <option value="Producto Físico (Venta)">Producto Físico (Venta)</option>
                            </select>
                        </div>
                    </div>

                    {/* Duración, Costo de Insumos, Comisión y Precio de Venta */}
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                        <p className="text-[11px] font-black uppercase tracking-wider text-slate-600">
                            Estructura de Tiempo, Costos y Precio
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div>
                                <label className="font-bold text-slate-600 block mb-1">Duración (min)</label>
                                <input
                                    type="number"
                                    min="5"
                                    step="5"
                                    value={formData.duracionMin}
                                    onChange={(e) => setFormData({ ...formData, duracionMin: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-xl bg-white font-bold text-slate-800 outline-none focus:border-turquesa"
                                />
                            </div>
                            <div>
                                <label className="font-bold text-rose-600 block mb-1">Costo Insumo ($)</label>
                                <input
                                    type="number"
                                    min="0"
                                    placeholder="0.00"
                                    value={formData.costoInsumos}
                                    onChange={(e) => setFormData({ ...formData, costoInsumos: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-xl bg-white font-bold text-rose-600 outline-none focus:border-turquesa"
                                />
                            </div>
                            <div>
                                <label className="font-bold text-amber-700 block mb-1">Comisión Esp. (%)</label>
                                <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="0.5"
                                    value={formData.comisionPct}
                                    onChange={(e) => setFormData({ ...formData, comisionPct: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-xl bg-white font-bold text-amber-700 outline-none focus:border-turquesa"
                                />
                            </div>
                            <div>
                                <label className="font-bold text-emerald-700 block mb-1">Precio Venta ($) *</label>
                                <input
                                    type="number"
                                    min="0"
                                    placeholder="0.00"
                                    value={formData.precioVenta}
                                    onChange={(e) => setFormData({ ...formData, precioVenta: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-xl bg-white font-black text-emerald-700 outline-none focus:border-turquesa"
                                />
                            </div>
                        </div>

                        {formData.esPaquete && (
                            <div className="pt-2 space-y-2">
                                <div>
                                    <label className="font-bold text-indigo-700 block mb-1">Número Total de Sesiones del Paquete</label>
                                    <input
                                        type="number"
                                        min="2"
                                        value={formData.numeroSesiones}
                                        onChange={(e) => setFormData({ ...formData, numeroSesiones: e.target.value })}
                                        className="w-36 px-3 py-1.5 border border-indigo-200 rounded-xl bg-white font-black text-indigo-700"
                                    />
                                </div>
                                {Number(formData.precioVenta) > 0 && (
                                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs space-y-1">
                                        <p className="font-black text-amber-900 uppercase text-[10px]">Esquema Automático de Pagos (App Paciente y Caja)</p>
                                        <p className="font-bold text-gray-800">
                                            • Total del Paquete ({Number(formData.numeroSesiones) || 10} sesiones): <strong>{formatCurrency(Number(formData.precioVenta))}</strong>
                                        </p>
                                        <p className="font-black text-emerald-700">
                                            • ✨ Inicia en 1ª Sesión con el 20%: <strong>{formatCurrency(Number(formData.precioVenta) * 0.20)}</strong>
                                        </p>
                                        <p className="font-bold text-indigo-800">
                                            • 💳 Sesiones 2 a la {Number(formData.numeroSesiones) || 10} ({Math.max(1, (Number(formData.numeroSesiones) || 10) - 1)} pagos): <strong>{formatCurrency((Number(formData.precioVenta) * 0.80) / Math.max(1, (Number(formData.numeroSesiones) || 10) - 1))} por sesión</strong>
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}

                        {modalCalc.precio > 0 && (
                            <div className="pt-3 border-t border-slate-200 grid grid-cols-3 gap-2 text-center">
                                <div className="bg-white p-2 rounded-xl border border-slate-100">
                                    <span className="text-[10px] text-slate-400 font-bold block">Insumo + Comisión</span>
                                    <span className="font-black text-rose-600">
                                        -{formatCurrency(modalCalc.insumo + modalCalc.comMonto)}
                                    </span>
                                </div>
                                <div className="bg-emerald-50 p-2 rounded-xl border border-emerald-200">
                                    <span className="text-[10px] text-emerald-700 font-bold block">Utilidad Libre</span>
                                    <span className="font-black text-emerald-700">
                                        {formatCurrency(modalCalc.utilidadNeta)}
                                    </span>
                                </div>
                                <div className="bg-white p-2 rounded-xl border border-slate-100">
                                    <span className="text-[10px] text-slate-400 font-bold block">% Margen Neto</span>
                                    <span className="font-black text-slate-800">
                                        {modalCalc.margenPct.toFixed(1)}%
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Configuración para el Plan de Ventas Diarias */}
                    <div className="p-4 rounded-2xl bg-teal-50/50 border border-teal-200/60 space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Sparkles size={15} className="text-turquesa" />
                                <span className="font-black text-slate-800 text-xs">
                                    Configuración en Plan de Ingresos Mensual (Ventas Diarias)
                                </span>
                            </div>
                            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={Boolean(formData.esPaquete)}
                                    onChange={(e) => {
                                        const esPaq = e.target.checked;
                                        setFormData({
                                            ...formData,
                                            esPaquete: esPaq,
                                            incluirEnPlanDiario: esPaq ? false : true,
                                        });
                                    }}
                                />
                                <span>Es un Paquete</span>
                            </label>
                        </div>

                        {!formData.esPaquete ? (
                            <div className="space-y-3">
                                <label className="flex items-center gap-2.5 bg-white p-3 rounded-xl border border-teal-100 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={Boolean(formData.incluirEnPlanDiario)}
                                        onChange={(e) => setFormData({ ...formData, incluirEnPlanDiario: e.target.checked })}
                                        className="w-4 h-4 accent-teal-600"
                                    />
                                    <div>
                                        <p className="font-black text-slate-800">Incluir este servicio en la Meta de Ventas Diarias</p>
                                        <p className="text-[11px] text-slate-500">
                                            El módulo de Reportes calculará cuántas sesiones diarias de este servicio debes vender para cubrir gastos fijos, nómina y provisiones.
                                        </p>
                                    </div>
                                </label>

                                {formData.incluirEnPlanDiario && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="font-bold text-slate-700 block mb-1">Prioridad / Demanda en Clínica</label>
                                            <select
                                                value={formData.prioridadPlan}
                                                onChange={(e) => setFormData({ ...formData, prioridadPlan: e.target.value })}
                                                className="w-full px-3 py-2 border rounded-xl bg-white font-semibold"
                                            >
                                                {PRIORIDADES_PLAN.map((p) => (
                                                    <option key={p.id} value={p.id}>{p.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="font-bold text-slate-700 block mb-1">Meta Diaria Fija (Opcional)</label>
                                            <input
                                                type="number"
                                                min="0"
                                                step="1"
                                                placeholder="Automático según prioridad"
                                                value={formData.metaDiariaManual}
                                                onChange={(e) => setFormData({ ...formData, metaDiariaManual: e.target.value })}
                                                className="w-full px-3 py-2 border rounded-xl bg-white font-bold"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <p className="text-[11px] text-slate-600 italic">
                                Al estar marcado como <strong>Paquete / Plan de varias sesiones</strong>, se excluye automáticamente del cálculo de servicios sueltos diarios tal como solicitaste.
                            </p>
                        )}
                    </div>

                    <div className="space-y-1">
                        <label className="font-bold text-gray-700 block">Cupón Aplicable (Opcional)</label>
                        <select
                            className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-turquesa outline-none bg-gray-50"
                            value={formData.cuponId}
                            onChange={(e) => setFormData({ ...formData, cuponId: e.target.value })}
                        >
                            <option value="">Ninguno</option>
                            {cupones.filter((c) => c.activo).map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.codigo} (-{c.descuento}{c.tipo === 'Porcentaje' ? '%' : ' MXN'}{c.fechaFin ? ` • vence ${c.fechaFin}` : ''})
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </Modal>

            {/* Modal: Gestor Estratégico de Cupones con Vigencia */}
            <Modal
                isOpen={isCouponModalOpen}
                onClose={() => setIsCouponModalOpen(false)}
                title="Gestor Estratégico de Cupones y Vigencias"
                maxWidth="max-w-lg"
            >
                <div className="space-y-4">
                    <p className="text-xs text-gray-500">
                        Crea códigos de descuento con vigencia automática (por días o fecha límite) o cárgales directo desde la Plantilla Excel.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                        <input ref={couponCodeRef} type="text" placeholder="Código (ej. GLOW20)" className="px-3 py-2 border rounded-xl text-xs font-bold uppercase" />
                        <input ref={couponValueRef} type="number" placeholder="Descuento" className="px-3 py-2 border rounded-xl text-xs font-bold" />
                        <select ref={couponTypeRef} className="px-3 py-2 border rounded-xl text-xs font-bold outline-none">
                            <option>%</option>
                            <option>$ Fijo</option>
                        </select>
                        <input ref={couponVigenciaRef} type="text" placeholder="Vigencia (ej. 15 dias o 2026-11-30)" className="px-3 py-2 border rounded-xl text-xs" />
                    </div>
                    <div className="flex justify-end">
                        <Button variant="primary" size="sm" icon={PlusCircle} onClick={handleCrearCupon}>Crear Cupón con Vigencia</Button>
                    </div>

                    <div className="mt-4 space-y-2 max-h-80 overflow-y-auto pr-1">
                        <h4 className="font-bold text-xs uppercase tracking-wider text-gray-500 border-b pb-1.5">Cupones Registrados ({cupones.length})</h4>
                        {cupones.map((cupon) => (
                            <div key={cupon.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                                <div className="flex items-center gap-3">
                                    <div className={`w-2.5 h-2.5 rounded-full ${cupon.activo ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <p className="font-black text-acero text-sm">{cupon.codigo}</p>
                                            {cupon.expiradoPorFecha && (
                                                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                                                    Expirado
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-gray-500">
                                            {cupon.descuento}{cupon.tipo === 'Porcentaje' ? '%' : ' MXN'} de descuento
                                            {cupon.fechaFin ? ` • Vence: ${cupon.fechaFin}` : (cupon.vigenciaTexto ? ` • ${cupon.vigenciaTexto}` : ' • Vigencia indefinida')}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => handleToggleCupon(cupon)} className="text-xs font-bold px-2.5 py-1 bg-white border shadow-2xs rounded-lg hover:bg-gray-50 cursor-pointer">
                                        {cupon.activo ? 'Desactivar' : 'Activar'}
                                    </button>
                                    <button onClick={() => handleDeleteCupon(cupon.id)} className="text-xs text-red-500 px-2 py-1 hover:bg-red-50 rounded-lg cursor-pointer"><Trash2 size={14} /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </Modal>

            {/* Modal Exclusivo Web: Plantilla de Carga Masiva, Detector de Variaciones y Cupones Automáticos */}
            <Modal
                isOpen={isBulkModalOpen}
                onClose={() => setIsBulkModalOpen(false)}
                title="Plantilla Inteligente de Servicios, Paquetes y Cupones (Auditoría de Variaciones)"
                maxWidth="max-w-4xl"
                footer={
                    <div className="flex items-center justify-between w-full gap-3">
                        <Button variant="outline" icon={Download} onClick={handleDescargarPlantillaActual}>
                            Descargar Plantilla con mi Catálogo Actual ({servicios.length} registros)
                        </Button>
                        <div className="flex gap-2">
                            <Button variant="ghost" onClick={() => setIsBulkModalOpen(false)}>Cerrar</Button>
                            {bulkAnalysis && (
                                <Button
                                    variant="primary"
                                    disabled={applyingBulk}
                                    onClick={handleAplicarCambiosAprobados}
                                >
                                    {applyingBulk ? 'Aplicando Cambios...' : '✅ Aceptar Variaciones Seleccionadas y Guardar'}
                                </Button>
                            )}
                        </div>
                    </div>
                }
            >
                <div className="space-y-5 text-xs">
                    {/* Paso 1: Subir archivo CSV o Pegar desde Excel */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-200/80 space-y-2.5 flex flex-col justify-between">
                            <div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-700 bg-indigo-100 px-2.5 py-0.5 rounded-full">
                                    Opción A • Archivo Excel / CSV
                                </span>
                                <h4 className="text-sm font-black text-slate-800 mt-1.5">
                                    Sube tu Plantilla Editada
                                </h4>
                                <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                                    1. Haz clic abajo en <strong>"Descargar Plantilla con mi Catálogo Actual"</strong>.<br/>
                                    2. Modifica precios, sesiones o agrega códigos de cupón y vigencia (ej. <code>15 dias</code> o <code>2026-11-30</code>).<br/>
                                    3. Sube el archivo aquí para auditar las variaciones antes de aplicar.
                                </p>
                            </div>
                            <div>
                                <input
                                    ref={bulkFileInputRef}
                                    type="file"
                                    accept=".csv,.txt,.tsv"
                                    onChange={handleSubirArchivoPlantilla}
                                    className="hidden"
                                />
                                <button
                                    type="button"
                                    onClick={() => bulkFileInputRef.current?.click()}
                                    className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs flex items-center justify-center gap-2 shadow-sm cursor-pointer transition-all"
                                >
                                    <Upload size={15} /> Seleccionar Archivo CSV de mi Computadora
                                </button>
                            </div>
                        </div>

                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 flex flex-col justify-between">
                            <div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-teal-700 bg-teal-100 px-2.5 py-0.5 rounded-full">
                                    Opción B • Copiar y Pegar Directo desde Excel
                                </span>
                                <h4 className="text-sm font-black text-slate-800 mt-1.5">
                                    Pega tus Filas de Excel Aquí
                                </h4>
                                <textarea
                                    rows={4}
                                    value={bulkPasteText}
                                    onChange={(e) => setBulkPasteText(e.target.value)}
                                    placeholder="Nombre | Tipo | Categoria | Precio_Venta | Numero_Sesiones | Duracion_Min | Costo_Insumos | Comision_Pct | Incluir_Plan_Diario | Prioridad_Plan | Servicios_Incluidos | Cupon_Codigo | Cupon_Descuento | Cupon_Tipo | Cupon_Vigencia"
                                    className="w-full mt-1.5 p-2.5 rounded-xl border border-slate-200 bg-white font-mono text-[11px] outline-none focus:border-turquesa"
                                />
                            </div>
                            <button
                                type="button"
                                onClick={handleAnalizarTextoPegado}
                                className="w-full py-2 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-teal-300 font-black text-xs flex items-center justify-center gap-2 cursor-pointer transition-all"
                            >
                                <Search size={14} /> Analizar y Detectar Variaciones
                            </button>
                        </div>
                    </div>

                    {/* Paso 2: Resultado de la Auditoría de Variaciones */}
                    {bulkAnalysis && (
                        <div className="space-y-4 pt-2 border-t border-gray-200 animate-in fade-in">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                                    <span className="text-[10px] font-black uppercase text-amber-700">Variaciones Detectadas</span>
                                    <p className="text-lg font-black text-amber-900">{bulkAnalysis.variaciones.length}</p>
                                </div>
                                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                                    <span className="text-[10px] font-black uppercase text-emerald-700">Servicios / Paquetes Nuevos</span>
                                    <p className="text-lg font-black text-emerald-900">{bulkAnalysis.nuevos.length}</p>
                                </div>
                                <div className="p-3 rounded-xl bg-purple-50 border border-purple-200">
                                    <span className="text-[10px] font-black uppercase text-purple-700">Cupones Automáticos</span>
                                    <p className="text-lg font-black text-purple-900">{bulkAnalysis.cuponesDetectados.length}</p>
                                </div>
                                <div className="p-3 rounded-xl bg-gray-50 border border-gray-200">
                                    <span className="text-[10px] font-black uppercase text-gray-500">Sin Cambios (Idénticos)</span>
                                    <p className="text-lg font-black text-gray-700">{bulkAnalysis.sinCambios.length}</p>
                                </div>
                            </div>

                            {/* Bloque 1: Variaciones Detectadas (Antes -> Ahora) */}
                            {bulkAnalysis.variaciones.length > 0 && (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <h4 className="font-black text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                                            <AlertTriangle size={15} className="text-amber-600" />
                                            1. Confirmar Variaciones en Servicios / Paquetes Existentes ({bulkAnalysis.variaciones.length})
                                        </h4>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const allSelected = bulkAnalysis.variaciones.every(v => acceptedVarIds[v.tempId]);
                                                const next = {};
                                                bulkAnalysis.variaciones.forEach(v => { next[v.tempId] = !allSelected; });
                                                setAcceptedVarIds(next);
                                            }}
                                            className="text-[11px] font-bold text-amber-800 underline cursor-pointer"
                                        >
                                            Marcar / Desmarcar Todas las Variaciones
                                        </button>
                                    </div>
                                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                                        {bulkAnalysis.variaciones.map((v) => (
                                            <label
                                                key={v.tempId}
                                                className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                                                    acceptedVarIds[v.tempId]
                                                        ? 'bg-amber-50/70 border-amber-300'
                                                        : 'bg-gray-50 border-gray-200 opacity-60'
                                                }`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={Boolean(acceptedVarIds[v.tempId])}
                                                    onChange={(e) => setAcceptedVarIds(prev => ({ ...prev, [v.tempId]: e.target.checked }))}
                                                    className="mt-1 w-4 h-4 accent-amber-600"
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className="font-black text-slate-900 text-xs">{v.newData.nombre}</span>
                                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white border border-amber-200 text-amber-800">
                                                            {v.diffs.length} cambio(s)
                                                        </span>
                                                    </div>
                                                    <div className="mt-1.5 flex flex-wrap gap-2">
                                                        {v.diffs.map((d, dIdx) => (
                                                            <div key={dIdx} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-amber-200/80 text-[11px]">
                                                                <span className="font-bold text-slate-600">{d.campo}:</span>
                                                                <span className="line-through text-rose-500">{d.antes}</span>
                                                                <ArrowRight size={11} className="text-slate-400" />
                                                                <span className="font-black text-emerald-700">{d.ahora}</span>
                                                                {d.deltaTexto && (
                                                                    <span className="text-[10px] font-black text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded">
                                                                        {d.deltaTexto}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Bloque 2: Cupones Automáticos con Vigencia */}
                            {bulkAnalysis.cuponesDetectados.length > 0 && (
                                <div className="space-y-2">
                                    <h4 className="font-black text-purple-900 uppercase tracking-wider flex items-center gap-1.5">
                                        <Tag size={15} className="text-purple-600" />
                                        2. Cupones Automáticos Detectados en la Plantilla ({bulkAnalysis.cuponesDetectados.length})
                                    </h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {bulkAnalysis.cuponesDetectados.map((c) => (
                                            <label
                                                key={c.codigo}
                                                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer ${
                                                    acceptedCuponIds[c.codigo]
                                                        ? 'bg-purple-50/70 border-purple-300'
                                                        : 'bg-gray-50 border-gray-200 opacity-60'
                                                }`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={Boolean(acceptedCuponIds[c.codigo])}
                                                    onChange={(e) => setAcceptedCuponIds(prev => ({ ...prev, [c.codigo]: e.target.checked }))}
                                                    className="w-4 h-4 accent-purple-600"
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-black text-purple-950 text-xs">🎟️ {c.codigo}</span>
                                                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-purple-200 text-purple-900">
                                                            {c.esNuevo ? 'Nuevo Cupón Automático' : 'Actualizar Cupón'}
                                                        </span>
                                                    </div>
                                                    <p className="text-[11px] text-purple-800 mt-0.5">
                                                        Descuento: <strong>{c.descuento}{c.tipo === 'Porcentaje' ? '%' : ' MXN'}</strong> • Vigencia: <strong>{c.vigenciaTexto}</strong>
                                                    </p>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Bloque 3: Servicios y Paquetes Nuevos */}
                            {bulkAnalysis.nuevos.length > 0 && (
                                <div className="space-y-2">
                                    <h4 className="font-black text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                                        <PlusCircle size={15} className="text-emerald-600" />
                                        3. Nuevos Servicios y Paquetes por Agregar ({bulkAnalysis.nuevos.length})
                                    </h4>
                                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                        {bulkAnalysis.nuevos.map((n) => (
                                            <label
                                                key={n.tempId}
                                                className={`flex items-center justify-between gap-3 p-2.5 rounded-xl border cursor-pointer ${
                                                    acceptedNewIds[n.tempId]
                                                        ? 'bg-emerald-50/60 border-emerald-300'
                                                        : 'bg-gray-50 border-gray-200 opacity-60'
                                                }`}
                                            >
                                                <div className="flex items-center gap-2.5">
                                                    <input
                                                        type="checkbox"
                                                        checked={Boolean(acceptedNewIds[n.tempId])}
                                                        onChange={(e) => setAcceptedNewIds(prev => ({ ...prev, [n.tempId]: e.target.checked }))}
                                                        className="w-4 h-4 accent-emerald-600"
                                                    />
                                                    <div>
                                                        <span className="font-black text-slate-900">{n.nombre}</span>
                                                        <span className="ml-2 text-[10px] font-bold px-2 py-0.5 rounded bg-white border text-slate-600">
                                                            {n.esPaquete ? `Paquete (${n.numeroSesiones} ses.)` : 'Servicio Individual'} • {n.categoria}
                                                        </span>
                                                    </div>
                                                </div>
                                                <span className="font-black text-emerald-700">{formatCurrency(n.precioVenta)}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {bulkAnalysis.variaciones.length === 0 && bulkAnalysis.nuevos.length === 0 && bulkAnalysis.cuponesDetectados.length === 0 && (
                                <div className="p-6 text-center rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold">
                                    ✓ Todas las filas del archivo coinciden exactamente con tu catálogo actual. No hay variaciones pendientes por aplicar.
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </Modal>

            {/* Modal: Subida Masiva de Flyers */}
            <Modal
                isOpen={isFlyerModalOpen}
                onClose={() => setIsFlyerModalOpen(false)}
                title={`Subir Flyers Promocionales (${controlFlyersMes.nombreMesActual || 'Mes Actual'})`}
                maxWidth="max-w-2xl"
                footer={
                    <div className="flex items-center justify-between w-full gap-3">
                        <span className="text-xs text-gray-500 font-bold">
                            {batchFlyersQueue.length} imagen(es) en cola para publicar
                        </span>
                        <div className="flex gap-2">
                            <Button variant="ghost" onClick={() => setIsFlyerModalOpen(false)}>Cancelar</Button>
                            <Button
                                variant="primary"
                                disabled={batchFlyersQueue.length === 0 || uploading}
                                onClick={() => handleSubirBatchFlyers(true)}
                            >
                                {uploading ? uploadStep : `🚀 Publicar ${batchFlyersQueue.length} Flyer(s) y Marcar Mes Completado`}
                            </Button>
                        </div>
                    </div>
                }
            >
                <div className="space-y-4">
                    <label className="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed border-turquesa/40 bg-turquesa/5 rounded-2xl cursor-pointer hover:bg-turquesa/10 transition-colors">
                        <Upload size={30} className="text-turquesa mb-1.5" />
                        <span className="text-sm font-black text-acero">Haz clic para elegir una o varias imágenes al mismo tiempo</span>
                        <span className="text-xs text-gray-500 mt-0.5">Puedes seleccionar 1, 5, 10 o más flyers juntos desde tu computadora</span>
                        <input
                            type="file"
                            multiple
                            className="hidden"
                            accept="image/*"
                            onChange={handleSelectBatchFlyerFiles}
                        />
                    </label>

                    {batchFlyersQueue.length > 0 && (
                        <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                            <div className="flex items-center justify-between">
                                <h4 className="text-xs font-black uppercase text-gray-500">Vista Previa del Lote ({batchFlyersQueue.length})</h4>
                                <button
                                    type="button"
                                    onClick={() => setBatchFlyersQueue([])}
                                    className="text-xs font-bold text-red-500 hover:underline cursor-pointer"
                                >
                                    Vaciar cola
                                </button>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {batchFlyersQueue.map((item, idx) => (
                                    <div key={item.id} className="flex items-center gap-3 p-2.5 rounded-2xl border border-gray-200 bg-gray-50">
                                        <img src={item.preview} alt="Preview" className="w-16 h-16 rounded-xl object-contain bg-white shrink-0 border border-gray-200" />
                                        <div className="flex-1 min-w-0">
                                            <label className="text-[10px] font-bold text-gray-400 uppercase block">Título Flyer #{idx + 1}</label>
                                            <input
                                                type="text"
                                                value={item.title}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setBatchFlyersQueue(prev => prev.map(x => x.id === item.id ? { ...x, title: val } : x));
                                                }}
                                                className="w-full px-2.5 py-1.5 mt-0.5 rounded-lg border border-gray-200 bg-white text-xs font-bold text-slate-800 outline-none focus:border-turquesa"
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setBatchFlyersQueue(prev => prev.filter(x => x.id !== item.id))}
                                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 cursor-pointer"
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </Modal>
        </div>
    );
}
