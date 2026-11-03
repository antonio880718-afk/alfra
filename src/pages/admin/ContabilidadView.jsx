import React, { useState, useEffect, useMemo } from 'react';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import jsPDF from 'jspdf';
import { guardarPdfNativo } from '../../services/nativeDownloadService';
import autoTable from 'jspdf-autotable';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import {
    Activity, DollarSign, TrendingDown, TrendingUp, PlusCircle,
    ArrowUpRight, ArrowDownRight, FileText, Loader, Trash2, Edit3,
    CheckCircle2, XCircle, Search, Wallet, Building2, Package,
    Sparkles, Tag, Download, CheckCircle, AlertCircle, Settings
} from 'lucide-react';
import {
    onMovimientosChange,
    onCajasDiariasChange,
    registrarMovimiento,
    solicitarCancelacionMovimiento,
    procesarCancelacionMovimiento,
    actualizarMovimiento,
    toLocalISOString,
    CATALOGO_CATEGORIAS_GASTO,
    obtenerCatalogoGastosCompleto,
    agregarMotivoPersonalizadoGasto,
    normalizarCategoriaGasto,
    esGastoDeCajaDelDia,
} from '../../services/finanzasService';
import { DEFAULT_CONFIG } from '../../services/reportesMetrics';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';

const loadLocalMetas = () => {
    try {
        const raw = localStorage.getItem('alfra_metas_financieras_v1');
        if (raw) return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
    } catch {}
    return DEFAULT_CONFIG;
};

