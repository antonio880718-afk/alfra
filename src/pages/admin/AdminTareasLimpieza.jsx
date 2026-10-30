import React, { useState, useEffect } from 'react';
import {
    ClipboardList, Plus, CheckCircle, Clock, Package, Wrench, Send, X,
    AlertCircle, Sparkles, Check, Download, FileText, Calendar, Camera,
    Eye, ShieldCheck, UserCheck, RefreshCw, Filter, Search, ChevronRight,
    ThumbsUp, AlertTriangle, Printer, SlidersHorizontal
} from 'lucide-react';
import { getAuth } from 'firebase/auth';
import {
    ESPACIOS_CLINICA, onEspaciosClinicaChange, onBitacoraChange, getBitacoraDelDia,
    getBitacoraDiaGeneral, onBitacoraDiaGeneralChange, sellarBitacoraDiaSupervisor,
    crearTareaExtra, onTodasTareasExtraChange, aprobarTareaExtra, solicitarCorreccionTareaExtra,
    getReportesMantenimiento, updateReporteEstado, onReportesMantenimientoChange,
    getSolicitudesInsumos, updateSolicitudEstado, onSolicitudesChange,
    onHistorialBitacoraChange, getBitacorasDelMes, guardarFotoEvidenciaEspacio,
    getConfiguracionFirmas
} from '../../services/limpiezaService';
import { getStaff } from '../../services/staffService';
import {
    generarBitacoraDiaPDF,
    generarConcentradoMensualCOFEPRIS,
    generarBitacoraMantenimientoPDF
} from '../../services/limpiezaPdfService';
import AdminConfiguracionEspacios from '../../components/limpieza/AdminConfiguracionEspacios';
import ModalConfigurarFirmasPDF from '../../components/limpieza/ModalConfigurarFirmasPDF';

const auth = getAuth();
const getLocalDateString = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};
const HOY = getLocalDateString();

