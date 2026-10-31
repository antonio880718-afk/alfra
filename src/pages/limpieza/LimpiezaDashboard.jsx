import React, { useState, useEffect, useRef } from 'react';
import {
    Sparkles, CheckCircle, Clock, AlertCircle, Wrench, Package, ClipboardList,
    Plus, Trash2, Send, X, Bell, Calendar, Camera, Eye, Check, FileText, Download,
    ShieldCheck, ArrowRight, UserCheck, CheckSquare, UploadCloud, ChevronRight,
    Loader2
} from 'lucide-react';
import { getAuth } from 'firebase/auth';
import { getCitas, crearAlertaPaciente } from '../../services/citasService';
import {
    ESPACIOS_CLINICA, onEspaciosClinicaChange, registrarTareaCompletada, onBitacoraChange,
    marcarEspacioCompletoUnClic, getBitacoraDiaGeneral, onBitacoraDiaGeneralChange,
    guardarBitacoraDiaGeneral, subirFotoEvidencia, guardarFotoEvidenciaEspacio, eliminarFotoEvidenciaEspacio, onTareasChange,
    enviarTareaExtraRevision, crearReporteMantenimiento, onReportesMantenimientoChange,
    crearSolicitudInsumos, onSolicitudesChange
} from '../../services/limpiezaService';
import { generarBitacoraDiaPDF } from '../../services/limpiezaPdfService';
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

