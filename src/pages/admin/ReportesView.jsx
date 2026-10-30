import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import {
    Download, Printer, TrendingUp, TrendingDown, Users, Activity, Loader, Medal,
    Wallet, Calendar, AlertTriangle, CheckCircle2, Info, Settings, ChevronLeft,
    ChevronRight, MessageCircle, Package, Clock, Target, ShieldAlert, Sparkles,
    CreditCard, Layers, UserCheck, Flame, Search, Calculator, Edit2, ShoppingBag,
    Cpu, Building2, Zap, Wifi, Droplets
} from 'lucide-react';
import { onMovimientosChange } from '../../services/finanzasService';
import { onCitasChange } from '../../services/citasService';
import { onPacientesChange } from '../../services/pacientesService';
import { onPlanesChange } from '../../services/planesService';
import { onStaffChange } from '../../services/staffService';
import { onInventarioChange } from '../../services/inventarioService';
import { onServiciosChange, updateServicio } from '../../services/comercialService';
import { abrirWhatsApp } from '../../services/whatsappService';
import {
    DEFAULT_CONFIG, DIAS_SEMANA_LARGO, prepararDatos, calcularReporte, navegarPeriodo,
    esServicioPaquete
} from '../../services/reportesMetrics';
import { generarReporteEjecutivoPDF, exportarCSVCompleto } from '../../services/reportesPdfGenerator';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, ComposedChart, Line, Legend
} from 'recharts';
import { db } from '../../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const STORAGE_KEY = 'alfra_reportes_config_v3';
const COLORS_PIE = ['#0d9488', '#3b82f6', '#6366f1', '#f59e0b', '#ec4899', '#ef4444', '#84cc16', '#06b6d4'];

const formatCurrency = (val) => `$${Number(val || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatShortMoney = (val) => {
    const n = Number(val || 0);
    if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(1)}k`;
    return `$${Math.round(n)}`;
};
const formatPct = (val) => `${Number(val || 0).toFixed(1)}%`;