export default function AdminTareasLimpieza() {
    const user = auth.currentUser;
    const [activeTab, setActiveTab] = useState('tareas'); // 'tareas' | 'bitacora' | 'mantenimiento' | 'insumos' | 'historial'
    const [selectedDate, setSelectedDate] = useState(HOY);
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

    // Data States
    const [tareasExtra, setTareasExtra] = useState([]);
    const [bitacoraItems, setBitacoraItems] = useState([]);
    const [bitacoraDia, setBitacoraDia] = useState(null);
    const [reportesMantenimiento, setReportesMantenimiento] = useState([]);
    const [solicitudesInsumos, setSolicitudesInsumos] = useState([]);
    const [historialBitacora, setHistorialBitacora] = useState([]);
    const [staffList, setStaffList] = useState([]);
    const [espacios, setEspacios] = useState(ESPACIOS_CLINICA);

    // Modals & UI States
    const [showModalNuevaTarea, setShowModalNuevaTarea] = useState(false);
    const [modalFoto, setModalFoto] = useState(null);
    const [modalSellarDia, setModalSellarDia] = useState(false);
    const [modalDetalleReporte, setModalDetalleReporte] = useState(null);
    const [filtroTareas, setFiltroTareas] = useState('todas'); // 'todas' | 'por_revisar' | 'pendientes' | 'aprobadas'
    const [exportando, setExportando] = useState(false);
    const [modalConfigFirmas, setModalConfigFirmas] = useState(null); // null | { tipo: 'dia' | 'mensual' | 'mantenimiento' }
    const [toastMsg, setToastMsg] = useState('');

    // ============ CARGA INICIAL Y LISTENERS ============
    useEffect(() => {
        getStaff().then(setStaffList).catch(console.error);
        const unsubEspacios = onEspaciosClinicaChange(setEspacios);
        return () => unsubEspacios();
    }, []);

    useEffect(() => {
        const unsubBitacora = onBitacoraChange(selectedDate, setBitacoraItems);
        const unsubDia = onBitacoraDiaGeneralChange(selectedDate, setBitacoraDia);
        const unsubTareas = onTodasTareasExtraChange(setTareasExtra);
        const unsubMantenimiento = onReportesMantenimientoChange(setReportesMantenimiento);
        const unsubSolicitudes = onSolicitudesChange(setSolicitudesInsumos);
        const unsubHistorial = onHistorialBitacoraChange(setHistorialBitacora);

        return () => {
            unsubBitacora();
            unsubDia();
            unsubTareas();
            unsubMantenimiento();
            unsubSolicitudes();
            unsubHistorial();
        };
    }, [selectedDate]);

    const mostrarToast = (msg) => {
        setToastMsg(msg);
        setTimeout(() => setToastMsg(''), 4000);
    };

    // Cálculos de métricas
    const espaciosCompletados = bitacoraItems.filter(b => b.completado).map(b => b.espacioId);
    const espaciosConEvidencia = bitacoraItems.filter(b => b.fotosEvidencia && b.fotosEvidencia.length > 0).map(b => b.espacioId);
    const porcentajeAseo = espacios.length > 0 ? Math.round((espaciosCompletados.length / espacios.length) * 100) : 0;
    const espaciosFaltantesEvidencia = espacios.filter(e => {
        const reg = bitacoraItems.find(b => b.espacioId === e.id);
        return !reg?.fotosEvidencia || reg.fotosEvidencia.length === 0;
    });
    const tareasPorRevisar = tareasExtra.filter(t => t.estado === 'por_revisar');
    const tareasPendientes = tareasExtra.filter(t => t.estado === 'pendiente');
    const mantenimientoPendiente = reportesMantenimiento.filter(r => r.estado === 'pendiente');
    const insumosPendientes = solicitudesInsumos.filter(s => s.estado === 'pendiente');

    // ============ EXPORTADORES PDF COFEPRIS ============
    const handleExportarDiaPDF = () => {
        setModalConfigFirmas({ tipo: 'dia' });
    };

    const handleExportarMensualPDF = () => {
        setModalConfigFirmas({ tipo: 'mensual' });
    };

    const handleExportarMantenimientoPDF = () => {
        setModalConfigFirmas({ tipo: 'mantenimiento' });
    };

    const ejecutarGeneracionPDF = async (firmas) => {
        if (!modalConfigFirmas) return;
        setExportando(true);
        try {
            if (modalConfigFirmas.tipo === 'dia') {
                const tareasDelDia = tareasExtra.filter(t => t.fechaProgramada === selectedDate || t.fechaLimite === selectedDate);
                await generarBitacoraDiaPDF({
                    fecha: selectedDate,
                    bitacoraDoc: bitacoraDia || {},
                    espacios: espacios,
                    bitacoraItems,
                    tareasExtra: tareasDelDia,
                    firmas
                });
                mostrarToast('📄 PDF Diario COFEPRIS generado con logotipo y firmas');
            } else if (modalConfigFirmas.tipo === 'mensual') {
                const bitacorasMes = await getBitacorasDelMes(selectedYear, selectedMonth);
                await generarConcentradoMensualCOFEPRIS({
                    anio: selectedYear,
                    mes: selectedMonth,
                    bitacorasMes,
                    firmas
                });
                mostrarToast('📄 Concentrado Mensual COFEPRIS generado exitosamente');
            } else if (modalConfigFirmas.tipo === 'mantenimiento') {
                await generarBitacoraMantenimientoPDF({
                    reportes: reportesMantenimiento,
                    anio: selectedYear,
                    mes: selectedMonth,
                    firmas
                });
                mostrarToast('🔧 Bitácora de Mantenimiento generada exitosamente');
            }
            setModalConfigFirmas(null);
        } catch (e) {
            console.error(e);
            alert('Error al generar el reporte PDF');
        } finally {
            setExportando(false);
        }
    };

    // ============ ACCIONES DE TAREAS EXTRA ============
    const handleAprobarTarea = async (tareaId) => {
        const nota = prompt('Nota o felicitación al personal (opcional):', 'Excelente trabajo y evidencia completa.') || '';
        try {
            await aprobarTareaExtra(tareaId, {
                notasAdmin: nota,
                aprobadoPor: user?.displayName || user?.email || 'Administración'
            });
            mostrarToast('✅ Tarea aprobada satisfactoriamente');
        } catch (e) {
            console.error(e);
            alert('Error al aprobar tarea');
        }
    };

    const handleRechazarTarea = async (tareaId) => {
        const motivo = prompt('Motivo de corrección o qué faltó corregir:', 'Falta desinfectar la parte superior / repetir limpieza.');
        if (!motivo) return;
        try {
            await solicitarCorreccionTareaExtra(tareaId, { notasAdmin: motivo });
            mostrarToast('🔄 Corrección solicitada al personal');
        } catch (e) {
            console.error(e);
            alert('Error al solicitar corrección');
        }
    };

    const handleSellarBitacora = async (datos) => {
        try {
            await sellarBitacoraDiaSupervisor(selectedDate, datos);
            setModalSellarDia(false);
            mostrarToast('✍️ Bitácora del día sellada y validada legalmente');
        } catch (e) {
            console.error(e);
            alert('Error al sellar bitácora');
        }
    };

    const tareasFiltradas = tareasExtra.filter(t => {
        if (filtroTareas === 'por_revisar') return t.estado === 'por_revisar';
        if (filtroTareas === 'pendientes') return t.estado === 'pendiente';
        if (filtroTareas === 'aprobadas') return t.estado === 'aprobada';
        return true;
    });

    const handleSubirFotoEspacioAdmin = async (espacio, e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            await guardarFotoEvidenciaEspacio({
                espacioId: espacio.id,
                nombreEspacio: espacio.nombre,
                fecha: selectedDate,
                file,
                usuarioNombre: 'Supervisión Médica / Admin',
                usuarioUid: auth.currentUser?.uid || ''
            });
            mostrarToast('Evidencia agregada a ' + espacio.nombre);
        } catch (err) {
            console.error('Error al subir evidencia como admin:', err);
            alert('Error al subir foto de evidencia');
        } finally {
            e.target.value = '';
        }
    };

    const tabs = [
        { id: 'tareas', label: 'Tareas Extra', icon: ClipboardList, badge: tareasPorRevisar.length, colorBadge: 'bg-blue-600' },
        { id: 'bitacora', label: 'Aseo Diario', icon: Sparkles, count: `${porcentajeAseo}%` },
        { id: 'configuracion', label: 'Cabinas y Tareas', icon: SlidersHorizontal, count: `${espacios.length} Áreas` },
        { id: 'mantenimiento', label: 'Mantenimiento', icon: Wrench, badge: mantenimientoPendiente.length, colorBadge: 'bg-amber-500' },
        { id: 'insumos', label: 'Insumos', icon: Package, badge: insumosPendientes.length, colorBadge: 'bg-red-500' },
        { id: 'historial', label: 'Concentrado COFEPRIS', icon: ShieldCheck }
    ];

    return (
        <div className="max-w-6xl mx-auto space-y-6 pb-12">
            {/* TOAST FLOTANTE */}
            {toastMsg && (
                <div className="fixed top-5 right-5 z-50 bg-slate-900 text-teal-400 border border-teal-500/40 px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-bounce">
                    <CheckCircle size={20} className="text-teal-400" />
                    <span className="text-sm font-black text-white">{toastMsg}</span>
                </div>
            )}

            {/* HEADER HERO ADMINISTRATIVO */}
            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-slate-700/60">
                <div className="absolute top-0 right-0 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/20 text-teal-300 text-xs font-black uppercase tracking-wider mb-2 border border-teal-500/30">
                            <ShieldCheck size={14} /> Dirección Médica & Supervisión COFEPRIS
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
                            Control Sanitario, Aseo y Mantenimiento
                        </h1>
                        <p className="text-slate-300 text-sm mt-1 max-w-2xl">
                            Asignación de tareas extraordinarias con evidencia fotográfica obligatoria y expedición de bitácoras oficiales bajo la NOM-016-SSA3-2012.
                        </p>
                    </div>

                    {/* BARRA DE DESCARGAS COFEPRIS */}
                    <div className="flex flex-wrap items-center gap-2.5 bg-white/5 p-3 rounded-2xl border border-white/10 backdrop-blur-md">
                        <button
                            onClick={handleExportarDiaPDF}
                            disabled={exportando}
                            className="flex items-center gap-2 px-3.5 py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md active:scale-95 disabled:opacity-50"
                            title="Descargar hoja diaria con fotos para imprimir"
                        >
                            <Download size={14} /> Bitácora del Día (PDF)
                        </button>
                        <button
                            onClick={handleExportarMensualPDF}
                            disabled={exportando}
                            className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-teal-300 border border-teal-500/30 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md active:scale-95 disabled:opacity-50"
                            title="Descargar concentrado mensual tipo sábana para carpeta de inspección"
                        >
                            <Printer size={14} /> Concentrado COFEPRIS
                        </button>
                    </div>
                </div>

                {/* KPI STRIP */}
                <div className="mt-6 pt-6 border-t border-slate-700/60 grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-3.5">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Aseo de Hoy ({selectedDate})</p>
                        <p className="text-xl font-black text-teal-400 mt-1">{porcentajeAseo}% Conforme</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{espaciosCompletados.length} de {espacios.length} Espacios</p>
                    </div>

                    <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-3.5">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Tareas Extra por Validar</p>
                        <p className="text-xl font-black text-blue-400 mt-1">{tareasPorRevisar.length}</p>
                        <p className="text-[10px] text-blue-300/70 mt-0.5">Con evidencia fotográfica</p>
                    </div>

                    <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-3.5">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Averías Pendientes</p>
                        <p className="text-xl font-black text-amber-400 mt-1">{mantenimientoPendiente.length}</p>
                        <p className="text-[10px] text-amber-300/70 mt-0.5">Mantenimiento de clínica</p>
                    </div>

                    <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-3.5">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Validación Sanitaria</p>
                        <p className="text-base font-black mt-1">
                            {bitacoraDia?.supervisorAprobado ? (
                                <span className="text-emerald-400 flex items-center gap-1.5"><ShieldCheck size={16} /> Sellada</span>
                            ) : (
                                <span className="text-amber-400 flex items-center gap-1.5"><Clock size={16} /> Sin sellar</span>
                            )}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Dirección / Responsable</p>
                    </div>
                </div>
            </div>

            {/* BARRA DE NAVEGACIÓN Y SELECTOR DE FECHA */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2.5 px-5 py-3 rounded-2xl font-bold text-sm whitespace-nowrap transition-all ${
                                activeTab === tab.id
                                    ? 'bg-slate-900 text-white shadow-lg scale-[1.02]'
                                    : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200/80 shadow-sm'
                            }`}
                        >
                            <tab.icon size={17} className={activeTab === tab.id ? 'text-teal-400' : 'text-slate-400'} />
                            {tab.label}
                            {tab.badge > 0 && (
                                <span className={`w-5 h-5 ${tab.colorBadge || 'bg-red-500'} text-white text-[10px] font-black rounded-full flex items-center justify-center animate-pulse`}>
                                    {tab.badge}
                                </span>
                            )}
                            {tab.count && (
                                <span className={`text-[10px] px-2 py-0.5 rounded-md font-black ${
                                    activeTab === tab.id ? 'bg-teal-500/20 text-teal-300' : 'bg-slate-100 text-slate-600'
                                }`}>
                                    {tab.count}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* SELECTOR DE FECHA GLOBAL */}
                <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-2xl border border-slate-200 shadow-sm shrink-0">
                    <Calendar size={16} className="text-slate-400" />
                    <span className="text-xs font-bold text-slate-600">Fecha:</span>
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="text-xs font-bold text-slate-800 outline-none bg-transparent cursor-pointer"
                    />
                </div>
            </div>

            {/* PESTAÑA: CONFIGURACIÓN DINÁMICA DE CABINAS Y TAREAS */}
            {activeTab === 'configuracion' && (
                <AdminConfiguracionEspacios mostrarToast={mostrarToast} />
            )}

            {/* ===================== TAB 1: TAREAS EXTRAORDINARIAS ===================== */}
            {activeTab === 'tareas' && (
                <div className="space-y-6">
                    {/* BOTÓN ASIGNAR TAREA EXTRA + FILTROS */}
                    <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <h3 className="font-black text-slate-800 text-base flex items-center gap-2">
                                <ClipboardList size={18} className="text-teal-600" />
                                Tareas Extraordinarias Asignadas por Dirección
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Asigna labores profundas, limpiezas especiales o mantenimientos con foto de evidencia obligatoria.
                            </p>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setShowModalNuevaTarea(true)}
                                className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md transition-all active:scale-95"
                            >
                                <Plus size={16} className="text-teal-400" /> Asignar Tarea Extra
                            </button>
                        </div>
                    </div>

                    {/* FILTROS DE ESTADO */}
                    <div className="flex gap-2 overflow-x-auto pb-1">
                        {[
                            { id: 'todas', label: 'Todas las Tareas', count: tareasExtra.length },
                            { id: 'por_revisar', label: '📷 Por Validar (Con Evidencia)', count: tareasPorRevisar.length, color: 'text-blue-600' },
                            { id: 'pendientes', label: 'Pendientes', count: tareasPendientes.length },
                            { id: 'aprobadas', label: 'Aprobadas', count: tareasExtra.filter(t => t.estado === 'aprobada').length }
                        ].map(f => (
                            <button
                                key={f.id}
                                onClick={() => setFiltroTareas(f.id)}
                                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                                    filtroTareas === f.id
                                        ? 'bg-slate-900 text-white shadow'
                                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                                }`}
                            >
                                {f.label} ({f.count})
                            </button>
                        ))}
                    </div>

                    {/* LISTADO DE TAREAS EXTRA */}
                    {tareasFiltradas.length === 0 ? (
                        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 text-slate-400">
                            <ClipboardList size={40} className="mx-auto mb-3 text-slate-300" />
                            <p className="font-bold text-slate-600">No hay tareas en esta categoría.</p>
                            <p className="text-xs text-slate-400 mt-1">Usa el botón "+ Asignar Tarea Extra" para encargar un trabajo especial.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {tareasFiltradas.map((tarea) => {
                                const esPorRevisar = tarea.estado === 'por_revisar';
                                const esAprobada = tarea.estado === 'aprobada';
                                const esPendiente = tarea.estado === 'pendiente';

                                return (
                                    <div
                                        key={tarea.id}
                                        className={`rounded-3xl border p-5 space-y-4 transition-all shadow-sm ${
                                            esPorRevisar
                                                ? 'bg-blue-50/40 border-blue-300 ring-2 ring-blue-500/20'
                                                : esAprobada
                                                    ? 'bg-emerald-50/30 border-emerald-200'
                                                    : 'bg-white border-slate-200'
                                        }`}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h4 className="font-black text-base text-slate-800">{tarea.titulo}</h4>
                                                    {tarea.prioridad === 'urgente' && (
                                                        <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-red-100 text-red-700 rounded-md">
                                                            URGENTE
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-slate-600 mt-1">{tarea.descripcion || 'Sin descripción adicional'}</p>
                                            </div>

                                            <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full border ${
                                                esAprobada
                                                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                                    : esPorRevisar
                                                        ? 'bg-blue-100 text-blue-800 border-blue-300 animate-pulse'
                                                        : 'bg-amber-100 text-amber-800 border-amber-300'
                                            }`}>
                                                {esAprobada ? '✓ Aprobada' : esPorRevisar ? '📷 Por Revisar' : 'Pendiente'}
                                            </span>
                                        </div>

                                        <div className="text-[11px] text-slate-500 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                                            <span>Asignado a: <strong className="text-slate-700">{tarea.asignadoANombre || 'Personal Intendencia'}</strong></span>
                                            <span>Para: {tarea.fechaProgramada || tarea.fechaLimite || 'Hoy'}</span>
                                        </div>

                                        {/* EVIDENCIA FOTOGRÁFICA SUBIDA POR EL OPERADOR */}
                                        {tarea.fotosEvidencia && tarea.fotosEvidencia.length > 0 && (
                                            <div className="bg-white p-3 rounded-2xl border border-slate-200 space-y-2">
                                                <div className="flex items-center justify-between text-xs">
                                                    <span className="font-black text-slate-700 flex items-center gap-1.5">
                                                        <Camera size={14} className="text-blue-600" /> Evidencia Fotográfica Adjunta
                                                    </span>
                                                    <span className="text-[10px] text-slate-400">Clic para ampliar</span>
                                                </div>
                                                <div className="flex gap-2">
                                                    {tarea.fotosEvidencia.map((f, fIdx) => (
                                                        <div
                                                            key={fIdx}
                                                            onClick={() => setModalFoto(f.dataUrl || f.url)}
                                                            className="w-20 h-16 rounded-xl overflow-hidden border border-slate-200 cursor-pointer hover:opacity-90 relative group"
                                                        >
                                                            <img src={f.dataUrl || f.url} alt="Evidencia" className="w-full h-full object-cover" />
                                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                                <Eye size={16} className="text-white" />
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                                {tarea.notasOperador && (
                                                    <p className="text-[11px] text-slate-600 italic bg-slate-50 p-2 rounded-xl">
                                                        "{tarea.notasOperador}"
                                                    </p>
                                                )}
                                            </div>
                                        )}

                                        {/* BOTONES DE VALIDACIÓN PARA EL ADMINISTRADOR */}
                                        {esPorRevisar && (
                                            <div className="flex gap-2 pt-1">
                                                <button
                                                    onClick={() => handleAprobarTarea(tarea.id)}
                                                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md active:scale-95"
                                                >
                                                    <CheckCircle size={15} /> Aprobar Tarea
                                                </button>
                                                <button
                                                    onClick={() => handleRechazarTarea(tarea.id)}
                                                    className="px-3.5 py-2.5 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-xl text-xs font-bold transition-all"
                                                >
                                                    Solicitar Corrección
                                                </button>
                                            </div>
                                        )}

                                        {esAprobada && (
                                            <div className="bg-emerald-50 p-2.5 rounded-xl text-xs text-emerald-800 flex items-center justify-between">
                                                <span className="flex items-center gap-1.5 font-bold">
                                                    <CheckCircle size={15} className="text-emerald-600" /> Aprobada por: {tarea.aprobadoPor || 'Admin'}
                                                </span>
                                                {tarea.notasAdmin && <span className="text-[11px] italic">"{tarea.notasAdmin}"</span>}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* ===================== TAB 2: ASEO DIARIO Y VALIDACIÓN ===================== */}
            {activeTab === 'bitacora' && (
                <div className="space-y-6">
                    {/* TARJETA DE RESUMEN DEL DÍA */}
                    <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                                <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                                    <ShieldCheck size={20} className="text-teal-600" />
                                    Bitácora de Aseo del Día: {selectedDate}
                                </h3>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Horario registrado: <strong>{bitacoraDia?.horaInicio || '08:00'} a {bitacoraDia?.horaFin || '09:15'}</strong> · Operador: <strong>{bitacoraDia?.responsableNombre || 'Personal de Intendencia'}</strong>
                                </p>
                            </div>

                            <div className="flex items-center gap-2">
                                {!bitacoraDia?.supervisorAprobado ? (
                                    <button
                                        onClick={() => setModalSellarDia(true)}
                                        className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-teal-900/20 transition-all active:scale-95"
                                    >
                                        <ShieldCheck size={16} /> Sellar y Validar Bitácora
                                    </button>
                                ) : (
                                    <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-100 text-emerald-800 text-xs font-black border border-emerald-300">
                                        <CheckCircle size={16} /> Sellada por Dirección Médica
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* FOTOS DE EVIDENCIA DEL DÍA */}
                        <div className="pt-2 border-t border-slate-100 space-y-2">
                            <h4 className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                                <Camera size={15} className="text-teal-600" /> Evidencias Fotográficas de la Jornada:
                            </h4>
                            {bitacoraDia?.fotosEvidencia && bitacoraDia.fotosEvidencia.length > 0 ? (
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    {bitacoraDia.fotosEvidencia.map((f, idx) => (
                                        <div
                                            key={idx}
                                            onClick={() => setModalFoto(f.dataUrl || f.url)}
                                            className="group relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 aspect-video shadow-sm cursor-pointer"
                                        >
                                            <img src={f.dataUrl || f.url} alt={`Evidencia ${idx + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                            <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                <Eye size={18} className="text-white" />
                                            </div>
                                            <span className="absolute bottom-1 left-2 text-[9px] font-bold text-white bg-slate-900/70 px-1.5 py-0.5 rounded">
                                                Foto #{idx + 1}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-xs text-slate-400 italic">No se anexaron fotos de evidencia para esta fecha.</p>
                            )}
                        </div>

                        {bitacoraDia?.observaciones && (
                            <div className="bg-slate-50 p-3 rounded-2xl text-xs text-slate-700 border border-slate-100">
                                <strong>Observaciones del operador:</strong> {bitacoraDia.observaciones}
                            </div>
                        )}
                    </div>

                    {/* ALERTA DE EVIDENCIAS FOTOGRÁFICAS PENDIENTES */}
                    {espaciosFaltantesEvidencia.length > 0 && (
                        <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-300 rounded-2xl flex items-start sm:items-center justify-between gap-3 text-xs text-amber-950 shadow-xs">
                            <div className="flex items-start sm:items-center gap-3">
                                <AlertTriangle size={20} className="text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
                                <div>
                                    <p className="font-black text-amber-900">
                                        ⚠️ Evidencia obligatoria pendiente en {espaciosFaltantesEvidencia.length} espacio(s):
                                    </p>
                                    <p className="text-[11px] text-amber-800 font-medium mt-0.5">
                                        {espaciosFaltantesEvidencia.map(e => e.nombre).join(', ')} aún no cuentan con fotografía de evidencia para certificar ante COFEPRIS.
                                    </p>
                                </div>
                            </div>
                            <span className="text-[10px] font-black uppercase bg-amber-200 text-amber-950 px-2.5 py-1 rounded-full border border-amber-300 shrink-0">
                                COFEPRIS NOM-016
                            </span>
                        </div>
                    )}

                    {/* DESGLOSE POR ESPACIO CLÍNICO */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {espacios.map(espacio => {
                            const registro = bitacoraItems.find(b => b.espacioId === espacio.id);
                            const completado = !!registro?.completado;
                            const tareasDetalle = registro?.tareasDetalle || {};
                            const count = Object.keys(tareasDetalle).length;
                            const fotosEspacio = registro?.fotosEvidencia || [];
                            const todasTareasHechas = count === espacio.tareas.length;
                            const tieneFotos = fotosEspacio.length > 0;
                            const faltaEvidencia = todasTareasHechas && !tieneFotos;

                            return (
                                <div key={espacio.id} className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3.5 flex flex-col justify-between">
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-start gap-2">
                                            <div>
                                                <h4 className="font-black text-slate-800 text-sm">{espacio.nombre}</h4>
                                                <span className="text-[10px] font-bold uppercase text-teal-700 bg-teal-50 px-2 py-0.5 rounded">
                                                    {espacio.tipoArea}
                                                </span>
                                            </div>
                                            <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full border ${
                                                completado && tieneFotos
                                                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                                    : faltaEvidencia
                                                        ? 'bg-rose-100 text-rose-800 border-rose-300 animate-pulse'
                                                        : 'bg-slate-100 text-slate-500 border-slate-200'
                                            }`}>
                                                {completado && tieneFotos ? '✓ Conforme & Evidencia OK' : (
                                                    faltaEvidencia
                                                        ? '⚠️ Falta Evidencia Obligatoria'
                                                        : `${count}/${espacio.tareas.length} Tareas`
                                                )}
                                            </span>
                                        </div>

                                        <div className="text-xs text-slate-500 space-y-0.5">
                                            <p><strong>Desinfectante:</strong> {espacio.quimicoSugerido}</p>
                                            <p><strong>Hora:</strong> {registro?.hora || 'Pendiente'}</p>
                                            {registro?.limpiadoPor && (
                                                <p><strong>Responsable:</strong> {registro.limpiadoPor}</p>
                                            )}
                                        </div>

                                        {/* EVIDENCIA FOTOGRÁFICA DE LA CABINA */}
                                        <div className="pt-2.5 border-t border-slate-100 space-y-2">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-1.5">
                                                    <Camera size={13} className="text-teal-600" />
                                                    <span className="text-[11px] font-black text-slate-700">Evidencias Fotográficas ({fotosEspacio.length})</span>
                                                </div>
                                                <label className="cursor-pointer text-[10px] font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 px-2 py-0.5 rounded-lg border border-teal-200/80 transition-all flex items-center gap-1 shadow-xs">
                                                    <Camera size={11} /> + Subir Foto
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        capture="environment"
                                                        onChange={(e) => handleSubirFotoEspacioAdmin(espacio, e)}
                                                        className="hidden"
                                                    />
                                                </label>
                                            </div>

                                            {fotosEspacio.length > 0 ? (
                                                <div className="space-y-2">
                                                    <div className="flex flex-wrap gap-2 pt-0.5">
                                                        {fotosEspacio.map((f, fIdx) => {
                                                            const src = f.dataUrl || f.url;
                                                            return (
                                                                <div
                                                                    key={fIdx}
                                                                    onClick={() => setModalFoto(src)}
                                                                    className="group relative w-14 h-14 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 cursor-pointer shadow-xs hover:border-teal-500 transition-all"
                                                                    title={`Ver evidencia ${fIdx + 1} de ${espacio.nombre}`}
                                                                >
                                                                    <img src={src} alt={`Evidencia ${fIdx + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                                                    <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                                        <Eye size={14} className="text-white drop-shadow" />
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                    <div className="text-[10px] text-emerald-700 font-bold flex items-center gap-1 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200">
                                                        <ShieldCheck size={12} className="text-emerald-600" /> Evidencia fotográfica conforme para COFEPRIS
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-between px-2.5 py-1.5 bg-amber-50 rounded-xl text-[10px] text-amber-800 border border-dashed border-amber-300">
                                                    <span className="font-bold flex items-center gap-1">
                                                        <AlertTriangle size={12} className="text-amber-600" /> Falta foto obligatoria para certificar
                                                    </span>
                                                    <span className="bg-amber-200/80 text-amber-900 font-black px-1.5 py-0.5 rounded text-[9px] uppercase">Requerida</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ===================== TAB 3: MANTENIMIENTO ===================== */}
            {activeTab === 'mantenimiento' && (
                <div className="space-y-6">
                    <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex justify-between items-center">
                        <div>
                            <h3 className="font-black text-slate-800 text-base">Bitácora Oficial de Mantenimiento (NOM-016-SSA3-2012)</h3>
                            <p className="text-xs text-slate-500 mt-0.5">Control de incidencias, reparaciones técnicas y garantías de instalaciones y equipos.</p>
                        </div>
                        <button
                            onClick={handleExportarMantenimientoPDF}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-teal-300 rounded-xl text-xs font-black uppercase tracking-wider"
                        >
                            <Download size={14} /> Exportar Bitácora PDF
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {reportesMantenimiento.map(rep => (
                            <div key={rep.id} className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h4 className="font-black text-sm text-slate-800">{rep.titulo || rep.descripcion}</h4>
                                        <span className="text-[10px] font-bold uppercase text-slate-400">Área: {rep.ubicacion}</span>
                                    </div>
                                    <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full border ${
                                        rep.estado === 'resuelto' 
                                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
                                            : rep.estado === 'en_proceso'
                                                ? 'bg-blue-100 text-blue-800 border-blue-300'
                                                : 'bg-amber-100 text-amber-800 border-amber-300'
                                    }`}>
                                        {rep.estado}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-600">{rep.descripcion}</p>
                                
                                {rep.fotosEvidencia?.[0] && (
                                    <button
                                        onClick={() => setModalFoto(rep.fotosEvidencia[0].dataUrl || rep.fotosEvidencia[0].url)}
                                        className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-600 underline"
                                    >
                                        <Eye size={13} /> Ver foto del desperfecto
                                    </button>
                                )}

                                <div className="border-t border-slate-100 pt-2 flex gap-2">
                                    {rep.estado !== 'resuelto' && (
                                        <button
                                            onClick={async () => {
                                                const tec = prompt('Técnico o proveedor que atendió:', 'Servicio Técnico Especializado') || '';
                                                const costo = prompt('Costo de la reparación en MXN (opcional):', '0') || '0';
                                                await updateReporteEstado(rep.id, 'resuelto', { tecnicoProveedor: tec, costo: Number(costo) });
                                                mostrarToast('Reporte marcado como resuelto');
                                            }}
                                            className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold"
                                        >
                                            Marcar Resuelto
                                        </button>
                                    )}
                                    {rep.estado === 'pendiente' && (
                                        <button
                                            onClick={async () => {
                                                await updateReporteEstado(rep.id, 'en_proceso');
                                                mostrarToast('Reporte marcado en proceso');
                                            }}
                                            className="px-3 py-1.5 bg-blue-100 text-blue-800 rounded-lg text-xs font-bold"
                                        >
                                            En Proceso
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ===================== TAB 4: SOLICITUDES DE INSUMOS ===================== */}
            {activeTab === 'insumos' && (
                <div className="space-y-6">
                    <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
                        <h3 className="font-black text-slate-800 text-base">Solicitudes de Insumos y Químicos</h3>
                        <p className="text-xs text-slate-500 mt-0.5">Pedidos de cloro, sanitizantes, bolsas y consumibles solicitados por el personal.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {solicitudesInsumos.map(sol => (
                            <div key={sol.id} className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h4 className="font-black text-sm text-slate-800">{sol.items?.join(', ') || 'Insumos varios'}</h4>
                                        <p className="text-[10px] text-slate-400">Solicitó: {sol.solicitadoPor}</p>
                                    </div>
                                    <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full border ${
                                        sol.estado === 'comprada' || sol.estado === 'aprobada'
                                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                            : sol.estado === 'rechazada'
                                                ? 'bg-red-100 text-red-800 border-red-300'
                                                : 'bg-amber-100 text-amber-800 border-amber-300'
                                    }`}>
                                        {sol.estado}
                                    </span>
                                </div>
                                {sol.notas && <p className="text-xs text-slate-500 italic">"{sol.notas}"</p>}

                                {sol.estado === 'pendiente' && (
                                    <div className="border-t border-slate-100 pt-2 flex gap-2">
                                        <button
                                            onClick={async () => {
                                                await updateSolicitudEstado(sol.id, 'aprobada', 'Aprobado para compra');
                                                mostrarToast('Solicitud aprobada');
                                            }}
                                            className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold"
                                        >
                                            Aprobar Compra
                                        </button>
                                        <button
                                            onClick={async () => {
                                                await updateSolicitudEstado(sol.id, 'comprada', 'Surtido en clínica');
                                                mostrarToast('Marcado como surtido');
                                            }}
                                            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold"
                                        >
                                            Ya Surtido
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ===================== TAB 5: HISTORIAL Y CONCENTRADO COFEPRIS ===================== */}
            {activeTab === 'historial' && (
                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <h3 className="font-black text-slate-800 text-base flex items-center gap-2">
                                <ShieldCheck size={20} className="text-teal-600" />
                                Concentrado Sanitario Mensual (NOM-016-SSA3-2012)
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Genera la carpeta reglamentaria de verificación de salubridad para el mes seleccionado.
                            </p>
                        </div>

                        <div className="flex items-center gap-3">
                            <select
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                                className="text-xs font-bold p-2.5 rounded-xl border border-slate-200 outline-none"
                            >
                                {['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'].map((m, idx) => (
                                    <option key={idx} value={idx + 1}>{m}</option>
                                ))}
                            </select>

                            <select
                                value={selectedYear}
                                onChange={(e) => setSelectedYear(Number(e.target.value))}
                                className="text-xs font-bold p-2.5 rounded-xl border border-slate-200 outline-none"
                            >
                                <option value={2026}>2026</option>
                                <option value={2025}>2025</option>
                            </select>

                            <button
                                onClick={handleExportarMensualPDF}
                                disabled={exportando}
                                className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md transition-all active:scale-95 disabled:opacity-50"
                            >
                                <Download size={14} /> Exportar Sábana PDF
                            </button>
                        </div>
                    </div>

                    <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 text-xs text-slate-600 space-y-2">
                        <p className="font-bold text-slate-800">📋 Requisitos para la Inspección de COFEPRIS en Físico:</p>
                        <p>1. Mantener el concentrado mensual impreso y firmado al final de cada mes en la carpeta de bioseguridad en recepción.</p>
                        <p>2. Conservar el archivo fotográfico digital de evidencia como respaldo técnico ante auditorías sanitarias.</p>
                        <p>3. Verificar que las diluciones de cuaternario de amonio e hipoclorito de sodio correspondan a las fichas técnicas autorizadas.</p>
                    </div>
                </div>
            )}

            {/* MODAL FOTO FULLSCREEN */}
            {modalFoto && (
                <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
                    <button 
                        onClick={() => setModalFoto(null)}
                        className="absolute top-5 right-5 text-white bg-white/20 hover:bg-white/30 p-2.5 rounded-full transition-all"
                    >
                        <X size={24} />
                    </button>
                    <img 
                        src={modalFoto} 
                        alt="Evidencia Fullscreen"
                        className="max-h-[85vh] max-w-[95vw] object-contain rounded-2xl shadow-2xl" 
                    />
                </div>
            )}

            {/* MODAL CREAR TAREA EXTRAORDINARIA */}
            {showModalNuevaTarea && (
                <ModalCrearTareaExtra
                    staffList={staffList}
                    onClose={() => setShowModalNuevaTarea(false)}
                    onSuccess={(msg) => {
                        setShowModalNuevaTarea(false);
                        mostrarToast(msg);
                    }}
                />
            )}

            {/* MODAL SELLAR DÍA */}
            {/* MODAL SELLAR DÍA */}
            {modalSellarDia && (
                <ModalSellarBitacoraDia
                    fecha={selectedDate}
                    onClose={() => setModalSellarDia(false)}
                    onConfirm={handleSellarBitacora}
                    espaciosFaltantesEvidencia={espaciosFaltantesEvidencia}
                />
            )}

            {/* MODAL CONFIGURACIÓN DE FIRMAS Y DATOS SANITARIOS PDF */}
            <ModalConfigurarFirmasPDF
                isOpen={!!modalConfigFirmas}
                onClose={() => setModalConfigFirmas(null)}
                onGenerarPDF={ejecutarGeneracionPDF}
                tituloReporte={
                    modalConfigFirmas?.tipo === 'dia' ? 'Bitácora Diaria de Aseo Sanitario' :
                    modalConfigFirmas?.tipo === 'mensual' ? 'Concentrado Mensual Sanitario COFEPRIS' :
                    'Bitácora de Mantenimiento Preventivo y Correctivo'
                }
                subtituloReporte={
                    modalConfigFirmas?.tipo === 'dia' ? `Fecha: ${selectedDate} • Supervisión Médica & Auditoría` :
                    modalConfigFirmas?.tipo === 'mensual' ? `Período: ${selectedMonth}/${selectedYear} • Supervisión Médica` :
                    `Período: ${selectedMonth}/${selectedYear} • Auditoría Técnica NOM-016`
                }
                defaultOperador={bitacoraDia?.personal || 'Personal de Intendencia'}
                defaultSupervisor={user?.displayName || 'Dra. Alondra Frausto'}
                mostrarToast={mostrarToast}
            />
        </div>
    );
}

// ===================== SUBCOMPONENTES MODALES =====================
function ModalCrearTareaExtra({ staffList, onClose, onSuccess }) {
    const [titulo, setTitulo] = useState('');
    const [descripcion, setDescripcion] = useState('');
    const [prioridad, setPrioridad] = useState('normal');
    const [fechaProgramada, setFechaProgramada] = useState(HOY);
    const [asignadoA, setAsignadoA] = useState('todos');
    const [guardando, setGuardando] = useState(false);

    const handleGuardar = async () => {
        if (!titulo.trim()) return alert('Escribe el título de la tarea extra');
        setGuardando(true);
        try {
            const staffSel = staffList.find(s => s.id === asignadoA || s.uid === asignadoA);
            const nombreAsignado = asignadoA === 'todos' ? 'Personal General de Intendencia' : (staffSel?.nombre || 'Personal Asignado');

            await crearTareaExtra({
                titulo,
                descripcion,
                prioridad,
                fechaProgramada,
                asignadoA,
                asignadoANombre: nombreAsignado,
                asignadoPor: auth.currentUser?.displayName || auth.currentUser?.email || 'Administración'
            });

            onSuccess('✨ Tarea extraordinaria asignada exitosamente');
        } catch (e) {
            console.error(e);
            alert('Error al crear tarea');
        } finally {
            setGuardando(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
                <div className="flex justify-between items-center">
                    <h3 className="font-black text-slate-800 text-base">Asignar Tarea Extraordinaria</h3>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100 text-slate-400"><X size={18} /></button>
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Título de la Tarea:</label>
                    <input
                        type="text"
                        value={titulo}
                        onChange={(e) => setTitulo(e.target.value)}
                        placeholder="Ej. Limpieza profunda de ventanales exteriores..."
                        className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:border-teal-500 outline-none"
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Instrucciones / Alcance Detallado:</label>
                    <textarea
                        rows={3}
                        value={descripcion}
                        onChange={(e) => setDescripcion(e.target.value)}
                        placeholder="Ej. Utilizar desengrasante en canceles, secar marcos y anexar foto al terminar..."
                        className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:border-teal-500 outline-none"
                    />
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Fecha Programada:</label>
                        <input
                            type="date"
                            value={fechaProgramada}
                            onChange={(e) => setFechaProgramada(e.target.value)}
                            className="w-full text-xs p-2.5 rounded-xl border border-slate-200 outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Prioridad:</label>
                        <select
                            value={prioridad}
                            onChange={(e) => setPrioridad(e.target.value)}
                            className="w-full text-xs p-2.5 rounded-xl border border-slate-200 outline-none"
                        >
                            <option value="normal">Normal</option>
                            <option value="urgente">Urgente</option>
                        </select>
                    </div>
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Asignar a:</label>
                    <select
                        value={asignadoA}
                        onChange={(e) => setAsignadoA(e.target.value)}
                        className="w-full text-xs p-2.5 rounded-xl border border-slate-200 outline-none"
                    >
                        <option value="todos">Personal General de Intendencia / Limpieza</option>
                        {staffList.map(s => (
                            <option key={s.id} value={s.id || s.uid}>{s.nombre} ({s.puesto || 'Staff'})</option>
                        ))}
                    </select>
                </div>
                <div className="flex gap-2 justify-end pt-3">
                    <button onClick={onClose} className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl">Cancelar</button>
                    <button
                        onClick={handleGuardar}
                        disabled={guardando}
                        className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black uppercase tracking-wider rounded-xl disabled:opacity-50"
                    >
                        {guardando ? 'Asignando...' : 'Asignar Tarea'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function ModalSellarBitacoraDia({ fecha, onClose, onConfirm, espaciosFaltantesEvidencia = [] }) {
    const [nombre, setNombre] = useState('Dra. Alondra Frausto');
    const [cedula, setCedula] = useState('CED. PROF. 12849203 SSA');
    const [cargo, setCargo] = useState('Responsable Sanitario / Dirección Médica');
    const [notas, setNotas] = useState('Bitácora verificada y conforme con la NOM-016-SSA3-2012.');

    useEffect(() => {
        getConfiguracionFirmas().then(cfg => {
            if (cfg.supervisorNombre) setNombre(cfg.supervisorNombre);
            if (cfg.supervisorCedula) setCedula(cfg.supervisorCedula);
            if (cfg.supervisorCargo) setCargo(cfg.supervisorCargo);
        }).catch(console.error);
    }, []);

    return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
                <div className="flex justify-between items-center">
                    <h3 className="font-black text-slate-800 text-base flex items-center gap-2">
                        <ShieldCheck size={18} className="text-teal-600" /> Sellar Bitácora Sanitaria ({fecha})
                    </h3>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100 text-slate-400"><X size={18} /></button>
                </div>
                <p className="text-xs text-slate-500">
                    Al sellar la bitácora, certificas legalmente como Responsable Sanitario que se cumplieron los protocolos de limpieza y desinfección de la clínica.
                </p>

                {espaciosFaltantesEvidencia.length > 0 && (
                    <div className="p-3 bg-amber-50 border border-amber-300 rounded-2xl flex items-start gap-2.5 text-xs text-amber-950">
                        <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                        <div>
                            <p className="font-bold">⚠️ Atención: Faltan {espaciosFaltantesEvidencia.length} espacio(s) sin foto obligatoria:</p>
                            <p className="text-[11px] text-amber-800 mt-0.5 font-medium">{espaciosFaltantesEvidencia.map(e => e.nombre).join(', ')}</p>
                            <p className="text-[10px] text-amber-700 mt-1">NOM-016-SSA3-2012 estipula evidencia fotográfica completa para avalar el sellado.</p>
                        </div>
                    </div>
                )}

                <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Responsable Sanitario / Supervisor:</label>
                    <input
                        type="text"
                        value={nombre}
                        onChange={(e) => setNombre(e.target.value)}
                        className="w-full text-xs p-2.5 rounded-xl border border-slate-200 outline-none focus:border-teal-500"
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Cargo Oficial:</label>
                    <input
                        type="text"
                        value={cargo}
                        onChange={(e) => setCargo(e.target.value)}
                        className="w-full text-xs p-2.5 rounded-xl border border-slate-200 outline-none focus:border-teal-500"
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Cédula Profesional SSA:</label>
                    <input
                        type="text"
                        value={cedula}
                        onChange={(e) => setCedula(e.target.value)}
                        className="w-full text-xs p-2.5 rounded-xl border border-slate-200 outline-none focus:border-teal-500"
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Dictamen / Notas de Supervisión:</label>
                    <textarea
                        rows={2}
                        value={notas}
                        onChange={(e) => setNotas(e.target.value)}
                        className="w-full text-xs p-2.5 rounded-xl border border-slate-200 outline-none focus:border-teal-500"
                    />
                </div>
                <div className="flex gap-2 justify-end pt-2">
                    <button onClick={onClose} className="px-4 py-2 text-xs font-bold text-slate-500">Cancelar</button>
                    <button
                        onClick={() => onConfirm({ supervisorNombre: nombre, supervisorCedula: cedula, supervisorCargo: cargo, notas })}
                        className="px-5 py-2.5 bg-gradient-to-r from-teal-600 to-emerald-600 text-white text-xs font-black uppercase rounded-xl shadow-md active:scale-95 transition-all"
                    >
                        Sellar y Validar
                    </button>
                </div>
            </div>
        </div>
    );
}