export default function LimpiezaDashboard() {
    const user = auth.currentUser;
    const [activeTab, setActiveTab] = useState('bitacora');
    const [selectedDate, setSelectedDate] = useState(HOY);
    const [bitacoraItems, setBitacoraItems] = useState([]);
    const [bitacoraDia, setBitacoraDia] = useState(null);
    const [tareasExtra, setTareasExtra] = useState([]);
    const [reportesMantenimiento, setReportesMantenimiento] = useState([]);
    const [solicitudesInsumos, setSolicitudesInsumos] = useState([]);
    const [espacios, setEspacios] = useState(ESPACIOS_CLINICA);
    
    // UI States
    const [subiendoFoto, setSubiendoFoto] = useState(false);
    const [subiendoEspacioId, setSubiendoEspacioId] = useState(null);
    const [modalFoto, setModalFoto] = useState(null);
    const [modalCompletarTarea, setModalCompletarTarea] = useState(null);
    const [modalNuevoReporte, setModalNuevoReporte] = useState(false);
    const [modalNuevaSolicitud, setModalNuevaSolicitud] = useState(false);
    const [exportandoPdf, setExportandoPdf] = useState(false);
    const [modalConfigFirmas, setModalConfigFirmas] = useState(false);
    const [mensajeExito, setMensajeExito] = useState('');

    const fileInputRef = useRef(null);

    // ============ REAL-TIME LISTENERS ============
    useEffect(() => {
        const unsubEspacios = onEspaciosClinicaChange(setEspacios);
        return () => unsubEspacios();
    }, []);

    useEffect(() => {
        const unsubBitacora = onBitacoraChange(selectedDate, setBitacoraItems);
        const unsubDia = onBitacoraDiaGeneralChange(selectedDate, setBitacoraDia);
        let unsubTareas = () => {};
        if (user?.uid) {
            unsubTareas = onTareasChange(user.uid, setTareasExtra);
        }
        const unsubMantenimiento = onReportesMantenimientoChange(setReportesMantenimiento);
        const unsubSolicitudes = onSolicitudesChange(setSolicitudesInsumos);

        return () => {
            unsubBitacora();
            unsubDia();
            unsubTareas();
            unsubMantenimiento();
            unsubSolicitudes();
        };
    }, [selectedDate, user?.uid]);

    // Resumen de cumplimiento
    const espaciosCompletados = bitacoraItems.filter(b => b.completado).map(b => b.espacioId);
    const porcentajeAseo = espacios.length > 0 ? Math.round((espaciosCompletados.length / espacios.length) * 100) : 0;
    const tareasPendientes = tareasExtra.filter(t => t.estado === 'pendiente');

    // Manejar subida de foto de evidencia general del aseo
    const handleSubirFotoGeneral = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setSubiendoFoto(true);
        try {
            const fotoObj = await subirFotoEvidencia(file, `evidencia_limpieza/${selectedDate}`);
            const fotosActuales = bitacoraDia?.fotosEvidencia || [];
            const nuevasFotos = [...fotosActuales, fotoObj];
            
            await guardarBitacoraDiaGeneral(selectedDate, {
                fotosEvidencia: nuevasFotos,
                responsableNombre: user?.displayName || user?.email || 'Personal de Intendencia',
                responsableUid: user?.uid || ''
            });

            mostrarToast('📷 Foto de evidencia guardada exitosamente');
        } catch (err) {
            console.error('Error al subir foto:', err);
            alert('No se pudo subir la foto. Intenta de nuevo.');
        } finally {
            setSubiendoFoto(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleEliminarFoto = async (idx) => {
        if (!window.confirm('¿Deseas eliminar esta foto de evidencia?')) return;
        const fotosActuales = [...(bitacoraDia?.fotosEvidencia || [])];
        fotosActuales.splice(idx, 1);
        await guardarBitacoraDiaGeneral(selectedDate, { fotosEvidencia: fotosActuales });
        mostrarToast('Foto eliminada');
    };

    const handleSubirFotoEspacio = async (espacio, e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setSubiendoEspacioId(espacio.id);
        try {
            await guardarFotoEvidenciaEspacio({
                espacioId: espacio.id,
                nombreEspacio: espacio.nombre,
                fecha: selectedDate,
                file,
                usuarioNombre: user?.displayName || user?.email || 'Personal de Intendencia',
                usuarioUid: user?.uid || ''
            });
            mostrarToast('Evidencia fotográfica agregada a ' + espacio.nombre);
        } catch (err) {
            console.error('Error al subir evidencia de espacio:', err);
            alert('No se pudo subir la foto de evidencia. Intenta de nuevo.');
        } finally {
            setSubiendoEspacioId(null);
            e.target.value = '';
        }
    };

    const handleEliminarFotoEspacio = async (espacioId, fotoIdx) => {
        if (!window.confirm('¿Deseas eliminar esta foto de evidencia de la cabina?')) return;
        try {
            await eliminarFotoEvidenciaEspacio({
                espacioId,
                fecha: selectedDate,
                fotoIdx
            });
            mostrarToast('Foto eliminada');
        } catch (err) {
            console.error('Error al eliminar foto de espacio:', err);
        }
    };

    const handleMarcarTodoAseo = async () => {
        if (!window.confirm('¿Confirmas que se completó el aseo y desinfección de TODOS los espacios clínicos el día de hoy?')) return;
        try {
            for (const espacio of espacios) {
                await marcarEspacioCompletoUnClic({
                    espacioId: espacio.id,
                    fecha: selectedDate,
                    usuarioNombre: user?.displayName || user?.email || 'Personal de Intendencia',
                    usuarioUid: user?.uid || ''
                });
            }
            mostrarToast('✨ Todos los espacios marcados como completos al 100%');
        } catch (e) {
            console.error(e);
            alert('Error al marcar espacios');
        }
    };

    const handleDescargarPDF = () => {
        setModalConfigFirmas(true);
    };

    const ejecutarDescargaPDF = async (firmas) => {
        setExportandoPdf(true);
        try {
            await generarBitacoraDiaPDF({
                fecha: selectedDate,
                bitacoraDoc: bitacoraDia || {},
                espacios: espacios,
                bitacoraItems,
                tareasExtra: tareasExtra.filter(t => t.fechaProgramada === selectedDate || t.fechaLimite === selectedDate),
                firmas
            });
            mostrarToast('📄 Bitácora PDF generada con logotipo y firmas personalizadas');
        } catch (e) {
            console.error('Error al generar PDF:', e);
            alert('Error al generar el PDF de la bitácora');
        } finally {
            setExportandoPdf(false);
        }
    };

    const mostrarToast = (msg) => {
        setMensajeExito(msg);
        setTimeout(() => setMensajeExito(''), 4000);
    };

    const tabs = [
        { id: 'bitacora', label: 'Bitácora Diaria', icon: Sparkles, count: `${porcentajeAseo}%` },
        { id: 'tareas', label: 'Tareas Extra', icon: ClipboardList, badge: tareasPendientes.length },
        { id: 'mantenimiento', label: 'Mantenimiento', icon: Wrench },
        { id: 'insumos', label: 'Insumos', icon: Package }
    ];

    return (
        <div className="max-w-5xl mx-auto space-y-6 pb-12">
            {/* TOAST FLOTANTE */}
            {mensajeExito && (
                <div className="fixed top-5 right-5 z-50 bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-bounce">
                    <CheckCircle size={20} />
                    <span className="text-sm font-black">{mensajeExito}</span>
                </div>
            )}

            {/* HEADER HERO */}
            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-slate-700/50">
                <div className="absolute top-0 right-0 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/20 text-teal-300 text-xs font-black uppercase tracking-wider mb-2 border border-teal-500/30">
                            <ShieldCheck size={14} /> Protocolo COFEPRIS (NOM-016-SSA3-2012)
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
                            Bitácora de Limpieza y Mantenimiento
                        </h1>
                        <p className="text-slate-300 text-sm mt-1">
                            El aseo de la clínica se ejecuta una vez por día con registro sanitario y evidencia fotográfica obligatoria.
                        </p>
                    </div>

                    {/* SELECTOR DE FECHA & PDF DIRECTO */}
                    <div className="flex flex-wrap items-center gap-3 bg-white/5 p-3 rounded-2xl border border-white/10 backdrop-blur-md">
                        <div className="flex items-center gap-2">
                            <Calendar size={18} className="text-teal-400" />
                            <input 
                                type="date" 
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="bg-slate-900/80 text-white font-bold text-sm px-3 py-2 rounded-xl border border-slate-700 focus:border-teal-400 outline-none"
                            />
                        </div>
                        <button
                            onClick={handleDescargarPDF}
                            disabled={exportandoPdf}
                            className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md active:scale-95 disabled:opacity-50"
                        >
                            <Download size={14} />
                            {exportandoPdf ? 'Exportando...' : 'PDF COFEPRIS'}
                        </button>
                    </div>
                </div>

                {/* BARRA DE PROGRESO DEL DÍA */}
                <div className="mt-6 pt-6 border-t border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex-1">
                        <div className="flex justify-between items-center mb-2 text-xs">
                            <span className="font-bold text-slate-300">Cumplimiento del Aseo Diario ({espaciosCompletados.length} de {espacios.length} Espacios)</span>
                            <span className={`font-black px-2 py-0.5 rounded-full text-[11px] ${porcentajeAseo === 100 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                {porcentajeAseo}% Conforme
                            </span>
                        </div>
                        <div className="h-3 bg-slate-700/60 rounded-full overflow-hidden p-0.5">
                            <div 
                                className={`h-full rounded-full transition-all duration-700 ${porcentajeAseo === 100 ? 'bg-gradient-to-r from-teal-400 to-emerald-400' : 'bg-gradient-to-r from-amber-400 to-teal-400'}`}
                                style={{ width: `${porcentajeAseo}%` }}
                            />
                        </div>
                    </div>

                    {porcentajeAseo < 100 && (
                        <button
                            onClick={handleMarcarTodoAseo}
                            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-teal-900/30 active:scale-95 whitespace-nowrap"
                        >
                            <CheckSquare size={16} /> Marcar Todo Listo (1 Clic)
                        </button>
                    )}
                </div>
            </div>

            {/* ALERTA DE MANTENIMIENTO PREVENTIVO */}
            <div className="bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                        <Wrench size={18} />
                    </div>
                    <div>
                        <span className="font-bold text-sm block text-amber-950 dark:text-amber-100">
                            Protocolo de Mantenimiento Preventivo Programado
                        </span>
                        <span className="text-[11px] text-amber-800 dark:text-amber-300">
                            Supervisi?n de equipos cl?nicos, aires acondicionados y cabinas cada 30 d?as para cumplimiento COFEPRIS.
                        </span>
                    </div>
                </div>
                <button
                    onClick={() => { setActiveTab('mantenimiento'); setModalNuevoReporte(true); }}
                    className="px-3 py-2 bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold rounded-xl text-xs shrink-0 transition flex items-center gap-1.5 shadow-sm"
                >
                    <Wrench size={14} />
                    <span>Registrar Mantenimiento</span>
                </button>
            </div>

            {/* PESTAÑAS DE NAVEGACIÓN */}
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
                            <span className="w-5 h-5 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center animate-pulse">
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

            {/* CONTENIDO SEGÚN PESTAÑA */}
            {activeTab === 'bitacora' && (
                <div className="space-y-6">
                    {/* SECCIÓN DE EVIDENCIA FOTOGRÁFICA DEL ASEO DIARIO */}
                    <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                                <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                                    <Camera size={19} className="text-teal-600" />
                                    Evidencia Fotográfica de la Jornada
                                </h3>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Toma fotos desde el celular o anexa imágenes de cómo quedaron las cabinas y baños al terminar el aseo diario.
                                </p>
                            </div>
                            <div>
                                <input
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    ref={fileInputRef}
                                    onChange={handleSubirFotoGeneral}
                                    className="hidden"
                                    id="inputFotoGeneral"
                                    disabled={subiendoFoto}
                                />
                                <label
                                    htmlFor="inputFotoGeneral"
                                    className={`inline-flex items-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer shadow-md transition-all active:scale-95 ${
                                        subiendoFoto ? 'opacity-50 pointer-events-none' : ''
                                    }`}
                                >
                                    <UploadCloud size={16} />
                                    {subiendoFoto ? 'Comprimiendo y subiendo...' : '📷 Anexar Foto de Evidencia'}
                                </label>
                            </div>
                        </div>

                        {/* GALERÍA DE FOTOS SUBIDAS */}
                        {bitacoraDia?.fotosEvidencia && bitacoraDia.fotosEvidencia.length > 0 ? (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
                                {bitacoraDia.fotosEvidencia.map((foto, idx) => (
                                    <div key={idx} className="group relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 aspect-video shadow-sm">
                                        <img 
                                            src={foto.dataUrl || foto.url} 
                                            alt={`Evidencia ${idx + 1}`}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                        />
                                        <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                            <button
                                                onClick={() => setModalFoto(foto.dataUrl || foto.url)}
                                                className="p-2 bg-white/90 hover:bg-white text-slate-800 rounded-full shadow"
                                                title="Ver pantalla completa"
                                            >
                                                <Eye size={15} />
                                            </button>
                                            <button
                                                onClick={() => handleEliminarFoto(idx)}
                                                className="p-2 bg-red-600/90 hover:bg-red-600 text-white rounded-full shadow"
                                                title="Eliminar foto"
                                            >
                                                <Trash2 size={15} />
                                            </button>
                                        </div>
                                        <span className="absolute bottom-1 left-2 text-[9px] font-bold text-white bg-slate-900/70 px-1.5 py-0.5 rounded">
                                            Foto #{idx + 1}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                <Camera size={32} className="mx-auto text-slate-300 mb-2" />
                                <p className="text-xs font-bold text-slate-600">Aún no hay fotos de evidencia agregadas para hoy.</p>
                                <p className="text-[11px] text-slate-400 mt-0.5">Sube de 1 a 4 fotos para anexarlas al reporte oficial de COFEPRIS.</p>
                            </div>
                        )}

                        {/* OBSERVACIONES Y VALIDACIÓN */}
                        <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row gap-3">
                            <input
                                type="text"
                                defaultValue={bitacoraDia?.observaciones || ''}
                                placeholder="Observaciones o notas del día (ej. 'Se usó desengrasante en piso de cabina 1')..."
                                onBlur={(e) => guardarBitacoraDiaGeneral(selectedDate, { observaciones: e.target.value })}
                                className="flex-1 text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-teal-500 outline-none bg-slate-50/60"
                            />
                            {bitacoraDia?.supervisorAprobado ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-100 text-emerald-800 text-xs font-black">
                                    <ShieldCheck size={16} /> Aprobado por Dirección
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-50 text-amber-700 text-xs font-bold border border-amber-200/80">
                                    <Clock size={15} /> Pendiente de Validación Admin
                                </span>
                            )}
                        </div>
                    </div>

                    {/* GRID DE ESPACIOS CLÍNICOS COFEPRIS */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {espacios.map((espacio) => {
                            const registro = bitacoraItems.find(b => b.espacioId === espacio.id);
                            const completado = !!registro?.completado;
                            const tareasDetalle = registro?.tareasDetalle || {};
                            const tareasCompletadasCount = Object.keys(tareasDetalle).length;
                            const fotosEspacio = registro?.fotosEvidencia || [];
                            const tieneFotos = fotosEspacio.length > 0;
                            const todasTareasListas = espacio.tareas.length > 0 && tareasCompletadasCount >= espacio.tareas.length;

                            return (
                                <div
                                    key={espacio.id}
                                    className={`rounded-3xl border transition-all duration-300 flex flex-col justify-between overflow-hidden shadow-sm hover:shadow-md ${
                                        completado 
                                            ? 'bg-gradient-to-br from-emerald-50/50 via-white to-emerald-50/20 border-emerald-300/80' 
                                            : todasTareasListas && !tieneFotos
                                                ? 'bg-gradient-to-br from-rose-50/30 via-white to-amber-50/20 border-rose-300/80 shadow-rose-100'
                                                : 'bg-white border-slate-200'
                                    }`}
                                >
                                    <div className="p-5 space-y-4">
                                        {/* CABECERA DE LA CABINA / ESPACIO */}
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h4 className="font-black text-base text-slate-800">
                                                        {espacio.nombre}
                                                    </h4>
                                                </div>
                                                <span className="inline-block mt-1 text-[10px] font-black uppercase tracking-wider text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200/60">
                                                    {espacio.tipoArea}
                                                </span>
                                            </div>

                                            <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border transition-all ${
                                                completado
                                                    ? 'bg-emerald-100 border-emerald-300 text-emerald-800'
                                                    : todasTareasListas && !tieneFotos
                                                        ? 'bg-rose-100 border-rose-300 text-rose-800 animate-pulse'
                                                        : tareasCompletadasCount > 0
                                                            ? 'bg-amber-100 border-amber-300 text-amber-800'
                                                            : 'bg-slate-100 border-slate-200 text-slate-500'
                                            }`}>
                                                {completado 
                                                    ? '✓ Completado' 
                                                    : todasTareasListas && !tieneFotos
                                                        ? '⚠️ Falta Foto Obligatoria'
                                                        : `${tareasCompletadasCount}/${espacio.tareas.length} Tareas`}
                                            </span>
                                        </div>

                                        {/* PROTOCOLO QUÍMICO COFEPRIS */}
                                        <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 text-slate-600 text-xs space-y-1">
                                            <p className="font-bold text-[11px] text-slate-700 flex items-center gap-1.5"><Sparkles size={12} className="text-teal-600 inline" /> Químico Sugerido:</p>
                                            <p className="text-[11px] text-slate-500">{espacio.quimicoSugerido}</p>
                                        </div>

                                        {/* LISTA DE TAREAS ESPECÍFICAS */}
                                        <div className="space-y-2 pt-1">
                                            {espacio.tareas.map((tarea, tIdx) => {
                                                const hecha = !!tareasDetalle[tarea];
                                                const horaHecha = tareasDetalle[tarea];

                                                return (
                                                    <div
                                                        key={tIdx}
                                                        onClick={() => registrarTareaCompletada({
                                                            espacioId: espacio.id,
                                                            nombreEspacio: espacio.nombre,
                                                            tareaNombre: tarea,
                                                            usuarioNombre: user?.displayName || user?.email || 'Personal de Intendencia',
                                                            usuarioUid: user?.uid || '',
                                                            fecha: selectedDate
                                                        })}
                                                        className={`flex items-center justify-between p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                                                            hecha
                                                                ? 'bg-emerald-500/10 border-emerald-300/80 text-emerald-950 font-bold'
                                                                : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-2.5">
                                                            <div className={`w-4 h-4 rounded-md flex items-center justify-center border transition-all ${
                                                                hecha ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300 bg-white'
                                                            }`}>
                                                                {hecha && <Check size={12} strokeWidth={3} />}
                                                            </div>
                                                            <span>{tarea}</span>
                                                        </div>
                                                        {hecha && (
                                                            <span className="text-[10px] text-emerald-700 font-bold">{horaHecha}</span>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* SECCIÓN DE EVIDENCIA FOTOGRÁFICA DE LA CABINA (OBLIGATORIA) */}
                                        <div className="pt-3 border-t border-slate-100 space-y-2.5">
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-1.5">
                                                    <Camera size={14} className={tieneFotos ? "text-teal-600" : "text-rose-600"} />
                                                    <span className="text-xs font-black text-slate-700">Evidencia Fotográfica</span>
                                                    {tieneFotos ? (
                                                        <span className="text-[10px] bg-teal-100 text-teal-800 font-black px-1.5 py-0.2 rounded-full border border-teal-200">
                                                            {fotosEspacio.length} {fotosEspacio.length === 1 ? 'foto' : 'fotos'}
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] bg-rose-100 text-rose-800 font-black px-2 py-0.5 rounded-full border border-rose-200 animate-pulse">
                                                            Obligatoria
                                                        </span>
                                                    )}
                                                </div>
                                                <label className={`cursor-pointer inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition-all shadow-xs ${
                                                    subiendoEspacioId === espacio.id
                                                        ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                                                        : tieneFotos
                                                            ? 'bg-teal-50 hover:bg-teal-100 text-teal-700 border-teal-200 active:scale-95'
                                                            : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200 active:scale-95'
                                                }`}>
                                                    {subiendoEspacioId === espacio.id ? (
                                                        <>
                                                            <Loader2 size={12} className="animate-spin text-teal-600" /> Subiendo...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Camera size={13} className={tieneFotos ? "text-teal-600" : "text-rose-600"} /> {tieneFotos ? '+ Anexar Foto' : 'Tomar / Subir Foto'}
                                                        </>
                                                    )}
                                                    <input
                                                        id={`input-foto-espacio-${espacio.id}`}
                                                        type="file"
                                                        accept="image/*"
                                                        capture="environment"
                                                        disabled={subiendoEspacioId === espacio.id}
                                                        onChange={(e) => handleSubirFotoEspacio(espacio, e)}
                                                        className="hidden"
                                                    />
                                                </label>
                                            </div>

                                            {/* MINIATURAS DE FOTOS DE ESTA CABINA */}
                                            {tieneFotos ? (
                                                <div className="flex flex-wrap gap-2 pt-1">
                                                    {fotosEspacio.map((foto, fIdx) => {
                                                        const fotoSrc = foto.dataUrl || foto.url;
                                                        return (
                                                            <div key={fIdx} className="relative group w-16 h-16 rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 shadow-xs">
                                                                <img
                                                                    src={fotoSrc}
                                                                    alt={`Evidencia ${espacio.nombre} #${fIdx + 1}`}
                                                                    className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform"
                                                                    onClick={() => setModalFoto(fotoSrc)}
                                                                />
                                                                <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                                                                    <Eye size={16} className="text-white drop-shadow" />
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    onClick={(ev) => {
                                                                        ev.stopPropagation();
                                                                        handleEliminarFotoEspacio(espacio.id, fIdx);
                                                                    }}
                                                                    className="absolute top-1 right-1 p-1 rounded-full bg-red-600/90 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700 shadow-sm"
                                                                    title="Eliminar foto"
                                                                >
                                                                    <X size={10} />
                                                                </button>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-between px-3 py-2 bg-rose-50/60 border border-dashed border-rose-200 rounded-xl text-[11px] text-rose-700">
                                                    <span>Sin foto anexada a esta ?rea</span>
                                                    <span className="text-[10px] font-black uppercase tracking-wider text-rose-800">Obligatoria COFEPRIS</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* PIE DE CABINA CON VALIDACIÓN ESTRICTA DE EVIDENCIA */}
                                    <div className="p-4 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between gap-3">
                                        <div className="flex flex-col">
                                            <span className="text-[11px] font-bold text-slate-500">
                                                {registro?.hora ? `Concluido: ${registro.hora}` : 'Sin finalizar'}
                                            </span>
                                            {registro?.limpiadoPor && (
                                                <span className="text-[10px] text-slate-400 font-medium truncate max-w-[150px]">
                                                    Por: {registro.limpiadoPor}
                                                </span>
                                            )}
                                        </div>
                                        {!completado ? (
                                            !tieneFotos ? (
                                                <button
                                                    onClick={() => {
                                                        mostrarToast('⚠️ Evidencia obligatoria: Toma o sube al menos una foto de la cabina limpia para poder darla por concluida.');
                                                        const input = document.getElementById(`input-foto-espacio-${espacio.id}`);
                                                        if (input) input.click();
                                                    }}
                                                    className="text-xs font-black text-rose-700 hover:text-rose-900 bg-rose-50 hover:bg-rose-100 px-3.5 py-2 rounded-xl border border-rose-300 shadow-xs transition-all active:scale-95 flex items-center gap-1.5"
                                                    title="Es obligatorio anexar foto para concluir el aseo"
                                                >
                                                    <Camera size={14} className="text-rose-600" /> Tomar Foto Obligatoria
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={async () => {
                                                        try {
                                                            await marcarEspacioCompletoUnClic({
                                                                espacioId: espacio.id,
                                                                fecha: selectedDate,
                                                                usuarioNombre: user?.displayName || user?.email || 'Personal de Intendencia',
                                                                usuarioUid: user?.uid || ''
                                                            });
                                                            mostrarToast(`✓ ${espacio.nombre} completada`);
                                                        } catch (err) {
                                                            if (err.code === 'EVIDENCIA_REQUERIDA') {
                                                                mostrarToast('⚠️ Evidencia obligatoria: Debes tomar una foto antes de completar.');
                                                            } else {
                                                                mostrarToast('Error al marcar cabina');
                                                            }
                                                        }
                                                    }}
                                                    className="text-xs font-black text-teal-700 hover:text-teal-900 bg-teal-50 hover:bg-teal-100 px-3.5 py-2 rounded-xl border border-teal-200 shadow-xs transition-all active:scale-95 flex items-center gap-1.5"
                                                >
                                                    <CheckCircle size={14} className="text-teal-600" /> Marcar Cabina Completa
                                                </button>
                                            )
                                        ) : (
                                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200">
                                                <Check size={13} strokeWidth={3} /> Aseo y Evidencia OK
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {activeTab === 'tareas' && (
                <div className="space-y-5">
                    <div className="bg-amber-500/10 border border-amber-200 rounded-3xl p-5 flex items-start gap-4">
                        <AlertCircle className="text-amber-600 shrink-0 mt-0.5" size={24} />
                        <div>
                            <h3 className="text-sm font-black text-amber-900 uppercase tracking-wide">
                                Tareas Extraordinarias Asignadas por Dirección
                            </h3>
                            <p className="text-xs text-amber-800 mt-1">
                                Cuando el Administrador te asigne una labor profunda o especial, aparecerá aquí. Al terminarla, pulsa <strong>"Realizar y Subir Evidencia"</strong> para adjuntar la fotografía del trabajo terminado.
                            </p>
                        </div>
                    </div>

                    {tareasExtra.length === 0 ? (
                        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 text-slate-400">
                            <ClipboardList size={40} className="mx-auto mb-3 text-slate-300" />
                            <p className="font-bold text-slate-600">No tienes tareas extraordinarias pendientes.</p>
                            <p className="text-xs text-slate-400 mt-1">Las tareas asignadas por el Administrador aparecerán en este panel.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {tareasExtra.map((tarea) => {
                                const esPendiente = tarea.estado === 'pendiente';
                                const esPorRevisar = tarea.estado === 'por_revisar';
                                const esAprobada = tarea.estado === 'aprobada';

                                return (
                                    <div 
                                        key={tarea.id}
                                        className={`rounded-3xl border p-5 space-y-4 transition-all ${
                                            esAprobada 
                                                ? 'bg-emerald-50/30 border-emerald-200' 
                                                : esPorRevisar
                                                    ? 'bg-blue-50/30 border-blue-200'
                                                    : 'bg-white border-slate-200 shadow-sm'
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
                                                <p className="text-xs text-slate-500 mt-1">{tarea.descripcion || 'Sin descripción'}</p>
                                            </div>

                                            <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full border ${
                                                esAprobada
                                                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                                    : esPorRevisar
                                                        ? 'bg-blue-100 text-blue-800 border-blue-300'
                                                        : 'bg-amber-100 text-amber-800 border-amber-300'
                                            }`}>
                                                {esAprobada ? '✓ Aprobada' : esPorRevisar ? 'En Revisión' : 'Pendiente'}
                                            </span>
                                        </div>

                                        <div className="text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-100 pt-3">
                                            <span>Para: {tarea.fechaProgramada || tarea.fechaLimite || 'Hoy'}</span>
                                            <span>Asignó: {tarea.asignadoPor || 'Admin'}</span>
                                        </div>

                                        {/* ACCIONES DE LA TAREA */}
                                        {esPendiente && (
                                            <button
                                                onClick={() => setModalCompletarTarea(tarea)}
                                                className="w-full flex items-center justify-center gap-2 py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md active:scale-95"
                                            >
                                                <Camera size={15} /> Realizar y Subir Evidencia
                                            </button>
                                        )}

                                        {esPorRevisar && (
                                            <div className="bg-blue-50 border border-blue-200 p-3 rounded-2xl text-xs text-blue-900 space-y-2">
                                                <p className="font-bold">📷 Evidencia enviada a Administración.</p>
                                                {tarea.fotosEvidencia?.[0] && (
                                                    <button 
                                                        onClick={() => setModalFoto(tarea.fotosEvidencia[0].dataUrl || tarea.fotosEvidencia[0].url)}
                                                        className="text-[11px] font-bold text-blue-700 underline"
                                                    >
                                                        Ver foto de evidencia adjunta
                                                    </button>
                                                )}
                                            </div>
                                        )}

                                        {esAprobada && (
                                            <div className="text-xs font-bold text-emerald-700 flex items-center gap-2">
                                                <CheckCircle size={16} /> Validada y aprobada por Dirección
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* PESTAÑA: MANTENIMIENTO */}
            {activeTab === 'mantenimiento' && (
                <div className="space-y-6">
                    <div className="flex justify-between items-center bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
                        <div>
                            <h3 className="font-black text-slate-800 text-base">Bitácora de Mantenimiento e Incidencias</h3>
                            <p className="text-xs text-slate-500 mt-0.5">Reporta fugas, fallas eléctricas, desperfectos de clima o mobiliario con foto.</p>
                        </div>
                        <button
                            onClick={() => setModalNuevoReporte(true)}
                            className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black uppercase tracking-wider rounded-2xl shadow-md transition-all active:scale-95"
                        >
                            <Plus size={16} /> Reportar Avería
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {reportesMantenimiento.map(rep => (
                            <div key={rep.id} className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3">
                                <div className="flex justify-between items-start gap-2">
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
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* PESTAÑA: SOLICITUDES DE INSUMOS */}
            {activeTab === 'insumos' && (
                <div className="space-y-6">
                    <div className="flex justify-between items-center bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
                        <div>
                            <h3 className="font-black text-slate-800 text-base">Insumos y Químicos de Limpieza</h3>
                            <p className="text-xs text-slate-500 mt-0.5">Solicita cloro, bolsas, papel camilla, guantes o desinfectantes a Dirección.</p>
                        </div>
                        <button
                            onClick={() => setModalNuevaSolicitud(true)}
                            className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black uppercase tracking-wider rounded-2xl shadow-md transition-all active:scale-95"
                        >
                            <Plus size={16} /> Pedir Insumos
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {solicitudesInsumos.map(sol => (
                            <div key={sol.id} className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3">
                                <div className="flex justify-between items-start">
                                    <h4 className="font-black text-sm text-slate-800">
                                        {sol.items?.join(', ') || 'Insumos varios'}
                                    </h4>
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
                                {sol.notas && <p className="text-xs text-slate-500">Nota: {sol.notas}</p>}
                                <p className="text-[10px] text-slate-400">Solicitó: {sol.solicitadoPor}</p>
                            </div>
                        ))}
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

            {/* MODAL COMPLETAR TAREA EXTRA CON EVIDENCIA */}
            {modalCompletarTarea && (
                <ModalCompletarTareaExtra
                    tarea={modalCompletarTarea}
                    onClose={() => setModalCompletarTarea(null)}
                    onSuccess={(msg) => {
                        setModalCompletarTarea(null);
                        mostrarToast(msg);
                    }}
                />
            )}

            {/* MODAL NUEVO REPORTE MANTENIMIENTO */}
            {modalNuevoReporte && (
                <ModalNuevoReporteMantenimiento
                    user={user}
                    onClose={() => setModalNuevoReporte(false)}
                    onSuccess={(msg) => {
                        setModalNuevoReporte(false);
                        mostrarToast(msg);
                    }}
                />
            )}

            {/* MODAL NUEVA SOLICITUD INSUMOS */}
            {modalNuevaSolicitud && (
                <ModalNuevaSolicitudInsumos
                    user={user}
                    onClose={() => setModalNuevaSolicitud(false)}
                    onSuccess={(msg) => {
                        setModalNuevaSolicitud(false);
                        mostrarToast(msg);
                    }}
                />
            )}
        </div>
    );
}

// ===================== SUBCOMPONENTES MODALES =====================
function ModalCompletarTareaExtra({ tarea, onClose, onSuccess }) {
    const [nota, setNota] = useState('');
    const [foto, setFoto] = useState(null);
    const [enviando, setEnviando] = useState(false);

    const handleFile = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const res = await subirFotoEvidencia(file, `evidencia_tareas/${tarea.id}`);
            setFoto(res);
        } catch (e) {
            alert('Error al procesar foto');
        }
    };

    const handleEnviar = async () => {
        if (!foto) {
            alert('Por favor anexa la foto de evidencia de la tarea completada.');
            return;
        }
        setEnviando(true);
        try {
            await enviarTareaExtraRevision(tarea.id, {
                notasOperador: nota,
                fotosEvidencia: [foto]
            });
            onSuccess('Tarea enviada a revisión con foto de evidencia.');
        } catch (e) {
            console.error(e);
            alert('Error al enviar tarea');
        } finally {
            setEnviando(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
                <div className="flex justify-between items-center">
                    <h3 className="font-black text-slate-800 text-base">Completar Tarea Extra</h3>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100 text-slate-400"><X size={18} /></button>
                </div>
                <div className="bg-slate-50 p-3 rounded-2xl text-xs space-y-1">
                    <p className="font-bold text-slate-700">{tarea.titulo}</p>
                    <p className="text-slate-500">{tarea.descripcion}</p>
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Foto de Evidencia (Obligatoria):</label>
                    <input type="file" accept="image/*" capture="environment" onChange={handleFile} className="text-xs" />
                    {foto && (
                        <div className="mt-2 w-28 h-20 rounded-xl overflow-hidden border">
                            <img src={foto.dataUrl || foto.url} alt="Evidencia" className="w-full h-full object-cover" />
                        </div>
                    )}
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Notas u Observaciones:</label>
                    <textarea
                        rows={2}
                        value={nota}
                        onChange={(e) => setNota(e.target.value)}
                        placeholder="Ej. 'Quedó desinfectado a fondo, se utilizó desengrasante'..."
                        className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:border-teal-500 outline-none"
                    />
                </div>
                <div className="flex gap-2 justify-end pt-2">
                    <button onClick={onClose} className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl">Cancelar</button>
                    <button
                        onClick={handleEnviar}
                        disabled={enviando || !foto}
                        className="px-5 py-2.5 bg-teal-600 hover:bg-teal-500 text-white text-xs font-black uppercase tracking-wider rounded-xl disabled:opacity-50"
                    >
                        {enviando ? 'Enviando...' : 'Enviar a Revisión'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function ModalNuevoReporteMantenimiento({ user, onClose, onSuccess }) {
    const [ubicacion, setUbicacion] = useState('Cabina Facial');
    const [descripcion, setDescripcion] = useState('');
    const [prioridad, setPrioridad] = useState('media');
    const [foto, setFoto] = useState(null);
    const [guardando, setGuardando] = useState(false);

    const handleFile = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const res = await subirFotoEvidencia(file, 'evidencia_mantenimiento');
        setFoto(res);
    };

    const handleGuardar = async () => {
        if (!descripcion.trim()) return alert('Describe la falla');
        setGuardando(true);
        try {
            await crearReporteMantenimiento({
                ubicacion,
                descripcion,
                prioridad,
                fotosEvidencia: foto ? [foto] : [],
                reportadoPor: user?.displayName || user?.email || 'Personal de Limpieza',
                reportadoPorUid: user?.uid || ''
            });
            onSuccess('Reporte de mantenimiento creado');
        } catch (e) {
            console.error(e);
            alert('Error al crear reporte');
        } finally {
            setGuardando(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
                <div className="flex justify-between items-center">
                    <h3 className="font-black text-slate-800 text-base">Reportar Avería o Mantenimiento</h3>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100 text-slate-400"><X size={18} /></button>
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Área o Equipo:</label>
                    <select
                        value={ubicacion}
                        onChange={(e) => setUbicacion(e.target.value)}
                        className="w-full text-xs p-2.5 rounded-xl border border-slate-200 outline-none"
                    >
                        <option>Cabina Facial</option>
                        <option>Cabina Corporal</option>
                        <option>Cabina Capilar</option>
                        <option>Baños Generales</option>
                        <option>Recepción</option>
                        <option>Sala de Espera</option>
                        <option>Aire Acondicionado</option>
                        <option>Instalación Eléctrica / Plomería</option>
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Descripción del desperfecto:</label>
                    <textarea
                        rows={2}
                        value={descripcion}
                        onChange={(e) => setDescripcion(e.target.value)}
                        placeholder="Ej. Fuga en llave de lavamanos, clima gotea..."
                        className="w-full text-xs p-2.5 rounded-xl border border-slate-200 outline-none"
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Foto de la falla (opcional):</label>
                    <input type="file" accept="image/*" capture="environment" onChange={handleFile} className="text-xs" />
                </div>
                <div className="flex gap-2 justify-end pt-2">
                    <button onClick={onClose} className="px-4 py-2 text-xs font-bold text-slate-500">Cancelar</button>
                    <button
                        onClick={handleGuardar}
                        disabled={guardando}
                        className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black uppercase rounded-xl"
                    >
                        {guardando ? 'Guardando...' : 'Crear Reporte'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function ModalNuevaSolicitudInsumos({ user, onClose, onSuccess }) {
    const [itemsTexto, setItemsTexto] = useState('');
    const [notas, setNotas] = useState('');
    const [guardando, setGuardando] = useState(false);

    const handleGuardar = async () => {
        if (!itemsTexto.trim()) return alert('Indica los insumos');
        setGuardando(true);
        try {
            const items = itemsTexto.split(',').map(s => s.trim()).filter(Boolean);
            await crearSolicitudInsumos({
                items,
                notas,
                solicitadoPor: user?.displayName || user?.email || 'Personal de Limpieza',
                solicitadoPorUid: user?.uid || ''
            });
            onSuccess('Solicitud de insumos enviada');
        } catch (e) {
            console.error(e);
            alert('Error');
        } finally {
            setGuardando(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
                <div className="flex justify-between items-center">
                    <h3 className="font-black text-slate-800 text-base">Solicitar Insumos de Limpieza</h3>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100 text-slate-400"><X size={18} /></button>
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Insumos requeridos (separados por coma):</label>
                    <input
                        type="text"
                        value={itemsTexto}
                        onChange={(e) => setItemsTexto(e.target.value)}
                        placeholder="Ej. Cloro 5L, Toallas interdobladas, Bolsas de basura..."
                        className="w-full text-xs p-2.5 rounded-xl border border-slate-200 outline-none"
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Notas adicionales:</label>
                    <textarea
                        rows={2}
                        value={notas}
                        onChange={(e) => setNotas(e.target.value)}
                        placeholder="Ej. Se terminaron las bolsas del baño de cabina 1..."
                        className="w-full text-xs p-2.5 rounded-xl border border-slate-200 outline-none"
                    />
                </div>
                <div className="flex gap-2 justify-end pt-2">
                    <button onClick={onClose} className="px-4 py-2 text-xs font-bold text-slate-500">Cancelar</button>
                    <button
                        onClick={handleGuardar}
                        disabled={guardando}
                        className="px-5 py-2.5 bg-slate-900 text-white text-xs font-black uppercase rounded-xl"
                    >
                        {guardando ? 'Guardando...' : 'Enviar Pedido'}
                    </button>
                </div>
            </div>
        
            {/* MODAL CONFIGURACIÓN DE FIRMAS DEL REPORTE PDF */}
            <ModalConfigurarFirmasPDF
                isOpen={modalConfigFirmas}
                onClose={() => setModalConfigFirmas(false)}
                onGenerarPDF={ejecutarDescargaPDF}
                tituloReporte="Bitácora Diaria de Aseo Sanitario"
                subtituloReporte={`Fecha: ${selectedDate} • Personal de Intendencia & Supervisión Médica`}
                defaultOperador={user?.displayName || user?.email || 'Personal de Intendencia'}
                defaultSupervisor="Dra. Alondra Frausto"
                mostrarToast={mostrarToast}
            />

        </div>
    );
}