function DeltaBadge({ kpi, dark = false }) {
    if (!kpi || kpi.delta === null || kpi.delta === undefined || Number.isNaN(kpi.delta)) {
        return (
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${dark ? 'bg-white/15 text-white/80' : 'bg-slate-100 text-slate-500'}`}>
                Sin base previa
            </span>
        );
    }
    const val = Number(kpi.delta);
    const isZero = Math.abs(val) < 0.05;
    const isGood = kpi.inverso ? val <= 0 : val >= 0;
    const sign = val > 0 ? '↑ +' : val < 0 ? '↓ ' : '';
    const suffix = kpi.deltaEnPuntos ? ' pts' : '%';

    if (isZero) {
        return (
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${dark ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-600'}`}>
                0.0{suffix} vs. ant.
            </span>
        );
    }

    const cls = dark
        ? isGood
            ? 'bg-emerald-400/25 text-emerald-50 border border-emerald-300/30'
            : 'bg-rose-400/25 text-rose-50 border border-rose-300/30'
        : isGood
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            : 'bg-rose-50 text-rose-700 border border-rose-200';

    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black ${cls}`}>
            {sign}{val.toFixed(1)}{suffix} vs. ant.
        </span>
    );
}

export default function ReportesView() {
    const [periodo, setPeriodo] = useState('Mes');
    const [seccion, setSeccion] = useState('resumen'); // 'resumen' | 'plan' | 'finanzas' | 'planes' | 'pacientes' | 'operacion' | 'inventario'
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [busquedaRiesgo, setBusquedaRiesgo] = useState('');
    const [busquedaServPlan, setBusquedaServPlan] = useState('');
    const [modoCalculoPlan, setModoCalculoPlan] = useState('precio'); // 'precio' | 'margen'

    // Colecciones en tiempo real
    const [movimientos, setMovimientos] = useState([]);
    const [citas, setCitas] = useState([]);
    const [pacientes, setPacientes] = useState([]);
    const [planes, setPlanes] = useState([]);
    const [staff, setStaff] = useState([]);
    const [inventario, setInventario] = useState([]);
    const [servicios, setServicios] = useState([]);

    // Modal de edición rápida de un servicio desde el Plan Diario
    const [servEditModal, setServEditModal] = useState(null);
    const [savingServ, setSavingServ] = useState(false);

    // Configuración de negocio
    const [config, setConfig] = useState(() => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? { ...DEFAULT_CONFIG, ...JSON.parse(raw) } : DEFAULT_CONFIG;
        } catch {
            return DEFAULT_CONFIG;
        }
    });
    const [modalConfig, setModalConfig] = useState(false);
    const [formConfig, setFormConfig] = useState(config);
    const [savingConfig, setSavingConfig] = useState(false);

    useEffect(() => {
        const unsubMovs = onMovimientosChange(setMovimientos);
        const unsubCitas = onCitasChange(setCitas);
        const unsubPac = onPacientesChange(setPacientes);
        const unsubPlanes = onPlanesChange(setPlanes);
        const unsubStaff = onStaffChange(setStaff);
        const unsubInv = onInventarioChange(setInventario);
        const unsubServ = onServiciosChange(setServicios);

        getDoc(doc(db, 'configuracion', 'reportes'))
            .then((snap) => {
                if (snap.exists()) {
                    const merged = {
                        ...DEFAULT_CONFIG,
                        ...snap.data(),
                        horario: { ...DEFAULT_CONFIG.horario, ...(snap.data().horario || {}) },
                    };
                    setConfig(merged);
                    setFormConfig(merged);
                    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(merged)); } catch {}
                }
            })
            .catch(() => {});

        const timer = setTimeout(() => setLoading(false), 600);
        return () => {
            if (unsubMovs) unsubMovs();
            if (unsubCitas) unsubCitas();
            if (unsubPac) unsubPac();
            if (unsubPlanes) unsubPlanes();
            if (unsubStaff) unsubStaff();
            if (unsubInv) unsubInv();
            if (unsubServ) unsubServ();
            clearTimeout(timer);
        };
    }, []);

    const datosPreparados = useMemo(
        () => prepararDatos({ movimientos, citas, pacientes, planes, staff, inventario, servicios }),
        [movimientos, citas, pacientes, planes, staff, inventario, servicios]
    );

    const rep = useMemo(
        () => calcularReporte(datosPreparados, periodo, config),
        [datosPreparados, periodo, config]
    );

    const handleGuardarConfig = async () => {
        setSavingConfig(true);
        const gRenta = Number(formConfig.gastoRenta) || 0;
        const gLuz = Number(formConfig.gastoLuz) || 0;
        const gInternet = Number(formConfig.gastoInternet) || 0;
        const gAgua = Number(formConfig.gastoAgua) || 0;
        const gOtros = Number(formConfig.gastoOtrosFijos) || 0;
        const sumaServiciosFijos = gRenta + gLuz + gInternet + gAgua + gOtros;

        const clean = {
            gastoRenta: gRenta,
            gastoLuz: gLuz,
            gastoInternet: gInternet,
            gastoAgua: gAgua,
            gastoOtrosFijos: gOtros,
            gastosFijosMensuales: sumaServiciosFijos > 0 ? sumaServiciosFijos : (Number(formConfig.gastosFijosMensuales) || 0),
            nominaMensualEstimada: Number(formConfig.nominaMensualEstimada) || 0,
            usarNominaPromedio: formConfig.usarNominaPromedio !== false,
            provisionProductoMensual: Number(formConfig.provisionProductoMensual) || 0,
            provisionEquipoMensual: Number(formConfig.provisionEquipoMensual) || 0,
            nombreEquipoMeta: String(formConfig.nombreEquipoMeta || '').trim(),
            costoEquipoMeta: Number(formConfig.costoEquipoMeta) || 0,
            utilidadDeseadaMensual: Number(formConfig.utilidadDeseadaMensual) || 0,
            metaMensual: Number(formConfig.metaMensual) || 0,
            diasRiesgo: Math.max(15, Number(formConfig.diasRiesgo) || 45),
            diasAtrasoPlan: Math.max(7, Number(formConfig.diasAtrasoPlan) || 30),
            horario: formConfig.horario || DEFAULT_CONFIG.horario,
            updatedAt: new Date().toISOString(),
        };
        setConfig(clean);
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(clean)); } catch {}
        try { await setDoc(doc(db, 'configuracion', 'reportes'), clean, { merge: true }); } catch {}
        setSavingConfig(false);
        setModalConfig(false);
    };

    const handleGuardarServicioPlan = async () => {
        if (!servEditModal || !servEditModal.id) return;
        setSavingServ(true);
        try {
            const precioNum = Number(servEditModal.precio) || 0;
            await updateServicio(servEditModal.id, {
                categoria: servEditModal.categoria || 'Cabina / Corporal',
                precio: precioNum,
                precioVenta: precioNum,
                costoInsumos: Number(servEditModal.costoInsumos) || 0,
                comisionPct: Number(servEditModal.comisionPct) || 0,
                duracionMin: Number(servEditModal.duracionMin) || 60,
                esPaquete: Boolean(servEditModal.esPaquete),
                incluirEnPlanDiario: Boolean(servEditModal.incluirEnPlanDiario),
                prioridadPlan: servEditModal.prioridadPlan || 'media',
                metaDiariaManual: Number(servEditModal.metaDiariaManual) || 0,
            });
            setServEditModal(null);
        } catch (err) {
            console.error('Error actualizando servicio:', err);
            alert('No se pudo actualizar el servicio.');
        } finally {
            setSavingServ(false);
        }
    };

    const handleToggleIncluirPlan = async (serv) => {
        try {
            await updateServicio(serv.id, {
                incluirEnPlanDiario: !serv.incluirEnPlanDiario,
                esPaquete: false,
            });
        } catch (err) {
            console.error(err);
        }
    };

    const handlePDF = async (autoPrint = false) => {
        try {
            setExporting(true);
            await generarReporteEjecutivoPDF(rep, { autoPrint });
        } catch (err) {
            console.error('Error generando reporte PDF:', err);
            alert('Ocurrió un error al generar el PDF del reporte.');
        } finally {
            setExporting(false);
        }
    };

    const handleWhatsAppPlanAtrasado = (plan) => {
        if (!plan.telefono) {
            alert('Este paciente no tiene número de teléfono registrado.');
            return;
        }
        const msg = [
            `¡Hola, *${plan.paciente}*! 🌸 Te saludamos de *Clínica ALFRA*.`,
            `Te escribimos para dar seguimiento a tu Plan de Tratamiento (*${plan.objetivo}*) y compartirte tu estado de cuenta actualizado:`,
            `• Meta del plan: *${formatCurrency(plan.meta)}*\n• Abonado a la fecha: *${formatCurrency(plan.acumulado)}*\n• Saldo pendiente: *${formatCurrency(plan.saldo)}*`,
            `¿Te gustaría agendar tu próxima sesión o realizar un abono a tu plan? ¡Estamos para servirte! ✨`,
        ].join('\n\n');
        abrirWhatsApp(plan.telefono, msg);
    };

    const handleWhatsAppReactivacion = (pac) => {
        if (!pac.telefono) {
            alert('Este paciente no tiene número de teléfono registrado.');
            return;
        }
        const msg = [
            `¡Hola, *${pac.nombre}*! 🌸 Esperamos que te encuentres muy bien.`,
            `En *Clínica ALFRA* te extrañamos. Notamos que han pasado *${pac.dias} días* desde tu última visita${pac.ultimoServicio ? ` (*${pac.ultimoServicio}*)` : ''} y queremos saber cómo te has sentido.`,
            `Recuerda que la constancia es clave para mantener y potenciar tus resultados. 🎯💆‍♀️`,
            `¿Te ayudamos a reservar un espacio esta semana en el horario que mejor te acomode? ¡Te esperamos! ✨`,
        ].join('\n\n');
        abrirWhatsApp(pac.telefono, msg);
    };

    const aniosDisponibles = useMemo(() => {
        const yNow = new Date().getFullYear();
        const set = new Set([yNow - 1, yNow, yNow + 1]);
        datosPreparados.movs.forEach((m) => { if (m._d) set.add(m._d.getFullYear()); });
        datosPreparados.cits.forEach((c) => { if (c._d) set.add(c._d.getFullYear()); });
        return [...set].sort((a, b) => b - a);
    }, [datosPreparados]);

    const pacientesRiesgoFiltrados = useMemo(() => {
        const q = busquedaRiesgo.trim().toLowerCase();
        if (!q) return rep.pacientes.riesgo;
        return rep.pacientes.riesgo.filter(
            (r) => r.nombre.toLowerCase().includes(q) || String(r.telefono).includes(q) || r.ultimoServicio.toLowerCase().includes(q)
        );
    }, [rep.pacientes.riesgo, busquedaRiesgo]);

    const serviciosPlanFiltrados = useMemo(() => {
        const lista = rep.planIngresos?.serviciosPlan || [];
        const q = busquedaServPlan.trim().toLowerCase();
        if (!q) return lista;
        return lista.filter(
            (s) => s.nombre.toLowerCase().includes(q) || String(s.categoria || '').toLowerCase().includes(q)
        );
    }, [rep.planIngresos, busquedaServPlan]);

    // Vista previa en vivo dentro del Modal de Configuración
    const previewConfig = useMemo(() => {
        const renta = Number(formConfig.gastoRenta) || 0;
        const luz = Number(formConfig.gastoLuz) || 0;
        const internet = Number(formConfig.gastoInternet) || 0;
        const agua = Number(formConfig.gastoAgua) || 0;
        const otros = Number(formConfig.gastoOtrosFijos) || 0;
        const sumaFijos = renta + luz + internet + agua + otros;
        const nominaManual = Number(formConfig.nominaMensualEstimada) || 0;
        const nominaEfectiva = nominaManual > 0 ? nominaManual : (rep.equilibrio?.nominaPromedioAuto || 0);
        const bolsaProdManual = Number(formConfig.provisionProductoMensual) || 0;
        const bolsaProdEfectiva = bolsaProdManual > 0 ? bolsaProdManual : (rep.equilibrio?.insumosPromedioAuto || 0);
        const bolsaEquipo = Number(formConfig.provisionEquipoMensual) || 0;
        const utilidadDeseada = Number(formConfig.utilidadDeseadaMensual) || 0;
        const puntoEquilibrio = sumaFijos + nominaEfectiva + bolsaProdEfectiva + bolsaEquipo;
        const metaTotal = Math.max(Number(formConfig.metaMensual) || 0, puntoEquilibrio + utilidadDeseada);
        const diasLab = rep.planIngresos?.diasLaboralesMes || 26;
        const metaDiaria = metaTotal / diasLab;
        const costoEquipoMeta = Number(formConfig.costoEquipoMeta) || 0;
        const mesesEquipo = bolsaEquipo > 0 && costoEquipoMeta > 0 ? Math.ceil(costoEquipoMeta / bolsaEquipo) : null;
        return {
            sumaFijos,
            nominaEfectiva,
            bolsaProdEfectiva,
            bolsaEquipo,
            utilidadDeseada,
            puntoEquilibrio,
            metaTotal,
            diasLab,
            metaDiaria,
            mesesEquipo,
        };
    }, [formConfig, rep.equilibrio, rep.planIngresos]);

    if (loading) {
        return (
            <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
                <Loader className="animate-spin text-turquesa" size={48} />
                <p className="text-gray-400 font-bold uppercase tracking-widest text-sm">Calculando Inteligencia de Negocio...</p>
            </div>
        );
    }

    const tipoActual = rep.R.tipo; // 'dia' | 'semana' | 'mes' | 'anio'
    const eq = rep.equilibrio;
    const pl = rep.planIngresos;

    const SECCIONES = [
        { id: 'resumen', label: 'Resumen Ejecutivo', icon: Activity },
        { id: 'plan', label: 'Plan de Ingresos y Meta Diaria', icon: Calculator, badge: pl?.resumenMix?.unidadesTotalesMixDia ? `${pl.resumenMix.unidadesTotalesMixDia}/día` : null },
        { id: 'finanzas', label: 'Salud Financiera', icon: Wallet },
        { id: 'planes', label: 'Planes y Cartera', icon: CreditCard, badge: rep.planes.atrasados.length || null },
        { id: 'pacientes', label: 'Pacientes y Retención', icon: Users, badge: rep.pacientes.riesgo.length || null },
        { id: 'operacion', label: 'Agenda y Especialistas', icon: Calendar },
        { id: 'inventario', label: 'Inventario y Stock', icon: Package, badge: rep.inventario.bajoStock.length || null },
    ];

    return (
        <div className="space-y-6 pb-20">
            {/* ── BARRA SUPERIOR DE CONTROLES Y EXPORTACIÓN ── */}
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2.5">
                        <span className="px-2.5 py-1 rounded-lg bg-turquesa/10 text-turquesa text-xs font-black uppercase tracking-wider">
                            Reporte {rep.R.tipoLabel}
                        </span>
                        {rep.R.enCurso && (
                            <span className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 text-xs font-bold border border-amber-200">
                                Periodo en curso
                            </span>
                        )}
                    </div>
                    <h2 className="text-2xl font-black text-slate-800 mt-1">
                        Inteligencia de Negocio y Reportes Ejecutivos
                    </h2>
                    <p className="text-slate-500 text-sm">
                        Analizando: <strong className="text-slate-800 capitalize">{rep.R.label}</strong> • Comparado contra <span className="capitalize">{rep.R.prevLabel}</span>
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {/* Selector de granularidad: Diario, Semanal, Mensual, Anual */}
                    <div className="bg-slate-100 rounded-2xl p-1 flex items-center gap-1">
                        {[
                            { id: 'Hoy', tipo: 'dia', label: 'Diario' },
                            { id: 'Semana', tipo: 'semana', label: 'Semanal' },
                            { id: 'Mes', tipo: 'mes', label: 'Mensual' },
                            { id: 'Año', tipo: 'anio', label: 'Anual' },
                        ].map((t) => {
                            const active = tipoActual === t.tipo;
                            return (
                                <button
                                    key={t.id}
                                    disabled={exporting}
                                    onClick={() => setPeriodo(t.id)}
                                    className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all ${
                                        active ? 'bg-turquesa text-white shadow-sm' : 'text-slate-600 hover:bg-white/60'
                                    }`}
                                >
                                    {t.label}
                                </button>
                            );
                        })}
                    </div>

                    {/* Navegación de fecha / semana / mes / año */}
                    <div className="flex items-center bg-white border border-slate-200 rounded-2xl p-1 shadow-sm">
                        <button
                            onClick={() => setPeriodo((p) => navegarPeriodo(p, -1))}
                            title="Periodo anterior"
                            className="p-2 rounded-xl hover:bg-slate-100 text-slate-600 transition-colors"
                        >
                            <ChevronLeft size={16} />
                        </button>

                        {tipoActual === 'dia' && (
                            <input
                                type="date"
                                value={format(rep.R.start, 'yyyy-MM-dd')}
                                onChange={(e) => e.target.value && setPeriodo(`D:${e.target.value}`)}
                                className="px-2 py-1 text-xs font-bold text-slate-700 outline-none bg-transparent cursor-pointer"
                            />
                        )}
                        {tipoActual === 'semana' && (
                            <input
                                type="date"
                                value={format(rep.R.start, 'yyyy-MM-dd')}
                                onChange={(e) => e.target.value && setPeriodo(`S:${e.target.value}`)}
                                title="Elige cualquier día de la semana que deseas consultar"
                                className="px-2 py-1 text-xs font-bold text-slate-700 outline-none bg-transparent cursor-pointer"
                            />
                        )}
                        {tipoActual === 'mes' && (
                            <input
                                type="month"
                                value={format(rep.R.start, 'yyyy-MM')}
                                onChange={(e) => e.target.value && setPeriodo(`M:${e.target.value}`)}
                                className="px-2 py-1 text-xs font-bold text-slate-700 outline-none bg-transparent cursor-pointer"
                            />
                        )}
                        {tipoActual === 'anio' && (
                            <select
                                value={format(rep.R.start, 'yyyy')}
                                onChange={(e) => setPeriodo(`A:${e.target.value}`)}
                                className="px-3 py-1 text-xs font-black text-slate-700 outline-none bg-transparent cursor-pointer"
                            >
                                {aniosDisponibles.map((y) => (
                                    <option key={y} value={y}>Año {y}</option>
                                ))}
                            </select>
                        )}

                        <button
                            onClick={() => setPeriodo((p) => navegarPeriodo(p, 1))}
                            title="Periodo siguiente"
                            className="p-2 rounded-xl hover:bg-slate-100 text-slate-600 transition-colors"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>

                    <button
                        onClick={() => { setFormConfig(config); setModalConfig(true); }}
                        title="Configurar Renta, Luz, Internet, Nómina Promedio, Bolsas de Producto y Equipo"
                        className="p-2.5 rounded-xl border border-teal-200 bg-teal-50/70 hover:bg-teal-100 text-teal-900 flex items-center gap-1.5 text-xs font-black shadow-sm transition-colors"
                    >
                        <Settings size={16} className="text-turquesa" />
                        <span className="hidden sm:inline">Gastos Fijos, Bolsas y Metas</span>
                    </button>

                    <Button variant="outline" icon={Download} onClick={() => exportarCSVCompleto(rep)} disabled={exporting}>
                        Excel / CSV
                    </Button>
                    <Button variant="outline" icon={Download} onClick={() => handlePDF(false)} disabled={exporting}>
                        Descargar PDF
                    </Button>
                    <Button variant="primary" icon={Printer} onClick={() => handlePDF(true)} disabled={exporting}>
                        {exporting ? 'Generando...' : `Imprimir ${rep.R.tipoLabel}`}
                    </Button>
                </div>
            </div>

            {/* ── NAVEGACIÓN POR PESTAÑAS ── */}
            <div className="flex overflow-x-auto gap-2 pb-1 no-scrollbar">
                {SECCIONES.map((s) => {
                    const Icon = s.icon;
                    const active = seccion === s.id;
                    return (
                        <button
                            key={s.id}
                            onClick={() => setSeccion(s.id)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-black whitespace-nowrap transition-all border ${
                                active
                                    ? 'bg-slate-900 text-white border-slate-900 shadow-md'
                                    : 'bg-white text-slate-600 border-slate-200/80 hover:bg-slate-50'
                            }`}
                        >
                            <Icon size={15} className={active ? 'text-turquesa' : 'text-slate-400'} />
                            <span>{s.label}</span>
                            {s.badge ? (
                                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                                    active ? 'bg-turquesa text-white' : 'bg-amber-100 text-amber-800'
                                }`}>
                                    {s.badge}
                                </span>
                            ) : null}
                        </button>
                    );
                })}
            </div>

            {/* ── 8 TARJETAS KPI PRINCIPALES ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Ingresos */}
                <div className="p-5 rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/15 flex flex-col justify-between">
                    <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2.5">
                            <div className="p-2 bg-white/20 rounded-xl"><TrendingUp size={20} /></div>
                            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-50">Ingresos Cobrados</span>
                        </div>
                        <DeltaBadge kpi={rep.kpis.ingresos} dark />
                    </div>
                    <div>
                        <h3 className="text-2xl sm:text-3xl font-black">{formatCurrency(rep.actual.ingresos)}</h3>
                        <p className="text-xs text-emerald-100 mt-1 flex justify-between">
                            <span>Ant.: {formatCurrency(rep.anterior.ingresos)}</span>
                            <span>{rep.actual.transacciones} cobros</span>
                        </p>
                    </div>
                </div>

                {/* 2. Egresos */}
                <div className="p-5 rounded-3xl bg-gradient-to-br from-rose-500 to-red-600 text-white shadow-lg shadow-rose-500/15 flex flex-col justify-between">
                    <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2.5">
                            <div className="p-2 bg-white/20 rounded-xl"><TrendingDown size={20} /></div>
                            <span className="text-[11px] font-black uppercase tracking-wider text-rose-50">Egresos / Gastos</span>
                        </div>
                        <DeltaBadge kpi={rep.kpis.egresos} dark />
                    </div>
                    <div>
                        <h3 className="text-2xl sm:text-3xl font-black">{formatCurrency(rep.actual.egresos)}</h3>
                        <p className="text-xs text-rose-100 mt-1 flex justify-between">
                            <span>Ant.: {formatCurrency(rep.anterior.egresos)}</span>
                            <span>{rep.finanzas.egresosCat[0] ? `Top: ${rep.finanzas.egresosCat[0].name}` : 'Sin gastos'}</span>
                        </p>
                    </div>
                </div>

                {/* 3. Utilidad Neta + Margen */}
                <div className="p-5 rounded-3xl bg-gradient-to-br from-indigo-600 to-blue-700 text-white shadow-lg shadow-indigo-600/15 flex flex-col justify-between">
                    <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2.5">
                            <div className="p-2 bg-white/20 rounded-xl"><Activity size={20} /></div>
                            <span className="text-[11px] font-black uppercase tracking-wider text-indigo-100">Utilidad y Margen</span>
                        </div>
                        <DeltaBadge kpi={rep.kpis.utilidad} dark />
                    </div>
                    <div>
                        <div className="flex items-baseline justify-between gap-2">
                            <h3 className="text-2xl sm:text-3xl font-black">{formatCurrency(rep.actual.utilidad)}</h3>
                            <span className="px-2 py-0.5 rounded-lg bg-white/20 text-xs font-black">
                                {formatPct(rep.actual.margen)} margen
                            </span>
                        </div>
                        <p className="text-xs text-indigo-100 mt-1">
                            Te quedan <strong>${Math.max(0, rep.actual.margen).toFixed(0)}</strong> por cada $100 cobrados
                        </p>
                    </div>
                </div>

                {/* 4. Meta Diaria / Ticket Promedio */}
                <div
                    onClick={() => setSeccion('plan')}
                    className="p-5 rounded-3xl bg-slate-900 text-white shadow-lg flex flex-col justify-between cursor-pointer hover:bg-slate-800 transition-colors"
                >
                    <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2.5">
                            <div className="p-2 bg-turquesa/20 text-turquesa rounded-xl"><Calculator size={20} /></div>
                            <span className="text-[11px] font-black uppercase tracking-wider text-slate-300">Cuota Diaria Meta</span>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-turquesa/20 text-turquesa">
                            {pl.resumenMix.unidadesTotalesMixDia || 0} serv/día
                        </span>
                    </div>
                    <div>
                        <h3 className="text-2xl sm:text-3xl font-black">{formatCurrency(pl.metaDiariaPesos)}</h3>
                        <p className="text-xs text-slate-400 mt-1 flex justify-between">
                            <span>Ticket prom.: {formatCurrency(rep.actual.ticket)}</span>
                            <span className="text-turquesa font-bold">Ver plan diario →</span>
                        </p>
                    </div>
                </div>

                {/* 5. Cartera por Cobrar de Planes */}
                <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Cartera por Cobrar</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-50 text-indigo-700">
                            {rep.planes.vigentes} planes activos
                        </span>
                    </div>
                    <div className="my-2">
                        <h4 className="text-2xl font-black text-slate-800">{formatCurrency(rep.planes.cartera)}</h4>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Abonos en periodo: <strong className="text-emerald-600">{formatCurrency(rep.planes.abonosCobrados)}</strong> ({formatPct(rep.planes.pctIngresos)} del ingreso)
                        </p>
                    </div>
                    {rep.planes.atrasados.length > 0 ? (
                        <button
                            onClick={() => setSeccion('planes')}
                            className="text-left text-[11px] font-bold text-rose-600 hover:underline flex items-center gap-1"
                        >
                            <AlertTriangle size={13} /> {rep.planes.atrasados.length} planes atrasados ({formatCurrency(rep.planes.montoAtrasado)})
                        </button>
                    ) : (
                        <span className="text-[11px] font-bold text-emerald-600">Sin planes en atraso (+{config.diasAtrasoPlan}d)</span>
                    )}
                </div>

                {/* 6. Retención y Pacientes en Riesgo */}
                <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Retención (60 días)</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-sky-50 text-sky-700">
                            LTV: {formatCurrency(rep.pacientes.ltvPromedio)}
                        </span>
                    </div>
                    <div className="my-2 flex items-baseline justify-between">
                        <h4 className="text-2xl font-black text-slate-800">
                            {formatPct(rep.pacientes.retencion.find((r) => r.dias === 60)?.tasa || 0)}
                        </h4>
                        <span className="text-xs font-bold text-slate-500">
                            {rep.pacientes.recurrentes} rec. / {rep.pacientes.nuevosAtendidos} nuevos
                        </span>
                    </div>
                    <button
                        onClick={() => setSeccion('pacientes')}
                        className="text-left text-[11px] font-bold text-amber-600 hover:underline flex items-center gap-1"
                    >
                        <Users size={13} /> {rep.pacientes.riesgo.length} pacientes sin cita en +{config.diasRiesgo} días
                    </button>
                </div>

                {/* 7. Citas Completadas e Inasistencias */}
                <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Citas Completadas</span>
                        <DeltaBadge kpi={rep.kpis.completadas} />
                    </div>
                    <div className="my-2 flex items-baseline justify-between">
                        <h4 className="text-2xl font-black text-slate-800">{rep.actual.completadas}</h4>
                        <span className="text-xs font-bold text-rose-600">
                            {rep.actual.noAsistio} no asistió ({formatPct(rep.actual.tasaInasistencia)})
                        </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                        Costo por inasistencias: <strong className="text-rose-600">~{formatCurrency(rep.operacion.costoInasistencias)}</strong>
                    </p>
                </div>

                {/* 8. Inventario y Reabastecimiento */}
                <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Inventario y Productos</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700">
                            Margen prom. {formatPct(rep.inventario.margenPromedio)}
                        </span>
                    </div>
                    <div className="my-2 flex items-baseline justify-between">
                        <h4 className="text-2xl font-black text-slate-800">{formatCurrency(rep.inventario.ingresoProductos)}</h4>
                        <span className="text-xs font-bold text-slate-500">{rep.inventario.unidadesVendidas} vendidos</span>
                    </div>
                    <button
                        onClick={() => setSeccion('inventario')}
                        className="text-left text-[11px] font-bold text-amber-600 hover:underline flex items-center gap-1"
                    >
                        <Package size={13} /> {rep.inventario.bajoStock.length} artículos bajo stock mínimo ({rep.inventario.agotados} agotados)
                    </button>
                </div>
            </div>

            {/* ════════════════════════════════════════════════════════════════════════
                SECCIÓN 1: RESUMEN EJECUTIVO
               ════════════════════════════════════════════════════════════════════════ */}
            {seccion === 'resumen' && (
                <div className="space-y-6">
                    {/* Punto de equilibrio y proyección de cierre */}
                    {rep.equilibrio.aplica && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Punto de equilibrio + Bolsas */}
                            <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col justify-between">
                                <div>
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2.5 rounded-2xl bg-teal-50 text-teal-600"><Target size={22} /></div>
                                            <div>
                                                <h3 className="text-base font-black text-slate-800">Punto de Equilibrio y Bolsas ({rep.R.tipoLabel})</h3>
                                                <p className="text-xs text-slate-500">
                                                    Fijos (Renta/Luz/Internet) + Nómina Promedio + Bolsa Producto + Bolsa Equipo
                                                </p>
                                            </div>
                                        </div>
                                        <span className={`px-3 py-1 rounded-full text-xs font-black ${
                                            rep.equilibrio.alcanzado ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                        }`}>
                                            {rep.equilibrio.alcanzado ? '¡Equilibrio superado!' : `${formatPct(rep.equilibrio.cubierto)} cubierto`}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3 text-[11px]">
                                        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                                            <span className="text-slate-400 font-bold block">Renta/Luz/Int.</span>
                                            <strong className="text-slate-800 text-xs">{formatCurrency(eq.sumaFijosServicios)}/mes</strong>
                                        </div>
                                        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                                            <span className="text-slate-400 font-bold block">Nómina Estimada</span>
                                            <strong className="text-slate-800 text-xs">{formatCurrency(eq.nominaMensual)}/mes</strong>
                                        </div>
                                        <div className="p-2.5 rounded-xl bg-teal-50/60 border border-teal-100">
                                            <span className="text-teal-700 font-bold block">Bolsa Producto</span>
                                            <strong className="text-teal-900 text-xs">{formatCurrency(eq.bolsaProductoMensual)}/mes</strong>
                                        </div>
                                        <div className="p-2.5 rounded-xl bg-indigo-50/60 border border-indigo-100">
                                            <span className="text-indigo-700 font-bold block">Bolsa Equipo</span>
                                            <strong className="text-indigo-900 text-xs">{formatCurrency(eq.bolsaEquipoMensual)}/mes</strong>
                                        </div>
                                    </div>

                                    <div className="space-y-2 mb-4">
                                        <div className="flex justify-between text-xs font-bold">
                                            <span className="text-slate-600">Llevas: <strong className="text-slate-900">{formatCurrency(rep.actual.ingresos)}</strong></span>
                                            <span className="text-slate-600">Meta equilibrio ({rep.R.tipoLabel}): <strong className="text-slate-900">{formatCurrency(rep.equilibrio.metaEquilibrio)}</strong></span>
                                        </div>
                                        <div className="w-full h-3.5 bg-slate-100 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all duration-500 ${
                                                    rep.equilibrio.alcanzado ? 'bg-emerald-500' : 'bg-gradient-to-r from-amber-500 to-turquesa'
                                                }`}
                                                style={{ width: `${Math.min(100, Math.max(3, rep.equilibrio.cubierto))}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100 text-xs">
                                    {rep.equilibrio.alcanzado ? (
                                        <span className="font-bold text-emerald-700">
                                            ✓ Alcanzado el {rep.equilibrio.fechaEquilibrio ? format(rep.equilibrio.fechaEquilibrio, "d 'de' MMMM", { locale: es }) : 'en este periodo'}. Todo ingreso adicional es ganancia libre.
                                        </span>
                                    ) : (
                                        <span className="font-bold text-slate-600">
                                            Faltan <strong className="text-rose-600">{formatCurrency(rep.equilibrio.faltante)}</strong> para cubrir el compromiso del periodo.
                                        </span>
                                    )}
                                    <div className="flex items-center gap-3">
                                        <button onClick={() => setSeccion('plan')} className="text-indigo-600 font-black hover:underline">
                                            Ver cuántos servicios vender/día →
                                        </button>
                                        <button onClick={() => { setFormConfig(config); setModalConfig(true); }} className="text-turquesa font-black hover:underline">
                                            Configurar →
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Proyección de Cierre */}
                            <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col justify-between">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2.5 rounded-2xl bg-indigo-50 text-indigo-600"><Sparkles size={22} /></div>
                                        <div>
                                            <h3 className="text-base font-black text-slate-800">
                                                {rep.proyeccion ? `Proyección de Cierre (${rep.R.tipoLabel})` : `Resultado Final del Periodo (${rep.R.tipoLabel})`}
                                            </h3>
                                            <p className="text-xs text-slate-500">
                                                {rep.proyeccion
                                                    ? `Avance del tiempo: ${formatPct(rep.proyeccion.avance)} del periodo transcurrido`
                                                    : `Comparado contra el periodo completo anterior (${rep.R.prevLabel})`}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {rep.proyeccion ? (
                                    <div className="grid grid-cols-3 gap-3 my-2">
                                        <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                                            <p className="text-[10px] font-bold uppercase text-slate-400">Ingreso Proyectado</p>
                                            <p className="text-lg font-black text-emerald-600 mt-0.5">{formatCurrency(rep.proyeccion.ingresos)}</p>
                                        </div>
                                        <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                                            <p className="text-[10px] font-bold uppercase text-slate-400">Gasto Proyectado</p>
                                            <p className="text-lg font-black text-rose-600 mt-0.5">{formatCurrency(rep.proyeccion.egresos)}</p>
                                        </div>
                                        <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                                            <p className="text-[10px] font-bold uppercase text-slate-400">Utilidad Proyectada</p>
                                            <p className="text-lg font-black text-indigo-600 mt-0.5">{formatCurrency(rep.proyeccion.utilidad)}</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-3 gap-3 my-2">
                                        <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                                            <p className="text-[10px] font-bold uppercase text-slate-400">Ingresos Periodo</p>
                                            <p className="text-lg font-black text-emerald-600 mt-0.5">{formatCurrency(rep.actual.ingresos)}</p>
                                        </div>
                                        <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                                            <p className="text-[10px] font-bold uppercase text-slate-400">Periodo Anterior</p>
                                            <p className="text-lg font-black text-slate-700 mt-0.5">{formatCurrency(rep.anterior.ingresos)}</p>
                                        </div>
                                        <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                                            <p className="text-[10px] font-bold uppercase text-slate-400">Diferencia Neta</p>
                                            <p className={`text-lg font-black mt-0.5 ${rep.actual.ingresos - rep.anterior.ingresos >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                {formatCurrency(rep.actual.ingresos - rep.anterior.ingresos)}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                                    {rep.proyeccion && rep.proyeccion.meta > 0 ? (
                                        <span>
                                            Meta del plan: <strong>{formatCurrency(rep.proyeccion.meta)}</strong> • Proyectas llegar al <strong>{formatPct(rep.proyeccion.pctMeta)}</strong>
                                        </span>
                                    ) : (
                                        <span>Meta mensual de tu plan: <strong>{formatCurrency(pl.metaPlanMensual)}</strong> ({formatCurrency(pl.metaDiariaPesos)}/día)</span>
                                    )}
                                    <button onClick={() => setSeccion('plan')} className="text-indigo-600 font-black hover:underline">
                                        Abrir Plan de Ingresos →
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Diagnóstico Ejecutivo / Hallazgos Automáticos */}
                    {rep.hallazgos.length > 0 && (
                        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
                            <h3 className="text-base font-black text-slate-800 mb-4 flex items-center gap-2">
                                Diagnóstico Ejecutivo del Negocio ({rep.R.label})
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {rep.hallazgos.map((h, i) => {
                                    const isPos = h.tipo === 'positivo';
                                    const isAlert = h.tipo === 'alerta';
                                    return (
                                        <div
                                            key={i}
                                            className={`p-3.5 rounded-2xl border flex items-start gap-3 text-xs leading-relaxed font-medium ${
                                                isPos
                                                    ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                                                    : isAlert
                                                        ? 'bg-amber-50/80 border-amber-200 text-amber-900'
                                                        : 'bg-slate-50 border-slate-200 text-slate-700'
                                            }`}
                                        >
                                            {isPos ? (
                                                <CheckCircle2 size={17} className="text-emerald-600 shrink-0 mt-0.5" />
                                            ) : isAlert ? (
                                                <AlertTriangle size={17} className="text-amber-600 shrink-0 mt-0.5" />
                                            ) : (
                                                <Info size={17} className="text-sky-600 shrink-0 mt-0.5" />
                                            )}
                                            <span>{h.texto}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Gráfica de Evolución Temporal (Semanal / Mensual / Anual / Diario) */}
                    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
                            <div>
                                <h3 className="text-lg font-black text-slate-800">
                                    {tipoActual === 'anio'
                                        ? 'Evolución Mensual del Año (Ingresos, Egresos y Utilidad)'
                                        : tipoActual === 'mes'
                                            ? 'Evolución Diaria del Mes'
                                            : tipoActual === 'semana'
                                                ? 'Evolución Día por Día de la Semana'
                                                : 'Evolución por Hora del Día'}
                                </h3>
                                <p className="text-xs text-slate-500">
                                    Compara entradas de dinero, salidas y utilidad neta en cada {tipoActual === 'anio' ? 'mes' : tipoActual === 'dia' ? 'hora' : 'día'}
                                </p>
                            </div>
                        </div>

                        <div className="h-[320px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={rep.desglose} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="labelCorto" tick={{ fontSize: 11, fill: '#64748b', fontWeight: 700 }} axisLine={false} tickLine={false} />
                                    <YAxis tickFormatter={formatShortMoney} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                    <Tooltip
                                        formatter={(val, name) => [formatCurrency(val), name]}
                                        labelFormatter={(l, payload) => payload?.[0]?.payload?.label || l}
                                        contentStyle={{ borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.08)' }}
                                    />
                                    <Legend wrapperStyle={{ fontSize: '12px', fontWeight: 700 }} />
                                    <Bar dataKey="ingresos" name="Ingresos" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={32} />
                                    <Bar dataKey="egresos" name="Egresos" fill="#f43f5e" radius={[6, 6, 0, 0]} maxBarSize={32} />
                                    <Line type="monotone" dataKey="utilidad" name="Utilidad Neta" stroke="#4f46e5" strokeWidth={2.5} dot={{ r: 3 }} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Tabla de desglose del periodo */}
                        <div className="mt-6 overflow-x-auto border border-slate-100 rounded-2xl">
                            <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                    <tr className="bg-slate-900 text-white uppercase text-[10px] tracking-wider">
                                        <th className="py-3 px-4">{tipoActual === 'anio' ? 'Mes' : tipoActual === 'dia' ? 'Horario' : 'Día / Fecha'}</th>
                                        <th className="py-3 px-3 text-right">Ingresos</th>
                                        <th className="py-3 px-3 text-right">Egresos</th>
                                        <th className="py-3 px-3 text-right">Utilidad</th>
                                        <th className="py-3 px-3 text-right">Margen</th>
                                        <th className="py-3 px-3 text-right">Ticket Prom.</th>
                                        <th className="py-3 px-3 text-center">Citas Comp.</th>
                                        <th className="py-3 px-3 text-center">No Asistió</th>
                                        <th className="py-3 px-3 text-center">Pac. Nuevos</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {rep.desglose
                                        .filter((d) => tipoActual !== 'dia' || d.ingresos > 0 || d.egresos > 0 || d.completadas > 0 || d.noAsistio > 0)
                                        .map((d) => (
                                            <tr key={d.key} className="hover:bg-slate-50/80">
                                                <td className="py-2.5 px-4 font-bold text-slate-800">{d.label}</td>
                                                <td className="py-2.5 px-3 text-right font-bold text-emerald-600">{formatCurrency(d.ingresos)}</td>
                                                <td className="py-2.5 px-3 text-right font-medium text-rose-600">{formatCurrency(d.egresos)}</td>
                                                <td className={`py-2.5 px-3 text-right font-black ${d.utilidad >= 0 ? 'text-slate-800' : 'text-rose-600'}`}>
                                                    {formatCurrency(d.utilidad)}
                                                </td>
                                                <td className="py-2.5 px-3 text-right text-slate-500">{formatPct(d.margen)}</td>
                                                <td className="py-2.5 px-3 text-right text-slate-600">{formatCurrency(d.ticket)}</td>
                                                <td className="py-2.5 px-3 text-center font-bold text-slate-700">{d.completadas}</td>
                                                <td className="py-2.5 px-3 text-center text-amber-600 font-bold">{d.noAsistio}</td>
                                                <td className="py-2.5 px-3 text-center text-sky-600 font-bold">{d.nuevos}</td>
                                            </tr>
                                        ))}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-200">
                                        <td className="py-3 px-4">TOTAL DEL PERIODO</td>
                                        <td className="py-3 px-3 text-right text-emerald-700">{formatCurrency(rep.actual.ingresos)}</td>
                                        <td className="py-3 px-3 text-right text-rose-700">{formatCurrency(rep.actual.egresos)}</td>
                                        <td className="py-3 px-3 text-right">{formatCurrency(rep.actual.utilidad)}</td>
                                        <td className="py-3 px-3 text-right">{formatPct(rep.actual.margen)}</td>
                                        <td className="py-3 px-3 text-right">{formatCurrency(rep.actual.ticket)}</td>
                                        <td className="py-3 px-3 text-center">{rep.actual.completadas}</td>
                                        <td className="py-3 px-3 text-center">{rep.actual.noAsistio}</td>
                                        <td className="py-3 px-3 text-center">{rep.actual.nuevos}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ════════════════════════════════════════════════════════════════════════
                SECCIÓN 2: PLAN DE INGRESOS MENSUALES, BOLSAS DE PROVISIÓN Y META DIARIA DE SERVICIOS
               ════════════════════════════════════════════════════════════════════════ */}
            {seccion === 'plan' && (
                <div className="space-y-6">
                    {/* Banner superior del Plan de Ingresos */}
                    <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-teal-900 rounded-3xl p-6 text-white shadow-lg flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div>
                            <span className="px-2.5 py-1 rounded-lg bg-turquesa/20 text-turquesa text-xs font-black uppercase tracking-wider">
                                Planificador Financiero y Operativo • {pl.diasLaboralesMes} días laborales/mes
                            </span>
                            <h3 className="text-xl sm:text-2xl font-black mt-2">
                                Plan de Ingresos Mensuales y Cuota Diaria de Servicios (No Paquete)
                            </h3>
                            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-3xl">
                                Calcula exactamente cuánto necesitas ingresar al mes y por día para cubrir <strong>Renta, Luz, Internet</strong>, el <strong>Promedio de Nóminas</strong>, tu <strong>Bolsa para Comprar Producto de Tratamientos</strong>, tu <strong>Bolsa para Comprar Equipo</strong> y tu <strong>Utilidad Libre Deseada</strong>.
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 shrink-0">
                            <div className="bg-white/10 backdrop-blur-sm border border-white/15 rounded-2xl px-4 py-3 text-right">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-teal-200 block">Meta Mensual del Plan</span>
                                <span className="text-2xl font-black text-white">{formatCurrency(pl.metaPlanMensual)}</span>
                                <span className="text-[11px] text-slate-300 block">Equilibrio: {formatCurrency(pl.compromisoMensualTotal)}</span>
                            </div>
                            <div className="bg-turquesa/25 border border-turquesa/40 rounded-2xl px-4 py-3 text-right">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-teal-100 block">Debes Vender por Día</span>
                                <span className="text-2xl font-black text-white">{formatCurrency(pl.metaDiariaPesos)}</span>
                                <span className="text-[11px] text-teal-100 block">~{pl.resumenMix.unidadesTotalesMixDia} servicios sueltos/día</span>
                            </div>
                            <button
                                onClick={() => { setFormConfig(config); setModalConfig(true); }}
                                className="px-4 py-3 rounded-2xl bg-white text-slate-900 hover:bg-teal-50 font-black text-xs flex items-center gap-2 shadow-md transition-colors"
                            >
                                <Settings size={16} className="text-turquesa" />
                                Configurar Gastos y Bolsas
                            </button>
                        </div>
                    </div>

                    {/* 4 Bloques: 1. Gastos Fijos | 2. Nómina Promedio | 3. Bolsa Producto | 4. Bolsa Equipo */}
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                        {/* 1. Gastos Fijos Divididos */}
                        <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm flex flex-col justify-between">
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">1. Gastos Fijos Mensuales</span>
                                    <div className="p-2 rounded-xl bg-slate-100 text-slate-700"><Building2 size={17} /></div>
                                </div>
                                <h4 className="text-2xl font-black text-slate-800">{formatCurrency(eq.sumaFijosServicios)}<span className="text-xs font-bold text-slate-400">/mes</span></h4>
                                <p className="text-xs font-bold text-turquesa mt-0.5">
                                    Cuota diaria: {formatCurrency(pl.cuotaDiaria.fijos)} / día laboral
                                </p>
                                <div className="mt-4 space-y-2 pt-3 border-t border-slate-100 text-xs">
                                    <div className="flex items-center justify-between">
                                        <span className="text-slate-600 flex items-center gap-1.5"><Building2 size={13} className="text-slate-400" /> Renta de Local</span>
                                        <strong className="text-slate-800">{formatCurrency(eq.fijosDesglose.renta)}</strong>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-slate-600 flex items-center gap-1.5"><Zap size={13} className="text-amber-500" /> Luz (CFE)</span>
                                        <strong className="text-slate-800">{formatCurrency(eq.fijosDesglose.luz)}</strong>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-slate-600 flex items-center gap-1.5"><Wifi size={13} className="text-sky-500" /> Internet y Tel.</span>
                                        <strong className="text-slate-800">{formatCurrency(eq.fijosDesglose.internet)}</strong>
                                    </div>
                                    {(eq.fijosDesglose.agua > 0 || eq.fijosDesglose.otros > 0) && (
                                        <div className="flex items-center justify-between">
                                            <span className="text-slate-600 flex items-center gap-1.5"><Droplets size={13} className="text-blue-500" /> Agua y Otros</span>
                                            <strong className="text-slate-800">{formatCurrency((eq.fijosDesglose.agua || 0) + (eq.fijosDesglose.otros || 0))}</strong>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <button
                                onClick={() => { setFormConfig(config); setModalConfig(true); }}
                                className="mt-4 text-left text-[11px] font-black text-turquesa hover:underline"
                            >
                                Editar Renta, Luz e Internet →
                            </button>
                        </div>

                        {/* 2. Promedio de Nóminas */}
                        <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm flex flex-col justify-between">
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">2. Estimado de Nóminas</span>
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-50 text-amber-700">
                                        {eq.usaNominaAuto ? 'Promedio Automático' : 'Monto Fijo'}
                                    </span>
                                </div>
                                <h4 className="text-2xl font-black text-slate-800">{formatCurrency(eq.nominaMensual)}<span className="text-xs font-bold text-slate-400">/mes</span></h4>
                                <p className="text-xs font-bold text-amber-600 mt-0.5">
                                    Cuota diaria: {formatCurrency(pl.cuotaDiaria.nomina)} / día ({formatCurrency(eq.nominaSemanalAuto)}/sem prom.)
                                </p>

                                <div className="mt-4 space-y-1.5 pt-3 border-t border-slate-100 text-xs max-h-[120px] overflow-y-auto">
                                    {eq.nominasPorStaff && eq.nominasPorStaff.length > 0 ? (
                                        eq.nominasPorStaff.slice(0, 4).map((emp) => (
                                            <div key={emp.nombre} className="flex items-center justify-between">
                                                <span className="text-slate-600 truncate max-w-[130px]">{emp.nombre}</span>
                                                <strong className="text-slate-800">~{formatCurrency(emp.promedioPago)}/pago</strong>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-[11px] text-slate-400 italic">Sin nóminas previas registradas</p>
                                    )}
                                </div>
                            </div>
                            <p className="mt-3 text-[11px] text-slate-400">
                                Promedio real detectado: <strong>{formatCurrency(eq.nominaPromedioAuto)}/mes</strong>
                            </p>
                        </div>

                        {/* 3. Bolsa de Provisión para Producto de Tratamientos */}
                        <div className="bg-white rounded-3xl p-5 border border-teal-100 shadow-sm flex flex-col justify-between">
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-[11px] font-black uppercase tracking-wider text-teal-700">3. Bolsa Producto (Tratamientos)</span>
                                    <div className="p-2 rounded-xl bg-teal-50 text-teal-600"><ShoppingBag size={17} /></div>
                                </div>
                                <h4 className="text-2xl font-black text-teal-900">{formatCurrency(eq.bolsaProductoMensual)}<span className="text-xs font-bold text-slate-400">/mes</span></h4>
                                <p className="text-xs font-bold text-teal-600 mt-0.5">
                                    Apartar por día: {formatCurrency(pl.cuotaDiaria.bolsaProducto)} / día laboral
                                </p>

                                <div className="mt-4 space-y-2 pt-3 border-t border-slate-100 text-xs">
                                    <div className="flex justify-between">
                                        <span className="text-slate-500">Bolsa del periodo ({rep.R.tipoLabel}):</span>
                                        <strong className="text-slate-800">{formatCurrency(eq.bolsaProductoPeriodo)}</strong>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-500">Gastado en insumos:</span>
                                        <strong className="text-rose-600">{formatCurrency(eq.gastadoInsumosPeriodo)}</strong>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-600 font-bold">Disponible en bolsa:</span>
                                        <strong className={eq.disponibleBolsaProducto >= 0 ? 'text-emerald-600 font-black' : 'text-rose-600 font-black'}>
                                            {formatCurrency(eq.disponibleBolsaProducto)}
                                        </strong>
                                    </div>
                                </div>
                            </div>
                            <p className="mt-3 text-[11px] text-slate-400">
                                Promedio histórico insumos: <strong>{formatCurrency(eq.insumosPromedioAuto)}/mes</strong>
                            </p>
                        </div>

                        {/* 4. Bolsa de Provisión para Comprar Equipo */}
                        <div className="bg-white rounded-3xl p-5 border border-indigo-100 shadow-sm flex flex-col justify-between">
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-[11px] font-black uppercase tracking-wider text-indigo-700">4. Bolsa Compra de Equipo</span>
                                    <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600"><Cpu size={17} /></div>
                                </div>
                                <h4 className="text-2xl font-black text-indigo-900">{formatCurrency(eq.bolsaEquipoMensual)}<span className="text-xs font-bold text-slate-400">/mes</span></h4>
                                <p className="text-xs font-bold text-indigo-600 mt-0.5">
                                    Apartar por día: {formatCurrency(pl.cuotaDiaria.bolsaEquipo)} / día laboral
                                </p>

                                <div className="mt-4 space-y-2 pt-3 border-t border-slate-100 text-xs">
                                    <div className="flex justify-between">
                                        <span className="text-slate-500">Equipo objetivo:</span>
                                        <strong className="text-slate-800 truncate max-w-[140px]">{eq.nombreEquipoMeta || 'Fondo Renovación'}</strong>
                                    </div>
                                    {eq.costoEquipoMeta > 0 && (
                                        <>
                                            <div className="flex justify-between">
                                                <span className="text-slate-500">Costo meta equipo:</span>
                                                <strong className="text-indigo-700">{formatCurrency(eq.costoEquipoMeta)}</strong>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-600 font-bold">Tiempo estimado:</span>
                                                <strong className="text-emerald-600 font-black">
                                                    {eq.mesesParaEquipo ? `${eq.mesesParaEquipo} meses` : 'Define cuota mensual'}
                                                </strong>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                            <button
                                onClick={() => { setFormConfig(config); setModalConfig(true); }}
                                className="mt-4 text-left text-[11px] font-black text-indigo-600 hover:underline"
                            >
                                Configurar meta de equipo →
                            </button>
                        </div>
                    </div>

                    {/* MIX DIARIO SUGERIDO DE CABINA (COMBINACIÓN REALISTA DE SERVICIOS SUELTOS) */}
                    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-5">
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase">
                                        Combinación Diaria Recomendada
                                    </span>
                                    <span className="text-xs text-slate-400 font-bold">
                                        Solo servicios que NO son paquete
                                    </span>
                                </div>
                                <h3 className="text-lg font-black text-slate-800 mt-1">
                                    Mix Diario Sugerido de Servicios para alcanzar {formatCurrency(pl.metaDiariaPesos)} / día
                                </h3>
                                <p className="text-xs text-slate-500">
                                    En lugar de vender un solo tipo de servicio, esta combinación equilibra tus servicios Estrella y Regulares para cumplir tu cuota diaria.
                                </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-3">
                                <div className="px-3.5 py-2 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
                                    <span className="text-slate-400 font-bold block text-[10px] uppercase">Total Servicios / Día</span>
                                    <strong className="text-slate-900 font-black text-sm">{pl.resumenMix.unidadesTotalesMixDia} servicios diarios</strong>
                                </div>
                                <div className="px-3.5 py-2 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs">
                                    <span className="text-emerald-700 font-bold block text-[10px] uppercase">Ingreso del Mix / Día</span>
                                    <strong className="text-emerald-900 font-black text-sm">{formatCurrency(pl.resumenMix.ingresoMixDia)}</strong>
                                </div>
                                <div className="px-3.5 py-2 rounded-2xl bg-indigo-50 border border-indigo-200 text-xs">
                                    <span className="text-indigo-700 font-bold block text-[10px] uppercase">Tiempo en Cabina</span>
                                    <strong className="text-indigo-900 font-black text-sm">{Number(pl.resumenMix.horasCabinaMixDia ?? pl.resumenMix.horasCabinaDia ?? 0).toFixed(1)} hrs/día</strong>
                                </div>
                            </div>
                        </div>

                        {pl.mixDiarioSugerido.length === 0 ? (
                            <p className="text-sm text-slate-400 italic py-6 text-center">
                                Activa servicios en el catálogo inferior para generar tu mix diario sugerido.
                            </p>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                {pl.mixDiarioSugerido.slice(0, 8).map((item) => (
                                    <div key={item.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col justify-between">
                                        <div>
                                            <div className="flex items-center justify-between gap-2 mb-1">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                                    item.prioridadPlan === 'alta'
                                                        ? 'bg-amber-100 text-amber-800'
                                                        : item.prioridadPlan === 'baja'
                                                            ? 'bg-slate-200 text-slate-700'
                                                            : 'bg-teal-100 text-teal-800'
                                                }`}>
                                                    {item.prioridadPlan === 'alta' ? '⭐ Estrella' : item.prioridadPlan === 'baja' ? 'Complemento' : 'Regular'}
                                                </span>
                                                <span className="text-xs font-black text-slate-700">{formatCurrency(item.precio)}</span>
                                            </div>
                                            <h4 className="font-black text-slate-800 text-sm leading-snug mt-1">{item.nombre}</h4>
                                            <p className="text-[11px] text-slate-500 mt-0.5">
                                                Margen libre: <strong className="text-emerald-700">{formatCurrency(item.margenNetoUnitario)}</strong> • {item.duracionMin} min
                                            </p>
                                        </div>
                                        <div className="mt-3 pt-2.5 border-t border-slate-200 flex items-baseline justify-between">
                                            <div>
                                                <span className="text-xl font-black text-turquesa">{item.unidadesMixDia}</span>
                                                <span className="text-xs font-bold text-slate-600 ml-1">al día</span>
                                                <span className="text-[10px] text-slate-400 block">({item.unidadesMixMes} al mes)</span>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-xs font-black text-slate-800 block">{formatCurrency(item.ingresoMixDia)}/día</span>
                                                <span className="text-[10px] text-slate-400">Vendidos per.: {item.vendidosPeriodo || 0}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* TABLA COMPLETA DE SERVICIOS SUELTOS (NO PAQUETE): ¿CUÁNTOS VENDER DIARIOS? */}
                    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-5">
                            <div>
                                <h3 className="text-lg font-black text-slate-800">
                                    Catálogo de Servicios Sueltos (No Paquete) — ¿Cuántos debo vender diarios?
                                </h3>
                                <p className="text-xs text-slate-500">
                                    Muestra para cada servicio individual cuántos tendrías que vender por día para cubrir tu meta diaria de <strong>{formatCurrency(pl.metaDiariaPesos)}</strong>, o ajusta su costo de insumo, comisión y prioridad con un clic.
                                </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <div className="bg-slate-100 rounded-xl p-1 flex items-center gap-1 text-xs">
                                    <button
                                        onClick={() => setModoCalculoPlan('precio')}
                                        className={`px-3 py-1.5 rounded-lg font-black transition-all ${
                                            modoCalculoPlan === 'precio' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                                        }`}
                                    >
                                        Por Precio de Venta
                                    </button>
                                    <button
                                        onClick={() => setModoCalculoPlan('margen')}
                                        className={`px-3 py-1.5 rounded-lg font-black transition-all ${
                                            modoCalculoPlan === 'margen' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                                        }`}
                                    >
                                        Por Margen Libre
                                    </button>
                                </div>

                                <div className="relative w-full sm:w-60">
                                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Buscar servicio..."
                                        value={busquedaServPlan}
                                        onChange={(e) => setBusquedaServPlan(e.target.value)}
                                        className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs outline-none focus:border-turquesa"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="overflow-x-auto border border-slate-100 rounded-2xl max-h-[540px]">
                            <table className="w-full text-xs text-left">
                                <thead className="sticky top-0 bg-slate-900 text-white uppercase text-[10px] z-10">
                                    <tr>
                                        <th className="py-3 px-3">Servicio (No Paquete)</th>
                                        <th className="py-3 px-2">Categoría</th>
                                        <th className="py-3 px-2 text-right">Precio Venta</th>
                                        <th className="py-3 px-2 text-right">Insumo + Com.</th>
                                        <th className="py-3 px-2 text-right">Utilidad Libre</th>
                                        <th className="py-3 px-2 text-center bg-teal-900/60">
                                            Si solo vendieras este / día
                                        </th>
                                        <th className="py-3 px-2 text-center bg-indigo-900/60">
                                            En Mix Diario
                                        </th>
                                        <th className="py-3 px-2 text-center">Vendidos ({rep.R.tipoLabel})</th>
                                        <th className="py-3 px-3 text-center">Configurar</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {serviciosPlanFiltrados.map((s) => {
                                        const mixItem = pl.mixDiarioSugerido.find((m) => m.id === s.id);
                                        const cantDiaria = modoCalculoPlan === 'margen' ? s.soloEsteMargenDia : s.soloEsteParaMetaDia;
                                        const cantDiariaRed = modoCalculoPlan === 'margen' ? s.soloEsteMargenDiaRedondeado : s.soloEsteParaMetaDiaRedondeado;
                                        const cantMes = Math.ceil(cantDiaria * pl.diasLaboralesMes);

                                        return (
                                            <tr key={s.id} className="hover:bg-slate-50/90">
                                                <td className="py-2.5 px-3">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-black text-slate-800">{s.nombre}</span>
                                                        {s.prioridadPlan === 'alta' && (
                                                            <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[9px] font-black">⭐ Estrella</span>
                                                        )}
                                                    </div>
                                                    <span className="text-[10px] text-slate-400">{s.duracionMin} min en cabina</span>
                                                </td>
                                                <td className="py-2.5 px-2 text-slate-600 font-medium">{s.categoria}</td>
                                                <td className="py-2.5 px-2 text-right font-black text-slate-900">{formatCurrency(s.precio)}</td>
                                                <td className="py-2.5 px-2 text-right text-slate-500">
                                                    {formatCurrency(s.costoInsumos + s.comisionMonto)}
                                                    <span className="block text-[10px] text-slate-400">
                                                        Ins: {formatCurrency(s.costoInsumos)} | Com: {s.comisionPct}%
                                                    </span>
                                                </td>
                                                <td className="py-2.5 px-2 text-right font-black text-emerald-600">
                                                    {formatCurrency(s.margenNetoUnitario)}
                                                    <span className="block text-[10px] text-emerald-700 font-bold">{formatPct(s.margenPct)}</span>
                                                </td>
                                                <td className="py-2.5 px-2 text-center bg-teal-50/50">
                                                    <span className="text-sm font-black text-teal-800">
                                                        {cantDiariaRed} al día
                                                    </span>
                                                    <span className="block text-[10px] text-slate-500">
                                                        ({Number(cantDiaria || 0).toFixed(1)} exactos • {cantMes}/mes)
                                                    </span>
                                                </td>
                                                <td className="py-2.5 px-2 text-center bg-indigo-50/40">
                                                    {mixItem ? (
                                                        <>
                                                            <span className="text-sm font-black text-indigo-700">
                                                                {mixItem.unidadesMixDia} / día
                                                            </span>
                                                            <span className="block text-[10px] text-indigo-500">
                                                                {formatCurrency(mixItem.ingresoMixDia)}/día
                                                            </span>
                                                        </>
                                                    ) : (
                                                        <span className="text-[11px] text-slate-400">—</span>
                                                    )}
                                                </td>
                                                <td className="py-2.5 px-2 text-center">
                                                    <span className={`px-2 py-0.5 rounded-full font-black text-[11px] ${
                                                        s.vendidosPeriodo > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-400'
                                                    }`}>
                                                        {s.vendidosPeriodo || 0}
                                                    </span>
                                                </td>
                                                <td className="py-2.5 px-3 text-center">
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        <button
                                                            onClick={() => setServEditModal({ ...s })}
                                                            title="Editar precio, costo de producto, comisión y prioridad"
                                                            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-turquesa hover:text-white text-slate-700 font-bold text-[11px] inline-flex items-center gap-1 transition-colors"
                                                        >
                                                            <Edit2 size={12} /> Ajustar
                                                        </button>
                                                        <button
                                                            onClick={() => handleToggleIncluirPlan(s)}
                                                            title="Quitar del plan diario"
                                                            className="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-[10px]"
                                                        >
                                                            Excluir
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ════════════════════════════════════════════════════════════════════════
                SECCIÓN 3: SALUD FINANCIERA
               ════════════════════════════════════════════════════════════════════════ */}
            {seccion === 'finanzas' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Ingresos por método de pago */}
                        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
                            <h3 className="text-base font-black text-slate-800 mb-4 flex items-center gap-2">
                                <CreditCard className="text-turquesa" size={20} />
                                Ingresos por Método de Pago
                            </h3>
                            {rep.finanzas.porMetodo.length === 0 ? (
                                <p className="text-sm text-slate-400 italic py-10 text-center">Sin cobros registrados en este periodo</p>
                            ) : (
                                <div className="space-y-3">
                                    {rep.finanzas.porMetodo.map((m) => (
                                        <div key={m.name} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                                            <div className="flex justify-between items-center text-xs font-bold mb-1.5">
                                                <span className="text-slate-800">{m.name}</span>
                                                <span className="text-slate-900 font-black">{formatCurrency(m.value)} ({formatPct(m.pct)})</span>
                                            </div>
                                            <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                                                <div className="h-full bg-turquesa rounded-full" style={{ width: `${Math.min(100, m.pct)}%` }} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Ingresos por Fuente (Servicios vs Planes vs Productos) */}
                        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
                            <h3 className="text-base font-black text-slate-800 mb-4 flex items-center gap-2">
                                <Layers className="text-indigo-600" size={20} />
                                Ingresos por Fuente de Negocio
                            </h3>
                            {rep.finanzas.porFuente.length === 0 ? (
                                <p className="text-sm text-slate-400 italic py-10 text-center">Sin ingresos registrados en este periodo</p>
                            ) : (
                                <div className="space-y-3">
                                    {rep.finanzas.porFuente.map((f) => (
                                        <div key={f.name} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                                            <div className="flex justify-between items-center text-xs font-bold mb-1.5">
                                                <span className="text-slate-800">{f.name}</span>
                                                <span className="text-indigo-700 font-black">{formatCurrency(f.value)} ({formatPct(f.pct)})</span>
                                            </div>
                                            <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                                                <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${Math.min(100, f.pct)}%` }} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Top 10 Servicios */}
                        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
                            <h3 className="text-base font-black text-slate-800 mb-4 flex items-center gap-2">
                                <TrendingUp className="text-emerald-600" size={20} />
                                Top 10 Tratamientos y Servicios por Ingreso
                            </h3>
                            {rep.finanzas.topServicios.length === 0 ? (
                                <p className="text-sm text-slate-400 italic py-10 text-center">Sin ventas de servicios en este periodo</p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs text-left">
                                        <thead>
                                            <tr className="border-b border-slate-200 text-slate-400 uppercase text-[10px]">
                                                <th className="py-2">#</th>
                                                <th className="py-2">Servicio / Concepto</th>
                                                <th className="py-2 text-center">Cobros</th>
                                                <th className="py-2 text-right">Facturado</th>
                                                <th className="py-2 text-right">% Ing.</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {rep.finanzas.topServicios.map((s, idx) => (
                                                <tr key={s.name} className="hover:bg-slate-50">
                                                    <td className="py-2.5 font-black text-slate-400">{idx + 1}</td>
                                                    <td className="py-2.5 font-bold text-slate-800">{s.name}</td>
                                                    <td className="py-2.5 text-center text-slate-600">{s.count}</td>
                                                    <td className="py-2.5 text-right font-black text-emerald-600">{formatCurrency(s.value)}</td>
                                                    <td className="py-2.5 text-right text-slate-500">{formatPct(s.pct)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* Egresos por Categoría */}
                        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
                            <h3 className="text-base font-black text-slate-800 mb-4 flex items-center gap-2">
                                <TrendingDown className="text-rose-600" size={20} />
                                Desglose de Egresos por Categoría
                            </h3>
                            {rep.finanzas.egresosCat.length === 0 ? (
                                <p className="text-sm text-slate-400 italic py-10 text-center">Sin gastos registrados en este periodo</p>
                            ) : (
                                <>
                                    <div className="h-[200px] w-full mb-4">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={rep.finanzas.egresosCat}
                                                    dataKey="value"
                                                    nameKey="name"
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={45}
                                                    outerRadius={75}
                                                    paddingAngle={3}
                                                >
                                                    {rep.finanzas.egresosCat.map((e, i) => (
                                                        <Cell key={e.name} fill={COLORS_PIE[i % COLORS_PIE.length]} />
                                                    ))}
                                                </Pie>
                                                <Tooltip formatter={(v) => formatCurrency(v)} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <div className="space-y-2">
                                        {rep.finanzas.egresosCat.map((g, i) => (
                                            <div key={g.name} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COLORS_PIE[i % COLORS_PIE.length] }} />
                                                    <span className="font-bold text-slate-700">{g.name}</span>
                                                </div>
                                                <span className="font-black text-rose-600">{formatCurrency(g.value)} ({formatPct(g.pct)})</span>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ════════════════════════════════════════════════════════════════════════
                SECCIÓN 4: PLANES DE TRATAMIENTO Y CARTERA POR COBRAR
               ════════════════════════════════════════════════════════════════════════ */}
            {seccion === 'planes' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="p-5 rounded-3xl bg-white border border-slate-100 shadow-sm">
                            <p className="text-[11px] font-black uppercase text-slate-400">Cartera Total por Cobrar</p>
                            <h4 className="text-2xl font-black text-indigo-700 mt-1">{formatCurrency(rep.planes.cartera)}</h4>
                            <p className="text-xs text-slate-500 mt-1">
                                En {rep.planes.vigentes} planes vigentes ({formatPct(rep.planes.avancePromedio)} pagado en prom.)
                            </p>
                        </div>
                        <div className="p-5 rounded-3xl bg-white border border-slate-100 shadow-sm">
                            <p className="text-[11px] font-black uppercase text-slate-400">Planes Vendidos vs. Liquidados</p>
                            <h4 className="text-2xl font-black text-slate-800 mt-1">
                                {rep.planes.vendidos} vendidos / {rep.planes.liquidados} liquidados
                            </h4>
                            <p className="text-xs text-slate-500 mt-1">
                                Valor vendido en el periodo: <strong>{formatCurrency(rep.planes.valorVendido)}</strong>
                            </p>
                        </div>
                        <div className="p-5 rounded-3xl bg-white border border-slate-100 shadow-sm">
                            <p className="text-[11px] font-black uppercase text-slate-400">% de Ingresos por Planes</p>
                            <h4 className="text-2xl font-black text-emerald-600 mt-1">{formatPct(rep.planes.pctIngresos)}</h4>
                            <p className="text-xs text-slate-500 mt-1">
                                {formatCurrency(rep.planes.abonosCobrados)} cobrados en abonos de planes
                            </p>
                        </div>
                        <div className="p-5 rounded-3xl bg-white border border-rose-100 shadow-sm">
                            <p className="text-[11px] font-black uppercase text-rose-500">Planes Atrasados (+{config.diasAtrasoPlan} días)</p>
                            <h4 className="text-2xl font-black text-rose-600 mt-1">{rep.planes.atrasados.length} planes</h4>
                            <p className="text-xs text-slate-500 mt-1">
                                Saldo detenido: <strong className="text-rose-600">{formatCurrency(rep.planes.montoAtrasado)}</strong>
                            </p>
                        </div>
                    </div>

                    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                            <div>
                                <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                                    <ShieldAlert className="text-rose-600" size={20} />
                                    Planes con Atraso de Pago (+{config.diasAtrasoPlan} días sin abono)
                                </h3>
                                <p className="text-xs text-slate-500">
                                    Envía un recordatorio de estado de cuenta por WhatsApp con un clic para acelerar la cobranza
                                </p>
                            </div>
                        </div>

                        {rep.planes.atrasados.length === 0 ? (
                            <div className="py-12 text-center text-emerald-600 font-bold text-sm">
                                ¡Excelente! Todos los planes activos tienen abonos recientes (menos de {config.diasAtrasoPlan} días).
                            </div>
                        ) : (
                            <div className="overflow-x-auto border border-slate-100 rounded-2xl">
                                <table className="w-full text-xs text-left">
                                    <thead>
                                        <tr className="bg-slate-900 text-white uppercase text-[10px]">
                                            <th className="py-3 px-4">Paciente</th>
                                            <th className="py-3 px-3">Plan / Tratamiento</th>
                                            <th className="py-3 px-3 text-right">Meta</th>
                                            <th className="py-3 px-3 text-right">Abonado</th>
                                            <th className="py-3 px-3 text-right">Saldo por Cobrar</th>
                                            <th className="py-3 px-3 text-center">Días sin Abono</th>
                                            <th className="py-3 px-4 text-center">Acción</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {rep.planes.atrasados.map((p) => (
                                            <tr key={p.id} className="hover:bg-rose-50/30">
                                                <td className="py-3 px-4">
                                                    <p className="font-black text-slate-800">{p.paciente}</p>
                                                    <p className="text-[11px] text-slate-400">{p.telefono || 'Sin teléfono'}</p>
                                                </td>
                                                <td className="py-3 px-3 font-semibold text-slate-700">{p.objetivo}</td>
                                                <td className="py-3 px-3 text-right text-slate-600">{formatCurrency(p.meta)}</td>
                                                <td className="py-3 px-3 text-right text-emerald-600 font-bold">{formatCurrency(p.acumulado)}</td>
                                                <td className="py-3 px-3 text-right font-black text-rose-600">{formatCurrency(p.saldo)}</td>
                                                <td className="py-3 px-3 text-center">
                                                    <span className="px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 font-black text-[11px]">
                                                        {p.diasSinPago} días
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 text-center">
                                                    <button
                                                        onClick={() => handleWhatsAppPlanAtrasado(p)}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs shadow-sm transition-colors"
                                                    >
                                                        <MessageCircle size={14} /> Recordar pago
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ════════════════════════════════════════════════════════════════════════
                SECCIÓN 5: PACIENTES, RETENCIÓN, LTV, CANALES Y REACTIVACIÓN
               ════════════════════════════════════════════════════════════════════════ */}
            {seccion === 'pacientes' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {rep.pacientes.retencion.map((r) => (
                            <div key={r.dias} className="p-5 rounded-3xl bg-white border border-slate-100 shadow-sm">
                                <p className="text-[11px] font-black uppercase text-slate-400">Tasa de Retención ({r.dias} días)</p>
                                <h4 className="text-2xl font-black text-slate-800 mt-1">{formatPct(r.tasa)}</h4>
                                <p className="text-xs text-slate-500 mt-1">
                                    {r.regresaron} de {r.elegibles} pacientes regresaron en ≤{r.dias} días
                                </p>
                            </div>
                        ))}
                        <div className="p-5 rounded-3xl bg-white border border-slate-100 shadow-sm">
                            <p className="text-[11px] font-black uppercase text-slate-400">Valor de Vida (LTV Promedio)</p>
                            <h4 className="text-2xl font-black text-turquesa mt-1">{formatCurrency(rep.pacientes.ltvPromedio)}</h4>
                            <p className="text-xs text-slate-500 mt-1">
                                Promedio de <strong>{rep.pacientes.visitasProm.toFixed(1)} visitas</strong> por paciente
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
                            <h3 className="text-base font-black text-slate-800 mb-4 flex items-center gap-2">
                                <Medal className="text-amber-500" size={20} />
                                Top 10 Pacientes VIP por Facturación ({rep.R.label})
                            </h3>
                            {rep.pacientes.topPacientes.length === 0 ? (
                                <p className="text-sm text-slate-400 italic py-10 text-center">Sin pagos de pacientes en este periodo</p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs text-left">
                                        <thead>
                                            <tr className="border-b border-slate-200 text-slate-400 uppercase text-[10px]">
                                                <th className="py-2">#</th>
                                                <th className="py-2">Paciente</th>
                                                <th className="py-2 text-center">Visitas Tot.</th>
                                                <th className="py-2 text-right">Pagado Periodo</th>
                                                <th className="py-2 text-right">LTV Histórico</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {rep.pacientes.topPacientes.map((p, idx) => (
                                                <tr key={p.nombre + idx} className="hover:bg-slate-50">
                                                    <td className="py-2.5 font-black text-amber-600">{idx + 1}</td>
                                                    <td className="py-2.5 font-bold text-slate-800">{p.nombre}</td>
                                                    <td className="py-2.5 text-center text-slate-600">{p.visitas}</td>
                                                    <td className="py-2.5 text-right font-black text-emerald-600">{formatCurrency(p.total)}</td>
                                                    <td className="py-2.5 text-right font-bold text-slate-700">{formatCurrency(p.ltv)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col justify-between">
                            <div>
                                <h3 className="text-base font-black text-slate-800 mb-4 flex items-center gap-2">
                                    <UserCheck className="text-sky-600" size={20} />
                                    Nuevos vs. Recurrentes y Canal de Origen
                                </h3>
                                <div className="grid grid-cols-3 gap-3 mb-5">
                                    <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 text-center">
                                        <p className="text-[10px] font-bold uppercase text-slate-400">Atendidos</p>
                                        <p className="text-xl font-black text-slate-800">{rep.pacientes.atendidos}</p>
                                    </div>
                                    <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-100 text-center">
                                        <p className="text-[10px] font-bold uppercase text-emerald-700">Recurrentes</p>
                                        <p className="text-xl font-black text-emerald-700">
                                            {rep.pacientes.recurrentes} ({formatPct(rep.pacientes.pctRecurrentes)})
                                        </p>
                                    </div>
                                    <div className="p-3 rounded-2xl bg-sky-50 border border-sky-100 text-center">
                                        <p className="text-[10px] font-bold uppercase text-sky-700">Primera Vez</p>
                                        <p className="text-xl font-black text-sky-700">{rep.pacientes.nuevosAtendidos}</p>
                                    </div>
                                </div>

                                <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2">
                                    ¿Cómo nos conocieron los {rep.actual.nuevos} pacientes registrados en el periodo?
                                </h4>
                                {rep.pacientes.canales.length === 0 ? (
                                    <p className="text-xs text-slate-400 italic py-4">Sin pacientes nuevos registrados en este periodo.</p>
                                ) : (
                                    <div className="space-y-2">
                                        {rep.pacientes.canales.map((c) => (
                                            <div key={c.name} className="flex items-center justify-between text-xs bg-slate-50 px-3 py-2 rounded-xl">
                                                <span className="font-bold text-slate-700">{c.name}</span>
                                                <span className="font-black text-slate-900">{c.value} pac. ({formatPct(c.pct)})</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <p className="text-[11px] text-slate-400 mt-4 pt-3 border-t border-slate-100">
                                El campo <strong>"¿Cómo nos conoció?"</strong> está activo en el registro y edición de pacientes para medir tus campañas.
                            </p>
                        </div>
                    </div>

                    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                            <div>
                                <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                                    <AlertTriangle className="text-amber-500" size={20} />
                                    Pacientes en Riesgo de Abandono (+{config.diasRiesgo} días sin cita y sin cita futura)
                                </h3>
                                <p className="text-xs text-slate-500">
                                    {rep.pacientes.riesgo.length} pacientes que ya han invertido <strong>{formatCurrency(rep.pacientes.valorRiesgo)}</strong> en la clínica. Contáctalos por WhatsApp para reactivarlos.
                                </p>
                            </div>
                            <div className="relative w-full sm:w-64">
                                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Buscar paciente en riesgo..."
                                    value={busquedaRiesgo}
                                    onChange={(e) => setBusquedaRiesgo(e.target.value)}
                                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs outline-none focus:border-turquesa"
                                />
                            </div>
                        </div>

                        {pacientesRiesgoFiltrados.length === 0 ? (
                            <p className="text-sm text-slate-400 italic py-8 text-center">No se encontraron pacientes en riesgo con ese criterio.</p>
                        ) : (
                            <div className="overflow-x-auto border border-slate-100 rounded-2xl max-h-[420px]">
                                <table className="w-full text-xs text-left">
                                    <thead className="sticky top-0 bg-slate-900 text-white uppercase text-[10px]">
                                        <tr>
                                            <th className="py-3 px-4">Paciente</th>
                                            <th className="py-3 px-3">Último Servicio</th>
                                            <th className="py-3 px-3 text-center">Última Visita</th>
                                            <th className="py-3 px-3 text-center">Días sin Venir</th>
                                            <th className="py-3 px-3 text-center">Visitas</th>
                                            <th className="py-3 px-3 text-right">LTV Invertido</th>
                                            <th className="py-3 px-4 text-center">Reactivar</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {pacientesRiesgoFiltrados.slice(0, 60).map((r) => (
                                            <tr key={r.key} className="hover:bg-amber-50/40">
                                                <td className="py-2.5 px-4">
                                                    <p className="font-black text-slate-800">{r.nombre}</p>
                                                    <p className="text-[11px] text-slate-400">{r.telefono || 'Sin teléfono'}</p>
                                                </td>
                                                <td className="py-2.5 px-3 text-slate-600">{r.ultimoServicio || '—'}</td>
                                                <td className="py-2.5 px-3 text-center text-slate-600">
                                                    {r.ultimaVisita ? format(r.ultimaVisita, 'dd/MM/yyyy') : '—'}
                                                </td>
                                                <td className="py-2.5 px-3 text-center">
                                                    <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-black">
                                                        {r.dias} días
                                                    </span>
                                                </td>
                                                <td className="py-2.5 px-3 text-center font-bold text-slate-700">{r.visitas}</td>
                                                <td className="py-2.5 px-3 text-right font-black text-slate-800">{formatCurrency(r.ltv)}</td>
                                                <td className="py-2.5 px-4 text-center">
                                                    <button
                                                        onClick={() => handleWhatsAppReactivacion(r)}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs shadow-sm transition-colors"
                                                    >
                                                        <MessageCircle size={14} /> WhatsApp
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ════════════════════════════════════════════════════════════════════════
                SECCIÓN 6: OPERACIÓN, AGENDA, RENTABILIDAD POR ESPECIALISTA Y MAPA DE CALOR
               ════════════════════════════════════════════════════════════════════════ */}
            {seccion === 'operacion' && (
                <div className="space-y-6">
                    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                            <div>
                                <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                                    <Medal className="text-turquesa" size={20} />
                                    Rentabilidad, Ocupación e Ingreso Real por Especialista
                                </h3>
                                <p className="text-xs text-slate-500">
                                    Muestra citas completadas, ocupación de su agenda laboral, ingreso atribuido, comisiones generadas y aporte neto
                                </p>
                            </div>
                            <span className="px-3 py-1 rounded-full bg-rose-50 text-rose-700 text-xs font-black border border-rose-200">
                                Inasistencias: {rep.actual.noAsistio} (~{formatCurrency(rep.operacion.costoInasistencias)} perdidos)
                            </span>
                        </div>

                        {rep.operacion.especialistas.length === 0 ? (
                            <p className="text-sm text-slate-400 italic py-10 text-center">Sin citas registradas en este periodo</p>
                        ) : (
                            <div className="overflow-x-auto border border-slate-100 rounded-2xl">
                                <table className="w-full text-xs text-left">
                                    <thead>
                                        <tr className="bg-slate-900 text-white uppercase text-[10px]">
                                            <th className="py-3 px-4">Especialista</th>
                                            <th className="py-3 px-3 text-center">Citas Comp.</th>
                                            <th className="py-3 px-3 text-center">No Asistió</th>
                                            <th className="py-3 px-3 text-right">Horas Agenda</th>
                                            <th className="py-3 px-3 text-right">% Ocupación</th>
                                            <th className="py-3 px-3 text-right">Ingreso Generado</th>
                                            <th className="py-3 px-3 text-right">Ticket Prom.</th>
                                            <th className="py-3 px-3 text-right">Comisiones</th>
                                            <th className="py-3 px-3 text-right">Nómina Pag.</th>
                                            <th className="py-3 px-4 text-right">Aporte Neto</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {rep.operacion.especialistas.map((e) => (
                                            <tr key={e.id || e.nombre} className="hover:bg-slate-50">
                                                <td className="py-3 px-4 font-black text-slate-800">{e.nombre}</td>
                                                <td className="py-3 px-3 text-center font-bold text-emerald-600">{e.completadas}</td>
                                                <td className="py-3 px-3 text-center text-amber-600 font-bold">
                                                    {e.noAsistio} ({formatPct(e.tasaInasistencia)})
                                                </td>
                                                <td className="py-3 px-3 text-right text-slate-600">{e.horasAgendadas.toFixed(1)} hrs</td>
                                                <td className="py-3 px-3 text-right">
                                                    <span className="px-2 py-0.5 rounded-lg bg-sky-50 text-sky-700 font-black">
                                                        {formatPct(e.ocupacion)}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-3 text-right font-black text-emerald-700">{formatCurrency(e.ingresos)}</td>
                                                <td className="py-3 px-3 text-right text-slate-600">{formatCurrency(e.ticket)}</td>
                                                <td className="py-3 px-3 text-right text-amber-700 font-semibold">{formatCurrency(e.comisiones)}</td>
                                                <td className="py-3 px-3 text-right text-rose-600 font-semibold">{formatCurrency(e.nomina)}</td>
                                                <td className={`py-3 px-4 text-right font-black ${e.utilidadNeta >= 0 ? 'text-indigo-700' : 'text-rose-600'}`}>
                                                    {formatCurrency(e.utilidadNeta)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                            <div>
                                <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                                    <Flame className="text-orange-500" size={20} />
                                    Mapa de Calor de Agenda (Día de la Semana × Hora)
                                </h3>
                                <p className="text-xs text-slate-500">
                                    Detecta horas pico de demanda y horas muertas para lanzar promociones o ajustar turnos
                                </p>
                            </div>
                            {rep.operacion.heatmap.max > 0 && rep.operacion.heatmap.picoDia !== null && (
                                <span className="px-3 py-1 rounded-full bg-orange-50 text-orange-700 text-xs font-black border border-orange-200">
                                    Hora pico: {DIAS_SEMANA_LARGO[(rep.operacion.heatmap.picoDia + 1) % 7]} a las {rep.operacion.heatmap.picoHora}:00 hrs
                                </span>
                            )}
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-xs border-collapse">
                                <thead>
                                    <tr>
                                        <th className="p-2 text-left text-slate-400 font-bold">Día \ Hora</th>
                                        {rep.operacion.heatmap.horas.map((h) => (
                                            <th key={h} className="p-1.5 text-center text-[11px] font-bold text-slate-500">{h}:00</th>
                                        ))}
                                        <th className="p-2 text-right text-slate-500 font-black">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rep.operacion.heatmap.dias.map((dia, di) => (
                                        <tr key={dia} className="border-t border-slate-100">
                                            <td className="p-2 font-black text-slate-700">{dia}</td>
                                            {rep.operacion.heatmap.matriz[di].map((val, hi) => {
                                                const max = rep.operacion.heatmap.max || 1;
                                                const ratio = val / max;
                                                const bg = val === 0
                                                    ? 'bg-slate-50 text-slate-300'
                                                    : ratio > 0.75
                                                        ? 'bg-turquesa text-white font-black'
                                                        : ratio > 0.4
                                                            ? 'bg-turquesa/50 text-slate-900 font-bold'
                                                            : 'bg-turquesa/20 text-slate-700 font-semibold';
                                                return (
                                                    <td key={hi} className="p-1">
                                                        <div className={`h-8 rounded-lg flex items-center justify-center text-xs ${bg}`}>
                                                            {val}
                                                        </div>
                                                    </td>
                                                );
                                            })}
                                            <td className="p-2 text-right font-black text-slate-800">
                                                {rep.operacion.heatmap.totalPorDia[di]}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ════════════════════════════════════════════════════════════════════════
                SECCIÓN 7: INVENTARIO, MARGEN POR PRODUCTO Y ALERTAS DE STOCK MÍNIMO
               ════════════════════════════════════════════════════════════════════════ */}
            {seccion === 'inventario' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="p-5 rounded-3xl bg-white border border-slate-100 shadow-sm">
                            <p className="text-[11px] font-black uppercase text-slate-400">Valor Inventario (al Costo)</p>
                            <h4 className="text-2xl font-black text-slate-800 mt-1">{formatCurrency(rep.inventario.valorCosto)}</h4>
                            <p className="text-xs text-slate-500 mt-1">{rep.inventario.totalItems} artículos registrados</p>
                        </div>
                        <div className="p-5 rounded-3xl bg-white border border-slate-100 shadow-sm">
                            <p className="text-[11px] font-black uppercase text-slate-400">Valor Productos (Precio Venta)</p>
                            <h4 className="text-2xl font-black text-emerald-600 mt-1">{formatCurrency(rep.inventario.valorVenta)}</h4>
                            <p className="text-xs text-slate-500 mt-1">Margen promedio: <strong>{formatPct(rep.inventario.margenPromedio)}</strong></p>
                        </div>
                        <div className="p-5 rounded-3xl bg-white border border-slate-100 shadow-sm">
                            <p className="text-[11px] font-black uppercase text-slate-400">Ventas de Productos (Periodo)</p>
                            <h4 className="text-2xl font-black text-indigo-600 mt-1">{formatCurrency(rep.inventario.ingresoProductos)}</h4>
                            <p className="text-xs text-slate-500 mt-1">{rep.inventario.unidadesVendidas} unidades vendidas</p>
                        </div>
                        <div className="p-5 rounded-3xl bg-white border border-amber-200 shadow-sm">
                            <p className="text-[11px] font-black uppercase text-amber-600">Bajo Stock Mínimo</p>
                            <h4 className="text-2xl font-black text-amber-600 mt-1">{rep.inventario.bajoStock.length} artículos</h4>
                            <p className="text-xs text-rose-600 font-bold mt-1">{rep.inventario.agotados} completamente agotados</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
                            <h3 className="text-base font-black text-slate-800 mb-4 flex items-center gap-2">
                                <AlertTriangle className="text-amber-500" size={20} />
                                Productos e Insumos por Reabastecer
                            </h3>
                            {rep.inventario.bajoStock.length === 0 ? (
                                <p className="text-sm text-emerald-600 font-bold py-8 text-center">Todo el inventario está por encima del stock mínimo.</p>
                            ) : (
                                <div className="overflow-x-auto max-h-[380px]">
                                    <table className="w-full text-xs text-left">
                                        <thead className="sticky top-0 bg-slate-900 text-white uppercase text-[10px]">
                                            <tr>
                                                <th className="py-2.5 px-3">Artículo</th>
                                                <th className="py-2.5 px-2 text-center">Actual</th>
                                                <th className="py-2.5 px-2 text-center">Mínimo</th>
                                                <th className="py-2.5 px-2">Proveedor</th>
                                                <th className="py-2.5 px-2 text-center">Estado</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {rep.inventario.bajoStock.map((b, idx) => (
                                                <tr key={b.nombre + idx} className="hover:bg-amber-50/40">
                                                    <td className="py-2.5 px-3 font-bold text-slate-800">{b.nombre}</td>
                                                    <td className="py-2.5 px-2 text-center font-black text-rose-600">{b.stock} {b.unidad}</td>
                                                    <td className="py-2.5 px-2 text-center text-slate-500">{b.stockMinimo} {b.unidad}</td>
                                                    <td className="py-2.5 px-2 text-slate-600">{b.proveedor || '—'}</td>
                                                    <td className="py-2.5 px-2 text-center">
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                                                            b.agotado ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                                                        }`}>
                                                            {b.agotado ? 'AGOTADO' : 'BAJO'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
                            <h3 className="text-base font-black text-slate-800 mb-4 flex items-center gap-2">
                                <Package className="text-emerald-600" size={20} />
                                Margen y Rentabilidad por Producto (Precio − Costo)
                            </h3>
                            {rep.inventario.productos.length === 0 ? (
                                <p className="text-sm text-slate-400 italic py-8 text-center">No hay productos con precio de venta registrado.</p>
                            ) : (
                                <div className="overflow-x-auto max-h-[380px]">
                                    <table className="w-full text-xs text-left">
                                        <thead className="sticky top-0 bg-slate-900 text-white uppercase text-[10px]">
                                            <tr>
                                                <th className="py-2.5 px-3">Producto</th>
                                                <th className="py-2.5 px-2 text-right">Costo</th>
                                                <th className="py-2.5 px-2 text-right">Precio</th>
                                                <th className="py-2.5 px-2 text-right">Margen $</th>
                                                <th className="py-2.5 px-2 text-right">Margen %</th>
                                                <th className="py-2.5 px-2 text-center">Vendidos</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {rep.inventario.productos.map((p, idx) => (
                                                <tr key={p.nombre + idx} className="hover:bg-slate-50">
                                                    <td className="py-2.5 px-3 font-bold text-slate-800">{p.nombre}</td>
                                                    <td className="py-2.5 px-2 text-right text-slate-500">{formatCurrency(p.costo)}</td>
                                                    <td className="py-2.5 px-2 text-right font-bold text-slate-800">{formatCurrency(p.precio)}</td>
                                                    <td className="py-2.5 px-2 text-right font-black text-emerald-600">{formatCurrency(p.margen)}</td>
                                                    <td className="py-2.5 px-2 text-right font-bold text-teal-700">{formatPct(p.margenPct)}</td>
                                                    <td className="py-2.5 px-2 text-center font-bold text-indigo-600">{p.unidadesVendidas}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ── MODAL DE EDICIÓN RÁPIDA DE SERVICIO PARA EL PLAN DIARIO ── */}
            <Modal
                isOpen={Boolean(servEditModal)}
                onClose={() => setServEditModal(null)}
                title={servEditModal ? `Configurar Servicio: ${servEditModal.nombre}` : 'Configurar Servicio'}
                maxWidth="max-w-lg"
                footer={
                    <>
                        <Button variant="outline" onClick={() => setServEditModal(null)}>
                            Cancelar
                        </Button>
                        <Button variant="primary" onClick={handleGuardarServicioPlan} disabled={savingServ}>
                            {savingServ ? 'Guardando...' : 'Guardar Cambios'}
                        </Button>
                    </>
                }
            >
                {servEditModal && (
                    <div className="space-y-4 text-xs">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="font-bold text-slate-600 block mb-1">Precio de Venta ($)</label>
                                <input
                                    type="number"
                                    value={servEditModal.precio}
                                    onChange={(e) => setServEditModal((p) => ({ ...p, precio: e.target.value }))}
                                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-black text-slate-800 outline-none focus:border-turquesa"
                                />
                            </div>
                            <div>
                                <label className="font-bold text-slate-600 block mb-1">Costo Producto / Insumo ($)</label>
                                <input
                                    type="number"
                                    value={servEditModal.costoInsumos}
                                    onChange={(e) => setServEditModal((p) => ({ ...p, costoInsumos: e.target.value }))}
                                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold text-slate-800 outline-none focus:border-turquesa"
                                />
                            </div>
                            <div>
                                <label className="font-bold text-slate-600 block mb-1">% Comisión Especialista</label>
                                <input
                                    type="number"
                                    value={servEditModal.comisionPct}
                                    onChange={(e) => setServEditModal((p) => ({ ...p, comisionPct: e.target.value }))}
                                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold text-slate-800 outline-none focus:border-turquesa"
                                />
                            </div>
                            <div>
                                <label className="font-bold text-slate-600 block mb-1">Duración en Cabina (min)</label>
                                <input
                                    type="number"
                                    value={servEditModal.duracionMin}
                                    onChange={(e) => setServEditModal((p) => ({ ...p, duracionMin: e.target.value }))}
                                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold text-slate-800 outline-none focus:border-turquesa"
                                />
                            </div>
                            <div>
                                <label className="font-bold text-slate-600 block mb-1">Prioridad en el Plan Diario</label>
                                <select
                                    value={servEditModal.prioridadPlan || 'media'}
                                    onChange={(e) => setServEditModal((p) => ({ ...p, prioridadPlan: e.target.value }))}
                                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold text-slate-800 outline-none focus:border-turquesa"
                                >
                                    <option value="alta">⭐ Alta (Servicio Estrella)</option>
                                    <option value="media">Regular (Rotación normal)</option>
                                    <option value="baja">Complementario</option>
                                </select>
                            </div>
                            <div>
                                <label className="font-bold text-slate-600 block mb-1">Meta Diaria Fija (0 = Auto)</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={servEditModal.metaDiariaManual || 0}
                                    onChange={(e) => setServEditModal((p) => ({ ...p, metaDiariaManual: e.target.value }))}
                                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold text-slate-800 outline-none focus:border-turquesa"
                                />
                            </div>
                        </div>
                    </div>
                )}
            </Modal>

            {/* ── MODAL DE CONFIGURACIÓN DE GASTOS FIJOS, NÓMINA PROMEDIO, BOLSAS Y METAS ── */}
            <Modal
                isOpen={modalConfig}
                onClose={() => setModalConfig(false)}
                title="Configurar Punto de Equilibrio, Bolsas, Plan Mensual y Horarios"
                maxWidth="max-w-3xl"
                footer={
                    <>
                        <Button variant="outline" onClick={() => setModalConfig(false)}>
                            Cancelar
                        </Button>
                        <Button variant="primary" onClick={handleGuardarConfig} disabled={savingConfig}>
                            {savingConfig ? 'Guardando...' : 'Guardar Parámetros'}
                        </Button>
                    </>
                }
            >
                <div className="space-y-5 text-xs">
                    {/* Resumen en vivo de la configuración */}
                    <div className="p-4 rounded-2xl bg-slate-900 text-white grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div>
                            <span className="text-[10px] font-bold uppercase text-slate-400 block">Gastos Fijos (Renta/Luz/Int)</span>
                            <strong className="text-base font-black text-white">{formatCurrency(previewConfig.sumaFijos)}/mes</strong>
                        </div>
                        <div>
                            <span className="text-[10px] font-bold uppercase text-slate-400 block">Nómina + Bolsas</span>
                            <strong className="text-base font-black text-teal-300">
                                {formatCurrency(previewConfig.nominaEfectiva + previewConfig.bolsaProdEfectiva + previewConfig.bolsaEquipo)}/mes
                            </strong>
                        </div>
                        <div>
                            <span className="text-[10px] font-bold uppercase text-slate-400 block">Meta Mensual Total</span>
                            <strong className="text-base font-black text-emerald-400">{formatCurrency(previewConfig.metaTotal)}/mes</strong>
                        </div>
                        <div>
                            <span className="text-[10px] font-bold uppercase text-turquesa block">Meta Diaria ({previewConfig.diasLab}d lab.)</span>
                            <strong className="text-base font-black text-turquesa">{formatCurrency(previewConfig.metaDiaria)}/día</strong>
                        </div>
                    </div>

                    {/* 1. DESGLOSE DE GASTOS FIJOS MENSUALES: RENTA, LUZ, INTERNET, AGUA, OTROS */}
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                        <div className="flex items-center justify-between">
                            <h4 className="font-black text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                                <Building2 size={15} className="text-turquesa" />
                                1. Gastos Fijos Mensuales del Local (Renta, Luz, Internet)
                            </h4>
                            <span className="px-2.5 py-0.5 rounded-full bg-white border border-slate-200 font-black text-slate-800">
                                Subtotal: {formatCurrency(previewConfig.sumaFijos)} / mes
                            </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                            <div>
                                <label className="font-bold text-slate-600 block mb-1">Renta ($/mes)</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={formConfig.gastoRenta}
                                    onChange={(e) => setFormConfig((p) => ({ ...p, gastoRenta: e.target.value }))}
                                    placeholder="Ej. 12000"
                                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-black text-slate-800 outline-none focus:border-turquesa"
                                />
                            </div>
                            <div>
                                <label className="font-bold text-slate-600 block mb-1">Luz / CFE ($/mes)</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={formConfig.gastoLuz}
                                    onChange={(e) => setFormConfig((p) => ({ ...p, gastoLuz: e.target.value }))}
                                    placeholder="Ej. 2500"
                                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-black text-slate-800 outline-none focus:border-turquesa"
                                />
                            </div>
                            <div>
                                <label className="font-bold text-slate-600 block mb-1">Internet y Tel. ($/mes)</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={formConfig.gastoInternet}
                                    onChange={(e) => setFormConfig((p) => ({ ...p, gastoInternet: e.target.value }))}
                                    placeholder="Ej. 899"
                                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-black text-slate-800 outline-none focus:border-turquesa"
                                />
                            </div>
                            <div>
                                <label className="font-bold text-slate-600 block mb-1">Agua ($/mes)</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={formConfig.gastoAgua}
                                    onChange={(e) => setFormConfig((p) => ({ ...p, gastoAgua: e.target.value }))}
                                    placeholder="Ej. 450"
                                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-black text-slate-800 outline-none focus:border-turquesa"
                                />
                            </div>
                            <div>
                                <label className="font-bold text-slate-600 block mb-1">Otros Fijos ($/mes)</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={formConfig.gastoOtrosFijos}
                                    onChange={(e) => setFormConfig((p) => ({ ...p, gastoOtrosFijos: e.target.value }))}
                                    placeholder="Contador, sist., etc."
                                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-black text-slate-800 outline-none focus:border-turquesa"
                                />
                            </div>
                        </div>
                    </div>

                    {/* 2. PROMEDIO DE NÓMINAS PARA ESTIMADO MENSUAL */}
                    <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/80 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                                <h4 className="font-black text-amber-950 uppercase tracking-wider text-[11px]">
                                    2. Estimado de Nóminas Mensual (Promedio Automático de tus Nóminas)
                                </h4>
                                <p className="text-[11px] text-amber-800">
                                    Promedio detectado en Finanzas: <strong>{formatCurrency(eq.nominaPromedioAuto)} / mes</strong> (~{formatCurrency(eq.nominaSemanalAuto)} / semana)
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setFormConfig((p) => ({ ...p, nominaMensualEstimada: 0 }))}
                                className="px-3 py-1 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 font-black text-[11px]"
                            >
                                Usar promedio automático ({formatCurrency(eq.nominaPromedioAuto)})
                            </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                            <div>
                                <label className="font-bold text-slate-700 block mb-1">
                                    Nómina Mensual Estimada ($ MXN) <span className="text-slate-400 font-normal">(0 = usar promedio automático)</span>
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    value={formConfig.nominaMensualEstimada}
                                    onChange={(e) => setFormConfig((p) => ({ ...p, nominaMensualEstimada: e.target.value }))}
                                    placeholder={`0 = Automático (${formatCurrency(eq.nominaPromedioAuto)}/mes)`}
                                    className="w-full px-3 py-2 rounded-xl border border-amber-200 bg-white font-black text-slate-800 outline-none focus:border-amber-500"
                                />
                            </div>
                            <div className="text-[11px] text-slate-600 bg-white/80 p-2.5 rounded-xl border border-amber-100">
                                {Number(formConfig.nominaMensualEstimada) > 0 ? (
                                    <span>Usando estimado manual de <strong>{formatCurrency(formConfig.nominaMensualEstimada)}/mes</strong> ({formatCurrency(Number(formConfig.nominaMensualEstimada) / previewConfig.diasLab)}/día).</span>
                                ) : (
                                    <span>Usando promedio automático de tus nóminas pagadas: <strong>{formatCurrency(eq.nominaPromedioAuto)}/mes</strong> ({formatCurrency(eq.nominaPromedioAuto / previewConfig.diasLab)}/día).</span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* 3. BOLSAS DE PROVISIÓN: PRODUCTO PARA TRATAMIENTOS Y COMPRA DE EQUIPO */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Bolsa Producto */}
                        <div className="p-4 rounded-2xl bg-teal-50/60 border border-teal-200/80 space-y-2.5">
                            <div className="flex items-center justify-between">
                                <h4 className="font-black text-teal-950 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                                    <ShoppingBag size={14} className="text-teal-600" />
                                    3A. Bolsa para Producto (Tratamientos)
                                </h4>
                            </div>
                            <p className="text-[11px] text-teal-800">
                                Apartado mensual para reponer producto e insumos de cabina. (Promedio histórico: <strong>{formatCurrency(eq.insumosPromedioAuto)}/mes</strong>).
                            </p>
                            <div>
                                <label className="font-bold text-slate-700 block mb-1">Provisión Mensual Producto ($ MXN)</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={formConfig.provisionProductoMensual}
                                    onChange={(e) => setFormConfig((p) => ({ ...p, provisionProductoMensual: e.target.value }))}
                                    placeholder={`0 = Automático (${formatCurrency(eq.insumosPromedioAuto)}/mes)`}
                                    className="w-full px-3 py-2 rounded-xl border border-teal-200 bg-white font-black text-slate-800 outline-none focus:border-turquesa"
                                />
                                <span className="text-[10px] text-teal-700 font-bold block mt-1">
                                    Representa apartar {formatCurrency(previewConfig.bolsaProdEfectiva / previewConfig.diasLab)} por día laboral.
                                </span>
                            </div>
                        </div>

                        {/* Bolsa Equipo */}
                        <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-200/80 space-y-2.5">
                            <div className="flex items-center justify-between">
                                <h4 className="font-black text-indigo-950 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                                    <Cpu size={14} className="text-indigo-600" />
                                    3B. Bolsa para Comprar Equipo
                                </h4>
                                {previewConfig.mesesEquipo && (
                                    <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-black text-[10px]">
                                        Lo reúnes en {previewConfig.mesesEquipo} meses
                                    </span>
                                )}
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="font-bold text-slate-700 block mb-1">Ahorro Mensual ($)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={formConfig.provisionEquipoMensual}
                                        onChange={(e) => setFormConfig((p) => ({ ...p, provisionEquipoMensual: e.target.value }))}
                                        placeholder="Ej. 5000"
                                        className="w-full px-3 py-2 rounded-xl border border-indigo-200 bg-white font-black text-slate-800 outline-none focus:border-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="font-bold text-slate-700 block mb-1">Costo Equipo Meta ($)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={formConfig.costoEquipoMeta}
                                        onChange={(e) => setFormConfig((p) => ({ ...p, costoEquipoMeta: e.target.value }))}
                                        placeholder="Ej. 45000"
                                        className="w-full px-3 py-2 rounded-xl border border-indigo-200 bg-white font-bold text-slate-800 outline-none focus:border-indigo-500"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="font-bold text-slate-700 block mb-1">Nombre del Equipo a Comprar / Renovar</label>
                                <input
                                    type="text"
                                    value={formConfig.nombreEquipoMeta || ''}
                                    onChange={(e) => setFormConfig((p) => ({ ...p, nombreEquipoMeta: e.target.value }))}
                                    placeholder="Ej. Aparatología Corporal / Hydrafacial"
                                    className="w-full px-3 py-1.5 rounded-xl border border-indigo-200 bg-white font-bold text-slate-800 outline-none focus:border-indigo-500"
                                />
                            </div>
                        </div>
                    </div>

                    {/* 4. UTILIDAD DESEADA MENSUAL Y UMBRALES */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                            <label className="font-bold text-slate-700 block mb-1">Utilidad Libre Deseada ($/mes)</label>
                            <input
                                type="number"
                                min="0"
                                value={formConfig.utilidadDeseadaMensual}
                                onChange={(e) => setFormConfig((p) => ({ ...p, utilidadDeseadaMensual: e.target.value }))}
                                placeholder="Ganancia libre deseada"
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 font-black text-emerald-700 outline-none focus:border-turquesa"
                            />
                            <span className="text-[10px] text-slate-400">Ganancia libre adicional a fijos, nómina y bolsas.</span>
                        </div>
                        <div>
                            <label className="font-bold text-slate-700 block mb-1">Días para Paciente en Riesgo</label>
                            <input
                                type="number"
                                value={formConfig.diasRiesgo}
                                onChange={(e) => setFormConfig((p) => ({ ...p, diasRiesgo: e.target.value }))}
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold text-slate-800 outline-none focus:border-turquesa"
                            />
                        </div>
                        <div>
                            <label className="font-bold text-slate-700 block mb-1">Días para Plan Atrasado</label>
                            <input
                                type="number"
                                value={formConfig.diasAtrasoPlan}
                                onChange={(e) => setFormConfig((p) => ({ ...p, diasAtrasoPlan: e.target.value }))}
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold text-slate-800 outline-none focus:border-turquesa"
                            />
                        </div>
                    </div>

                    {/* 5. HORARIO LABORAL */}
                    <div className="pt-3 border-t border-slate-100">
                        <label className="font-black text-slate-700 uppercase tracking-wider text-[10px] block mb-2">
                            Horario Laboral por Día (Determina los días laborales del mes y el % de Ocupación de Agenda)
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {[
                                { d: 1, n: 'Lunes' },
                                { d: 2, n: 'Martes' },
                                { d: 3, n: 'Miércoles' },
                                { d: 4, n: 'Jueves' },
                                { d: 5, n: 'Viernes' },
                                { d: 6, n: 'Sábado' },
                                { d: 0, n: 'Domingo' },
                            ].map(({ d, n }) => {
                                const h = formConfig.horario?.[d];
                                const abierto = Array.isArray(h) && h.length === 2;
                                return (
                                    <div key={d} className="flex items-center justify-between gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
                                        <label className="flex items-center gap-1.5 font-bold text-slate-700 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={abierto}
                                                onChange={(e) => {
                                                    const next = e.target.checked ? [9, 19] : null;
                                                    setFormConfig((prev) => ({
                                                        ...prev,
                                                        horario: { ...(prev.horario || {}), [d]: next },
                                                    }));
                                                }}
                                            />
                                            <span>{n}</span>
                                        </label>
                                        {abierto ? (
                                            <div className="flex items-center gap-1 text-[11px]">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="23"
                                                    value={h[0]}
                                                    onChange={(e) => {
                                                        const v = Number(e.target.value);
                                                        setFormConfig((prev) => ({
                                                            ...prev,
                                                            horario: { ...(prev.horario || {}), [d]: [v, h[1]] },
                                                        }));
                                                    }}
                                                    className="w-11 px-1 py-0.5 text-center rounded border border-slate-200 font-bold"
                                                />
                                                <span>a</span>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max="24"
                                                    value={h[1]}
                                                    onChange={(e) => {
                                                        const v = Number(e.target.value);
                                                        setFormConfig((prev) => ({
                                                            ...prev,
                                                            horario: { ...(prev.horario || {}), [d]: [h[0], v] },
                                                        }));
                                                    }}
                                                    className="w-11 px-1 py-0.5 text-center rounded border border-slate-200 font-bold"
                                                />
                                                <span>h</span>
                                            </div>
                                        ) : (
                                            <span className="text-[10px] font-bold text-slate-400">Cerrado</span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