const formatCurrency = (amount) =>
    `$${Number(amount || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function ContabilidadView() {
    const [rawMovimientos, setRawMovimientos] = useState([]);
    const [cajasMap, setCajasMap] = useState({});
    const [loading, setLoading] = useState(true);
    const [metasConfig, setMetasConfig] = useState(() => loadLocalMetas());

    // Filtros de la tabla de movimientos
    const [filter, setFilter] = useState('Todos'); // 'Todos' | 'Ingreso' | 'Egreso'
    const [rangoTabla, setRangoTabla] = useState('mes'); // 'mes' | 'semana' | 'dia' | 'todo'
    const [tableDateFilter, setTableDateFilter] = useState('');
    const [filtroCategoria, setFiltroCategoria] = useState('Todas');
    const [filtroMetodo, setFiltroMetodo] = useState('Todos');
    const [busquedaTexto, setBusquedaTexto] = useState('');

    // Catálogo unificado y ampliado de Categorías y Motivos de Gasto
    const [catalogoGastos, setCatalogoGastos] = useState(CATALOGO_CATEGORIAS_GASTO);
    const [showModal, setShowModal] = useState(false);
    const [categoriaGasto, setCategoriaGasto] = useState(CATALOGO_CATEGORIAS_GASTO[0].nombre);
    const [motivoCatalogo, setMotivoCatalogo] = useState(CATALOGO_CATEGORIAS_GASTO[0].motivos[0]);
    const [detalleExtra, setDetalleExtra] = useState('');
    const [proveedorGasto, setProveedorGasto] = useState('');
    const [montoGasto, setMontoGasto] = useState('');
    const [metodoGasto, setMetodoGasto] = useState('Efectivo en Caja');
    const [saving, setSaving] = useState(false);

    // Agregar motivo personalizado al catálogo
    const [nuevoMotivoCustom, setNuevoMotivoCustom] = useState('');
    const [showNuevoMotivoInput, setShowNuevoMotivoInput] = useState(false);

    // Modal Administrador de Catálogo de Motivos
    const [modalCatalogoOpen, setModalCatalogoOpen] = useState(false);
    const [catAdminSeleccionada, setCatAdminSeleccionada] = useState(CATALOGO_CATEGORIAS_GASTO[0].nombre);
    const [nuevoMotivoModalCat, setNuevoMotivoModalCat] = useState('');

    // Modal Editar Movimiento (Exclusivo Administrador)
    const [modalEditarOpen, setModalEditarOpen] = useState(false);
    const [movEditar, setMovEditar] = useState(null);
    const [savingEdicion, setSavingEdicion] = useState(false);

    const { userRole, currentUser } = useAuth();

    // Modales de Cancelación
    const [modalCancelacionOpen, setModalCancelacionOpen] = useState(false);
    const [cancelacionId, setCancelacionId] = useState(null);
    const [motivoCancelacion, setMotivoCancelacion] = useState('');

    const [modalConfirmAdminOpen, setModalConfirmAdminOpen] = useState(false);
    const [confirmAdminData, setConfirmAdminData] = useState({ id: null, aprobado: false });

    const hoyEstandar = toLocalISOString().split('T')[0];

    // Reporte PDF Financiero
    const [isReporteModalOpen, setIsReporteModalOpen] = useState(false);
    const [tipoReportePdf, setTipoReportePdf] = useState('mensual'); // 'semanal' | 'mensual'
    const [fechaReferencia, setFechaReferencia] = useState(hoyEstandar);

    // Fecha de referencia para las métricas del mes/semana
    const [selectedDateFilter, setSelectedDateFilter] = useState(hoyEstandar);
    const [fechaOperacion, setFechaOperacion] = useState(hoyEstandar);

    useEffect(() => {
        obtenerCatalogoGastosCompleto().then(setCatalogoGastos).catch(console.error);
        getDoc(doc(db, 'configuracion', 'metas_financieras')).then((snap) => {
            if (snap.exists()) {
                setMetasConfig((prev) => ({ ...prev, ...snap.data() }));
            }
        }).catch(console.error);

        const unsubMovs = onMovimientosChange((movimientos) => {
            setRawMovimientos(movimientos);
            setLoading(false);
        });
        const unsubCajas = onCajasDiariasChange(setCajasMap);

        return () => {
            if (unsubMovs) unsubMovs();
            if (unsubCajas) unsubCajas();
        };
    }, []);

    // Normalizar transacciones con Categoría Oficial Obligatoria
    const transactions = useMemo(() => {
        return rawMovimientos
            .map((m) => {
                const rawDateStr = m.fecha || m.createdAt || '';
                const isEgreso = m.tipo === 'Egreso';
                const catOficial = isEgreso
                    ? normalizarCategoriaGasto(m)
                    : m.categoria || (m.subTipo === 'abono_tratamiento' ? 'Planes de Tratamiento' : 'Servicios y Consultas');
                return {
                    id: m.id,
                    raw: m,
                    rawDate: rawDateStr,
                    dateKey: rawDateStr ? String(rawDateStr).substring(0, 10) : '',
                    date: rawDateStr
                        ? new Date(rawDateStr).toLocaleDateString('es-MX', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                          })
                        : '—',
                    type: m.tipo === 'Ingreso' ? 'Ingreso' : 'Egreso',
                    category: catOficial,
                    description: m.motivo || m.descripcion || m.concepto || '—',
                    proveedor: m.proveedor || '',
                    pacienteNombre: m.pacienteNombre || '',
                    registradoPor: m.registradoPor || '',
                    amount: Number(m.monto) || 0,
                    status: m.estado || 'Completado',
                    motivoCancelacion: m.motivoCancelacion || null,
                    method: m.metodoPago || 'Efectivo en Caja',
                    afectaCajaDia: isEgreso && esGastoDeCajaDelDia(m),
                };
            })
            .sort((a, b) => new Date(b.rawDate || 0) - new Date(a.rawDate || 0));
    }, [rawMovimientos]);

    const baseDate = useMemo(() => new Date(selectedDateFilter + 'T12:00:00'), [selectedDateFilter]);

    const isThisWeek = (dateStr) => {
        try {
            if (!dateStr) return false;
            const d = new Date(dateStr);
            return d >= startOfWeek(baseDate, { weekStartsOn: 1 }) && d <= endOfWeek(baseDate, { weekStartsOn: 1 });
        } catch {
            return false;
        }
    };

    const isThisMonth = (dateStr) => {
        try {
            if (!dateStr) return false;
            const d = new Date(dateStr);
            return d.getMonth() === baseDate.getMonth() && d.getFullYear() === baseDate.getFullYear();
        } catch {
            return false;
        }
    };

    const trxValidas = useMemo(() => transactions.filter((t) => t.status !== 'Cancelado'), [transactions]);
    const trxMesActual = useMemo(() => trxValidas.filter((t) => isThisMonth(t.rawDate)), [trxValidas, baseDate]);
    const trxSemanaActual = useMemo(() => trxValidas.filter((t) => isThisWeek(t.rawDate)), [trxValidas, baseDate]);

    const ingresosSemana = useMemo(
        () => trxSemanaActual.filter((t) => t.type === 'Ingreso').reduce((a, c) => a + c.amount, 0),
        [trxSemanaActual]
    );
    const egresosSemana = useMemo(
        () => trxSemanaActual.filter((t) => t.type === 'Egreso').reduce((a, c) => a + c.amount, 0),
        [trxSemanaActual]
    );
    const utilidadSemana = ingresosSemana - egresosSemana;

    const ingresosMes = useMemo(
        () => trxMesActual.filter((t) => t.type === 'Ingreso').reduce((a, c) => a + c.amount, 0),
        [trxMesActual]
    );
    const egresosMes = useMemo(
        () => trxMesActual.filter((t) => t.type === 'Egreso').reduce((a, c) => a + c.amount, 0),
        [trxMesActual]
    );
    const utilidadMes = ingresosMes - egresosMes;

    // ── Tesorería y Bolsas de Dinero del Mes Seleccionado ───────────────────
    const tesoreriaMes = useMemo(() => {
        // 1. Efectivo esperado en el cajón de recepción HOY
        const movsHoy = trxValidas.filter((t) => t.dateKey === hoyEstandar);
        const cajaHoyDoc = cajasMap[hoyEstandar] || {};
        const fondoHoy = Number(cajaHoyDoc.fondoInicial) || 0;
        const retirosHoy = (Array.isArray(cajaHoyDoc.retirosEfectivo) ? cajaHoyDoc.retirosEfectivo : []).reduce(
            (a, r) => a + (Number(r.monto) || 0),
            0
        );
        let ingEfectivoHoy = 0;
        let egCajaHoy = 0;
        movsHoy.forEach((t) => {
            if (t.type === 'Ingreso') {
                if (t.raw?.desglosePago) {
                    ingEfectivoHoy += Number(t.raw.desglosePago.efectivo) || 0;
                } else {
                    const m = t.method.toLowerCase();
                    if (!m.includes('tarjeta') && !m.includes('transfer') && !m.includes('cortesia')) {
                        ingEfectivoHoy += t.amount;
                    }
                }
            } else if (t.afectaCajaDia) {
                egCajaHoy += t.amount;
            }
        });
        const efectivoEnCajonHoy = fondoHoy + ingEfectivoHoy - egCajaHoy - retirosHoy;

        // 2. Flujo del mes por Efectivo vs Bancos (Tarjeta + Transferencia)
        let ingresosEfectivoMes = 0;
        let ingresosBancoMes = 0;
        let egresosEfectivoMes = 0;
        let egresosBancoMes = 0;

        // 3. Gastos por categoría oficial en el mes
        const gastosPorCategoria = {};

        trxMesActual.forEach((t) => {
            const m = t.method.toLowerCase();
            if (t.type === 'Ingreso') {
                if (t.raw?.desglosePago) {
                    ingresosEfectivoMes += Number(t.raw.desglosePago.efectivo) || 0;
                    ingresosBancoMes +=
                        (Number(t.raw.desglosePago.tarjeta) || 0) + (Number(t.raw.desglosePago.transferencia) || 0);
                } else if (m.includes('tarjeta') || m.includes('transfer') || m.includes('debito') || m.includes('credito')) {
                    ingresosBancoMes += t.amount;
                } else if (!m.includes('cortesia')) {
                    ingresosEfectivoMes += t.amount;
                }
            } else {
                gastosPorCategoria[t.category] = (gastosPorCategoria[t.category] || 0) + t.amount;
                if (m.includes('tarjeta') || m.includes('transfer') || m.includes('banco')) {
                    egresosBancoMes += t.amount;
                } else {
                    egresosEfectivoMes += t.amount;
                }
            }
        });

        // 4. Bolsas de Provisión Mensual (Producto Tratamientos y Equipo)
        const metaBolsaProducto = Number(metasConfig.provisionProductoMensual) || 0;
        const ejercidoBolsaProducto = gastosPorCategoria['Insumos / Producto (Tratamientos)'] || 0;
        const disponibleBolsaProducto = metaBolsaProducto - ejercidoBolsaProducto;

        const metaBolsaEquipo = Number(metasConfig.provisionEquipoMensual) || 0;
        const ejercidoBolsaEquipo = gastosPorCategoria['Compra / Renovación de Equipo'] || 0;
        const disponibleBolsaEquipo = metaBolsaEquipo - ejercidoBolsaEquipo;

        return {
            efectivoEnCajonHoy,
            ingresosEfectivoMes,
            egresosEfectivoMes,
            flujoNetoEfectivoMes: ingresosEfectivoMes - egresosEfectivoMes,
            ingresosBancoMes,
            egresosBancoMes,
            flujoNetoBancoMes: ingresosBancoMes - egresosBancoMes,
            gastosPorCategoria,
            metaBolsaProducto,
            ejercidoBolsaProducto,
            disponibleBolsaProducto,
            metaBolsaEquipo,
            ejercidoBolsaEquipo,
            disponibleBolsaEquipo,
        };
    }, [trxValidas, trxMesActual, cajasMap, hoyEstandar, metasConfig]);

    // ── Checklist de Compromisos Fijos del Mes ──────────────────────────────
    const compromisosFijosMes = useMemo(() => {
        const g = tesoreriaMes.gastosPorCategoria || {};
        return [
            {
                categoria: 'Renta',
                motivoDefault: 'Pago de renta mensual del local',
                presupuesto: Number(metasConfig.gastoRenta) || 0,
                pagado: g['Renta'] || 0,
            },
            {
                categoria: 'Luz / CFE',
                motivoDefault: 'Pago de recibo de luz CFE',
                presupuesto: Number(metasConfig.gastoLuz) || 0,
                pagado: g['Luz / CFE'] || 0,
            },
            {
                categoria: 'Internet y Teléfono',
                motivoDefault: 'Pago mensual de Internet y telefonía fija',
                presupuesto: Number(metasConfig.gastoInternet) || 0,
                pagado: g['Internet y Teléfono'] || 0,
            },
            {
                categoria: 'Agua',
                motivoDefault: 'Recibo mensual de agua potable',
                presupuesto: Number(metasConfig.gastoAgua) || 0,
                pagado: g['Agua'] || 0,
            },
            {
                categoria: 'Nómina',
                motivoDefault: 'Pago de sueldo base semanal / quincenal',
                presupuesto: Number(metasConfig.nominaMensualEstimada || metasConfig.gastoNominaBase) || 0,
                pagado: g['Nómina'] || 0,
            },
        ];
    }, [tesoreriaMes, metasConfig]);

    const handlePrellenarGastoFijo = (comp) => {
        setCategoriaGasto(comp.categoria);
        setMotivoCatalogo(comp.motivoDefault);
        setDetalleExtra(format(baseDate, 'MMMM yyyy', { locale: es }));
        setMontoGasto(comp.presupuesto > 0 ? String(comp.presupuesto) : '');
        setMetodoGasto('Transferencia Bancaria');
        setShowModal(true);
    };

    const categoriaSeleccionadaObj = useMemo(() => {
        return catalogoGastos.find((c) => c.nombre === categoriaGasto) || catalogoGastos[0];
    }, [catalogoGastos, categoriaGasto]);

    const handleCambiarCategoria = (nuevaCat) => {
        setCategoriaGasto(nuevaCat);
        const found = catalogoGastos.find((c) => c.nombre === nuevaCat);
        if (found && found.motivos?.length > 0) {
            setMotivoCatalogo(found.motivos[0]);
        } else {
            setMotivoCatalogo('');
        }
    };

    const handleAgregarMotivoPersonalizado = async (catTarget, textoMotivo) => {
        const limpio = String(textoMotivo || '').trim();
        if (!limpio) return;
        await agregarMotivoPersonalizadoGasto(catTarget, limpio);
        const actualizado = await obtenerCatalogoGastosCompleto();
        setCatalogoGastos(actualizado);
        if (catTarget === categoriaGasto) {
            setMotivoCatalogo(limpio);
        }
        setNuevoMotivoCustom('');
        setShowNuevoMotivoInput(false);
        setNuevoMotivoModalCat('');
    };

    const handleRegistrarGasto = async () => {
        if (!categoriaGasto) {
            alert('Todo gasto debe tener una categoría obligatoria.');
            return;
        }
        const montoNum = parseFloat(montoGasto);
        if (!montoNum || montoNum <= 0) {
            alert('Ingresa un monto válido.');
            return;
        }
        const baseMot = motivoCatalogo.trim();
        const extra = detalleExtra.trim();
        const motivoFinal = baseMot && extra ? `${baseMot} — ${extra}` : baseMot || extra;

        if (!motivoFinal) {
            alert('Selecciona o escribe la descripción del gasto.');
            return;
        }

        setSaving(true);
        try {
            const fechaOperacionIso = fechaOperacion === hoyEstandar
                ? toLocalISOString()
                : new Date(`${fechaOperacion}T12:00:00.000Z`).toISOString();

            await registrarMovimiento({
                tipo: 'Egreso',
                monto: montoNum,
                motivo: motivoFinal,
                motivoCatalogo: baseMot || motivoFinal,
                detalleExtra: extra || null,
                proveedor: proveedorGasto.trim() || null,
                categoria: normalizarCategoriaGasto({ categoria: categoriaGasto, motivo: motivoFinal }),
                metodoPago: metodoGasto,
                estado: 'Pagado',
                registradoPor: userRole || 'Administrador',
                usuarioEmail: currentUser?.email || null,
                origenModulo: 'ContabilidadAdmin',
                fecha: fechaOperacionIso,
            });
            setShowModal(false);
            setMontoGasto('');
            setDetalleExtra('');
            setProveedorGasto('');
            setFechaOperacion(hoyEstandar);
        } catch (err) {
            alert('Error al registrar el gasto.');
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    // Editar Movimiento (Exclusivo Administrador)
    const abrirModalEditar = (trx) => {
        setMovEditar({
            id: trx.id,
            tipo: trx.type,
            fecha: trx.dateKey || hoyEstandar,
            categoria: trx.category,
            motivo: trx.description,
            proveedor: trx.proveedor || '',
            metodoPago: trx.method,
            monto: String(trx.amount),
        });
        setModalEditarOpen(true);
    };

    const handleGuardarEdicionMovimiento = async () => {
        if (!movEditar) return;
        const montoNum = parseFloat(movEditar.monto);
        if (isNaN(montoNum) || montoNum < 0) {
            alert('Ingresa un monto válido.');
            return;
        }
        setSavingEdicion(true);
        try {
            const fechaIso = movEditar.fecha === hoyEstandar
                ? toLocalISOString()
                : new Date(`${movEditar.fecha}T12:00:00.000Z`).toISOString();

            await actualizarMovimiento(movEditar.id, {
                tipo: movEditar.tipo,
                monto: montoNum,
                categoria: movEditar.tipo === 'Egreso'
                    ? normalizarCategoriaGasto({ categoria: movEditar.categoria, motivo: movEditar.motivo })
                    : movEditar.categoria,
                motivo: movEditar.motivo.trim(),
                proveedor: movEditar.proveedor.trim() || null,
                metodoPago: movEditar.metodoPago,
                fecha: fechaIso,
            });
            setModalEditarOpen(false);
            setMovEditar(null);
        } catch (err) {
            console.error(err);
            alert('Error al actualizar el movimiento.');
        } finally {
            setSavingEdicion(false);
        }
    };

    const handleSolicitarCancelacion = (id) => {
        setCancelacionId(id);
        setMotivoCancelacion('');
        setModalCancelacionOpen(true);
    };

    const confirmarCancelacion = async () => {
        if (!motivoCancelacion || motivoCancelacion.trim() === '') {
            alert('Debes ingresar un motivo para poder solicitar la cancelación.');
            return;
        }
        try {
            await solicitarCancelacionMovimiento(cancelacionId, motivoCancelacion);
            alert('Solicitud enviada al Administrador.');
            setModalCancelacionOpen(false);
        } catch (err) {
            alert(`Error al solicitar cancelación: ${err.message || 'Intenta de nuevo.'}`);
        }
    };

    const handleProcesarCancelacion = (id, aprobado) => {
        setConfirmAdminData({ id, aprobado });
        setModalConfirmAdminOpen(true);
    };

    const ejecutarProcesarCancelacion = async () => {
        try {
            await procesarCancelacionMovimiento(confirmAdminData.id, confirmAdminData.aprobado);
            setModalConfirmAdminOpen(false);
        } catch {
            alert('Error al procesar la solicitud.');
        }
    };

    // Filtrado avanzado de movimientos
    const filteredTransactions = useMemo(() => {
        return transactions.filter((t) => {
            if (filter !== 'Todos' && t.type !== filter) return false;
            if (filtroCategoria !== 'Todas' && t.category !== filtroCategoria) return false;
            if (filtroMetodo !== 'Todos') {
                const m = t.method.toLowerCase();
                if (filtroMetodo === 'Efectivo' && !m.includes('efectivo') && !m.includes('caja')) return false;
                if (filtroMetodo === 'Tarjeta' && !m.includes('tarjeta')) return false;
                if (filtroMetodo === 'Transferencia' && !m.includes('transfer')) return false;
            }
            if (tableDateFilter) {
                if (t.dateKey !== tableDateFilter) return false;
            } else if (rangoTabla === 'mes') {
                if (!isThisMonth(t.rawDate)) return false;
            } else if (rangoTabla === 'semana') {
                if (!isThisWeek(t.rawDate)) return false;
            }
            if (busquedaTexto.trim()) {
                const q = busquedaTexto.toLowerCase();
                const textoFila = `${t.description} ${t.category} ${t.pacienteNombre} ${t.proveedor} ${t.method}`.toLowerCase();
                if (!textoFila.includes(q)) return false;
            }
            return true;
        });
    }, [transactions, filter, filtroCategoria, filtroMetodo, tableDateFilter, rangoTabla, busquedaTexto, baseDate]);

    // Exportar Movimientos Filtrados a Excel / CSV
    const exportarExcelCSV = () => {
        const rows = [
            ['Fecha', 'Tipo', 'Categoria Oficial', 'Concepto / Motivo', 'Paciente / Proveedor', 'Metodo de Pago', 'Estado', 'Monto'],
        ];
        filteredTransactions.forEach((t) => {
            const rel = t.pacienteNombre || t.proveedor || '';
            const montoConSigno = t.type === 'Egreso' ? -t.amount : t.amount;
            rows.push([
                t.dateKey,
                t.type,
                `"${String(t.category).replace(/"/g, '""')}"`,
                `"${String(t.description).replace(/"/g, '""')}"`,
                `"${String(rel).replace(/"/g, '""')}"`,
                `"${String(t.method).replace(/"/g, '""')}"`,
                t.status,
                montoConSigno.toFixed(2),
            ]);
        });
        const csvContent = '\uFEFF' + rows.map((r) => r.join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Contabilidad_ALFRA_${selectedDateFilter}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // Exportar Estado de Resultados Contable (PDF Semanal o Mensual)
    const generarReporteContablePDF = () => {
        if (!fechaReferencia) {
            alert('Selecciona una fecha de referencia.');
            return;
        }
        const targetDate = new Date(fechaReferencia + 'T12:00:00');
        let start;
        let end;
        let tituloPeriodo;

        if (tipoReportePdf === 'semanal') {
            start = startOfWeek(targetDate, { weekStartsOn: 1 });
            end = endOfWeek(targetDate, { weekStartsOn: 1 });
            tituloPeriodo = `Semanal (${format(start, 'dd/MM/yyyy')} al ${format(end, 'dd/MM/yyyy')})`;
        } else {
            start = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1, 0, 0, 0);
            end = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0, 23, 59, 59);
            tituloPeriodo = `Mensual (${format(targetDate, 'MMMM yyyy', { locale: es }).toUpperCase()})`;
        }

        const trxPeriodo = transactions.filter((t) => {
            if (!t.rawDate || t.status === 'Cancelado') return false;
            const d = new Date(t.rawDate);
            return d >= start && d <= end;
        });

        if (trxPeriodo.length === 0) {
            alert('No hay movimientos financieros registrados en el período seleccionado.');
            return;
        }

        let totalIngresos = 0;
        let totalEgresos = 0;
        const gastosPorCat = {};
        const ingresosPorMetodo = {};

        trxPeriodo.forEach((t) => {
            if (t.type === 'Ingreso') {
                totalIngresos += t.amount;
                ingresosPorMetodo[t.method] = (ingresosPorMetodo[t.method] || 0) + t.amount;
            } else {
                totalEgresos += t.amount;
                gastosPorCat[t.category] = (gastosPorCat[t.category] || 0) + t.amount;
            }
        });

        const docPdf = new jsPDF();
        docPdf.setFillColor(13, 148, 136);
        docPdf.rect(0, 0, 210, 32, 'F');
        docPdf.setFontSize(18);
        docPdf.setTextColor(255, 255, 255);
        docPdf.setFont('helvetica', 'bold');
        docPdf.text('Estado de Resultados Contable ALFRA', 14, 16);
        docPdf.setFontSize(10);
        docPdf.setFont('helvetica', 'normal');
        docPdf.text(`Periodo ${tituloPeriodo}`, 14, 24);

        // Resumen General
        autoTable(docPdf, {
            startY: 38,
            head: [['Concepto Financiero', 'Monto', '% sobre Ingresos']],
            body: [
                ['(+) Total Ingresos Operativos', formatCurrency(totalIngresos), '100.0%'],
                [
                    '(-) Total Gastos / Egresos Categorizados',
                    formatCurrency(totalEgresos),
                    totalIngresos > 0 ? `${((totalEgresos / totalIngresos) * 100).toFixed(1)}%` : '0%',
                ],
                [
                    '(=) UTILIDAD NETA DEL PERIODO',
                    formatCurrency(totalIngresos - totalEgresos),
                    totalIngresos > 0 ? `${(((totalIngresos - totalEgresos) / totalIngresos) * 100).toFixed(1)}%` : '0%',
                ],
            ],
            theme: 'grid',
            headStyles: { fillColor: [30, 41, 59], textColor: 255 },
            columnStyles: { 1: { halign: 'right', fontStyle: 'bold' }, 2: { halign: 'center' } },
        });

        // Desglose de Egresos por Categoría Obligatoria
        const catRows = Object.entries(gastosPorCat)
            .sort((a, b) => b[1] - a[1])
            .map(([cat, m]) => [
                cat,
                formatCurrency(m),
                totalEgresos > 0 ? `${((m / totalEgresos) * 100).toFixed(1)}%` : '0%',
            ]);

        if (catRows.length > 0) {
            autoTable(docPdf, {
                startY: docPdf.lastAutoTable.finalY + 8,
                head: [['Categoria Oficial del Gasto', 'Monto Ejercido', '% de Egresos']],
                body: catRows,
                theme: 'grid',
                headStyles: { fillColor: [220, 38, 38], textColor: 255 },
                columnStyles: { 1: { halign: 'right', fontStyle: 'bold' }, 2: { halign: 'center' } },
            });
        }

        // Detalle de Movimientos
        autoTable(docPdf, {
            startY: docPdf.lastAutoTable.finalY + 8,
            head: [['Fecha', 'Tipo', 'Categoria Oficial', 'Concepto', 'Metodo', 'Monto']],
            body: trxPeriodo.map((t) => [
                t.dateKey,
                t.type,
                t.category,
                t.description.substring(0, 40),
                t.method,
                `${t.type === 'Egreso' ? '-' : '+'}${formatCurrency(t.amount)}`,
            ]),
            styles: { fontSize: 8 },
            headStyles: { fillColor: [51, 65, 85], textColor: 255 },
            columnStyles: { 5: { halign: 'right', fontStyle: 'bold' } },
        });

        const baseFilename = `Estado_Resultados_ALFRA_${tipoReportePdf}_${fechaReferencia}.pdf`;

        const ejecutarExportacion = async () => {
            try {
                await guardarPdfNativo(docPdf, baseFilename, 'Estado de Resultados ALFRA');
            } catch (err) {
                alert('Fallo exportando el PDF: ' + err.message);
            }
        };

        ejecutarExportacion();
        setIsReporteModalOpen(false);
    };

    const categoriasGastosMesOrdenadas = useMemo(() => {
        return Object.entries(tesoreriaMes.gastosPorCategoria || {}).sort((a, b) => b[1] - a[1]);
    }, [tesoreriaMes]);

    return (
        <div className="space-y-6">
            {/* ── Header ─────────────────────────────────────────────── */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-acero">Módulo de Contabilidad y Tesorería</h2>
                    <p className="text-gray-500 text-sm">
                        Control de ingresos, gastos por categoría obligatoria, bolsas de provisión y compromisos fijos
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2.5">
                    <div className="flex items-center bg-white border border-gray-200 rounded-xl p-1 shadow-sm">
                        <button
                            onClick={() => {
                                const d = new Date(selectedDateFilter + 'T12:00:00');
                                d.setMonth(d.getMonth() - 1);
                                setSelectedDateFilter(format(d, 'yyyy-MM-dd'));
                            }}
                            className="p-1.5 hover:bg-gray-50 rounded-lg text-gray-400 hover:text-turquesa"
                            title="Mes Anterior"
                        >
                            <ArrowDownRight size={16} className="rotate-[135deg]" />
                        </button>
                        <div className="flex items-center px-2 text-sm font-bold text-gray-700">
                            <input
                                type="date"
                                className="outline-none bg-transparent cursor-pointer"
                                value={selectedDateFilter}
                                onChange={(e) => setSelectedDateFilter(e.target.value)}
                            />
                        </div>
                        <button
                            onClick={() => {
                                const d = new Date(selectedDateFilter + 'T12:00:00');
                                d.setMonth(d.getMonth() + 1);
                                setSelectedDateFilter(format(d, 'yyyy-MM-dd'));
                            }}
                            className="p-1.5 hover:bg-gray-50 rounded-lg text-gray-400 hover:text-turquesa"
                            title="Mes Siguiente"
                        >
                            <ArrowUpRight size={16} className="-rotate-45" />
                        </button>
                    </div>

                    <Button variant="outline" icon={Settings} onClick={() => setModalCatalogoOpen(true)}>
                        Catálogo Motivos
                    </Button>
                    <Button variant="outline" icon={Download} onClick={exportarExcelCSV}>
                        Excel / CSV
                    </Button>
                    <Button variant="outline" icon={FileText} onClick={() => setIsReporteModalOpen(true)}>
                        Estado Resultados PDF
                    </Button>
                    <Button
                        variant="primary"
                        icon={PlusCircle}
                        onClick={() => setShowModal(true)}
                        className="bg-rose-600 hover:bg-rose-700 border-rose-600 text-white"
                    >
                        Registrar Gasto
                    </Button>
                </div>
            </div>

            {/* ── KPIs Principales (Semana y Mes Seleccionado) ─────────── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-white border-l-4 border-turquesa shadow-sm">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Ingresos del Mes</p>
                            <h3 className="text-3xl font-black text-gray-900">{loading ? '...' : formatCurrency(ingresosMes)}</h3>
                        </div>
                        <div className="p-3 bg-turquesa/10 text-turquesa rounded-xl">
                            <TrendingUp size={24} />
                        </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between text-xs">
                        <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded font-bold">Esta Semana</span>
                        <span className="font-black text-gray-700">{formatCurrency(ingresosSemana)}</span>
                    </div>
                </Card>

                <Card className="bg-white border-l-4 border-rose-500 shadow-sm">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Gastos del Mes</p>
                            <h3 className="text-3xl font-black text-gray-900">{loading ? '...' : formatCurrency(egresosMes)}</h3>
                        </div>
                        <div className="p-3 bg-rose-50 text-rose-500 rounded-xl">
                            <TrendingDown size={24} />
                        </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between text-xs">
                        <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded font-bold">Esta Semana</span>
                        <span className="font-black text-gray-700">{formatCurrency(egresosSemana)}</span>
                    </div>
                </Card>

                <Card className={`bg-white border-l-4 shadow-sm ${utilidadMes >= 0 ? 'border-emerald-500' : 'border-rose-500'}`}>
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Utilidad Neta del Mes</p>
                            <h3 className={`text-3xl font-black ${utilidadMes >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {loading ? '...' : formatCurrency(utilidadMes)}
                            </h3>
                        </div>
                        <div className={`p-3 rounded-xl ${utilidadMes >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500'}`}>
                            <DollarSign size={24} />
                        </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between text-xs">
                        <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded font-bold">Utilidad Semanal</span>
                        <span className={`font-black ${utilidadSemana >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                            {formatCurrency(utilidadSemana)}
                        </span>
                    </div>
                </Card>
            </div>

            {/* ── Panel de Tesorería (Efectivo vs Banco y Bolsas de Provisión) ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl p-4 border border-emerald-100 shadow-sm">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-bold text-emerald-700 uppercase">Efectivo en Cajón Hoy</span>
                        <Wallet size={18} className="text-emerald-600" />
                    </div>
                    <p className="text-2xl font-black text-emerald-700">{formatCurrency(tesoreriaMes.efectivoEnCajonHoy)}</p>
                    <p className="text-[11px] text-gray-500 mt-1">
                        Flujo Efectivo Mes: <strong>{formatCurrency(tesoreriaMes.flujoNetoEfectivoMes)}</strong>
                    </p>
                </div>

                <div className="bg-white rounded-2xl p-4 border border-blue-100 shadow-sm">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-bold text-blue-700 uppercase">Flujo Neto Bancos (Mes)</span>
                        <Building2 size={18} className="text-blue-600" />
                    </div>
                    <p className="text-2xl font-black text-blue-700">{formatCurrency(tesoreriaMes.flujoNetoBancoMes)}</p>
                    <p className="text-[11px] text-gray-500 mt-1">
                        Entradas: {formatCurrency(tesoreriaMes.ingresosBancoMes)} • Salidas: {formatCurrency(tesoreriaMes.egresosBancoMes)}
                    </p>
                </div>

                <div className="bg-white rounded-2xl p-4 border border-teal-100 shadow-sm">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-bold text-teal-700 uppercase">Bolsa Producto (Cabina)</span>
                        <Package size={18} className="text-teal-600" />
                    </div>
                    <p className="text-xl font-black text-gray-900">
                        Ejercido: {formatCurrency(tesoreriaMes.ejercidoBolsaProducto)}
                    </p>
                    <p className="text-[11px] text-teal-700 font-bold mt-1">
                        Provisión mensual: {formatCurrency(tesoreriaMes.metaBolsaProducto)} (Saldo:{' '}
                        {formatCurrency(tesoreriaMes.disponibleBolsaProducto)})
                    </p>
                </div>

                <div className="bg-white rounded-2xl p-4 border border-purple-100 shadow-sm">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-bold text-purple-700 uppercase">Bolsa Equipo / Aparatología</span>
                        <Sparkles size={18} className="text-purple-600" />
                    </div>
                    <p className="text-xl font-black text-gray-900">
                        Ejercido: {formatCurrency(tesoreriaMes.ejercidoBolsaEquipo)}
                    </p>
                    <p className="text-[11px] text-purple-700 font-bold mt-1">
                        Provisión mensual: {formatCurrency(tesoreriaMes.metaBolsaEquipo)} (Saldo:{' '}
                        {formatCurrency(tesoreriaMes.disponibleBolsaEquipo)})
                    </p>
                </div>
            </div>

            {/* ── Checklist de Compromisos Fijos del Mes + Desglose por Categoría ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Checklist de Gastos Fijos */}
                <Card title={`Compromisos Fijos del Mes (${format(baseDate, 'MMMM yyyy', { locale: es })})`}>
                    <div className="space-y-2.5">
                        {compromisosFijosMes.map((comp) => {
                            const cubierto = comp.pagado > 0;
                            return (
                                <div
                                    key={comp.categoria}
                                    className={`flex items-center justify-between p-3 rounded-xl border ${
                                        cubierto ? 'bg-emerald-50/40 border-emerald-200' : 'bg-amber-50/40 border-amber-200'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        {cubierto ? (
                                            <CheckCircle size={18} className="text-emerald-600 shrink-0" />
                                        ) : (
                                            <AlertCircle size={18} className="text-amber-600 shrink-0" />
                                        )}
                                        <div>
                                            <p className="text-sm font-bold text-gray-800">{comp.categoria}</p>
                                            <p className="text-xs text-gray-500">
                                                Presupuesto ref: {formatCurrency(comp.presupuesto)} • Pagado este mes:{' '}
                                                <strong className={cubierto ? 'text-emerald-700' : 'text-amber-700'}>
                                                    {formatCurrency(comp.pagado)}
                                                </strong>
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handlePrellenarGastoFijo(comp)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                                            cubierto
                                                ? 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                                                : 'bg-rose-600 text-white hover:bg-rose-700'
                                        }`}
                                    >
                                        {cubierto ? '+ Otro Pago' : 'Registrar Pago'}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </Card>

                {/* Desglose de Gastos del Mes por Categoría Obligatoria */}
                <Card title="Gastos del Mes por Categoría Obligatoria">
                    {categoriasGastosMesOrdenadas.length === 0 ? (
                        <div className="text-center py-8 text-gray-400 text-sm">
                            No hay gastos registrados en el mes seleccionado.
                        </div>
                    ) : (
                        <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                            {categoriasGastosMesOrdenadas.map(([cat, montoCat]) => {
                                const pct = egresosMes > 0 ? Math.round((montoCat / egresosMes) * 100) : 0;
                                return (
                                    <div
                                        key={cat}
                                        onClick={() => {
                                            setFiltroCategoria(filtroCategoria === cat ? 'Todas' : cat);
                                            setFilter('Egreso');
                                        }}
                                        className="cursor-pointer group"
                                    >
                                        <div className="flex justify-between text-xs mb-1">
                                            <span className="font-bold text-gray-700 group-hover:text-rose-600 transition-colors">
                                                {cat}
                                            </span>
                                            <span className="font-black text-gray-900">
                                                {formatCurrency(montoCat)} <span className="text-gray-400 font-normal">({pct}%)</span>
                                            </span>
                                        </div>
                                        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-rose-500 rounded-full transition-all"
                                                style={{ width: `${Math.max(4, pct)}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </Card>
            </div>

            {/* ── Historial de Movimientos con Buscador y Filtros Avanzados ── */}
            <Card>
                <div className="flex flex-col space-y-4 mb-6 border-b pb-4">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <h3 className="text-lg font-bold text-acero flex items-center gap-2">
                            <Activity size={20} /> Historial de Movimientos ({filteredTransactions.length})
                        </h3>

                        <div className="flex flex-wrap gap-2 items-center">
                            {/* Rango de fechas de la tabla */}
                            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl text-xs">
                                {[
                                    { id: 'mes', label: 'Mes Actual' },
                                    { id: 'semana', label: 'Semana' },
                                    { id: 'todo', label: 'Todo el Historial' },
                                ].map((r) => (
                                    <button
                                        key={r.id}
                                        onClick={() => {
                                            setRangoTabla(r.id);
                                            setTableDateFilter('');
                                        }}
                                        className={`px-3 py-1.5 rounded-lg font-bold transition-colors ${
                                            !tableDateFilter && rangoTabla === r.id
                                                ? 'bg-white text-acero shadow-sm'
                                                : 'text-gray-500 hover:text-gray-800'
                                        }`}
                                    >
                                        {r.label}
                                    </button>
                                ))}
                            </div>

                            {/* Tipo: Todos / Ingresos / Egresos */}
                            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl text-xs">
                                {['Todos', 'Ingreso', 'Egreso'].map((f) => (
                                    <button
                                        key={f}
                                        className={`px-3 py-1.5 rounded-lg font-bold transition-colors ${
                                            filter === f ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                                        }`}
                                        onClick={() => setFilter(f)}
                                    >
                                        {f === 'Todos' ? 'Todos' : f + 's'}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Fila de buscador, categoría, método y fecha puntual */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="relative">
                            <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Buscar concepto, paciente, proveedor..."
                                value={busquedaTexto}
                                onChange={(e) => setBusquedaTexto(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-xs outline-none focus:border-turquesa"
                            />
                        </div>

                        <select
                            value={filtroCategoria}
                            onChange={(e) => setFiltroCategoria(e.target.value)}
                            className="px-3 py-2 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 outline-none bg-white"
                        >
                            <option value="Todas">Todas las Categorías</option>
                            <optgroup label="Categorías de Gasto Oficiales">
                                {catalogoGastos.map((c) => (
                                    <option key={c.nombre} value={c.nombre}>
                                        {c.nombre}
                                    </option>
                                ))}
                            </optgroup>
                            <optgroup label="Categorías de Ingreso">
                                <option value="Servicios y Consultas">Servicios y Consultas</option>
                                <option value="Planes de Tratamiento">Planes de Tratamiento</option>
                                <option value="Venta de Productos">Venta de Productos</option>
                            </optgroup>
                        </select>

                        <select
                            value={filtroMetodo}
                            onChange={(e) => setFiltroMetodo(e.target.value)}
                            className="px-3 py-2 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 outline-none bg-white"
                        >
                            <option value="Todos">Todos los Métodos de Pago</option>
                            <option value="Efectivo">Efectivo / Caja</option>
                            <option value="Tarjeta">Tarjeta</option>
                            <option value="Transferencia">Transferencia</option>
                        </select>

                        <div className="flex items-center gap-2 border border-gray-200 px-3 py-1.5 rounded-xl bg-white">
                            <span className="text-xs font-bold text-gray-400">Día exacto:</span>
                            <input
                                type="date"
                                value={tableDateFilter}
                                onChange={(e) => setTableDateFilter(e.target.value)}
                                className="text-xs font-bold text-gray-700 outline-none bg-transparent flex-1"
                            />
                            {tableDateFilter && (
                                <button onClick={() => setTableDateFilter('')} className="text-gray-400 hover:text-red-500">
                                    <XCircle size={15} />
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-12 gap-3 text-gray-400">
                        <Loader size={24} className="animate-spin text-turquesa" />
                        <span className="text-sm">Cargando movimientos desde Firebase...</span>
                    </div>
                ) : filteredTransactions.length === 0 ? (
                    <p className="text-center text-gray-400 italic py-8">
                        No se encontraron movimientos con los filtros seleccionados.
                    </p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-gray-100 text-xs uppercase text-gray-400">
                                    <th className="py-3 px-4 font-bold">Fecha</th>
                                    <th className="py-3 px-4 font-bold">Concepto / Detalle</th>
                                    <th className="py-3 px-4 font-bold">Categoría Oficial</th>
                                    <th className="py-3 px-4 font-bold">Método / Origen</th>
                                    <th className="py-3 px-4 font-bold">Estado</th>
                                    <th className="py-3 px-4 font-bold text-right">Monto</th>
                                    <th className="py-3 px-4 font-bold text-center">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredTransactions.map((trx) => (
                                    <tr key={trx.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                                        <td className="py-3.5 px-4 text-xs text-gray-500 whitespace-nowrap">{trx.date}</td>
                                        <td className="py-3.5 px-4">
                                            <div className="flex items-center gap-3">
                                                <div
                                                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                                                        trx.type === 'Ingreso'
                                                            ? 'bg-turquesa/10 text-turquesa'
                                                            : 'bg-rose-50 text-rose-500'
                                                    }`}
                                                >
                                                    {trx.type === 'Ingreso' ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                                                </div>
                                                <div>
                                                    <span className="font-bold text-gray-900 text-sm block">{trx.description}</span>
                                                    <span className="text-xs text-gray-400">
                                                        {trx.pacienteNombre ? `Paciente: ${trx.pacienteNombre}` : ''}
                                                        {trx.proveedor ? `Proveedor/Nota: ${trx.proveedor}` : ''}
                                                        {trx.registradoPor ? ` • Por: ${trx.registradoPor}` : ''}
                                                    </span>
                                                    {trx.motivoCancelacion && (
                                                        <span className="text-xs text-red-500 font-medium block">
                                                            Motivo cancelación: {trx.motivoCancelacion}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-3.5 px-4">
                                            <span
                                                className={`px-3 py-1 rounded-full text-xs font-bold ${
                                                    trx.type === 'Egreso'
                                                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                                        : 'bg-teal-50 text-teal-700'
                                                }`}
                                            >
                                                {trx.category}
                                            </span>
                                        </td>
                                        <td className="py-3.5 px-4 text-xs font-semibold text-gray-600">{trx.method}</td>
                                        <td className="py-3.5 px-4">
                                            <span
                                                className={`text-xs font-bold px-2 py-1 rounded-md ${
                                                    trx.status === 'Completado' || trx.status === 'Pagado'
                                                        ? 'bg-green-100 text-green-700'
                                                        : trx.status === 'Cancelado'
                                                            ? 'bg-gray-200 text-gray-500'
                                                            : 'bg-yellow-100 text-yellow-700'
                                                }`}
                                            >
                                                {trx.status}
                                            </span>
                                        </td>
                                        <td
                                            className={`py-3.5 px-4 text-right font-black whitespace-nowrap ${
                                                trx.status === 'Cancelado'
                                                    ? 'text-gray-400 line-through'
                                                    : trx.type === 'Ingreso'
                                                        ? 'text-turquesa'
                                                        : 'text-rose-500'
                                            }`}
                                        >
                                            {trx.type === 'Ingreso' ? '+' : '−'}
                                            {formatCurrency(trx.amount)}
                                        </td>
                                        <td className="py-3.5 px-4 text-center">
                                            {trx.status !== 'Cancelado' && (
                                                <div className="flex justify-center gap-1.5">
                                                    {userRole === 'Administrador' && trx.status === 'Pendiente Cancelación' && (
                                                        <>
                                                            <button
                                                                title="Aprobar Cancelación"
                                                                onClick={() => handleProcesarCancelacion(trx.id, true)}
                                                                className="p-1.5 bg-green-100 text-green-600 rounded hover:bg-green-200 transition-colors"
                                                            >
                                                                <CheckCircle2 size={16} />
                                                            </button>
                                                            <button
                                                                title="Rechazar Cancelación"
                                                                onClick={() => handleProcesarCancelacion(trx.id, false)}
                                                                className="p-1.5 bg-red-100 text-red-500 rounded hover:bg-red-200 transition-colors"
                                                            >
                                                                <XCircle size={16} />
                                                            </button>
                                                        </>
                                                    )}
                                                    {userRole === 'Administrador' && (
                                                        <button
                                                            title="Editar Movimiento"
                                                            onClick={() => abrirModalEditar(trx)}
                                                            className="p-1.5 bg-gray-100 text-acero hover:bg-blue-50 hover:text-blue-600 rounded transition-colors"
                                                        >
                                                            <Edit3 size={15} />
                                                        </button>
                                                    )}
                                                    {userRole === 'Administrador' && trx.status !== 'Pendiente Cancelación' && (
                                                        <button
                                                            title="Cancelar Movimiento"
                                                            onClick={() => handleProcesarCancelacion(trx.id, true)}
                                                            className="p-1.5 bg-gray-100 text-red-500 hover:text-red-600 rounded hover:bg-red-50 transition-colors"
                                                        >
                                                            <Trash2 size={15} />
                                                        </button>
                                                    )}
                                                    {userRole === 'Recepcionista' && trx.status !== 'Pendiente Cancelación' && (
                                                        <button
                                                            title="Solicitar Cancelación"
                                                            onClick={() => handleSolicitarCancelacion(trx.id)}
                                                            className="p-1.5 bg-yellow-50 text-yellow-600 rounded hover:bg-yellow-100 transition-colors text-xs font-bold flex items-center gap-1"
                                                        >
                                                            <Trash2 size={14} /> Solicitar
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            {/* ── Modal: Registrar Gasto Operativo (Catálogo Ampliado y Categoría Obligatoria) ── */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md space-y-4 max-h-[92vh] overflow-y-auto">
                        <h3 className="text-lg font-black text-acero flex items-center gap-2">
                            <Tag size={18} className="text-rose-600" /> Registrar Gasto Operativo
                        </h3>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase">Fecha del Gasto</label>
                            <input
                                type="date"
                                className="w-full mt-1 p-2.5 border rounded-xl text-sm font-bold"
                                value={fechaOperacion}
                                onChange={(e) => setFechaOperacion(e.target.value)}
                                max={hoyEstandar}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase">Categoría Obligatoria *</label>
                            <select
                                className="w-full mt-1 p-2.5 border border-rose-200 rounded-xl text-sm font-bold bg-white"
                                value={categoriaGasto}
                                onChange={(e) => handleCambiarCategoria(e.target.value)}
                            >
                                {catalogoGastos.map((c) => (
                                    <option key={c.nombre} value={c.nombre}>
                                        {c.nombre} ({c.grupo})
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <div className="flex justify-between items-center">
                                <label className="text-xs font-bold text-gray-500 uppercase">Motivo del Catálogo *</label>
                                <button
                                    type="button"
                                    onClick={() => setShowNuevoMotivoInput((v) => !v)}
                                    className="text-[11px] font-bold text-rose-600 hover:underline"
                                >
                                    {showNuevoMotivoInput ? 'Cerrar' : '+ Nuevo motivo al catálogo'}
                                </button>
                            </div>
                            <select
                                className="w-full mt-1 p-2.5 border rounded-xl text-sm bg-white"
                                value={motivoCatalogo}
                                onChange={(e) => setMotivoCatalogo(e.target.value)}
                            >
                                {(categoriaSeleccionadaObj?.motivos || []).map((m) => (
                                    <option key={m} value={m}>
                                        {m}
                                    </option>
                                ))}
                            </select>
                            {showNuevoMotivoInput && (
                                <div className="mt-2 flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="Escribe nuevo motivo frecuente..."
                                        value={nuevoMotivoCustom}
                                        onChange={(e) => setNuevoMotivoCustom(e.target.value)}
                                        className="flex-1 px-3 py-1.5 border rounded-lg text-xs"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => handleAgregarMotivoPersonalizado(categoriaGasto, nuevoMotivoCustom)}
                                        className="px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-bold"
                                    >
                                        Agregar
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase">Detalle / Especificación</label>
                                <input
                                    className="w-full mt-1 p-2.5 border rounded-xl text-sm"
                                    placeholder="Ej. Mes, lote, factura..."
                                    value={detalleExtra}
                                    onChange={(e) => setDetalleExtra(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase">Proveedor / Folio Nota</label>
                                <input
                                    className="w-full mt-1 p-2.5 border rounded-xl text-sm"
                                    placeholder="Ej. CFE, Proveedor..."
                                    value={proveedorGasto}
                                    onChange={(e) => setProveedorGasto(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase">Monto ($)</label>
                                <input
                                    type="number"
                                    className="w-full mt-1 p-2.5 border rounded-xl text-base font-black text-rose-600"
                                    placeholder="0.00"
                                    value={montoGasto}
                                    onChange={(e) => setMontoGasto(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase">Origen del Pago</label>
                                <select
                                    className="w-full mt-1 p-2.5 border rounded-xl text-xs font-bold bg-white"
                                    value={metodoGasto}
                                    onChange={(e) => setMetodoGasto(e.target.value)}
                                >
                                    <option value="Efectivo en Caja">Efectivo (Caja del Día)</option>
                                    <option value="Efectivo (Cortes Anteriores)">Efectivo (Cortes Anteriores)</option>
                                    <option value="Transferencia Bancaria">Transferencia Bancaria</option>
                                    <option value="Tarjeta de Crédito/Débito">Tarjeta (Crédito/Débito)</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex gap-3 pt-2">
                            <Button variant="outline" onClick={() => setShowModal(false)} className="flex-1">
                                Cancelar
                            </Button>
                            <Button
                                variant="primary"
                                onClick={handleRegistrarGasto}
                                disabled={saving}
                                className="flex-1 bg-rose-600 border-rose-600 text-white"
                            >
                                {saving ? 'Guardando...' : 'Registrar Egreso'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Modal: Administrador del Catálogo de Motivos de Gasto ──── */}
            {modalCatalogoOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-xl space-y-4 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center border-b pb-3">
                            <div>
                                <h3 className="text-lg font-black text-acero">Catálogo Oficial de Categorías y Motivos de Gasto</h3>
                                <p className="text-xs text-gray-500">
                                    Cualquier motivo que agregues aquí aparecerá en Recepción, Corte de Caja y Contabilidad.
                                </p>
                            </div>
                            <button onClick={() => setModalCatalogoOpen(false)} className="text-gray-400 hover:text-gray-700 font-bold">
                                ✕
                            </button>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase">Selecciona Categoría</label>
                            <select
                                value={catAdminSeleccionada}
                                onChange={(e) => setCatAdminSeleccionada(e.target.value)}
                                className="w-full mt-1 p-2.5 border rounded-xl text-sm font-bold bg-white"
                            >
                                {catalogoGastos.map((c) => (
                                    <option key={c.nombre} value={c.nombre}>
                                        {c.nombre} ({c.motivos.length} motivos)
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder="Agregar nuevo motivo frecuente a esta categoría..."
                                value={nuevoMotivoModalCat}
                                onChange={(e) => setNuevoMotivoModalCat(e.target.value)}
                                className="flex-1 px-3 py-2 border rounded-xl text-sm"
                            />
                            <Button
                                variant="primary"
                                onClick={() => handleAgregarMotivoPersonalizado(catAdminSeleccionada, nuevoMotivoModalCat)}
                            >
                                + Agregar Motivo
                            </Button>
                        </div>

                        <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100 max-h-64 overflow-y-auto space-y-1.5">
                            {(catalogoGastos.find((c) => c.nombre === catAdminSeleccionada)?.motivos || []).map((m, i) => (
                                <div key={i} className="text-xs bg-white px-3 py-2 rounded-lg border border-gray-100 font-medium text-gray-700 flex items-center gap-2">
                                    <Tag size={12} className="text-turquesa shrink-0" />
                                    <span>{m}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Modal: Editar Movimiento (Exclusivo Administrador) ──────── */}
            {modalEditarOpen && movEditar && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md space-y-4">
                        <h3 className="text-lg font-black text-acero flex items-center gap-2">
                            <Edit3 size={18} className="text-turquesa" /> Editar Movimiento ({movEditar.tipo})
                        </h3>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase">Fecha</label>
                            <input
                                type="date"
                                value={movEditar.fecha}
                                onChange={(e) => setMovEditar((p) => ({ ...p, fecha: e.target.value }))}
                                className="w-full mt-1 p-2.5 border rounded-xl text-sm font-bold"
                            />
                        </div>
                        {movEditar.tipo === 'Egreso' && (
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase">Categoría Obligatoria</label>
                                <select
                                    value={movEditar.categoria}
                                    onChange={(e) => setMovEditar((p) => ({ ...p, categoria: e.target.value }))}
                                    className="w-full mt-1 p-2.5 border rounded-xl text-sm font-bold bg-white"
                                >
                                    {catalogoGastos.map((c) => (
                                        <option key={c.nombre} value={c.nombre}>
                                            {c.nombre}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase">Concepto / Motivo</label>
                            <input
                                type="text"
                                value={movEditar.motivo}
                                onChange={(e) => setMovEditar((p) => ({ ...p, motivo: e.target.value }))}
                                className="w-full mt-1 p-2.5 border rounded-xl text-sm"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase">Monto ($)</label>
                                <input
                                    type="number"
                                    value={movEditar.monto}
                                    onChange={(e) => setMovEditar((p) => ({ ...p, monto: e.target.value }))}
                                    className="w-full mt-1 p-2.5 border rounded-xl text-sm font-black"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase">Método de Pago</label>
                                <select
                                    value={movEditar.metodoPago}
                                    onChange={(e) => setMovEditar((p) => ({ ...p, metodoPago: e.target.value }))}
                                    className="w-full mt-1 p-2.5 border rounded-xl text-xs font-bold bg-white"
                                >
                                    <option value="Efectivo">Efectivo</option>
                                    <option value="Efectivo en Caja">Efectivo (Caja del Día)</option>
                                    <option value="Efectivo (Cortes Anteriores)">Efectivo (Cortes Anteriores)</option>
                                    <option value="Tarjeta Débito/Crédito">Tarjeta Débito/Crédito</option>
                                    <option value="Transferencia">Transferencia</option>
                                    <option value="Transferencia Bancaria">Transferencia Bancaria</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex gap-3 pt-2">
                            <Button variant="outline" className="flex-1" onClick={() => setModalEditarOpen(false)}>
                                Cancelar
                            </Button>
                            <Button
                                variant="primary"
                                onClick={handleGuardarEdicionMovimiento}
                                disabled={savingEdicion}
                                className="flex-1 bg-turquesa border-turquesa text-white"
                            >
                                {savingEdicion ? 'Guardando...' : 'Guardar Cambios'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Cancelación */}
            {modalCancelacionOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white p-6 rounded-xl w-full max-w-md shadow-xl">
                        <h3 className="text-xl font-bold text-gray-900 mb-4">Solicitar Cancelación</h3>
                        <p className="text-sm text-gray-500 mb-4">
                            Por favor, indica el motivo por el cual deseas cancelar este movimiento.
                        </p>

                        <div className="mb-4">
                            <label className="block text-sm font-bold text-gray-700 mb-1">Motivo de Cancelación</label>
                            <textarea
                                value={motivoCancelacion}
                                onChange={(e) => setMotivoCancelacion(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:outline-none"
                                rows="3"
                                placeholder="Ej. Error en método de pago"
                            ></textarea>
                        </div>

                        <div className="flex gap-3 justify-end mt-6">
                            <button
                                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                                onClick={() => setModalCancelacionOpen(false)}
                            >
                                Cancelar
                            </button>
                            <button
                                className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 font-bold"
                                onClick={confirmarCancelacion}
                            >
                                Enviar Solicitud
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Confirmación Admin */}
            {modalConfirmAdminOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white p-6 rounded-xl w-full max-w-sm shadow-xl text-center">
                        <h3 className={`text-xl font-bold mb-4 ${confirmAdminData.aprobado ? 'text-red-600' : 'text-acero'}`}>
                            {confirmAdminData.aprobado ? '¿Aprobar Cancelación?' : '¿Rechazar Cancelación?'}
                        </h3>
                        <p className="text-sm text-gray-500 mb-6">
                            {confirmAdminData.aprobado
                                ? 'Esto cancelará el movimiento permanentemente y revertirá sus efectos financieros.'
                                : 'La solicitud de cancelación será denegada y el movimiento regresará a estado "Completado".'}
                        </p>

                        <div className="flex gap-3 justify-center">
                            <button
                                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 w-full"
                                onClick={() => setModalConfirmAdminOpen(false)}
                            >
                                Cancelar
                            </button>
                            <button
                                className={`px-4 py-2 text-white rounded-lg font-bold w-full ${
                                    confirmAdminData.aprobado ? 'bg-red-500 hover:bg-red-600' : 'bg-turquesa hover:bg-turquesa/90'
                                }`}
                                onClick={ejecutarProcesarCancelacion}
                            >
                                Confirmar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Estado de Resultados PDF */}
            {isReporteModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md space-y-4">
                        <h3 className="text-lg font-bold text-acero">Generar Estado de Resultados Contable (PDF)</h3>
                        <p className="text-sm text-gray-500">
                            Elige si deseas el Estado de Resultados Semanal o Mensual con desglose completo por Categoría Oficial de Gasto.
                        </p>
                        <div className="flex gap-2 bg-gray-100 p-1 rounded-xl">
                            {[
                                { id: 'mensual', label: 'Mensual' },
                                { id: 'semanal', label: 'Semanal' },
                            ].map((opt) => (
                                <button
                                    key={opt.id}
                                    onClick={() => setTipoReportePdf(opt.id)}
                                    className={`flex-1 py-2 rounded-lg text-xs font-bold ${
                                        tipoReportePdf === opt.id ? 'bg-white text-acero shadow-sm' : 'text-gray-500'
                                    }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase">Fecha dentro del período</label>
                            <input
                                type="date"
                                className="w-full mt-1 p-3 border rounded-xl text-sm outline-none focus:border-turquesa"
                                value={fechaReferencia}
                                onChange={(e) => setFechaReferencia(e.target.value)}
                            />
                        </div>
                        <div className="flex gap-3 pt-4 border-t">
                            <Button variant="outline" onClick={() => setIsReporteModalOpen(false)} className="flex-1">
                                Cancelar
                            </Button>
                            <Button
                                variant="primary"
                                onClick={generarReporteContablePDF}
                                className="flex-1 bg-turquesa border-turquesa text-white"
                            >
                                Descargar PDF
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
